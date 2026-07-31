"use strict";

const WORKLINE_STATUS = [
  ["idea", "構想中"],
  ["consulting", "相談中"],
  ["specification", "仕様整理中"],
  ["waiting_codex", "Codex依頼待ち"],
  ["codex_working", "Codex作業中"],
  ["review", "確認待ち"],
  ["revision", "修正中"],
  ["preparing_publish", "公開準備中"],
  ["completed", "完了"],
  ["on_hold", "保留"]
];
const WORKLINE_PRIORITY = [["low", "低"], ["normal", "通常"], ["high", "高"], ["urgent", "至急"]];
const LINK_TYPES = ["chatgpt", "github", "codex", "web", "file", "folder", "note", "other"];
const ARTIFACT_TYPES = ["article", "image", "document", "code", "website", "data", "other"];

let workline = { tasks: [], links: [], artifacts: [], employees: [], departments: [], activity: [], settings: {} };
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

async function renderDashboard() {
  const result = await worklineRequest("/api/workline/dashboard");
  const data = result.dashboard || { counts: {}, dueSoon: [], recentActivity: [], recentArtifacts: [], byEmployee: [] };
  q("#dashboard-metrics").innerHTML = [
    ["進行中", data.counts.inProgress || 0],
    ["確認待ち", data.counts.review || 0],
    ["Codex作業中", data.counts.codexWorking || 0],
    ["今月完了", data.counts.completedThisMonth || 0]
  ].map(([label, value]) => `<div class="metric-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
  q("#dashboard-due").innerHTML = compactTasks(data.dueSoon, "期限が近いタスクはありません。");
  q("#dashboard-activity").innerHTML = data.recentActivity?.length
    ? data.recentActivity.map((item) => `<article class="mini-card"><strong>${esc(item.message)}</strong><span>${esc(formatDateTime(item.createdAt))}</span></article>`).join("")
    : `<p class="muted">まだ活動履歴はありません。</p>`;
  q("#dashboard-employees").innerHTML = data.byEmployee?.length
    ? data.byEmployee.map((item) => `<span class="workline-chip">${esc(item.name)} ${item.count}件</span>`).join("")
    : `<p class="muted">担当タスクはまだありません。</p>`;
  q("#dashboard-artifacts").innerHTML = data.recentArtifacts?.length
    ? data.recentArtifacts.map((item) => `<article class="mini-card"><strong>${esc(item.title)}</strong><span>${esc(item.type)} / ${esc(item.pathOrUrl)}</span></article>`).join("")
    : `<p class="muted">生成履歴はこれから記録されます。</p>`;
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
  const tag = (q("#filter-tag")?.value || "").trim();
  const tasks = workline.tasks.filter((task) =>
    (!employee || task.employeeIds?.includes(employee)) &&
    (!department || task.departmentId === department) &&
    (!status || task.status === status) &&
    (!tag || task.tags?.some((item) => item.includes(tag)))
  );
  q("#kanban-board").innerHTML = WORKLINE_STATUS.map(([id, label]) => {
    const cards = tasks.filter((task) => task.status === id);
    return `<section class="kanban-column">
      <h3>${esc(label)} <span>${cards.length}</span></h3>
      <div class="kanban-cards">${cards.map(taskCard).join("") || `<p class="muted">なし</p>`}</div>
    </section>`;
  }).join("");
}

function taskCard(task) {
  const employees = (task.employeeIds || []).map(employeeName).filter(Boolean).join("、") || "未設定";
  return `<article class="task-card ${isOverdue(task) ? "is-overdue" : ""}" data-open-task="${esc(task.id)}">
    <strong>${esc(task.title)}</strong>
    <p>${esc(task.description || "説明なし")}</p>
    <div class="task-meta"><span>${esc(departmentName(task.departmentId) || "部署未設定")}</span><span>${esc(employees)}</span></div>
    <div class="task-meta"><span>期限 ${esc(task.endDate || "なし")}</span><span>優先度 ${esc(labelOf(WORKLINE_PRIORITY, task.priority))}</span></div>
    <div class="progress"><span style="width:${Number(task.progress || 0)}%"></span></div>
    <label class="quick-status">状態 <select data-task-status="${esc(task.id)}">${WORKLINE_STATUS.map(([value, label]) => `<option value="${value}" ${task.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
  </article>`;
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
  q("#delete-drawer").classList.toggle("is-hidden", !item || ["employee", "department"].includes(type));
  q("#drawer-message").replaceChildren();
  q("#drawer-body").innerHTML = drawerForm(type, drawer.item || blankItem(type));
  q("#workline-drawer").classList.remove("is-hidden");
}

function drawerTitle(type, item) {
  const map = { task: "タスク編集", artifact: "成果物編集", employee: "社員編集", department: "部署編集", link: "リンク編集" };
  return `${map[type] || "編集"}${item ? "" : "（新規）"}`;
}

function blankItem(type) {
  if (type === "task") return { title: "", description: "", departmentId: "", employeeIds: [], startDate: "", endDate: "", status: "idea", priority: "normal", progress: 0, parentTaskId: "", tags: [], notes: "", codexInstruction: "" };
  if (type === "artifact") return { title: "", description: "", type: "other", taskId: "", pathOrUrl: "" };
  if (type === "employee") return { name: "", role: "", departmentId: "", iconPath: "", isActive: true };
  if (type === "department") return { name: "", description: "", sortOrder: 100, isActive: true };
  return { taskId: "", type: "web", label: "", value: "" };
}

function drawerForm(type, item) {
  if (type === "task") return taskForm(item);
  if (type === "artifact") return artifactForm(item);
  if (type === "employee") return employeeForm(item);
  if (type === "department") return departmentForm(item);
  return linkForm(item);
}

function options(items, selected, empty = "") {
  return `${empty ? `<option value="">${esc(empty)}</option>` : ""}${items.map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`).join("")}`;
}

function multiOptions(items, selectedValues) {
  const selected = new Set(selectedValues || []);
  return items.map(([value, label]) => `<option value="${esc(value)}" ${selected.has(value) ? "selected" : ""}>${esc(label)}</option>`).join("");
}

function taskForm(item) {
  return `<div class="form-grid">
    ${input("title", "タイトル", item.title, "full")}
    ${textarea("description", "背景・説明", item.description, "full", 4)}
    <label class="field"><span>部署</span><select name="departmentId">${options(workline.departments.map((dept) => [dept.id, dept.name]), item.departmentId, "未設定")}</select></label>
    <label class="field"><span>担当社員</span><select name="employeeIds" multiple size="6">${multiOptions(workline.employees.map((employee) => [employee.id, employee.name]), item.employeeIds || [])}</select></label>
    ${input("startDate", "開始日", item.startDate, "", "date")}
    ${input("endDate", "終了日", item.endDate, "", "date")}
    <label class="field"><span>状態</span><select name="status">${options(WORKLINE_STATUS, item.status)}</select></label>
    <label class="field"><span>優先度</span><select name="priority">${options(WORKLINE_PRIORITY, item.priority)}</select></label>
    ${input("progress", "進捗率", item.progress, "", "number")}
    <label class="field"><span>親タスク</span><select name="parentTaskId">${options(workline.tasks.filter((task) => task.id !== item.id).map((task) => [task.id, task.title]), item.parentTaskId, "なし")}</select></label>
    ${input("tags", "タグ（改行区切り）", (item.tags || []).join("\\n"), "full")}
    ${textarea("notes", "メモ", item.notes, "full", 4)}
    ${textarea("codexInstruction", "Codex実装指示", item.codexInstruction, "full", 8)}
    <div class="button-row full"><button class="button secondary" id="copy-codex-instruction" type="button">Codex指示をコピー</button><button class="button secondary" id="template-codex-instruction" type="button">テンプレートから生成</button><button class="button secondary" id="add-task-link" type="button">リンクを追加</button></div>
    <div class="full drawer-links">${linksForTask(item.id)}</div>
  </div>`;
}

function artifactForm(item) {
  return `<div class="form-grid">${input("title", "タイトル", item.title, "full")}${textarea("description", "説明", item.description, "full", 3)}
    <label class="field"><span>種別</span><select name="type">${options(ARTIFACT_TYPES.map((type) => [type, type]), item.type)}</select></label>
    <label class="field"><span>関連タスク</span><select name="taskId">${options(workline.tasks.map((task) => [task.id, task.title]), item.taskId, "未紐付け")}</select></label>
    ${input("pathOrUrl", "パスまたはURL", item.pathOrUrl, "full")}</div>`;
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
  return `<label class="field ${span}"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value || "")}" /></label>`;
}

