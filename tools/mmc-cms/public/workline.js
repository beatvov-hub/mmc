"use strict";

const WORKLINE_STATUS = [
  ["idea", "構想中"],
  ["planned", "実施予定"],
  ["inProgress", "進行中"],
  ["review", "確認待ち"],
  ["publishDecision", "公開判断"],
  ["completed", "完了"],
  ["canceled", "中止"],
  ["inquiry", "相談受領"],
  ["proposal", "提案中"],
  ["waitingResponse", "返答待ち"],
  ["accepted", "受注"],
  ["production", "制作中"],
  ["clientReview", "先方確認中"],
  ["delivered", "納品済み"],
  ["invoiced", "請求済み"],
  ["paid", "入金済み"],
  ["declined", "不成立"]
];
const GENERAL_STATUS = WORKLINE_STATUS.filter(([id]) => ["idea", "planned", "inProgress", "review", "publishDecision", "completed", "canceled"].includes(id));
const EXTERNAL_STATUS = WORKLINE_STATUS.filter(([id]) => ["inquiry", "proposal", "waitingResponse", "accepted", "production", "clientReview", "delivered", "invoiced", "paid", "declined", "canceled"].includes(id));
const TASK_TYPE = [["project", "親案件"], ["task", "作業"], ["subtask", "小タスク"]];
const WORKFLOW_TYPE = [["general", "通常企画"], ["external", "外部案件"]];
const VISIBILITY = [["publicCandidate", "公開候補"], ["internal", "社内のみ"], ["confidential", "社外秘"], ["pending", "公開判断待ち"]];
const WORKLINE_PRIORITY = [["low", "低"], ["normal", "通常"], ["high", "高"], ["urgent", "至急"]];
const LINK_TYPES = ["chatgpt", "github", "codex", "web", "file", "folder", "note", "other"];
const ARTIFACT_TYPES = ["article", "image", "document", "code", "website", "data", "other"];
const EVALUATION_STATUS = [["unevaluated", "未評価"], ["later", "後で評価"], ["evaluated", "評価済み"], ["notApplicable", "評価対象外"]];
const EVALUATION_TYPE = [["final", "最終"], ["interim", "途中"], ["post_release", "公開後"]];
const ACTOR_TYPES = [["human", "人間"], ["ai_employee", "AI社員"], ["chatgpt_task", "ChatGPTタスク"], ["codex", "Codex"], ["internal_app", "自作アプリ"], ["external_contractor", "外部委託"], ["other", "その他"]];
const ACTOR_ROLES = [["primary", "主担当"], ["support", "補助"], ["review", "確認役"]];
const AI_WORK_LEVEL = [["", "未設定"], ["L0", "相談・壁打ちのみ"], ["L1", "調査・分類・提案"], ["L2", "下書き・成果物作成"], ["L3", "人間の承認後に実行"], ["L4", "条件内で自動実行"]];
const COMPLETION_LEVEL = [["completed", "完了"], ["partial", "一部完了"], ["incomplete", "未完了"], ["cancelled", "中止"]];
const HUMAN_REVISION_LEVEL = [["none", "なし"], ["minor", "軽微"], ["moderate", "中程度"], ["major", "大幅"], ["rebuild", "ほぼ作り直し"]];
const REUSABILITY = [["direct", "そのまま再利用"], ["with_changes", "一部修正で再利用"], ["one_time", "今回限り"], ["not_reusable", "再利用できない"], ["unknown", "未判断"]];
const ADOPTION = [["adopted", "採用"], ["partially_adopted", "一部採用"], ["pending", "保留"], ["rejected", "不採用"]];

let workline = { tasks: [], links: [], artifacts: [], evaluations: [], employees: [], departments: [], activity: [], settings: {} };
let drawer = { type: "", item: null };

const q = (selector, root = document) => root.querySelector(selector);
const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const labelOf = (pairs, value) => pairs.find(([id]) => id === value)?.[1] || value || "";
const today = () => new Date().toISOString().slice(0, 10);

