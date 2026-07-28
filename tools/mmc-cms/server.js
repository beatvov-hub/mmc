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

function requireToken(request) {
  return request.headers["x-cms-token"] === SESSION_TOKEN;
}

async function handleApi(request, response, url) {
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
        console.log("MMCローカルCMSは既に起動しています。ブラウザーで開きます。");
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
    console.log(`MMCローカルCMS: ${localUrl}`);
    console.log("終了するには、この画面で Ctrl+C を押してください。");
    if (!process.argv.includes("--no-open") && process.env.MMC_CMS_NO_OPEN !== "1") {
      openLocalBrowser(localUrl);
    }
  });
}

module.exports = { ROOT, createServer, generateForensics, generateLounge };