function textarea(name, label, value, span = "", rows = 3) {
  return `<label class="field ${span}"><span>${esc(label)}</span><textarea name="${esc(name)}" rows="${rows}">${esc(value || "")}</textarea></label>`;
}

function collectDrawer() {
  const body = q("#drawer-body");
  const item = drawer.item || {};
  qa("input, textarea, select", body).forEach((control) => {
    if (!control.name) return;
    if (control.multiple) item[control.name] = [...control.selectedOptions].map((option) => option.value);
    else if (control.type === "checkbox") item[control.name] = control.checked;
    else if (["tags"].includes(control.name)) item[control.name] = control.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean);
    else if (control.type === "number") item[control.name] = Number(control.value);
    else item[control.name] = control.value;
  });
  if (drawer.type === "task") item.employeeIds ||= [];
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

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, article, .timeline-bar, .timeline-task");
  if (!target) return;
  if (target.id === "refresh-workline") await loadWorkline();
  if (target.id === "new-task") openDrawer("task");
  if (target.id === "new-artifact") openDrawer("artifact");
  if (target.id === "new-employee") openDrawer("employee");
  if (target.id === "new-department") openDrawer("department");
  if (target.id === "close-drawer") closeDrawer();
  if (target.id === "save-drawer") await saveDrawer();
  if (target.id === "delete-drawer") await deleteDrawer();
  if (target.dataset.openTask) openDrawer("task", workline.tasks.find((task) => task.id === target.dataset.openTask));
  if (target.dataset.openArtifact) openDrawer("artifact", workline.artifacts.find((item) => item.id === target.dataset.openArtifact));
  if (target.dataset.openEmployee) openDrawer("employee", workline.employees.find((item) => item.id === target.dataset.openEmployee));
  if (target.dataset.openDepartment) openDrawer("department", workline.departments.find((item) => item.id === target.dataset.openDepartment));
  if (target.dataset.openLink) openDrawer("link", workline.links.find((item) => item.id === target.dataset.openLink));
  if (target.id === "add-task-link") openDrawer("link", { ...blankItem("link"), taskId: drawer.item?.id || "" });
  if (target.id === "template-codex-instruction") {
    const task = collectDrawer();
    q("[name='codexInstruction']").value = codexTemplate(task);
  }
  if (target.id === "copy-codex-instruction") {
    const task = collectDrawer();
    await navigator.clipboard.writeText(task.codexInstruction || codexTemplate(task));
    drawerMessage(["Codex指示をコピーしました。"]);
  }
  if (target.dataset.copy) {
    await navigator.clipboard.writeText(target.dataset.copy);
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.matches("[data-task-status]")) {
    const task = workline.tasks.find((item) => item.id === event.target.dataset.taskStatus);
    if (!task) return;
    const result = await worklineRequest(`/api/workline/tasks/${encodeURIComponent(task.id)}`, { body: { ...task, status: event.target.value, progress: event.target.value === "completed" ? 100 : task.progress } });
    if (result.ok) await loadWorkline();
    else alert((result.errors || ["状態を更新できませんでした。"]).join("\n"));
  }
});

["#filter-employee", "#filter-department", "#filter-status", "#filter-tag"].forEach((selector) => {
  document.addEventListener(selector === "#filter-tag" ? "input" : "change", (event) => {
    if (event.target.matches(selector)) renderBoard();
  });
});

setTimeout(loadWorkline, 300);
