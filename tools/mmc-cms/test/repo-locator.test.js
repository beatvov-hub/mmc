"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { findMmcRepoRoot, isMmcRepoRoot } = require("../lib/repo-locator");

test("実行ファイルの上位階層からMMCリポジトリを検出する", async (context) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mmc-workline-root-"));
  context.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.mkdir(path.join(root, "src", "data"), { recursive: true });
  await fsp.mkdir(path.join(root, "scripts"), { recursive: true });
  await fsp.mkdir(path.join(root, "tools", "mmc-cms", "dist"), { recursive: true });
  await fsp.writeFile(path.join(root, "src", "data", "loungeLogs.json"), "[]\n", "utf8");
  await fsp.writeFile(path.join(root, "scripts", "generate_lounge.py"), "", "utf8");
  await fsp.writeFile(path.join(root, "scripts", "generate_ai_forensics.py"), "", "utf8");
  const start = path.join(root, "tools", "mmc-cms", "dist");
  assert.equal(isMmcRepoRoot(root), true);
  assert.equal(findMmcRepoRoot([start]), root);
});

test("必要な既存データがないフォルダーはMMCリポジトリとして扱わない", async (context) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mmc-workline-invalid-"));
  context.after(() => fsp.rm(root, { recursive: true, force: true }));
  assert.equal(isMmcRepoRoot(root), false);
  assert.equal(findMmcRepoRoot([root]), "");
});
