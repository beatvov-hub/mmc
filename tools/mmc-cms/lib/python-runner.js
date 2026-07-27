"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

function candidateWorks(candidate) {
  try {
    const result = spawnSync(candidate.command, [...candidate.prefix, "--version"], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
      shell: false,
      env: { ...process.env, PYTHONUTF8: "1" }
    });
    return result.status === 0 && /Python\s+3\./i.test(`${result.stdout || ""}${result.stderr || ""}`);
  } catch {
    return false;
  }
}

async function codexPythonCandidates() {
  const candidates = [];
  const base = path.join(os.homedir(), ".cache", "codex-runtimes");
  if (!fs.existsSync(base)) return candidates;
  const runtimes = await fsp.readdir(base, { withFileTypes: true });
  for (const runtime of runtimes) {
    if (!runtime.isDirectory()) continue;
    const direct = path.join(base, runtime.name, "dependencies", "python", "python.exe");
    if (fs.existsSync(direct)) candidates.push(direct);
  }
  return candidates;
}

async function detectPython(settings = {}) {
  const candidates = [];
  if (settings.pythonPath) candidates.push({ command: settings.pythonPath, prefix: [], source: "設定" });
  candidates.push(
    { command: "python", prefix: [], source: "PATH" },
    { command: "python3", prefix: [], source: "PATH" },
    { command: "py", prefix: ["-3"], source: "Python Launcher" }
  );
  for (const candidate of await codexPythonCandidates()) {
    candidates.push({ command: candidate, prefix: [], source: "Codex同梱Python" });
  }
  for (const candidate of candidates) {
    if (candidateWorks(candidate)) return { available: true, ...candidate };
  }
  return { available: false, command: "", prefix: [], source: "" };
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      shell: false,
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }
    });
    let stdout = "";
    let stderr = "";
    const collect = (target, chunk) => `${target}${chunk.toString("utf8")}`.slice(-1_000_000);
    child.stdout.on("data", (chunk) => { stdout = collect(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = collect(stderr, chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else {
        const error = new Error(`生成スクリプトが終了コード ${code} で停止しました。`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

async function runGenerators(root, python, scripts) {
  if (!python.available) throw new Error("Python 3を検出できません。設定画面でPythonの場所を指定してください。");
  const logs = [];
  for (const script of scripts) {
    const result = await runProcess(python.command, [...python.prefix, path.join(root, script)], root);
    logs.push({
      script,
      output: [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n")
    });
  }
  return logs;
}

function validatePythonPath(candidatePath) {
  if (!candidatePath) return { ok: true };
  if (!path.isAbsolute(candidatePath)) return { ok: false, error: "Pythonの場所は絶対パスで入力してください。" };
  if (!/^python(?:3(?:\.\d+)?)?\.exe$/i.test(path.basename(candidatePath))) {
    return { ok: false, error: "python.exe だけを指定できます。" };
  }
  if (!fs.existsSync(candidatePath)) return { ok: false, error: "指定したPythonが見つかりません。" };
  if (!candidateWorks({ command: candidatePath, prefix: [] })) return { ok: false, error: "指定したファイルをPython 3として実行できません。" };
  return { ok: true };
}

module.exports = { detectPython, runGenerators, validatePythonPath };
