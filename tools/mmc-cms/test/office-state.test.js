"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { deriveVirtualOffice, inferOfficeStatus } = require("../lib/office-state");

const employees = [
  { id: "hono", name: "ほのちゃん", role: "総務課長", departmentId: "general-affairs", isActive: true },
  { id: "akito", name: "アキト", role: "主任", departmentId: "development", isActive: true },
  { id: "takaken", name: "たかけん", role: "部長", departmentId: "game-production", isActive: true },
  { id: "resting", name: "休止中", role: "", departmentId: "hr", isActive: false }
];

function task(id, status, employeeIds, updatedAt = "2026-09-10T01:00:00.000Z") {
  return { id, title: id, status, employeeIds, updatedAt };
}

test("既存タスクから作業・確認待ち・会議・待機を導出する", () => {
  const working = task("work", "inProgress", ["hono"]);
  const review = task("review", "review", ["akito"]);
  const meeting = task("meeting", "inProgress", ["takaken", "hono"]);
  assert.equal(inferOfficeStatus(employees[0], [working]), "working");
  assert.equal(inferOfficeStatus(employees[1], [review]), "waitingReview");
  assert.equal(inferOfficeStatus(employees[2], [meeting]), "meeting");
  assert.equal(inferOfficeStatus(employees[3], []), "paused");
  assert.equal(inferOfficeStatus(employees[0], []), "idle");
});

test("社員ごとのタスク・活動・成果物を二重保存せずにまとめる", () => {
  const all = {
    employees,
    departments: [{ id: "general-affairs", name: "総務課", isActive: true }],
    tasks: [task("task-hono", "inProgress", ["hono"], "2026-09-10T02:00:00.000Z")],
    artifacts: [{ id: "artifact-1", taskId: "task-hono", title: "ラウンジ記事", type: "article", updatedAt: "2026-09-10T03:00:00.000Z" }],
    activity: [{ id: "activity-1", targetType: "tasks", targetId: "task-hono", message: "ラウンジ記事を更新しました。", createdAt: "2026-09-10T04:00:00.000Z" }]
  };
  const office = deriveVirtualOffice(all);
  const hono = office.employees.find((employee) => employee.id === "hono");
  assert.equal(hono.currentTasks[0].id, "task-hono");
  assert.equal(hono.recentArtifacts[0].id, "artifact-1");
  assert.equal(hono.lastActivity.message, "ラウンジ記事を更新しました。");
  assert.deepEqual(hono.location, { kind: "department", departmentId: "general-affairs" });
  assert.ok(hono.officeLines.length > 0);
});

test("完了済みは現在タスクから外し、中止済みのみなら休止として扱う", () => {
  const all = { employees: [employees[0]], departments: [], artifacts: [], activity: [], tasks: [task("done", "completed", ["hono"]), task("stop", "canceled", ["hono"])] };
  const hono = deriveVirtualOffice(all).employees[0];
  assert.equal(hono.currentTasks.length, 0);
  assert.equal(hono.officeStatus, "paused");
});
