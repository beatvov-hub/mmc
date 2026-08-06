"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const {
  CATEGORIES,
  DIFFICULTIES,
  LOUNGE_PERIODS,
  SOURCE_TYPES,
  SPEAKERS,
  WEEKDAYS
} = require("./lib/constants");
const { normalizeLoungeEntry, parseLoungeDraft } = require("./lib/parser");
const { validateForensics, validateLounge } = require("./lib/validator");
const {
  FileTransaction,
  atomicWriteJson,
  forensicsTargets,
  loungeTargets,
  safePath,
  undoLatest
} = require("./lib/repository");
const { detectPython, runGenerators, validatePythonPath } = require("./lib/python-runner");
const {
  addActivity,
  dashboard: worklineDashboard,
  evaluationSummary: worklineEvaluationSummary,
  loadAll: loadWorkline,
  normalizeArtifact,
  normalizeDecisionLog,
  normalizeDepartment,
  normalizeEmployee,
  normalizeEvaluation,
  normalizeLink,
  normalizeTask,
  validateDecisionLog,
  validateEvaluation,
  validateLink,
  validateTask,
  writeJson: writeWorklineJson
} = require("./lib/workline-store");

const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC_DIR = path.join(__dirname, "public");
const BACKUP_DIR = path.join(__dirname, "backups");
const SETTINGS_RELATIVE = "tools/mmc-cms/settings.json";
const SESSION_TOKEN = crypto.randomBytes(24).toString("hex");
const MAX_BODY_BYTES = 10 * 1024 * 1024;

function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  response.end(body);
}