async function worklineRequest(endpoint, options = {}) {
  const headers = options.body === undefined ? {} : { "Content-Type": "application/json", "X-CMS-Token": window.worklineApiToken || "" };
  const response = await fetch(endpoint, { method: options.method || (options.body === undefined ? "GET" : "POST"), headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const data = await response.json().catch(() => ({ ok: false, errors: ["Worklineの応答を読み取れませんでした。"] }));
  data._status = response.status;
  return data;
}

async function loadWorkline() {
  const result = await worklineRequest("/api/workline/all");
  if (result.ok) workline = result.workline;
  renderAllWorkline();
}

function renderAllWorkline() {
  renderTaskSelects();
  renderDashboard();
  renderEvaluationDashboard();
  renderBoard();
  renderTimeline();
  renderArtifacts();
  renderPeople();
  renderArchive();
}

function renderTaskSelects() {
  ["#lounge-task-link", "#forensics-task-link"].forEach((selector) => {
    const select = q(selector);
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">関連タスクなし</option>${workline.tasks.map((task) => `<option value="${esc(task.id)}">${esc(task.title)}</option>`).join("")}`;
    select.value = current;
  });
  fillFilter("#filter-employee", [["", "すべて"], ...workline.employees.map((item) => [item.id, item.name])]);
  fillFilter("#filter-department", [["", "すべて"], ...workline.departments.map((item) => [item.id, item.name])]);
  fillFilter("#filter-status", [["", "すべて"], ...WORKLINE_STATUS]);
  fillFilter("#filter-type", [["", "すべて"], ...TASK_TYPE]);
  fillFilter("#filter-workflow", [["", "すべて"], ...WORKFLOW_TYPE]);
  fillFilter("#filter-visibility", [["", "すべて"], ...VISIBILITY]);
  fillFilter("#evaluation-filter-status", [["", "すべて"], ...EVALUATION_STATUS]);
  fillFilter("#evaluation-filter-actor", [["", "すべて"], ...ACTOR_TYPES]);
  fillFilter("#evaluation-filter-adoption", [["", "すべて"], ...ADOPTION]);
  fillFilter("#evaluation-filter-reusability", [["", "すべて"], ...REUSABILITY]);
}

function fillFilter(selector, options) {
  const element = q(selector);
  if (!element) return;
  const current = element.value;
  element.innerHTML = options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("");
  element.value = current;
}

function employeeName(id) {
  return workline.employees.find((item) => item.id === id)?.name || id || "";
}

function departmentName(id) {
  return workline.departments.find((item) => item.id === id)?.name || id || "";
}

function taskTitle(id) {
  return workline.tasks.find((item) => item.id === id)?.title || id || "";
}

function latestEvaluation(taskId) {
  return [...(workline.evaluations || [])]
    .filter((item) => item.taskId === taskId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0] || null;
}

function evaluationStatus(taskId) {
  return latestEvaluation(taskId)?.evaluationStatus || latestEvaluation(taskId)?.status || "unevaluated";
}

function isAiEvaluation(evaluation) {
  return (evaluation?.actors || []).some((actor) => ["ai_employee", "chatgpt_task", "codex", "internal_app"].includes(actor.type));
}

function needsImprovement(evaluation) {
  if (!evaluation) return false;
  if (evaluation.needsImprovement) return true;
  return ["major", "rebuild"].includes(evaluation.humanRevisionLevel) ||
    evaluation.adoption === "rejected" ||
    Number(evaluation.reworkCount || 0) >= 3 ||
    ["incomplete", "cancelled"].includes(evaluation.completionLevel);
}

function statusOptionsForWorkflow(workflowType) {
  return workflowType === "external" ? EXTERNAL_STATUS : GENERAL_STATUS;
}

function normalizeTaskForUi(task) {
  const employeeIds = task.employeeIds || [];
  const primaryAssigneeId = task.primaryAssigneeId || employeeIds[0] || "";
  return {
    type: task.parentTaskId ? "subtask" : "task",
    workflowType: "general",
    visibility: "internal",
    nextAction: "",
    primaryAssigneeId,
    supportAssigneeIds: employeeIds.filter((id) => id !== primaryAssigneeId),
    reviewerIds: [],
    external: {},
    ...task
  };
}

async function renderDashboard() {
  const result = await worklineRequest("/api/workline/dashboard");
  const data = result.dashboard || { counts: {}, dueSoon: [], recentActivity: [], recentArtifacts: [], byEmployee: [] };
  q("#dashboard-metrics").innerHTML = [
    ["進行中", data.counts.inProgress || 0],
    ["確認待ち", data.counts.review || 0],
    ["外部確認中", data.counts.externalWaiting || 0],
    ["今月完了", data.counts.completedThisMonth || 0]
  ].map(([label, value]) => `<div class="metric-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
  q("#dashboard-due").innerHTML = compactTasks(data.dueSoon, "期限が近いタスクはありません。");
  q("#dashboard-activity").innerHTML = data.recentActivity?.length
    ? data.recentActivity.map((item) => `<article class="mini-card" ${item.targetType === "tasks" && item.targetId ? `data-open-task="${esc(item.targetId)}"` : ""}><strong>${esc(item.message)}</strong><span>${esc(formatDateTime(item.createdAt))}</span></article>`).join("")
    : `<p class="muted">まだ活動履歴はありません。</p>`;
  q("#dashboard-employees").innerHTML = data.byEmployee?.length
    ? data.byEmployee.map((item) => `<span class="workline-chip">${esc(item.name)} ${item.count}件</span>`).join("")
    : `<p class="muted">担当タスクはまだありません。</p>`;
  q("#dashboard-artifacts").innerHTML = data.recentArtifacts?.length
    ? data.recentArtifacts.map((item) => `<article class="mini-card" ${item.taskId ? `data-open-task="${esc(item.taskId)}"` : ""}><strong>${esc(item.title)}</strong><span>${esc(item.type)} / ${esc(item.pathOrUrl)}</span></article>`).join("")
    : `<p class="muted">生成履歴はこれから記録されます。</p>`;
}

async function renderEvaluationDashboard() {
  const metrics = q("#evaluation-metrics");
  const list = q("#evaluation-list");
  const memos = q("#evaluation-improvements");
  if (!metrics || !list || !memos) return;
  const result = await worklineRequest("/api/workline/evaluation-summary");
  const summary = result.summary || {};
  metrics.innerHTML = [
    ["AI利用", summary.aiUsedCount || 0],
    ["評価済み", summary.evaluatedCount || 0],
    ["評価済み率", `${summary.evaluatedRate || 0}%`],
    ["要改善", summary.needsImprovementCount || 0],
    ["人間作業", `${summary.humanWorkMinutes || 0}分`],
    ["推定削減", `${summary.estimatedSavedMinutes || 0}分`],
    ["手戻り", `${summary.reworkCount || 0}回`]
  ].map(([label, value]) => `<div class="metric-card compact-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");

  const status = q("#evaluation-filter-status")?.value || "";
  const actorType = q("#evaluation-filter-actor")?.value || "";
  const adoption = q("#evaluation-filter-adoption")?.value || "";
  const reusability = q("#evaluation-filter-reusability")?.value || "";
  const evaluations = (workline.evaluations || []).filter((item) =>
    (!status || item.status === status) &&
    (!actorType || (item.actors || []).some((actor) => actor.type === actorType)) &&
    (!adoption || item.adoption === adoption) &&
    (!reusability || item.reusability === reusability)
  );
  list.innerHTML = evaluations.length
    ? evaluations
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      .slice(0, 30)
      .map(evaluationRow)
      .join("")
    : `<p class="muted">条件に合う業務振り返りはありません。</p>`;
  memos.innerHTML = summary.nextImprovements?.length
    ? summary.nextImprovements.map((item) => `<article class="mini-card" data-open-task="${esc(item.taskId)}"><strong>${esc(item.nextImprovement)}</strong><span>${esc(item.taskTitle)} / ${esc(formatDateTime(item.updatedAt))}</span></article>`).join("")
    : `<p class="muted">次回変えることは、振り返りから少しずつ集まります。</p>`;
}

function evaluationRow(item) {
  const human = item.humanMinutes ?? item.humanWorkMinutes;
  const estimated = item.estimatedMinutesWithoutAI ?? item.estimatedManualMinutes;
  const saved = human !== undefined && estimated !== undefined
    ? `${Number(estimated) - Number(human)}分`
    : "未計算";
  const badges = [
    isAiEvaluation(item) ? "AI利用" : "",
    needsImprovement(item) ? "要改善" : ""
  ].filter(Boolean).map((label) => `<span class="workline-chip">${esc(label)}</span>`).join("");
  return `<article class="table-row evaluation-row">
    <div><strong>${esc(taskTitle(item.taskId))}</strong><span>${esc(labelOf(EVALUATION_STATUS, item.evaluationStatus || item.status))} / ${esc(labelOf(EVALUATION_TYPE, item.evaluationType))} #${esc(item.revision)}</span></div>
    <div>${esc(labelOf(COMPLETION_LEVEL, item.completionLevel))}</div>
    <div>${esc(labelOf(HUMAN_REVISION_LEVEL, item.humanRevisionLevel))}</div>
    <div>${esc(labelOf(ADOPTION, item.adoption))} / 推定 ${esc(saved)}<span>${esc(item.nextImprovement || "")}</span></div>
    <div>${badges}<button class="button tiny" data-open-evaluation="${esc(item.id)}" type="button">編集</button></div>
  </article>`;
}

function compactTasks(tasks, emptyText) {
  return tasks?.length
    ? tasks.map((task) => `<article class="mini-card ${isOverdue(task) ? "is-overdue" : ""}" data-open-task="${esc(task.id)}"><strong>${esc(task.title)}</strong><span>${esc(labelOf(WORKLINE_STATUS, task.status))} / ${esc(task.endDate || "期限なし")}</span></article>`).join("")
    : `<p class="muted">${esc(emptyText)}</p>`;
}

function renderBoard() {
  const employee = q("#filter-employee")?.value || "";
  const department = q("#filter-department")?.value || "";
  const status = q("#filter-status")?.value || "";
  const type = q("#filter-type")?.value || "";
  const workflow = q("#filter-workflow")?.value || "";
  const visibility = q("#filter-visibility")?.value || "";
  const tag = (q("#filter-tag")?.value || "").trim();
  const terminalStatuses = ["completed", "canceled", "paid", "declined"];
  const tasks = workline.tasks.map(normalizeTaskForUi).filter((task) =>
    !terminalStatuses.includes(task.status) &&
    (!employee || [task.primaryAssigneeId, ...(task.supportAssigneeIds || []), ...(task.reviewerIds || [])].includes(employee)) &&
    (!department || task.departmentId === department) &&
    (!status || task.status === status) &&
    (!type || task.type === type) &&
    (!workflow || task.workflowType === workflow) &&
    (!visibility || task.visibility === visibility) &&
    (!tag || task.tags?.some((item) => item.includes(tag)))
  );
  const columns = [
    { label: "未着手", hint: "構想・準備", statuses: ["idea", "planned", "inquiry", "proposal"] },
    { label: "進行中", hint: "制作・実行", statuses: ["inProgress", "accepted", "production"] },
    { label: "確認待ち", hint: "レビュー・返答", statuses: ["review", "clientReview", "waitingResponse"] },
    { label: "判断・公開", hint: "最終の意思決定", statuses: ["publishDecision"] },
    { label: "完了間近", hint: "納品・請求", statuses: ["delivered", "invoiced"] }
  ];
  const count = q("#board-result-count");
  if (count) count.textContent = `${tasks.length}件の進行項目`;
  q("#kanban-board").innerHTML = tasks.length
    ? `<div class="kanban-grid">${columns.map((column) => {
      const items = tasks.filter((task) => column.statuses.includes(task.status));
      return `<section class="kanban-column"><header><div><h3>${esc(column.label)}</h3><p>${esc(column.hint)}</p></div><span>${items.length}</span></header><div class="kanban-cards">${items.length ? items.map(taskCard).join("") : `<p class="kanban-empty">該当する項目はありません</p>`}</div></section>`;
    }).join("")}</div>`
    : `<div class="board-empty"><strong>条件に合う進行項目はありません。</strong><span>絞り込みを変えるか、新しいタスクを追加してください。</span></div>`;
}

function taskCard(task) {
  const primary = employeeName(task.primaryAssigneeId) || "未設定";
  const evaluation = latestEvaluation(task.id);
  const evaluationState = evaluationStatus(task.id);
  const badges = [
    isAiEvaluation(evaluation) ? "AI利用" : "",
    evaluationState === "evaluated" ? "評価済み" : "",
    needsImprovement(evaluation) ? "要改善" : ""
  ].filter(Boolean).map((label) => `<span>${esc(label)}</span>`).join("");
  const child = childProgress(task.id);
  const progress = task.type === "project" && child.total ? child.percent : Number(task.progress || 0);
  const priority = labelOf(WORKLINE_PRIORITY, task.priority || "normal");
  return `<article class="task-card work-item-card priority-${esc(task.priority || "normal")} ${isOverdue(task) ? "is-overdue" : ""}" data-open-task="${esc(task.id)}">
    <div class="work-item-card__head">
      <div class="task-card__labels"><span class="type-label">${esc(labelOf(TASK_TYPE, task.type))}</span><span class="priority-label">${esc(priority)}</span></div>
      <strong>${esc(task.title)}</strong>
    </div>
    <p class="next-action-preview"><b>次にやること</b>${esc(task.nextAction || "未設定")}</p>
    ${badges ? `<div class="task-badges">${badges}</div>` : ""}
    ${child.total ? `<div class="subtask-progress"><span>子タスク ${child.completed}/${child.total}</span><div class="progress"><span style="width:${progress}%"></span></div></div>` : ""}
    <footer class="task-card__footer">
      <div class="assignee-chip"><span aria-hidden="true">${esc(primary.slice(0, 1))}</span><b>${esc(primary)}</b></div>
      <span class="task-due ${isOverdue(task) ? "is-overdue" : ""}">${esc(task.endDate ? `期限 ${task.endDate}` : "期限なし")}</span>
    </footer>
    <div class="quick-edit-row" data-stop-open>
      <label class="quick-status"><span>状態</span><select data-task-status="${esc(task.id)}">${statusOptionsForWorkflow(task.workflowType).map(([value, label]) => `<option value="${value}" ${task.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <span class="task-card__detail">詳細を開く</span>
    </div>
  </article>`;
}

function childProgress(taskId) {
  const children = workline.tasks.filter((item) => item.parentTaskId === taskId);
  const completed = children.filter((item) => ["completed", "delivered", "paid"].includes(item.status)).length;
  return { total: children.length, completed, percent: children.length ? Math.round((completed / children.length) * 100) : 0 };
}

function renderTimeline() {
  const tasks = workline.tasks.filter((task) => task.startDate && task.endDate && task.status !== "completed");
  const unscheduled = workline.tasks.filter((task) => !task.startDate || !task.endDate);
  if (!tasks.length) {
    q("#timeline-view").innerHTML = `<p class="muted">期間が設定された進行中タスクはまだありません。</p>`;
  } else {
    const dates = timelineRange(tasks);
    q("#timeline-view").innerHTML = `<div class="timeline-grid" style="--days:${dates.length}">
      <div class="timeline-head task-label">タスク</div>
      ${dates.map((date) => `<div class="timeline-head ${date === today() ? "is-today" : ""}">${date.slice(5)}</div>`).join("")}
      ${tasks.map((task) => timelineRow(task, dates)).join("")}
    </div>`;
  }
  q("#timeline-unscheduled").innerHTML = `<h3>期間未設定</h3>${compactTasks(unscheduled, "期間未設定タスクはありません。")}`;
}

function timelineRange(tasks) {
  const starts = tasks.map((task) => new Date(`${task.startDate}T00:00:00`).getTime());
  const ends = tasks.map((task) => new Date(`${task.endDate}T00:00:00`).getTime());
  const first = new Date(Math.min(...starts));
  const last = new Date(Math.max(...ends));
  const dates = [];
  for (let cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 1)) dates.push(cursor.toISOString().slice(0, 10));
  return dates.slice(0, 62);
}

function timelineRow(task, dates) {
  const start = dates.indexOf(task.startDate) + 2;
  const end = dates.indexOf(task.endDate) + 3;
  return `<div class="timeline-task" data-open-task="${esc(task.id)}">${esc(task.title)}<small>${esc(employeeNames(task))}</small></div>
    <div class="timeline-bar status-${esc(task.status)}" data-open-task="${esc(task.id)}" style="grid-column:${Math.max(start, 2)} / ${Math.max(end, start + 1)}">${esc(labelOf(WORKLINE_STATUS, task.status))}</div>`;
}

function employeeNames(task) {
  return (task.employeeIds || []).map(employeeName).filter(Boolean).join("、") || "未設定";
}

function renderArtifacts() {
  q("#artifact-table").innerHTML = workline.artifacts.length
    ? workline.artifacts.map((item) => `<article class="table-row">
      <div><strong>${esc(item.title)}</strong><span>${esc(item.description)}</span></div>
      <div>${esc(item.type)}</div>
      <div>${esc(workline.tasks.find((task) => task.id === item.taskId)?.title || "未紐付け")}</div>
      <div class="path-cell">${esc(item.pathOrUrl)}</div>
      <div><button class="button tiny" data-open-artifact="${esc(item.id)}">編集</button><button class="button tiny" data-copy="${esc(item.pathOrUrl)}">コピー</button></div>
    </article>`).join("")
    : `<p class="muted">成果物はまだ登録されていません。</p>`;
}

function renderPeople() {
  q("#employee-table").innerHTML = workline.employees.map((item) => `<article class="table-row">
    <div><strong>${esc(item.name)}</strong><span>${esc(item.role)}</span></div><div>${esc(departmentName(item.departmentId))}</div><div>${item.isActive ? "有効" : "無効"}</div><div><button class="button tiny" data-open-employee="${esc(item.id)}">編集</button></div>
  </article>`).join("");
  q("#department-table").innerHTML = workline.departments.map((item) => `<article class="table-row">
    <div><strong>${esc(item.name)}</strong><span>${esc(item.description)}</span></div><div>${esc(item.sortOrder)}</div><div>${item.isActive ? "有効" : "無効"}</div><div><button class="button tiny" data-open-department="${esc(item.id)}">編集</button></div>
  </article>`).join("");
}

function renderArchive() {
  q("#archive-list").innerHTML = compactTasks(workline.tasks.filter((task) => task.status === "completed"), "完了タスクはまだありません。");
}

function isOverdue(task) {
  return task.endDate && task.status !== "completed" && task.endDate < today();
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP");
}

function openDrawer(type, item = null) {
  drawer = { type, item: item ? structuredClone(item) : null };
  q("#drawer-kind").textContent = type.toUpperCase();
  q("#drawer-title").textContent = drawerTitle(type, item);
  q("#save-drawer").classList.toggle("is-hidden", type === "taskImport");
  q("#delete-drawer").classList.toggle("is-hidden", type === "taskImport" || !item?.id || ["employee", "department"].includes(type));
  q("#drawer-message").replaceChildren();
  q("#drawer-body").innerHTML = drawerForm(type, drawer.item || blankItem(type));
  q("#workline-drawer").classList.remove("is-hidden");
}

function drawerTitle(type, item) {
  const map = { task: "タスク編集", taskImport: "AI回答からタスクを取り込む", artifact: "成果物編集", evaluation: "業務振り返り", employee: "社員編集", department: "部署編集", link: "リンク編集" };
  return `${map[type] || "編集"}${item ? "" : "（新規）"}`;
}

function blankItem(type) {
  if (type === "task") return { title: "", description: "", type: "task", workflowType: "general", visibility: "internal", nextAction: "", departmentId: "", primaryAssigneeId: "", supportAssigneeIds: [], reviewerIds: [], employeeIds: [], startDate: "", endDate: "", status: "idea", priority: "normal", progress: 0, parentTaskId: "", tags: [], notes: "", codexInstruction: "", external: {} };
  if (type === "artifact") return { title: "", description: "", type: "other", taskId: "", pathOrUrl: "" };
  if (type === "evaluation") return { taskId: "", workItemId: "", evaluationType: "final", revision: 1, status: "evaluated", evaluationStatus: "evaluated", reviewMode: "quick", aiUsed: false, aiTools: [], aiTasks: "", humanChecks: "", actors: [], aiWorkLevel: "", completionLevel: "completed", humanRevisionLevel: "none", reworkCount: 0, specificationChangeCount: 0, humanMinutes: "", estimatedMinutesWithoutAI: "", humanWorkMinutes: "", estimatedManualMinutes: "", goodPoints: "", problems: "", reusability: "unknown", adoption: "pending", artifactIds: [], nextImprovement: "", needsImprovement: false, evaluatedBy: "", evaluatedAt: "" };
  if (type === "employee") return { name: "", role: "", departmentId: "", iconPath: "", isActive: true };
  if (type === "department") return { name: "", description: "", sortOrder: 100, isActive: true };
  return { taskId: "", type: "web", label: "", value: "" };
}

function drawerForm(type, item) {
  if (type === "task") return taskForm(item);
  if (type === "taskImport") return taskImportForm();
  if (type === "artifact") return artifactForm(item);
  if (type === "evaluation") return evaluationForm(item);
  if (type === "employee") return employeeForm(item);
  if (type === "department") return departmentForm(item);
  return linkForm(item);
}

function taskImportPrompt() {
  const employees = workline.employees.map((item) => `- ${item.id}: ${item.name}`).join("\n") || "- 未登録";
  const departments = workline.departments.map((item) => `- ${item.id}: ${item.name}`).join("\n") || "- 未登録";
  return `# Worklineタスク登録テンプレート

次のJSONを1件だけ返してください。説明文、Markdownのコードフェンス、ID、createdAt、updatedAtは含めません。

## 項目の説明
- title: 必須。タスク名を短く書く。
- description: 背景、目的、完了したい状態を書く。
- nextAction: 次に最初にする行動を一つ書く。
- type: project（親案件）/ task（作業）/ subtask（小タスク）。通常はtask。
- workflowType: general（通常企画）/ external（外部案件）。通常はgeneral。
- status: idea / planned / inProgress / review / publishDecision / completed。通常はidea。
- priority: low / normal / high / urgent。通常はnormal。
- primaryAssigneeId: 主担当の社員ID。補助・確認担当は配列で書く。
- departmentId: 担当部署のID。
- startDate / endDate: YYYY-MM-DD。未定なら空文字。
- tags: 検索用の短いタグ配列。
- notes: 補足、未決定事項、注意点。
- codexInstruction: Codexへ渡す実装や調査の依頼内容。不要なら空文字。

## 社員ID
${employees}

## 部署ID
${departments}

## 出力するJSON
{
  "title": "",
  "description": "",
  "nextAction": "",
  "type": "task",
  "workflowType": "general",
  "status": "idea",
  "priority": "normal",
  "visibility": "internal",
  "departmentId": "",
  "primaryAssigneeId": "",
  "supportAssigneeIds": [],
  "reviewerIds": [],
  "startDate": "",
  "endDate": "",
  "parentTaskId": "",
  "tags": [],
  "notes": "",
  "codexInstruction": "",
  "external": {
    "clientName": "",
    "projectName": "",
    "proposedAmount": "",
    "taxType": "",
    "proposedAt": "",
    "desiredDueDate": "",
    "deliverables": ""
  }
}`;
}

function taskImportForm() {
  return `<div class="task-import-guide">
    <p class="muted">AIとの会話で整理した内容を、通常のタスク編集画面へ取り込みます。取り込み後は保存前に内容を確認できます。</p>
    <ol>
      <li>下のテンプレートをコピーし、AIセッションへ渡します。</li>
      <li>AIから返ったJSONだけを下の入力欄へ貼り付けます。</li>
      <li>取り込んだあと、担当・期限・状態を確認して通常どおり保存します。</li>
    </ol>
    <label class="field"><span>AIに渡すテンプレート</span><textarea id="task-import-template" readonly rows="20">${esc(taskImportPrompt())}</textarea></label>
    <div class="button-row"><button class="button secondary" id="copy-task-import-template" type="button">テンプレートをコピー</button></div>
    <label class="field"><span>AIから返ってきたJSON</span><textarea id="task-import-input" rows="16" placeholder='{"title":"例：社員紹介ページの確認","nextAction":"対象ページを一つ開いて確認する"}'></textarea></label>
    <div class="button-row"><button class="button primary" id="apply-task-import" type="button">タスクへ取り込む</button></div>
  </div>`;
}

function importedStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(/[、,\n]/).map((item) => item.trim()).filter(Boolean);
}

function importedId(value, items) {
  const text = String(value || "").trim();
  return items.find((item) => item.id === text || item.name === text)?.id || text;
}

function taskFromImport(rawText) {
  const source = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const imported = JSON.parse(source);
  if (!imported || Array.isArray(imported) || typeof imported !== "object") throw new Error("JSONオブジェクトを1件だけ貼り付けてください。");
  const task = { ...blankItem("task") };
  ["title", "description", "nextAction", "type", "workflowType", "status", "priority", "visibility", "startDate", "endDate", "parentTaskId", "notes", "codexInstruction"].forEach((key) => {
    if (imported[key] !== undefined) task[key] = String(imported[key] ?? "").trim();
  });
  task.tags = importedStringList(imported.tags);
  task.departmentId = importedId(imported.departmentId, workline.departments);
  task.primaryAssigneeId = importedId(imported.primaryAssigneeId, workline.employees);
  task.supportAssigneeIds = importedStringList(imported.supportAssigneeIds).map((item) => importedId(item, workline.employees));
  task.reviewerIds = importedStringList(imported.reviewerIds).map((item) => importedId(item, workline.employees));
  task.employeeIds = [...new Set([task.primaryAssigneeId, ...task.supportAssigneeIds, ...task.reviewerIds].filter(Boolean))];
  task.external = { ...task.external, ...(imported.external && typeof imported.external === "object" ? imported.external : {}) };
  if (!task.title) throw new Error("title は必須です。AIの回答にタスク名を含めてください。");
  return task;
}

function options(items, selected, empty = "") {
  return `${empty ? `<option value="">${esc(empty)}</option>` : ""}${items.map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`).join("")}`;
}

function multiOptions(items, selectedValues) {
  const selected = new Set(selectedValues || []);
  return items.map(([value, label]) => `<option value="${esc(value)}" ${selected.has(value) ? "selected" : ""}>${esc(label)}</option>`).join("");
}

function taskForm(item) {
  item = normalizeTaskForUi(item);
  return `<div class="form-grid">
    ${input("title", "タイトル", item.title, "full")}
    ${textarea("nextAction", "次にやること", item.nextAction, "full", 3)}
    <label class="field"><span>種類</span><select name="type">${options(TASK_TYPE, item.type)}</select></label>
    <label class="field"><span>業務フロー</span><select name="workflowType">${options(WORKFLOW_TYPE, item.workflowType)}</select></label>
    <label class="field"><span>状態</span><select name="status">${options(statusOptionsForWorkflow(item.workflowType), item.status)}</select></label>
    <label class="field"><span>公開範囲</span><select name="visibility">${options(VISIBILITY, item.visibility)}</select></label>
    <label class="field"><span>主担当</span><select name="primaryAssigneeId">${options(workline.employees.map((employee) => [employee.id, employee.name]), item.primaryAssigneeId, "未設定")}</select></label>
    <label class="field"><span>補助担当</span><select name="supportAssigneeIds" multiple size="5">${multiOptions(workline.employees.map((employee) => [employee.id, employee.name]), item.supportAssigneeIds || [])}</select></label>
    <label class="field"><span>確認担当</span><select name="reviewerIds" multiple size="5">${multiOptions(workline.employees.map((employee) => [employee.id, employee.name]), item.reviewerIds || [])}</select></label>
    <label class="field"><span>部署</span><select name="departmentId">${options(workline.departments.map((dept) => [dept.id, dept.name]), item.departmentId, "未設定")}</select></label>
    ${input("startDate", "開始日", item.startDate, "", "date")}
    ${input("endDate", "終了日", item.endDate, "", "date")}
    <label class="field"><span>優先度</span><select name="priority">${options(WORKLINE_PRIORITY, item.priority)}</select></label>
    ${input("progress", "進捗率", item.progress, "", "number")}
    <label class="field"><span>親タスク</span><select name="parentTaskId">${options(workline.tasks.filter((task) => task.id !== item.id).map((task) => [task.id, task.title]), item.parentTaskId, "なし")}</select></label>
    ${textarea("description", "背景・説明", item.description, "full", 4)}
    ${externalFields(item)}
    <div class="full">${childrenForTask(item.id)}</div>
    ${input("tags", "タグ（改行区切り）", (item.tags || []).join("\\n"), "full")}
    ${textarea("notes", "メモ", item.notes, "full", 4)}
    ${textarea("codexInstruction", "Codex実装指示", item.codexInstruction, "full", 8)}
    <div class="button-row full"><button class="button secondary" id="copy-codex-instruction" type="button">Codex指示をコピー</button><button class="button secondary" id="template-codex-instruction" type="button">テンプレートから生成</button><button class="button secondary" id="add-task-link" type="button">リンクを追加</button><button class="button secondary" id="add-task-artifact" type="button">成果物を追加</button></div>
    <div class="full drawer-links">${linksForTask(item.id)}</div>
    <div class="full drawer-links">${artifactsForTask(item.id)}</div>
    <div class="full">${decisionLogsForTask(item.id)}</div>
    <div class="full">${evaluationsForTask(item.id)}</div>
  </div>`;
}

function externalFields(item) {
  const external = item.external || {};
  const hidden = item.workflowType === "external" ? "" : " is-hidden";
  return `<details class="full evaluation-detail${hidden}" ${item.workflowType === "external" ? "open" : ""}>
    <summary>外部案件情報</summary>
    <div class="form-grid">
      ${input("externalClientName", "取引先名", external.clientName || "")}
      ${input("externalProjectName", "案件名", external.projectName || "")}
      ${input("externalProposedAmount", "提案金額", external.proposedAmount ?? "", "", "number")}
      <label class="field"><span>税込／税別</span><select name="externalTaxType">${options([["", "未設定"], ["taxIncluded", "税込"], ["taxExcluded", "税別"]], external.taxType || "")}</select></label>
      ${input("externalProposedAt", "提案日", external.proposedAt || "", "", "date")}
      ${input("externalDesiredDueDate", "希望納期", external.desiredDueDate || "", "", "date")}
      ${textarea("externalDeliverables", "納品物", external.deliverables || "", "full", 3)}
      ${input("externalInvoiceStatus", "請求状態", external.invoiceStatus || "")}
      ${input("externalPaymentStatus", "入金状態", external.paymentStatus || "")}
    </div>
  </details>`;
}

function childrenForTask(taskId) {
  if (!taskId) return `<details class="evaluation-section full"><summary>子タスク</summary><p class="muted">保存後に子タスクを追加できます。</p></details>`;
  const children = workline.tasks.filter((task) => task.parentTaskId === taskId);
  const progress = childProgress(taskId);
  return `<details class="evaluation-section full" open>
    <summary>子タスク <span>${progress.completed}/${progress.total} 完了 · ${progress.percent}%</span></summary>
    <div class="progress"><span style="width:${progress.percent}%"></span></div>
    <div class="compact-list">
      ${children.length ? children.map((task) => `<article class="mini-card" data-open-task="${esc(task.id)}"><strong>${esc(task.title)}</strong><span>${esc(labelOf(WORKLINE_STATUS, task.status))} / 次: ${esc(task.nextAction || "未設定")}</span></article>`).join("") : `<p class="muted">子タスクはまだありません。</p>`}
    </div>
    <button class="button secondary" data-new-child-task="${esc(taskId)}" type="button">子タスクを追加</button>
  </details>`;
}

function artifactsForTask(taskId) {
  if (!taskId) return `<p class="muted">保存後に成果物を追加できます。</p>`;
  const items = workline.artifacts.filter((artifact) => artifact.taskId === taskId);
  return `<details class="evaluation-section full">
    <summary>成果物・関連情報</summary>
    ${items.length ? items.map((item) => `<article class="mini-card"><strong>${esc(item.title)}</strong><span>${esc(item.type)} / ${esc(item.pathOrUrl)}</span><button class="button tiny" data-open-artifact="${esc(item.id)}" type="button">編集</button></article>`).join("") : `<p class="muted">成果物はまだありません。</p>`}
  </details>`;
}

function decisionLogsForTask(taskId) {
  if (!taskId) return `<details class="evaluation-section full"><summary>決定ログ</summary><p class="muted">保存後に決定ログを追加できます。</p></details>`;
  const logs = [...(workline.decisionLogs || [])].filter((item) => item.workItemId === taskId || item.taskId === taskId).sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)));
  return `<details class="evaluation-section full" open>
    <summary>決定ログ <span>${logs.length}件</span></summary>
    <p class="muted">コメントとは別に、「何が決まったか」だけを追記で残します。</p>
    <div class="compact-list">${logs.length ? logs.map((item) => `<article class="mini-card"><strong>${esc(item.decidedAt)}｜${esc(item.summary)}</strong><span>${esc(item.reason || "理由なし")} / ${esc(item.decidedBy || "決定者未設定")}</span></article>`).join("") : `<p class="muted">まだ決定ログはありません。</p>`}</div>
    <div class="decision-log-form" data-stop-open>
      ${input("decisionDecidedAt", "決定日", today(), "", "date")}
      ${input("decisionDecidedBy", "決定者", "")}
      ${textarea("decisionSummary", "決定内容", "", "full", 2)}
      ${textarea("decisionReason", "理由", "", "full", 2)}
      <button class="button secondary" data-add-decision="${esc(taskId)}" type="button">決定を追記</button>
    </div>
  </details>`;
}

function evaluationsForTask(taskId) {
  if (!taskId) return `<details class="evaluation-section full"><summary>業務振り返り</summary><p class="muted">タスク保存後に振り返りを追加できます。</p></details>`;
  const evaluations = (workline.evaluations || []).filter((item) => item.taskId === taskId);
  const latest = evaluationStatus(taskId);
  return `<details class="evaluation-section full">
    <summary>業務振り返り <span>${esc(labelOf(EVALUATION_STATUS, latest))}</span></summary>
    <p class="muted">AI・ツール活用を含む、完了後の業務振り返りです。社員の採点ではなく、次回の仕事の進め方を改善するために使用します。</p>
    <div class="button-row">
      <button class="button secondary" data-new-evaluation="${esc(taskId)}" type="button">振り返りを追加</button>
    </div>
    <div class="compact-list">
      ${evaluations.length
        ? evaluations
          .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
          .map((item) => `<article class="mini-card"><strong>${esc(labelOf(EVALUATION_STATUS, item.evaluationStatus || item.status))} / ${esc(labelOf(COMPLETION_LEVEL, item.completionLevel))}</strong><span>${esc(item.nextImprovement || "次回メモなし")} / ${esc(formatDateTime(item.updatedAt || item.createdAt))}</span><button class="button tiny" data-open-evaluation="${esc(item.id)}" type="button">編集</button></article>`)
          .join("")
        : `<p class="muted">まだ振り返りはありません。</p>`}
    </div>
  </details>`;
}

function artifactForm(item) {
  return `<div class="form-grid">${input("title", "タイトル", item.title, "full")}${textarea("description", "説明", item.description, "full", 3)}
    <label class="field"><span>種別</span><select name="type">${options(ARTIFACT_TYPES.map((type) => [type, type]), item.type)}</select></label>
    <label class="field"><span>関連タスク</span><select name="taskId">${options(workline.tasks.map((task) => [task.id, task.title]), item.taskId, "未紐付け")}</select></label>
    ${input("pathOrUrl", "パスまたはURL", item.pathOrUrl, "full")}</div>`;
}

function evaluationForm(item) {
  const taskArtifacts = workline.artifacts.filter((artifact) => !item.taskId || !artifact.taskId || artifact.taskId === item.taskId);
  const actors = [...(item.actors || [])];
  while (actors.length < 3) actors.push({ type: "", employeeId: "", label: "", role: actors.length === 0 ? "primary" : "support" });
  const human = item.humanMinutes ?? item.humanWorkMinutes;
  const estimated = item.estimatedMinutesWithoutAI ?? item.estimatedManualMinutes;
  const saved = human !== undefined && human !== "" && estimated !== undefined && estimated !== ""
    ? Number(estimated) - Number(human)
    : null;
  return `<div class="form-grid evaluation-form">
    <label class="field full"><span>タスク</span><select name="taskId">${options(workline.tasks.map((task) => [task.id, task.title]), item.taskId, "選択してください")}</select></label>
    <label class="field"><span>評価状態</span><select name="evaluationStatus">${options(EVALUATION_STATUS, item.evaluationStatus || item.status || "evaluated")}</select></label>
    <label class="confirm-row"><input type="checkbox" name="aiUsed" ${item.aiUsed ? "checked" : ""} /><span>AIを使った</span></label>
    ${input("humanMinutes", "人間作業時間（分）", human ?? "", "", "number")}
    <label class="confirm-row"><input type="checkbox" name="needsImprovement" ${item.needsImprovement ? "checked" : ""} /><span>要改善として残す</span></label>
    ${textarea("nextImprovement", "次回改善メモ", item.nextImprovement, "full", 3)}
    <label class="field"><span>種別</span><select name="evaluationType">${options(EVALUATION_TYPE, item.evaluationType || "final")}</select></label>

    <div class="full actor-box">
      <h3>実行主体</h3>
      ${actors.slice(0, 3).map((actor, index) => `<div class="actor-row" data-actor-row>
        <label class="field"><span>主体</span><select name="actorType${index}">${options(ACTOR_TYPES, actor.type, "未設定")}</select></label>
        <label class="field"><span>AI社員</span><select name="actorEmployee${index}">${options(workline.employees.map((employee) => [employee.id, employee.name]), actor.employeeId, "なし")}</select></label>
        <label class="field"><span>表示名</span><input name="actorLabel${index}" value="${esc(actor.label || "")}" placeholder="例：所長、外部制作チーム" /></label>
        <label class="field"><span>役割</span><select name="actorRole${index}">${options(ACTOR_ROLES, actor.role || "support")}</select></label>
      </div>`).join("")}
    </div>

    <details class="full evaluation-detail">
      <summary>詳細振り返りを開く</summary>
      <p class="muted">手戻り回数は、誤り・抜け漏れ・品質不足・指示理解不足による再作業だけを数えます。仕様変更や追加要望は、仕様変更回数へ分けて残します。</p>
      <div class="form-grid">
        <label class="field"><span>完了度</span><select name="completionLevel">${options(COMPLETION_LEVEL, item.completionLevel || "completed")}</select></label>
        <label class="field"><span>人間の修正量</span><select name="humanRevisionLevel">${options(HUMAN_REVISION_LEVEL, item.humanRevisionLevel || "none")}</select></label>
        <label class="field"><span>採否</span><select name="adoption">${options(ADOPTION, item.adoption || "pending")}</select></label>
        <label class="field"><span>再利用性</span><select name="reusability">${options(REUSABILITY, item.reusability || "unknown")}</select></label>
        <label class="field"><span>AI業務レベル</span><select name="aiWorkLevel">${options(AI_WORK_LEVEL, item.aiWorkLevel || "")}</select></label>
        ${input("revision", "版数", item.revision || 1, "", "number")}
        ${input("reworkCount", "手戻り回数", item.reworkCount ?? 0, "", "number")}
        ${input("specificationChangeCount", "仕様変更回数", item.specificationChangeCount ?? 0, "", "number")}
        ${input("estimatedMinutesWithoutAI", "AIなし想定時間（分）", estimated ?? "", "", "number")}
        <div class="metric-card compact-metric"><span>推定削減時間</span><strong>${saved === null ? "未計算" : `${esc(saved)}分`}</strong></div>
        ${input("aiTools", "使用したAI・サービス（改行区切り）", (item.aiTools || []).join("\\n"), "full")}
        ${textarea("aiTasks", "AIが担当した作業", item.aiTasks || "", "full", 3)}
        ${textarea("humanChecks", "人間が確認した作業", item.humanChecks || "", "full", 3)}
        ${textarea("goodPoints", "良かった点", item.goodPoints || "", "full", 3)}
        ${textarea("problems", "問題点", item.problems || "", "full", 3)}
        <label class="field wide"><span>関連成果物</span><select name="artifactIds" multiple size="5">${multiOptions(taskArtifacts.map((artifact) => [artifact.id, artifact.title]), item.artifactIds || [])}</select></label>
        ${input("evaluatedBy", "評価者", item.evaluatedBy || "")}
        ${input("evaluatedAt", "評価日", item.evaluatedAt || "", "", "date")}
      </div>
    </details>
  </div>`;
}

function employeeForm(item) {
  return `<div class="form-grid">${input("name", "名前", item.name)}${input("role", "役職", item.role)}
    <label class="field"><span>部署</span><select name="departmentId">${options(workline.departments.map((dept) => [dept.id, dept.name]), item.departmentId, "未設定")}</select></label>
    ${input("iconPath", "アイコンパス", item.iconPath || "")}
    <label class="confirm-row"><input type="checkbox" name="isActive" ${item.isActive !== false ? "checked" : ""} /><span>有効</span></label></div>`;
}

function departmentForm(item) {
  return `<div class="form-grid">${input("name", "部署名", item.name)}${input("sortOrder", "並び順", item.sortOrder, "", "number")}${textarea("description", "説明", item.description, "full", 4)}<label class="confirm-row"><input type="checkbox" name="isActive" ${item.isActive !== false ? "checked" : ""} /><span>有効</span></label></div>`;
}

function linkForm(item) {
  return `<div class="form-grid">
    <label class="field"><span>関連タスク</span><select name="taskId">${options(workline.tasks.map((task) => [task.id, task.title]), item.taskId, "未紐付け")}</select></label>
    <label class="field"><span>種別</span><select name="type">${options(LINK_TYPES.map((type) => [type, type]), item.type)}</select></label>
    ${input("label", "リンク名", item.label)}${input("value", "URL・パス", item.value, "full")}
  </div>`;
}

function linksForTask(taskId) {
  if (!taskId) return `<p class="muted">保存後にリンクを追加できます。</p>`;
  const links = workline.links.filter((link) => link.taskId === taskId);
  return links.length ? links.map((link) => `<article class="mini-card"><strong>${esc(link.label)}</strong><span>${esc(link.type)} / ${esc(link.value)}</span><button class="button tiny" data-open-link="${esc(link.id)}" type="button">編集</button></article>`).join("") : `<p class="muted">関連リンクはまだありません。</p>`;
}

function input(name, label, value, span = "", type = "text") {
  return `<label class="field ${span}"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value ?? "")}" /></label>`;
}

function textarea(name, label, value, span = "", rows = 3) {
  return `<label class="field ${span}"><span>${esc(label)}</span><textarea name="${esc(name)}" rows="${rows}">${esc(value || "")}</textarea></label>`;
}

function collectDrawer() {
  const body = q("#drawer-body");
  const item = drawer.item || {};
  qa("input, textarea, select", body).forEach((control) => {
    if (!control.name) return;
    if (control.name.startsWith("decision")) return;
    if (control.multiple) item[control.name] = [...control.selectedOptions].map((option) => option.value);
    else if (control.type === "checkbox") item[control.name] = control.checked;
    else if (["tags", "aiTools"].includes(control.name)) item[control.name] = control.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean);
    else if (control.type === "number") item[control.name] = Number(control.value);
    else item[control.name] = control.value;
  });
  if (drawer.type === "task") {
    item.external = {
      clientName: item.externalClientName || "",
      projectName: item.externalProjectName || "",
      proposedAmount: item.externalProposedAmount,
      taxType: item.externalTaxType || "",
      proposedAt: item.externalProposedAt || "",
      desiredDueDate: item.externalDesiredDueDate || "",
      deliverables: item.externalDeliverables || "",
      invoiceStatus: item.externalInvoiceStatus || "",
      paymentStatus: item.externalPaymentStatus || ""
    };
    ["externalClientName", "externalProjectName", "externalProposedAmount", "externalTaxType", "externalProposedAt", "externalDesiredDueDate", "externalDeliverables", "externalInvoiceStatus", "externalPaymentStatus"].forEach((key) => delete item[key]);
    item.employeeIds = [...new Set([item.primaryAssigneeId, ...(item.supportAssigneeIds || []), ...(item.reviewerIds || [])].filter(Boolean))];
    if (item.parentTaskId && item.type === "project") item.type = "task";
  }
  if (drawer.type === "evaluation") {
    item.status = item.evaluationStatus || item.status;
    item.workItemId = item.taskId;
    item.humanWorkMinutes = item.humanMinutes;
    item.estimatedManualMinutes = item.estimatedMinutesWithoutAI;
    item.actors = [0, 1, 2].map((index) => ({
      type: item[`actorType${index}`],
      employeeId: item[`actorEmployee${index}`],
      label: item[`actorLabel${index}`],
      role: item[`actorRole${index}`] || "support"
    })).filter((actor) => actor.type || actor.employeeId || actor.label);
    [0, 1, 2].forEach((index) => {
      delete item[`actorType${index}`];
      delete item[`actorEmployee${index}`];
      delete item[`actorLabel${index}`];
      delete item[`actorRole${index}`];
    });
    if (item.humanMinutes === 0 && q("[name='humanMinutes']", body)?.value === "") {
      delete item.humanMinutes;
      delete item.humanWorkMinutes;
    }
    if (item.estimatedMinutesWithoutAI === 0 && q("[name='estimatedMinutesWithoutAI']", body)?.value === "") {
      delete item.estimatedMinutesWithoutAI;
      delete item.estimatedManualMinutes;
    }
    if (!item.aiWorkLevel) delete item.aiWorkLevel;
  }
  return item;
}

