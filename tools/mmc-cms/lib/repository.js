"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

function safePath(root, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error("リポジトリ内の相対パスだけを使用できます。");
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, normalized);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("リポジトリ外のパスは使用できません。");
  }
  return resolved;
}

async function hashFile(filePath) {
  try {
    const data = await fsp.readFile(filePath);
    return crypto.createHash("sha256").update(data).digest("hex");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function atomicWriteJson(root, relativePath, value) {
  const target = safePath(root, relativePath);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const unique = crypto.randomUUID();
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.cms-temp-${unique}`);
  const old = path.join(path.dirname(target), `.${path.basename(target)}.cms-old-${unique}`);
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  await fsp.writeFile(temp, serialized, { encoding: "utf8", flag: "wx" });
  JSON.parse(await fsp.readFile(temp, "utf8"));
  let movedOld = false;
  try {
    if (fs.existsSync(target)) {
      await fsp.rename(target, old);
      movedOld = true;
    }
    await fsp.rename(temp, target);
    if (movedOld) await fsp.unlink(old);
  } catch (error) {
    await fsp.rm(temp, { force: true });
    if (movedOld && !fs.existsSync(target) && fs.existsSync(old)) await fsp.rename(old, target);
    throw error;
  }
}

class FileTransaction {
  constructor(root, backupBase, operation) {
    this.root = path.resolve(root);
    this.backupBase = path.resolve(backupBase);
    this.operation = operation;
    this.dir = path.join(this.backupBase, `${timestamp()}-${crypto.randomUUID().slice(0, 8)}`);
    this.manifest = {
      version: 1,
      operation,
      createdAt: new Date().toISOString(),
      status: "preparing",
      files: []
    };
  }

  async begin(relativePaths) {
    await fsp.mkdir(path.join(this.dir, "files"), { recursive: true });
    const uniquePaths = [...new Set(relativePaths.map((item) => item.replaceAll("\\", "/")))].sort();
    for (const relativePath of uniquePaths) {
      const source = safePath(this.root, relativePath);
      const existed = fs.existsSync(source) && (await fsp.stat(source)).isFile();
      const entry = { path: relativePath, existed, beforeHash: existed ? await hashFile(source) : null };
      if (existed) {
        const backup = safePath(path.join(this.dir, "files"), relativePath);
        await fsp.mkdir(path.dirname(backup), { recursive: true });
        await fsp.copyFile(source, backup);
      }
      this.manifest.files.push(entry);
    }
    this.manifest.status = "active";
    await this.writeManifest();
    return this;
  }

  async writeManifest() {
    await fsp.mkdir(this.dir, { recursive: true });
    await fsp.writeFile(path.join(this.dir, "manifest.json"), `${JSON.stringify(this.manifest, null, 2)}\n`, "utf8");
  }

  async rollback(reason = "") {
    for (const entry of this.manifest.files) {
      const target = safePath(this.root, entry.path);
      if (entry.existed) {
        const backup = safePath(path.join(this.dir, "files"), entry.path);
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.copyFile(backup, target);
      } else {
        await fsp.rm(target, { force: true });
      }
    }
    this.manifest.status = "rolled-back";
    this.manifest.rolledBackAt = new Date().toISOString();
    this.manifest.reason = reason;
    await this.writeManifest();
  }

  async commit() {
    const changed = [];
    for (const entry of this.manifest.files) {
      const target = safePath(this.root, entry.path);
      entry.afterHash = await hashFile(target);
      entry.existsAfter = entry.afterHash !== null;
      if (entry.beforeHash !== entry.afterHash) changed.push(entry.path);
    }
    this.manifest.status = "committed";
    this.manifest.committedAt = new Date().toISOString();
    this.manifest.changedFiles = changed;
    await this.writeManifest();
    return changed;
  }
}

async function listFiles(root, relativeDir, predicate = () => true) {
  const dir = safePath(root, relativeDir);
  if (!fs.existsSync(dir)) return [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => `${relativeDir.replaceAll("\\", "/").replace(/\/$/, "")}/${entry.name}`);
}

async function loungeTargets(root, expectedDate = "") {
  const files = [
    "src/data/loungeLogs.json",
    "lounge.html",
    "index.html",
    "mainichi-miru-sitemap.xml",
    ...(await listFiles(root, "lounge-archive", (name) => name.endsWith(".html")))
  ];
  if (expectedDate) files.push(`lounge-archive/${expectedDate}.html`);
  return [...new Set(files)];
}

async function forensicsTargets(root, articleId) {
  return [...new Set([
    `src/data/ai-forensics/${articleId}.json`,
    ...(await listFiles(root, "ai-forensics", (name) => name.endsWith(".html"))),
    `ai-forensics/${articleId}.html`,
    ...(await loungeTargets(root))
  ])];
}

async function findLatestUndoable(backupBase) {
  if (!fs.existsSync(backupBase)) return null;
  const directories = (await fsp.readdir(backupBase, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const directory of directories) {
    const manifestPath = path.join(backupBase, directory, "manifest.json");
    try {
      const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
      if (manifest.status === "committed") return { directory: path.join(backupBase, directory), manifest, manifestPath };
    } catch {
      // 壊れたバックアップは自動復元対象にしない。
    }
  }
  return null;
}

async function undoLatest(root, backupBase) {
  const latest = await findLatestUndoable(backupBase);
  if (!latest) return { ok: false, errors: ["元に戻せる更新がありません。"] };
  const conflicts = [];
  for (const entry of latest.manifest.files) {
    const currentHash = await hashFile(safePath(root, entry.path));
    if (currentHash !== (entry.afterHash ?? null)) conflicts.push(entry.path);
  }
  if (conflicts.length) {
    return {
      ok: false,
      errors: ["更新後に別の変更が加わっているため、安全のため元に戻せません。"],
      conflicts
    };
  }
  const restored = [];
  for (const entry of latest.manifest.files) {
    const target = safePath(root, entry.path);
    if (entry.existed) {
      const backup = safePath(path.join(latest.directory, "files"), entry.path);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.copyFile(backup, target);
    } else {
      await fsp.rm(target, { force: true });
    }
    restored.push(entry.path);
  }
  latest.manifest.status = "undone";
  latest.manifest.undoneAt = new Date().toISOString();
  await fsp.writeFile(latest.manifestPath, `${JSON.stringify(latest.manifest, null, 2)}\n`, "utf8");
  return { ok: true, operation: latest.manifest.operation, restoredFiles: restored };
}

module.exports = {
  FileTransaction,
  atomicWriteJson,
  forensicsTargets,
  hashFile,
  loungeTargets,
  safePath,
  undoLatest
};
