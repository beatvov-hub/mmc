"use strict";

// Renderer-only layout. The server returns semantic locations, never pixels.
const OFFICE_SPOTS = {
  "department:general-affairs": [[12, 25], [18, 32]],
  "department:planning-sales": [[33, 24], [39, 30]],
  "department:overseas-ai": [[55, 24]],
  "department:game-production": [[76, 25], [83, 32]],
  "department:design": [[14, 64]],
  "department:development": [[35, 64], [43, 69]],
  "department:public-relations": [[58, 65]],
  "department:hr": [[78, 64]],
  "department:literacy": [[57, 82]],
  "department:external": [[82, 82]],
  meeting: [[32, 42], [43, 42], [54, 42], [65, 42], [32, 54], [43, 54], [54, 54], [65, 54], [21, 42], [76, 42], [21, 54], [76, 54]],
  review: [[69, 45], [74, 50]],
  lounge: [[22, 82], [27, 87], [33, 83], [19, 88]],
  idle: [[29, 48], [61, 34], [89, 51], [9, 48]]
};

let office = null;
let officeTimer = null;
let bubbleTimer = null;

const officeRoot = () => document.querySelector("#virtual-office");
const peopleRoot = () => document.querySelector("#office-people");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function locationKey(employee) {
  if (employee.location?.kind === "department") return `department:${employee.location.departmentId}`;
  if (employee.location?.kind === "idle") return employee.idleVariant === "lounge" ? "lounge" : "idle";
  return employee.location?.kind || "idle";
}

function placedEmployees(employees) {
  const grouped = new Map();
  employees.forEach((employee) => {
    const key = locationKey(employee);
    grouped.set(key, [...(grouped.get(key) || []), employee]);
  });
  return [...grouped.entries()].flatMap(([key, members]) => {
    const spots = OFFICE_SPOTS[key] || OFFICE_SPOTS.idle;
    return members.map((employee, index) => ({
      ...employee,
      position: spots[index % spots.length],
      positionIndex: index % spots.length,
      positionKey: key
    }));
  });
}

