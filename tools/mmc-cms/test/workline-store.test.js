"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  addActivity,
  createUnevaluatedEvaluation,
  evaluationSummary,
  loadAll,
  normalizeDecisionLog,
  normalizeEvaluation,
  normalizeLink,
  normalizeTask,
  validateDecisionLog,
  validateEvaluation,
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

test("親案件・子タスクと担当役割を保存できる", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  const parent = normalizeTask({
    id: "monthly-item",
    title: "社員紹介コンテンツ「今月の一枚」試作",
    type: "project",
    visibility: "pending",
    workflowType: "general",
    status: "planned",
    primaryAssigneeId: "kei",
    supportAssigneeIds: ["rei", "nemu"],
    reviewerIds: ["makoto"],
    nextAction: "試作写真4枚で仮レイアウトを作る"
  });
  const child = normalizeTask({
    id: "monthly-item-layout",
    title: "仮レイアウトを作成",
    type: "subtask",
    parentTaskId: "monthly-item",
    primaryAssigneeId: "kei",
    nextAction: "午前中の四枚を並べる"
  });
  assert.deepEqual(validateTask(parent, all), []);
  assert.deepEqual(validateTask(child, { ...all, tasks: [parent] }), []);
  await writeJson(root, "tasks", [parent, child]);
  const saved = await loadAll(root);
  assert.equal(saved.tasks.find((task) => task.id === "monthly-item").type, "project");
  assert.equal(saved.tasks.find((task) => task.id === "monthly-item").primaryAssigneeId, "kei");
  assert.equal(saved.tasks.find((task) => task.id === "monthly-item-layout").parentTaskId, "monthly-item");
});

test("外部案件では外部案件用ステータスを検証する", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  const external = normalizeTask({
    title: "外部PR案件",
    workflowType: "external",
    visibility: "confidential",
    status: "proposal",
    primaryAssigneeId: "shoma",
    external: { projectName: "外部PR案件" }
  });
  assert.deepEqual(validateTask(external, all), []);
  const invalid = normalizeTask({ ...external, status: "publishDecision" });
  assert.ok(validateTask(invalid, all).some((message) => message.includes("業務フロー")));
});

test("決定ログを追記型データとして保存できる", async (context) => {
  const root = await tempRoot(context);
  const task = normalizeTask({ id: "decision-task", title: "決定テスト" });
  await writeJson(root, "tasks", [task]);
  const all = await loadAll(root);
  const decision = normalizeDecisionLog({
    workItemId: "decision-task",
    decidedAt: "2026-08-06",
    decidedBy: "ケイ",
    summary: "まず4名で試作する。",
    reason: "更新負担と見せ方を検証するため。"
  });
  assert.deepEqual(validateDecisionLog(decision, all), []);
  await writeJson(root, "decisionLogs", [decision]);
  const saved = await loadAll(root);
  assert.equal(saved.decisionLogs[0].summary, "まず4名で試作する。");
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

test("完了タスクには未評価の業務振り返りを一度だけ作成する", () => {
  const task = normalizeTask({ id: "completed-task", title: "完了テスト", status: "completed" });
  const evaluation = createUnevaluatedEvaluation(task, []);
  assert.equal(evaluation.taskId, task.id);
  assert.equal(evaluation.evaluationStatus, "unevaluated");
  assert.equal(evaluation.completionLevel, "completed");
  assert.equal(createUnevaluatedEvaluation(task, [evaluation]), null);
});

test("業務振り返りの初期データと保存ができる", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  assert.equal(Array.isArray(all.evaluations), true);
  const task = normalizeTask({ id: "task-a", title: "テストタスク" });
  await writeJson(root, "tasks", [task]);
  const savedAll = await loadAll(root);
  const evaluation = normalizeEvaluation({
    taskId: "task-a",
    actors: [{ type: "codex", role: "primary" }],
    aiWorkLevel: "L2",
    completionLevel: "completed",
    humanRevisionLevel: "minor",
    reworkCount: 1,
    humanWorkMinutes: 20,
    estimatedManualMinutes: 60,
    reusability: "with_changes",
    adoption: "adopted",
    nextImprovement: "最初に完成条件を明記する"
  }, null, savedAll);
  assert.deepEqual(validateEvaluation(evaluation, { ...savedAll, evaluations: [] }), []);
  await writeJson(root, "evaluations", [evaluation]);
  const reloaded = await loadAll(root);
  assert.equal(reloaded.evaluations[0].taskId, "task-a");
  assert.equal(reloaded.evaluations[0].revision, 1);
});

test("業務振り返りの不正なID・列挙値・数値・長文を拒否する", async (context) => {
  const root = await tempRoot(context);
  const all = await loadAll(root);
  const evaluation = normalizeEvaluation({
    taskId: "missing-task",
    status: "scored",
    evaluationType: "bad",
    actors: [{ type: "unknown-ai", employeeId: "ghost", role: "lead" }],
    completionLevel: "done",
    humanRevisionLevel: "huge",
    reworkCount: -1,
    humanWorkMinutes: -5,
    estimatedManualMinutes: -10,
    reusability: "forever",
    adoption: "maybe",
    artifactIds: ["missing-artifact"],
    nextImprovement: "あ".repeat(301)
  }, null, all);
  const errors = validateEvaluation(evaluation, all);
  assert.ok(errors.some((message) => message.includes("タスクID")));
  assert.ok(errors.some((message) => message.includes("振り返り状態")));
  assert.ok(errors.some((message) => message.includes("社員ID")));
  assert.ok(errors.some((message) => message.includes("手戻り回数")));
  assert.ok(errors.some((message) => message.includes("300文字")));
});

test("業務振り返り集計を作成できる", async (context) => {
  const root = await tempRoot(context);
  const task = normalizeTask({ id: "task-summary", title: "集計タスク" });
  await writeJson(root, "tasks", [task]);
  const all = await loadAll(root);
  const evaluation = normalizeEvaluation({
    taskId: "task-summary",
    actors: [{ type: "codex", role: "primary" }],
    status: "evaluated",
    completionLevel: "completed",
    humanRevisionLevel: "major",
    reworkCount: 3,
    humanWorkMinutes: 30,
    estimatedManualMinutes: 90,
    reusability: "direct",
    adoption: "partially_adopted",
    nextImprovement: "UIとデータ処理を別タスクにする"
  }, null, all);
  await writeJson(root, "evaluations", [evaluation]);
  const summary = await evaluationSummary(root);
  assert.equal(summary.evaluatedCount, 1);
  assert.equal(summary.adoptionCount, 1);
  assert.equal(summary.majorRevisionCount, 1);
  assert.equal(summary.reusableArtifactCount, 1);
  assert.equal(summary.estimatedSavedMinutes, 60);
  assert.equal(summary.actorTypeCounts.codex, 1);
  assert.equal(summary.nextImprovements[0].taskId, "task-summary");
});