function sendText(response, status, contentType, body) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": data.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'"
  });
  response.end(data);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("入力が大きすぎます。"), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (error) {
        reject(Object.assign(new Error(`JSONを読み取れません: ${error.message}`), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

async function readSettings() {
  try {
    const settings = JSON.parse(await fsp.readFile(safePath(ROOT, SETTINGS_RELATIVE), "utf8"));
    return settings && typeof settings === "object" ? settings : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function readLoungeLogs() {
  const logs = JSON.parse(await fsp.readFile(safePath(ROOT, "src/data/loungeLogs.json"), "utf8"));
  if (!Array.isArray(logs)) throw new Error("loungeLogs.jsonが配列ではありません。");
  return logs;
}

async function listImages() {
  const relativeDir = "image/ai-forensics";
  const dir = safePath(ROOT, relativeDir);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      path: `${relativeDir}/${entry.name}`,
      previewUrl: `/api/image?name=${encodeURIComponent(entry.name)}`
    }))
    .sort((a, b) => b.name.localeCompare(a.name, "ja"));
}

async function listForensicsRecords() {
  const dir = safePath(ROOT, "src/data/ai-forensics");
  const entries = (await fsp.readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^case-.*\.json$/i.test(entry.name));
  const records = [];
  for (const entry of entries) {
    try {
      const article = JSON.parse(await fsp.readFile(path.join(dir, entry.name), "utf8"));
      records.push({ id: article.id, publishedAt: article.publishedAt, file: entry.name });
    } catch {
      records.push({ id: "", publishedAt: "", file: entry.name, invalid: true });
    }
  }
  return records;
}

async function apiStatus() {
  const [settings, logs, articles, images] = await Promise.all([
    readSettings(),
    readLoungeLogs(),
    listForensicsRecords(),
    listImages()
  ]);
  const python = await detectPython(settings);
  return {
    ok: true,
    token: SESSION_TOKEN,
    root: ROOT,
    python: {
      available: python.available,
      displayPath: python.available ? python.command : "",
      source: python.source
    },
    counts: { lounge: logs.length, forensics: articles.length, images: images.length },
    loungeIds: logs.map((item) => item.id),
    forensicsRecords: articles,
    options: {
      categories: CATEGORIES,
      difficulties: DIFFICULTIES,
      periods: LOUNGE_PERIODS,
      sourceTypes: SOURCE_TYPES,
      speakers: SPEAKERS,
      weekdays: WEEKDAYS
    }
  };
}

async function generateLounge(payload) {
  const entry = normalizeLoungeEntry(payload.entry);
  const validation = validateLounge(entry);
  if (validation.errors.length) return { status: 422, body: { ok: false, ...validation } };
  const logs = await readLoungeLogs();
  const duplicateIndex = logs.findIndex((item) => item.id === entry.id);
  if (duplicateIndex >= 0 && payload.confirmOverwrite !== true) {
    return {
      status: 409,
      body: { ok: false, duplicate: true, errors: [`ID ${entry.id} は既に存在します。上書き確認を有効にしてください。`] }
    };
  }
  if (duplicateIndex >= 0) logs[duplicateIndex] = entry;
  else logs.push(entry);
  logs.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const transaction = new FileTransaction(ROOT, BACKUP_DIR, `ラウンジ ${entry.id}`);
  await transaction.begin(await loungeTargets(ROOT, entry.date));
  try {
    await atomicWriteJson(ROOT, "src/data/loungeLogs.json", logs);
    const python = await detectPython(await readSettings());
    const generatorLogs = await runGenerators(ROOT, python, ["scripts/generate_lounge.py"]);
    const generatedFiles = await transaction.commit();
    await recordGeneratedContent({
      type: "lounge",
      targetId: entry.id,
      title: entry.title,
      ok: true,
      generatedFiles,
      taskId: payload.taskId || null
    });
    return {
      status: 200,
      body: {
        ok: true,
        overwritten: duplicateIndex >= 0,
        generatedFiles,
        logs: generatorLogs,
        warnings: validation.warnings
      }
    };
  } catch (error) {
    await transaction.rollback(error.message);
    await recordGeneratedContent({
      type: "lounge",
      targetId: entry.id,
      title: entry.title,
      ok: false,
      generatedFiles: [],
      taskId: payload.taskId || null,
      error: error.message
    });
    return {
      status: 500,
      body: {
        ok: false,
        errors: ["生成に失敗したため、更新前の状態へ戻しました。", error.message],
        logs: [{ output: [error.stdout, error.stderr].filter(Boolean).join("\n") }]
      }
    };
  }
}

async function generateForensics(payload) {
  const article = payload.article;
  const images = await listImages();
  const validation = validateForensics(article, { availableImages: images.map((item) => item.path) });
  if (validation.errors.length) return { status: 422, body: { ok: false, ...validation } };

  const records = await listForensicsRecords();
  const duplicates = records.filter((item) => item.id === article.id);
  const targetFile = `${article.id}.json`;
  const conflictingFile = duplicates.find((item) => item.file !== targetFile);
  if (conflictingFile) {
    return { status: 409, body: { ok: false, duplicate: true, errors: [`同じIDが別ファイル ${conflictingFile.file} に存在します。手動確認が必要です。`] } };
  }
  const targetExists = fs.existsSync(safePath(ROOT, `src/data/ai-forensics/${targetFile}`));
  if (targetExists && payload.confirmOverwrite !== true) {
    return {
      status: 409,
      body: { ok: false, duplicate: true, errors: [`ID ${article.id} は既に存在します。上書き確認を有効にしてください。`] }
    };
  }

  const transaction = new FileTransaction(ROOT, BACKUP_DIR, `AI鑑識室 ${article.id}`);
  await transaction.begin(await forensicsTargets(ROOT, article.id));
  try {
    await atomicWriteJson(ROOT, `src/data/ai-forensics/${targetFile}`, article);
    const python = await detectPython(await readSettings());
    const generatorLogs = await runGenerators(ROOT, python, [
      "scripts/generate_ai_forensics.py",
      "scripts/generate_lounge.py"
    ]);
    const generatedFiles = await transaction.commit();
    await recordGeneratedContent({
      type: "ai-forensics",
      targetId: article.id,
      title: article.title,
      ok: true,
      generatedFiles,
      taskId: payload.taskId || null
    });
    return {
      status: 200,
      body: {
        ok: true,
        overwritten: targetExists,
        generatedFiles,
        logs: generatorLogs,
        warnings: validation.warnings,
        articleUrl: `/ai-forensics/${article.id}.html`
      }
    };
  } catch (error) {
    await transaction.rollback(error.message);
    await recordGeneratedContent({
      type: "ai-forensics",
      targetId: article.id,
      title: article.title,
      ok: false,
      generatedFiles: [],
      taskId: payload.taskId || null,
      error: error.message
    });
    return {
      status: 500,
      body: {
        ok: false,
        errors: ["生成に失敗したため、更新前の状態へ戻しました。", error.message],
        logs: [{ output: [error.stdout, error.stderr].filter(Boolean).join("\n") }]
      }
    };
  }
}

async function recordGeneratedContent({ type, targetId, title, ok, generatedFiles, taskId, error }) {
  try {
    const artifactType = type === "ai-forensics" || type === "lounge" ? "article" : "other";
    const all = await loadWorkline(ROOT);
    const artifacts = all.artifacts;
    if (ok) {
      const artifact = normalizeArtifact({
        id: `${type}-${targetId}`,
        taskId,
        title,
        description: `${type} generated by MMC Workline`,
        type: artifactType,
        pathOrUrl: generatedFiles?.[0] || ""
      }, artifacts.find((item) => item.id === `${type}-${targetId}`));
      const index = artifacts.findIndex((item) => item.id === artifact.id);
      if (index >= 0) artifacts[index] = artifact;
      else artifacts.unshift(artifact);
      await writeWorklineJson(ROOT, "artifacts", artifacts);
    }
    await addActivity(ROOT, {
      type: ok ? "cms_generate_success" : "cms_generate_failed",
      targetType: type,
      targetId,
      message: ok
        ? `${title || targetId} を生成しました。`
        : `${title || targetId} の生成に失敗しました。${error || ""}`.trim()
    });
    if (taskId) await touchWorklineTask(taskId);
  } catch (activityError) {
    console.warn("Workline activity was not recorded:", activityError.message);
  }
}

async function touchWorklineTask(taskId) {
  const all = await loadWorkline(ROOT);
  const index = all.tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return;
  all.tasks[index].updatedAt = new Date().toISOString();
  await writeWorklineJson(ROOT, "tasks", all.tasks);
}

function worklineCollection(pathname) {
  const match = pathname.match(/^\/api\/workline\/(tasks|links|artifacts|decisionLogs|evaluations|employees|departments)(?:\/([^/]+))?$/);
  return match ? { collection: match[1], id: match[2] ? decodeURIComponent(match[2]) : null } : null;
}

async function handleWorklineApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/workline/dashboard") {
    return sendJson(response, 200, { ok: true, dashboard: await worklineDashboard(ROOT) });
  }
  if (request.method === "GET" && url.pathname === "/api/workline/evaluation-summary") {
    return sendJson(response, 200, { ok: true, summary: await worklineEvaluationSummary(ROOT) });
  }
  if (request.method === "GET" && url.pathname === "/api/workline/all") {
    return sendJson(response, 200, { ok: true, workline: await loadWorkline(ROOT) });
  }
  if (request.method === "GET" && url.pathname === "/api/workline/activities") {
    const all = await loadWorkline(ROOT);
    return sendJson(response, 200, { ok: true, activity: all.activity });
  }
  const taskEvaluationsMatch = url.pathname.match(/^\/api\/workline\/tasks\/([^/]+)\/evaluations$/);
  if (request.method === "GET" && taskEvaluationsMatch) {
    const taskId = decodeURIComponent(taskEvaluationsMatch[1]);
    const all = await loadWorkline(ROOT);
    return sendJson(response, 200, { ok: true, evaluations: all.evaluations.filter((item) => item.taskId === taskId) });
  }

  const route = worklineCollection(url.pathname);
  if (!route) return sendJson(response, 404, { ok: false, errors: ["Workline APIが見つかりません。"] });
  const all = await loadWorkline(ROOT);
  const collectionKey = route.collection === "departments" ? "departments" : route.collection;
  if (request.method === "GET") {
    if (route.id) {
      const item = all[collectionKey].find((entry) => entry.id === route.id);
      if (!item) return sendJson(response, 404, { ok: false, errors: ["対象が見つかりません。"] });
      return sendJson(response, 200, { ok: true, item });
    }
    return sendJson(response, 200, { ok: true, [collectionKey]: all[collectionKey] });
  }
  if (!["POST", "PUT", "DELETE"].includes(request.method)) return sendJson(response, 405, { ok: false, errors: ["未対応の操作です。"] });
  if (!requireToken(request)) return sendJson(response, 403, { ok: false, errors: ["Worklineセッションを確認できません。画面を再読み込みしてください。"] });

  const payload = request.method === "DELETE" ? {} : await readBody(request);
  const items = [...all[collectionKey]];
  const index = route.id ? items.findIndex((item) => item.id === route.id) : -1;
  if (request.method === "DELETE") {
    if (!route.id || index < 0) return sendJson(response, 404, { ok: false, errors: ["削除対象が見つかりません。"] });
    items.splice(index, 1);
    await writeWorklineJson(ROOT, collectionKey, items);
    await addActivity(ROOT, { type: `${collectionKey}_deleted`, targetType: collectionKey, targetId: route.id, message: `${route.id} を削除しました。` });
    return sendJson(response, 200, { ok: true });
  }

  const existing = index >= 0 ? items[index] : null;
  let item;
  let errors = [];
  if (collectionKey === "tasks") {
    item = normalizeTask({ ...payload, id: route.id || payload.id }, existing);
    errors = validateTask(item, { ...all, tasks: items.filter((task) => task.id !== item.id) });
  } else if (collectionKey === "links") {
    item = normalizeLink({ ...payload, id: route.id || payload.id }, existing);
    if (item.taskId && !all.tasks.some((task) => task.id === item.taskId)) errors.push("存在しないタスクIDです。");
    errors.push(...validateLink(item, ROOT, all.settings));
  } else if (collectionKey === "artifacts") {
    item = normalizeArtifact({ ...payload, id: route.id || payload.id }, existing);
    if (!item.title) errors.push("成果物名は必須です。");
    if (!item.pathOrUrl) errors.push("パスまたはURLは必須です。");
  } else if (collectionKey === "decisionLogs") {
    item = normalizeDecisionLog({ ...payload, id: route.id || payload.id }, existing);
    errors = validateDecisionLog(item, all);
  } else if (collectionKey === "evaluations") {
    item = normalizeEvaluation({ ...payload, id: route.id || payload.id }, existing, all);
    errors = validateEvaluation(item, { ...all, evaluations: items.filter((evaluation) => evaluation.id !== item.id) });
  } else if (collectionKey === "departments") {
    item = normalizeDepartment({ ...payload, id: route.id || payload.id }, existing);
    if (!item.name) errors.push("部署名は必須です。");
  } else if (collectionKey === "employees") {
    item = normalizeEmployee({ ...payload, id: route.id || payload.id }, existing);
    if (!item.name) errors.push("社員名は必須です。");
    if (item.departmentId && !all.departments.some((dept) => dept.id === item.departmentId)) errors.push("存在しない部署IDです。");
  }
  if (errors.length) return sendJson(response, 422, { ok: false, errors });
  if (index >= 0) items[index] = item;
  else items.unshift(item);
  await writeWorklineJson(ROOT, collectionKey, items);
  await addActivity(ROOT, {
    type: `${collectionKey}_${index >= 0 ? "updated" : "created"}`,
    targetType: collectionKey,
    targetId: item.id,
    message: `${item.title || item.name || item.label || item.id} を${index >= 0 ? "更新" : "作成"}しました。`
  });
  return sendJson(response, 200, { ok: true, item });
}

