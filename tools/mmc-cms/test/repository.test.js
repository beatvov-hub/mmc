"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  FileTransaction,
  atomicWriteJson,
  safePath,
  undoLatest
} = require("../lib/repository");

test("JSONを一時ファイルで検証して置き換え、前回更新を復元できる", async (context) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mmc-cms-test-"));
  context.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.mkdir(path.join(root, "data"), { recursive: true });
  await fsp.writeFile(path.join(root, "data", "sample.json"), "{\"before\":true}\n", "utf8");
  const backup = path.join(root, "backups");
  const transaction = new FileTransaction(root, backup, "テスト更新");
  await transaction.begin(["data/sample.json", "data/generated.html"]);
  await atomicWriteJson(root, "data/sample.json", { after: true });
  await fsp.writeFile(path.join(root, "data", "generated.html"), "generated", "utf8");
  const changed = await transaction.commit();
  assert.deepEqual(changed, ["data/generated.html", "data/sample.json"]);
  assert.deepEqual(JSON.parse(await fsp.readFile(path.join(root, "data", "sample.json"), "utf8")), { after: true });

  const undone = await undoLatest(root, backup);
  assert.equal(undone.ok, true);
  assert.equal(await fsp.readFile(path.join(root, "data", "sample.json"), "utf8"), "{\"before\":true}\n");
  assert.equal(fs.existsSync(path.join(root, "data", "generated.html")), false);
});

test("更新後に手動変更されたファイルは復元で上書きしない", async (context) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mmc-cms-conflict-"));
  context.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.writeFile(path.join(root, "sample.json"), "{}\n", "utf8");
  const backup = path.join(root, "backups");
  const transaction = new FileTransaction(root, backup, "競合テスト");
  await transaction.begin(["sample.json"]);
  await atomicWriteJson(root, "sample.json", { cms: true });
  await transaction.commit();
  await fsp.writeFile(path.join(root, "sample.json"), "{\"user\":true}\n", "utf8");
  const undone = await undoLatest(root, backup);
  assert.equal(undone.ok, false);
  assert.deepEqual(undone.conflicts, ["sample.json"]);
  assert.equal(await fsp.readFile(path.join(root, "sample.json"), "utf8"), "{\"user\":true}\n");
});

test("リポジトリ外へのパスを拒否する", () => {
  assert.throws(() => safePath("C:\\safe\\repo", "..\\outside.json"), /リポジトリ外/);
});