async function saveDrawer() {
  const item = collectDrawer();
  const collection = `${drawer.type}s`.replace("ys", "ies");
  const endpoint = item.id ? `/api/workline/${collection}/${encodeURIComponent(item.id)}` : `/api/workline/${collection}`;
  const result = await worklineRequest(endpoint, { body: item });
  if (!result.ok) return drawerMessage(result.errors || ["保存できませんでした。"], "error");
  closeDrawer();
  await loadWorkline();
}

async function deleteDrawer() {
  if (!drawer.item?.id) return;
  if (!confirm("削除してよろしいですか？")) return;
  const collection = `${drawer.type}s`.replace("ys", "ies");
  const result = await worklineRequest(`/api/workline/${collection}/${encodeURIComponent(drawer.item.id)}`, { method: "DELETE", body: {} });
  if (!result.ok) return drawerMessage(result.errors || ["削除できませんでした。"], "error");
  closeDrawer();
  await loadWorkline();
}

function drawerMessage(lines, type = "") {
  q("#drawer-message").innerHTML = `<div class="message ${type}">${lines.map(esc).join("<br>")}</div>`;
}

function closeDrawer() {
  q("#workline-drawer").classList.add("is-hidden");
}

function codexTemplate(task) {
  return `# 実装タスク

## タイトル
${task.title || ""}

## 背景
${task.description || ""}

## 担当部署
${departmentName(task.departmentId) || "未設定"}

## 関連ファイル・リンク
${workline.links.filter((link) => link.taskId === task.id).map((link) => `- ${link.label}: ${link.value}`).join("\n") || "- 未登録"}

## 実装要件
${task.codexInstruction || ""}

## 制約
- 既存機能を壊さない
- 必要な範囲だけ変更する
- テストを追加または更新する
- 任意コマンド実行機能を追加しない

## 完了条件
- 実装要件を満たす
- 既存テストが成功する
- 新規テストが成功する
- 変更ファイルと確認方法を報告する`;
}