function requireToken(request) {
  return request.headers["x-cms-token"] === SESSION_TOKEN;
}

async function handleApi(request, response, url) {
  if (url.pathname.startsWith("/api/workline/")) {
    return handleWorklineApi(request, response, url);
  }
  if (request.method === "GET" && url.pathname === "/api/status") {
    return sendJson(response, 200, await apiStatus());
  }
  if (request.method === "GET" && url.pathname === "/api/images") {
    return sendJson(response, 200, { ok: true, images: await listImages() });
  }
  if (request.method === "GET" && url.pathname === "/api/image") {
    const name = path.basename(url.searchParams.get("name") || "");
    if (!/^[\w.-]+\.(png|jpe?g|webp|gif)$/i.test(name)) return sendJson(response, 400, { ok: false, errors: ["画像名が不正です。"] });
    const file = safePath(ROOT, `image/ai-forensics/${name}`);
    if (!fs.existsSync(file)) return sendJson(response, 404, { ok: false, errors: ["画像が見つかりません。"] });
    const extension = path.extname(name).toLowerCase();
    const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" }[extension];
    return sendText(response, 200, mime, await fsp.readFile(file));
  }
  if (request.method !== "POST") return sendJson(response, 405, { ok: false, errors: ["未対応の操作です。"] });
  if (!requireToken(request)) return sendJson(response, 403, { ok: false, errors: ["CMSセッションを確認できません。画面を再読み込みしてください。"] });

  const payload = await readBody(request);
  if (url.pathname === "/api/lounge/parse") {
    const parsed = parseLoungeDraft(payload.draft);
    return sendJson(response, 200, { ok: true, ...parsed });
  }
  if (url.pathname === "/api/lounge/validate") {
    const validation = validateLounge(payload.entry);
    return sendJson(response, validation.errors.length ? 422 : 200, { ok: !validation.errors.length, ...validation });
  }
  if (url.pathname === "/api/lounge/generate") {
    const result = await generateLounge(payload);
    return sendJson(response, result.status, result.body);
  }
  if (url.pathname === "/api/forensics/parse") {
    try {
      const article = JSON.parse(String(payload.text || ""));
      const images = await listImages();
      const validation = validateForensics(article, { availableImages: images.map((item) => item.path) });
      return sendJson(response, 200, { ok: true, article, ...validation });
    } catch (error) {
      return sendJson(response, 400, { ok: false, errors: [`JSON構文エラー: ${error.message}`] });
    }
  }
  if (url.pathname === "/api/forensics/validate") {
    const images = await listImages();
    const validation = validateForensics(payload.article, { availableImages: images.map((item) => item.path) });
    return sendJson(response, validation.errors.length ? 422 : 200, { ok: !validation.errors.length, ...validation });
  }
  if (url.pathname === "/api/forensics/generate") {
    const result = await generateForensics(payload);
    return sendJson(response, result.status, result.body);
  }
  if (url.pathname === "/api/settings") {
    const pythonPath = String(payload.pythonPath || "").trim();
    const checked = validatePythonPath(pythonPath);
    if (!checked.ok) return sendJson(response, 422, { ok: false, errors: [checked.error] });
    await atomicWriteJson(ROOT, SETTINGS_RELATIVE, { pythonPath });
    const python = await detectPython(await readSettings());
    return sendJson(response, 200, { ok: true, python: { available: python.available, displayPath: python.command, source: python.source } });
  }
  if (url.pathname === "/api/undo") {
    if (payload.confirm !== true) return sendJson(response, 422, { ok: false, errors: ["元に戻す確認が必要です。"] });
    const result = await undoLatest(ROOT, BACKUP_DIR);
    return sendJson(response, result.ok ? 200 : 409, result);
  }
  return sendJson(response, 404, { ok: false, errors: ["APIが見つかりません。"] });
}