function officeFormatDateTime(value) {
  if (!value) return "記録はまだありません。";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function currentTimeLabel() {
  const now = new Date();
  const hour = now.getHours();
  const period = hour < 10 ? "朝" : hour < 17 ? "昼" : hour < 20 ? "夕方" : "夜";
  const label = now.toLocaleString("ja-JP", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
  const clock = document.querySelector("#office-clock");
  if (clock) clock.textContent = `${period} · ${label}`;
  officeRoot()?.setAttribute("data-daytime", period);
}

function employeeMarkup(employee) {
  const [x, y] = employee.position;
  const initials = employee.name.slice(0, 2);
  const positionClass = `office-pos-${x}-${y}`;
  return `<button class="office-person ${positionClass} is-${escapeHtml(employee.officeStatus)} is-${escapeHtml(employee.animation)}" type="button" data-office-employee="${escapeHtml(employee.id)}" aria-label="${escapeHtml(employee.name)}：${escapeHtml(employee.statusLabel)}">
    <span class="office-speech" aria-hidden="true"></span>
    <span class="office-avatar"><img src="${escapeHtml(employee.avatarUrl)}" alt="" /><b>${escapeHtml(initials)}</b></span>
    <span class="office-person-name">${escapeHtml(employee.name)}</span>
    <span class="office-person-status">${escapeHtml(employee.statusIcon)} ${escapeHtml(employee.statusLabel)}</span>
  </button>`;
}

function renderOffice() {
  const root = peopleRoot();
  if (!root || !office) return;
  const placements = placedEmployees(office.employees);
  for (const employee of placements) {
    let element = root.querySelector(`[data-office-employee="${CSS.escape(employee.id)}"]`);
    const template = document.createElement("template");
    template.innerHTML = employeeMarkup(employee);
    const fresh = template.content.firstElementChild;
    if (!element) { root.append(fresh); element = fresh; }
    else {
      element.className = fresh.className;
      element.setAttribute("aria-label", fresh.getAttribute("aria-label"));
      element.querySelector(".office-person-status").textContent = fresh.querySelector(".office-person-status").textContent;
    }
  }
  for (const element of root.children) {
    if (!office.employees.some(employee => employee.id === element.dataset.officeEmployee)) element.remove();
  }
  scheduleBubble();
}

function closeOfficePanel() {
  document.querySelector("#office-person-panel")?.remove();
}

function openOfficePanel(employeeId) {
  const employee = office?.employees.find((item) => item.id === employeeId);
  if (!employee) return;
  closeOfficePanel();
  const panel = document.createElement("aside");
  panel.id = "office-person-panel";
  panel.className = "office-person-panel";
  const taskList = employee.currentTasks.length
    ? employee.currentTasks.map((task) => `<button class="office-task-link" type="button" data-office-task="${escapeHtml(task.id)}"><span>${escapeHtml(task.title)}</span><small>${escapeHtml(task.status)}</small></button>`).join("")
    : `<p class="office-empty">現在のアクティブタスクはありません。</p>`;
  const artifactList = employee.recentArtifacts.length
    ? employee.recentArtifacts.map((artifact) => `<li>${escapeHtml(artifact.title)}</li>`).join("")
    : `<p class="office-empty">紐づく最近の成果物はありません。</p>`;
  const activity = employee.lastActivity
    ? `<strong>${escapeHtml(officeFormatDateTime(employee.lastActivity.at))}</strong><span>${escapeHtml(employee.lastActivity.message)}</span>`
    : `<span>記録はまだありません。</span>`;
  panel.innerHTML = `<div class="office-panel-card">
    <button type="button" class="office-panel-close" data-office-close aria-label="閉じる">×</button>
    <div class="office-profile"><img src="${escapeHtml(employee.avatarUrl)}" alt="" /><div><p>MMC EMPLOYEE</p><h2>${escapeHtml(employee.name)}</h2><span>${escapeHtml(employee.role || "役職未設定")}</span></div></div>
    <div class="office-state"><b>${escapeHtml(employee.statusIcon)} ${escapeHtml(employee.statusLabel)}</b><span>${escapeHtml(office.departments.find((department) => department.id === employee.departmentId)?.name || "所属未設定")}</span></div>
    <section><h3>現在のタスク</h3>${taskList}</section>
    <section><h3>最終活動</h3><div class="office-activity">${activity}</div></section>
    <section><h3>最近の成果物</h3>${employee.recentArtifacts.length ? `<ul class="office-artifacts">${artifactList}</ul>` : artifactList}</section>
    <div class="office-panel-actions">
      <button class="button secondary" type="button" data-office-first-task="${escapeHtml(employee.currentTasks[0]?.id || "")}" ${employee.currentTasks.length ? "" : "disabled"}>タスクを見る</button>
      <button class="button quiet" type="button" data-office-employee-detail="${escapeHtml(employee.id)}">社員詳細を見る</button>
      ${/^https?:\/\//i.test(employee.chatUrl || "") ? `<a class="button primary" href="${escapeHtml(employee.chatUrl)}" target="_blank" rel="noopener">${escapeHtml(employee.name)}に相談する</a>` : `<button class="button" type="button" disabled title="社員詳細から相談リンクを登録できます。">相談リンク未登録</button>`}
    </div>
  </div>`;
  document.body.append(panel);
}

function showBubble(employee) {
  const person = document.querySelector(`[data-office-employee="${CSS.escape(employee.id)}"]`);
  if (!person) return;
  const lines = employee.officeLines || [];
  if (!lines.length) return;
  const bubble = person.querySelector(".office-speech");
  bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
  bubble.classList.add("is-visible");
  window.setTimeout(() => bubble.classList.remove("is-visible"), 6200);
}

function scheduleBubble() {
  window.clearTimeout(bubbleTimer);
  if (!office?.employees.length) return;
  bubbleTimer = window.setTimeout(() => {
    const candidates = office.employees.filter((employee) => ["working", "idle", "meeting"].includes(employee.officeStatus));
    showBubble((candidates.length ? candidates : office.employees)[Math.floor(Math.random() * (candidates.length ? candidates.length : office.employees.length))]);
    scheduleBubble();
  }, 9000 + Math.random() * 8000);
}

async function loadOffice() {
  const response = await fetch("/api/workline/office");
  const result = await response.json().catch(() => ({ ok: false }));
  if (!result.ok) return;
  office = result.office;
  renderOffice();
}

document.addEventListener("click", (event) => {
  const employeeButton = event.target.closest("[data-office-employee]");
  if (employeeButton) return openOfficePanel(employeeButton.dataset.officeEmployee);
  if (event.target.closest("[data-office-close]")) return closeOfficePanel();
  const taskId = event.target.closest("[data-office-task], [data-office-first-task]")?.dataset.officeTask || event.target.closest("[data-office-first-task]")?.dataset.officeFirstTask;
  if (taskId) { closeOfficePanel(); return window.worklineUi?.openTask(taskId); }
  const employeeId = event.target.closest("[data-office-employee-detail]")?.dataset.officeEmployeeDetail;
  if (employeeId) { closeOfficePanel(); return window.worklineUi?.openEmployee(employeeId); }
  if (event.target.closest("#office-refresh")) loadOffice();
});

window.addEventListener("workline-tab-change", (event) => {
  if (event.detail.tab === "office") loadOffice();
  else closeOfficePanel();
});
window.addEventListener("workline-data-updated", () => { if (document.querySelector("#panel-office")?.classList.contains("is-active")) loadOffice(); });

currentTimeLabel();
window.setInterval(currentTimeLabel, 30000);
officeTimer = window.setTimeout(loadOffice, 360);

document.addEventListener("error", (event) => {
  if (event.target.matches?.(".office-avatar img, .office-profile img")) event.target.remove();
}, true);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeOfficePanel(); });
window.setInterval(() => {
  if (document.hidden || !document.querySelector("#panel-office.is-active")) return;
  const idle = (office?.employees || []).filter(employee => employee.officeStatus === "idle");
  const employee = idle[Math.floor(Math.random() * idle.length)];
  if (!employee || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const element = peopleRoot().querySelector(`[data-office-employee="${CSS.escape(employee.id)}"]`);
  const original = [...element.classList].find(name => name.startsWith("office-pos-"));
  element.classList.remove(original);
  element.classList.add("office-pos-22-82", "is-walking");
  setTimeout(() => element.classList.remove("is-walking"), 1900);
  setTimeout(() => { element.classList.remove("office-pos-22-82"); element.classList.add(original, "is-walking"); setTimeout(() => element.classList.remove("is-walking"), 1900); }, 12000);
}, 35000);
