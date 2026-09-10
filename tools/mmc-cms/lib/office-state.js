"use strict";

// This module intentionally contains no pixel coordinates or DOM concerns.
// A future Canvas/Three.js renderer can consume the same office roster.
const TERMINAL_STATUSES = new Set(["completed", "canceled", "delivered", "paid", "declined"]);
const REVIEW_STATUSES = new Set(["review", "clientReview", "waitingResponse", "publishDecision"]);
const WORKING_STATUSES = new Set(["idea", "planned", "inProgress", "inquiry", "proposal", "accepted", "production", "invoiced"]);
const MEETING_STATUSES = new Set(["inProgress", "production"]);

const DEFAULT_OFFICE_LINES = {
  hono: ["コーヒーありますよ☕", "今日の空気、整えておきますね。"],
  shoma: ["これ企画にできそうっすね。", "届け方から考えてみます。"],
  michael: ["海外の動きも確認しておきます。", "少し調べてみましょう。"],
  takaken: ["ほぅ……。", "遊び心は残しておきたいですね。"],
  dg: ["観測ログ、見ておきます。", "ここは少し気になりますね。"],
  rei: ["見た目の筋を整えます。", "余白から考えてみますね。"],
  akito: ["まず構造から確認します。", "実装しやすい形にしていきます。"],
  kei: ["伝わる入口を整えます。", "公開後の景色も見ておきます。"],
  nemu: ["役割の相性を見てみます。", "無理のない進め方にしましょう。"],
  makoto: ["確認ポイントを整理します。", "安全な使い方を見ておきます。"],
  koto: ["文章の流れを整えています。", "読後感も大事にしますね。"],
  pechi: ["わふ。", "ラウンジ、いい匂いです。"]
};

function timestamp(value) {
  const time = Date.parse(value || "");
  return Number.isNaN(time) ? 0 : time;
}

function assignedTo(task, employeeId) {
  return new Set([
    task.primaryAssigneeId,
    ...(task.supportAssigneeIds || []),
    ...(task.reviewerIds || []),
    ...(task.employeeIds || [])
  ].filter(Boolean)).has(employeeId);
}

function isActiveTask(task) {
  return !TERMINAL_STATUSES.has(task.status);
}

function statusDetails(status) {
  return {
    idle: { label: "待機中", icon: "○", location: "idle" },
    working: { label: "作業中", icon: "●", location: "department" },
    meeting: { label: "会議・相談中", icon: "◎", location: "meeting" },
    waitingReview: { label: "確認待ち", icon: "◐", location: "review" },
    paused: { label: "休止・停止", icon: "◌", location: "lounge" }
  }[status];
}

function inferOfficeStatus(employee, assignedTasks) {
  const active = assignedTasks.filter(isActiveTask);
  if (!employee.isActive) return "paused";
  if (active.some((task) => REVIEW_STATUSES.has(task.status))) return "waitingReview";
  // A company-wide planning item is not a literal meeting.  Limit the visual
  // meeting rule to a small, actively executing collaboration.
  if (active.some((task) => {
    const participants = new Set([task.primaryAssigneeId, ...(task.supportAssigneeIds || []), ...(task.reviewerIds || []), ...(task.employeeIds || [])].filter(Boolean));
    return MEETING_STATUSES.has(task.status) && participants.size >= 2 && participants.size <= 5;
  })) return "meeting";
  if (active.length) return "working";
  if (assignedTasks.some((task) => task.status === "canceled")) return "paused";
  return "idle";
}

function activityForEmployee(employeeId, tasks, artifacts, activities) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const candidates = [];
  for (const task of tasks) {
    if (task.updatedAt) candidates.push({ at: task.updatedAt, message: `${task.title} を更新`, source: "task" });
  }
  for (const artifact of artifacts) {
    if (taskIds.has(artifact.taskId) && artifact.updatedAt) candidates.push({ at: artifact.updatedAt, message: `${artifact.title} を成果物として記録`, source: "artifact" });
  }
  for (const activity of activities) {
    const isEmployee = activity.targetType === "employees" && activity.targetId === employeeId;
    if (isEmployee || taskIds.has(activity.targetId)) {
      candidates.push({ at: activity.createdAt, message: activity.message, source: "activity" });
    }
  }
  return candidates.sort((a, b) => timestamp(b.at) - timestamp(a.at))[0] || null;
}

function officeLinesFor(employee) {
  const lines = Array.isArray(employee.officeLines) ? employee.officeLines.filter(Boolean) : [];
  return lines.length ? lines : (DEFAULT_OFFICE_LINES[employee.id] || ["少しずつ進めています。"]);
}

function deriveOfficeRoster(all) {
  const employees = (all.employees || []).filter((employee) => employee.isActive !== false);
  return employees.map((employee, employeeIndex) => {
    const assignedTasks = (all.tasks || []).filter((task) => assignedTo(task, employee.id));
    const currentTasks = assignedTasks
      .filter(isActiveTask)
      .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
      .slice(0, 3)
      .map((task) => ({ id: task.id, title: task.title, status: task.status, updatedAt: task.updatedAt }));
    const officeStatus = inferOfficeStatus(employee, assignedTasks);
    const detail = statusDetails(officeStatus);
    const recentArtifacts = (all.artifacts || [])
      .filter((artifact) => assignedTasks.some((task) => task.id === artifact.taskId))
      .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
      .slice(0, 3)
      .map((artifact) => ({ id: artifact.id, taskId: artifact.taskId, title: artifact.title, type: artifact.type, pathOrUrl: artifact.pathOrUrl, updatedAt: artifact.updatedAt }));
    return {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      departmentId: employee.departmentId,
      isActive: employee.isActive !== false,
      chatUrl: employee.chatUrl || "",
      officeLines: officeLinesFor(employee),
      officeStatus,
      statusLabel: detail.label,
      statusIcon: detail.icon,
      location: detail.location === "department" ? { kind: "department", departmentId: employee.departmentId || "unassigned" } : { kind: detail.location },
      animation: officeStatus === "working" ? "work" : officeStatus === "meeting" ? "talk" : "idle",
      idleVariant: employeeIndex % 3 === 0 ? "lounge" : "desk",
      currentTasks,
      lastActivity: activityForEmployee(employee.id, assignedTasks, all.artifacts || [], all.activity || []),
      recentArtifacts
    };
  });
}

function deriveVirtualOffice(all) {
  return {
    generatedAt: new Date().toISOString(),
    departments: (all.departments || []).filter((department) => department.isActive !== false).map((department) => ({ id: department.id, name: department.name })),
    employees: deriveOfficeRoster(all)
  };
}

module.exports = { DEFAULT_OFFICE_LINES, deriveOfficeRoster, deriveVirtualOffice, inferOfficeStatus, isActiveTask };
