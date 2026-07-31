"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  addActivity,
  loadAll,
  normalizeLink,
  normalizeTask,
  validateLink,
  validateTask,
  writeJson
} = require("../lib/workline-store");

async function tempRoot(context) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mmc-workline-test-"));
  context.after(() => fsp.rm(root, { recursive: true, force: true }));
  return root;
}

test("Worklineの初期データを作成できる", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  assert.equal(Array.isArray(all.tasks), true);
  assert.ok(all.employees.some((item) => item.id === "hono"));
  assert.ok(all.departments.some((item) => item.id === "game-production"));
});

test("有効なタスクを保存できる", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  const task = normalizeTask({
    title: "ラウンジ更新",
    description: "朝の原稿を反映する",
    departmentId: "public-relations",
    employeeIds: ["kei"],
    status: "waiting_codex",
    priority: "normal",
    progress: 20
  });
  assert.deepEqual(validateTask(task, all), []);
  await writeJson(root, "tasks", [task]);
  const saved = await loadAll(root);
  assert.equal(saved.tasks[0].title, "ラウンジ更新");
});

test("不正なステータスと進捗率を拒否する", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  const task = normalizeTask({ title: "不正タスク", status: "doing", priority: "normal", progress: 120 });
  const errors = validateTask(task, all);
  assert.ok(errors.some((message) => message.includes("ステータス")));
  assert.ok(errors.some((message) => message.includes("進捗率")));
});

test("存在しない社員・部署IDを拒否する", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  const task = normalizeTask({ title: "確認", departmentId: "missing", employeeIds: ["ghost"] });
  const errors = validateTask(task, all);
  assert.ok(errors.some((message) => message.includes("部署")));
  assert.ok(errors.some((message) => message.includes("社員")));
});

test("親子タスクの循環参照を拒否する", async (context) => {
  const root = await tempRoot(context);
  const parent = normalizeTask({ id: "parent", title: "親" });
  const child = normalizeTask({ id: "child", title: "子", parentTaskId: "parent" });
  const all = { ...(await loadAll(root)), tasks: [parent, child] };
  const editedParent = { ...parent, parentTaskId: "child" };
  const errors = validateTask(editedParent, all);
  assert.ok(errors.some((message) => message.includes("循環")));
});

test("URLはhttp/httpsだけ許可する", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  const good = normalizeLink({ type: "web", label: "公式", value: "https://mainichi-miru.com/" });
  const bad = normalizeLink({ type: "web", label: "危険", value: "javascript:alert(1)" });
  assert.deepEqual(validateLink(good, root, all.settings), []);
  assert.ok(validateLink(bad, root, all.settings).some((message) => message.includes("http")));
});

test("リポジトリ外パスを拒否する", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  const link = normalizeLink({ type: "file", label: "外部", value: "..\\outside.txt" });
  assert.ok(validateLink(link, root, all.settings).some((message) => message.includes("リポジトリ")));
});

test("活動履歴は設定上限で切り詰める", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  await writeJson(root, "settings", { ...all.settings, activityLimit: 2 });
  await addActivity(root, { message: "1" });
  await addActivity(root, { message: "2" });
  await addActivity(root, { message: "3" });
  const saved = await loadAll(root);
  assert.equal(saved.activity.length, 2);
  assert.equal(saved.activity[0].message, "3");
});