function newEvaluationForTask(taskId, status = "evaluated") {
  const revisions = (workline.evaluations || []).filter((item) => item.taskId === taskId).map((item) => Number(item.revision || 0));
  return { ...blankItem("evaluation"), taskId, workItemId: taskId, status, evaluationStatus: status, revision: Math.max(0, ...revisions) + 1, evaluatedAt: today() };
}

async function createStatusEvaluation(taskId, status) {
  const item = newEvaluationForTask(taskId, status);
  item.adoption = status === "not_applicable" ? "pending" : "pending";
  return worklineRequest("/api/workline/evaluations", { body: item });
}

async function updateTaskStatus(task, status) {
  return worklineRequest(`/api/workline/tasks/${encodeURIComponent(task.id)}`, {
    body: { ...task, status, progress: status === "completed" ? 100 : task.progress }
  });
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, article, .timeline-bar, .timeline-task");
  if (!target) return;
  if (!target.matches("button") && event.target.closest("[data-stop-open]")) return;
  if (target.id === "refresh-workline") await loadWorkline();
  if (target.id === "new-task" || target.id === "quick-new-task") openDrawer("task");
  if (target.id === "import-task") openDrawer("taskImport");
  if (target.id === "new-artifact") openDrawer("artifact");
  if (target.id === "new-employee") openDrawer("employee");
  if (target.id === "new-department") openDrawer("department");
  if (target.id === "close-drawer") closeDrawer();
  if (target.id === "save-drawer") await saveDrawer();
  if (target.id === "delete-drawer") await deleteDrawer();
  if (target.dataset.openTask) openDrawer("task", workline.tasks.find((task) => task.id === target.dataset.openTask));
  if (target.dataset.openArtifact) openDrawer("artifact", workline.artifacts.find((item) => item.id === target.dataset.openArtifact));
  if (target.dataset.openEvaluation) openDrawer("evaluation", workline.evaluations.find((item) => item.id === target.dataset.openEvaluation));
  if (target.dataset.openEmployee) openDrawer("employee", workline.employees.find((item) => item.id === target.dataset.openEmployee));
  if (target.dataset.openDepartment) openDrawer("department", workline.departments.find((item) => item.id === target.dataset.openDepartment));
  if (target.dataset.openLink) openDrawer("link", workline.links.find((item) => item.id === target.dataset.openLink));
  if (target.id === "add-task-link") openDrawer("link", { ...blankItem("link"), taskId: drawer.item?.id || "" });
  if (target.id === "add-task-artifact") openDrawer("artifact", { ...blankItem("artifact"), taskId: drawer.item?.id || "" });
  if (target.dataset.newChildTask) openDrawer("task", { ...blankItem("task"), type: "subtask", parentTaskId: target.dataset.newChildTask });
  if (target.dataset.newEvaluation) openDrawer("evaluation", newEvaluationForTask(target.dataset.newEvaluation));
  if (target.dataset.saveNextAction) {
    const task = workline.tasks.find((item) => item.id === target.dataset.saveNextAction);
    const input = qa("[data-next-action-input]").find((item) => item.dataset.nextActionInput === target.dataset.saveNextAction);
    if (task && input) {
      const result = await worklineRequest(`/api/workline/tasks/${encodeURIComponent(task.id)}`, { body: { ...task, nextAction: input.value } });
      if (result.ok) await loadWorkline();
      else alert((result.errors || ["次にやることを更新できませんでした。"]).join("\n"));
    }
  }
  if (target.dataset.addDecision) {
    const body = q("#drawer-body");
    const payload = {
      workItemId: target.dataset.addDecision,
      decidedAt: q("[name='decisionDecidedAt']", body)?.value || today(),
      decidedBy: q("[name='decisionDecidedBy']", body)?.value || "",
      summary: q("[name='decisionSummary']", body)?.value || "",
      reason: q("[name='decisionReason']", body)?.value || ""
    };
    const result = await worklineRequest("/api/workline/decisionLogs", { body: payload });
    if (!result.ok) return drawerMessage(result.errors || ["決定ログを追加できませんでした。"], "error");
    const task = workline.tasks.find((item) => item.id === target.dataset.addDecision);
    closeDrawer();
    await loadWorkline();
    openDrawer("task", task);
  }
  if (target.id === "template-codex-instruction") {
    const task = collectDrawer();
    q("[name='codexInstruction']").value = codexTemplate(task);
  }
  if (target.id === "copy-codex-instruction") {
    const task = collectDrawer();
    await navigator.clipboard.writeText(task.codexInstruction || codexTemplate(task));
    drawerMessage(["Codex指示をコピーしました。"]);
  }
  if (target.id === "copy-task-import-template") {
    await navigator.clipboard.writeText(q("#task-import-template")?.value || taskImportPrompt());
    drawerMessage(["AIセッション用テンプレートをコピーしました。"]);
  }
  if (target.id === "apply-task-import") {
    try {
      const task = taskFromImport(q("#task-import-input")?.value || "");
      openDrawer("task", task);
      drawerMessage(["取り込みました。内容を確認してから保存してください。"]);
    } catch (error) {
      drawerMessage([error.message || "JSONを取り込めませんでした。"], "error");
    }
  }
  if (target.dataset.copy) {
    await navigator.clipboard.writeText(target.dataset.copy);
  }
  if (target.dataset.clearBoardFilters !== undefined) {
    ["#filter-employee", "#filter-department", "#filter-status", "#filter-type", "#filter-workflow", "#filter-visibility", "#filter-tag"].forEach((selector) => {
      const input = q(selector);
      if (input) input.value = "";
    });
    renderBoard();
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.matches("#drawer-body [name='workflowType']")) {
    const item = collectDrawer();
    if (!statusOptionsForWorkflow(item.workflowType).some(([status]) => status === item.status)) {
      item.status = item.workflowType === "external" ? "inquiry" : "idea";
    }
    drawer.item = item;
    q("#drawer-body").innerHTML = taskForm(item);
    return;
  }
  if (event.target.matches("[data-task-status]")) {
    const task = workline.tasks.find((item) => item.id === event.target.dataset.taskStatus);
    if (!task) return;
    const previousValue = task.status;
    const nextValue = event.target.value;
    if (nextValue === "completed" && previousValue !== "completed") {
      const result = await updateTaskStatus(task, nextValue);
      if (!result.ok) {
        event.target.value = previousValue;
        return alert((result.errors || ["状態を更新できませんでした。"]).join("\n"));
      }
      await loadWorkline();
      return;
    }
    const result = await updateTaskStatus(task, nextValue);
    if (result.ok) await loadWorkline();
    else alert((result.errors || ["状態を更新できませんでした。"]).join("\n"));
  }
});

["#filter-employee", "#filter-department", "#filter-status", "#filter-type", "#filter-workflow", "#filter-visibility", "#filter-tag"].forEach((selector) => {
  document.addEventListener(selector === "#filter-tag" ? "input" : "change", (event) => {
    if (event.target.matches(selector)) renderBoard();
  });
});

["#evaluation-filter-status", "#evaluation-filter-actor", "#evaluation-filter-adoption", "#evaluation-filter-reusability"].forEach((selector) => {
  document.addEventListener("change", (event) => {
    if (event.target.matches(selector)) renderEvaluationDashboard();
  });
});

setTimeout(loadWorkline, 300);