async function handleStatic(response, url) {
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = path.resolve(PUBLIC_DIR, requested);
  if (file !== PUBLIC_DIR && !file.startsWith(`${PUBLIC_DIR}${path.sep}`)) return sendText(response, 403, "text/plain; charset=utf-8", "Forbidden");
  if (!fs.existsSync(file) || !(await fsp.stat(file)).isFile()) return sendText(response, 404, "text/plain; charset=utf-8", "Not found");
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  }[path.extname(file).toLowerCase()] || "application/octet-stream";
  sendText(response, 200, mime, await fsp.readFile(file));
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const host = request.headers.host || "127.0.0.1";
      const url = new URL(request.url, `http://${host}`);
      if (url.pathname.startsWith("/api/")) await handleApi(request, response, url);
      else await handleStatic(response, url);
    } catch (error) {
      if (!response.headersSent) sendJson(response, error.status || 500, { ok: false, errors: [error.message || "予期しないエラーが発生しました。"] });
      else response.end();
    }
  });
}

function openLocalBrowser(localUrl) {
  const opener = spawn("cmd.exe", ["/c", "start", "", localUrl], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  opener.unref();
}

function existingCmsIsHealthy(localUrl) {
  return new Promise((resolve) => {
    const request = http.get(`${localUrl}api/status`, { timeout: 2000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          const status = JSON.parse(body);
          resolve(response.statusCode === 200 && status.ok === true);
        } catch {
          resolve(false);
        }
      });
    });
    request.on("timeout", () => { request.destroy(); resolve(false); });
    request.on("error", () => resolve(false));
  });
}

if (require.main === module) {
  const port = Number(process.env.MMC_CMS_PORT || 4310);
  const localUrl = `http://127.0.0.1:${port}/`;
  const server = createServer();
  server.on("error", async (error) => {
    if (error.code === "EADDRINUSE") {
      if (await existingCmsIsHealthy(localUrl)) {
        console.log("MMC Worklineは既に起動しています。ブラウザーで開きます。");
        openLocalBrowser(localUrl);
        process.exitCode = 0;
      } else {
        console.error(`ポート ${port} は別のアプリで使用中です。`);
        process.exitCode = 1;
      }
    } else {
      console.error(error);
      process.exitCode = 1;
    }
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`MMC Workline: ${localUrl}`);
    console.log("終了するには、この画面で Ctrl+C を押してください。");
    if (!process.argv.includes("--no-open") && process.env.MMC_CMS_NO_OPEN !== "1") {
      openLocalBrowser(localUrl);
    }
  });
}

module.exports = { ROOT, createServer, generateForensics, generateLounge };
