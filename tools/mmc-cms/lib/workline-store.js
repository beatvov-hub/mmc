"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { atomicWriteJson, safePath } = require("./repository");

const DATA_DIR = "tools/mmc-cms/data";

const TASK_STATUSES = [
  "idea",
  "consulting",
  "specification",
  "waiting_codex",
  "codex_working",
  "review",
  "revision",
  "preparing_publish",
  "completed",
  "on_hold"
];

const PRIORITIES = ["low", "normal", "high", "urgent"];
const LINK_TYPES = ["chatgpt", "github", "codex", "web", "file", "folder", "note", "other"];
const ARTIFACT_TYPES = ["article", "image", "document", "code", "website", "data", "other"];
const EVALUATION_STATUSES = ["not_evaluated", "deferred", "evaluated", "not_applicable"];
const EVALUATION_TYPES = ["final", "interim", "post_release"];
const EXECUTION_ACTOR_TYPES = ["human", "ai_employee", "chatgpt_task", "codex", "internal_app", "external_contractor", "other"];
const EXECUTION_ACTOR_ROLES = ["primary", "support", "review"];
const AI_WORK_LEVELS = ["L0", "L1", "L2", "L3", "L4"];
const COMPLETION_LEVELS = ["completed", "partial", "incomplete", "cancelled"];
const HUMAN_REVISION_LEVELS = ["none", "minor", "moderate", "major", "rebuild"];
const REUSABILITY_LEVELS = ["direct", "with_changes", "one_time", "not_reusable", "unknown"];
const ADOPTION_LEVELS = ["adopted", "partially_adopted", "pending", "rejected"];

const FILES = {
  tasks: `${DATA_DIR}/workline-tasks.json`,
  links: `${DATA_DIR}/workline-links.json`,
  artifacts: `${DATA_DIR}/workline-artifacts.json`,
  evaluations: `${DATA_DIR}/workline-evaluations.json`,
  employees: `${DATA_DIR}/workline-employees.json`,
  departments: `${DATA_DIR}/workline-departments.json`,
  activity: `${DATA_DIR}/workline-activity.json`,
  settings: `${DATA_DIR}/workline-settings.json`
};

const DEFAULT_DEPARTMENTS = [
  { id: "general-affairs", name: "総務課", description: "ラウンジ運営、社内の空気づくり、生活リズムの見守りを担当します。", sortOrder: 10, isActive: true },
  { id: "planning-sales", name: "企画営業部", description: "記事や知見を、届け方と事業化の両面から整えます。", sortOrder: 20, isActive: true },
  { id: "overseas-ai", name: "海外AI研究室", description: "海外AIニュースやテックトレンドを観測し、日本向けに整理します。", sortOrder: 30, isActive: true },
  { id: "game-production", name: "ゲーム制作部", description: "ゲーム企画、世界観、体験設計、ゲーム文化の観測を担当します。", sortOrder: 40, isActive: true },
  { id: "design", name: "BEAT ANIMALSデザイン部", description: "制作物と会社全体のブランド表現を整えます。", sortOrder: 50, isActive: true },
  { id: "development", name: "開発推進室", description: "思いつきを仕様と実装しやすい形へ変換します。", sortOrder: 60, isActive: true },
  { id: "public-relations", name: "広報部", description: "ホームページや導線を整え、初めて来た人へ伝わる形にします。", sortOrder: 70, isActive: true },
  { id: "hr", name: "人事部", description: "AI社員の採用相談、役割整理、組織設計を担当します。", sortOrder: 80, isActive: true },
  { id: "literacy", name: "AIリテラシー推進室", description: "AIを安心して使うための確認方法を伝えます。", sortOrder: 90, isActive: true },
  { id: "external", name: "社外協力者", description: "社員ではない協力者の作業と居場所を扱います。", sortOrder: 100, isActive: true }
];

const DEFAULT_EMPLOYEES = [
  { id: "hono", name: "ほのちゃん", role: "総務課長", departmentId: "general-affairs", iconPath: "image/staff/hono-item.png", isActive: true },
  { id: "shoma", name: "ショウマ", role: "企画営業部長", departmentId: "planning-sales", iconPath: "image/staff/shoma-item.png", isActive: true },
  { id: "michael", name: "マイケル", role: "主任", departmentId: "overseas-ai", iconPath: "image/staff/michael-item.png", isActive: true },
  { id: "takaken", name: "たかけん", role: "ゲーム制作部長", departmentId: "game-production", iconPath: "image/staff/takaken-item.png", isActive: true },
  { id: "dg", name: "DG", role: "人狼界隈観測課長", departmentId: "game-production", iconPath: "image/staff/dg-item.png", isActive: true },
  { id: "rei", name: "レイちゃん", role: "ブランドデザイナー", departmentId: "design", iconPath: "image/staff/rei-item.png", isActive: true },
  { id: "akito", name: "アキト", role: "主任", departmentId: "development", iconPath: "image/staff/akito-item.png", isActive: true },
  { id: "kei", name: "ケイ", role: "広報部長", departmentId: "public-relations", iconPath: "image/staff/kei-item.png", isActive: true },
  { id: "nemu", name: "ねむちゃん", role: "人事部長", departmentId: "hr", iconPath: "image/staff/nemu-item.png", isActive: true },
  { id: "makoto", name: "誠", role: "主任", departmentId: "literacy", iconPath: "image/staff/makoto-item.png", isActive: true },
  { id: "pechi", name: "ペチ", role: "開発犬", departmentId: "external", iconPath: "image/staff/pechi-item.png", isActive: true }
];

const DEFAULT_SETTINGS = {
  activityLimit: 1000,
  archiveCompletedAfterDays: 30,
  allowedLocalRoots: [],
  timelineUnit: "week",
  dashboardDueSoonDays: 7
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureDataFiles(root) {
  await fsp.mkdir(safePath(root, DATA_DIR), { recursive: true });
  const initial = {
    tasks: [],
    links: [],
    artifacts: [],
    evaluations: [],
    employees: DEFAULT_EMPLOYEES,
    departments: DEFAULT_DEPARTMENTS,
    activity: [],
    settings: DEFAULT_SETTINGS
  };
  for (const [key, relativePath] of Object.entries(FILES)) {
    const file = safePath(root, relativePath);
    if (!fs.existsSync(file)) await atomicWriteJson(root, relativePath, initial[key]);
    else JSON.parse(await fsp.readFile(file, "utf8"));
  }
}

async function readJson(root, key) {
  await ensureDataFiles(root);
  return JSON.parse(await fsp.readFile(safePath(root, FILES[key]), "utf8"));
}

async function writeJson(root, key, value) {
  await ensureDataFiles(root);
  await backupWorklineFile(root, key);
  await atomicWriteJson(root, FILES[key], value);
}

async function backupWorklineFile(root, key) {
  const source = safePath(root, FILES[key]);
  if (!fs.existsSync(source)) return;
  const backupDir = safePath(root, `${DATA_DIR}/backups`);
  await fsp.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fsp.copyFile(source, path.join(backupDir, `${path.basename(FILES[key])}.${stamp}.bak`));
}

async function loadAll(root) {
  await ensureDataFiles(root);
  const [tasks, links, artifacts, evaluations, employees, departments, activity, settings] = await Promise.all([
    readJson(root, "tasks"),
    readJson(root, "links"),
    readJson(root, "artifacts"),
    readJson(root, "evaluations"),
    readJson(root, "employees"),
    readJson(root, "departments"),
    readJson(root, "activity"),
    readJson(root, "settings")
  ]);
  return { tasks, links, artifacts, evaluations, employees, departments, activity, settings: { ...DEFAULT_SETTINGS, ...settings } };
}

function normalizeString(value) {
  return String(value || "").trim();
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map(normalizeString).filter(Boolean) : [];
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function nextEvaluationRevision(taskId, evaluations, currentId = "") {
  return evaluations
    .filter((item) => item.taskId === taskId && item.id !== currentId)
    .reduce((max, item) => Math.max(max, Number(item.revision || 0)), 0) + 1;
}

function enumValue(allowed, payloadValue, existingValue, fallback) {
  if (payloadValue !== undefined) return payloadValue;
  if (existingValue !== undefined) return existingValue;
  return fallback;
}

function validateTask(task, all) {
  const errors = [];
  if (!normalizeString(task.title)) errors.push("タスク名は必須です。");
  if (!TASK_STATUSES.includes(task.status)) errors.push("不正なステータスです。");
  if (!PRIORITIES.includes(task.priority)) errors.push("不正な優先度です。");
  if (!Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100) errors.push("進捗率は0から100の整数で入力してください。");
  if (task.departmentId && !all.departments.some((item) => item.id === task.departmentId)) errors.push("存在しない部署IDです。");
  for (const employeeId of task.employeeIds || []) {
    if (!all.employees.some((item) => item.id === employeeId)) errors.push(`存在しない社員IDです: ${employeeId}`);
  }
  if (task.parentTaskId) {
    if (task.parentTaskId === task.id) errors.push("自分自身を親タスクにはできません。");
    const parent = all.tasks.find((item) => item.id === task.parentTaskId);
    if (!parent) errors.push("存在しない親タスクです。");
    if (parent?.parentTaskId) errors.push("親子階層は2段階までです。");
    const childIds = all.tasks.filter((item) => item.parentTaskId === task.id).map((item) => item.id);
    if (childIds.includes(task.parentTaskId)) errors.push("親子タスクの循環参照はできません。");
  }
  return errors;
}

function normalizeTask(payload, existing = null) {
  const timestamp = nowIso();
  const status = payload.status || existing?.status || "idea";
  const completedAt = status === "completed"
    ? (existing?.completedAt || timestamp)
    : null;
  return {
    id: existing?.id || normalizeString(payload.id) || makeId("task"),
    title: normalizeString(payload.title),
    description: normalizeString(payload.description),
    departmentId: normalizeString(payload.departmentId) || null,
    employeeIds: arrayOfStrings(payload.employeeIds),
    startDate: normalizeString(payload.startDate) || null,
    endDate: normalizeString(payload.endDate) || null,
    status,
    priority: payload.priority || existing?.priority || "normal",
    progress: Number(payload.progress ?? existing?.progress ?? 0),
    parentTaskId: normalizeString(payload.parentTaskId) || null,
    tags: arrayOfStrings(payload.tags),
    notes: normalizeString(payload.notes),
    codexInstruction: normalizeString(payload.codexInstruction),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    completedAt
  };
}

function validateLink(link, root, settings) {
  const errors = [];
  if (!LINK_TYPES.includes(link.type)) errors.push("不正なリンク種別です。");
  if (!normalizeString(link.label)) errors.push("リンク名は必須です。");
  const value = normalizeString(link.value);
  if (["chatgpt", "github", "codex", "web", "note", "other"].includes(link.type)) {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) errors.push("URLはhttpまたはhttpsのみ利用できます。");
    } catch {
      errors.push("URLの形式が不正です。");
    }
  }
  if (["file", "folder"].includes(link.type)) {
    const allowedRoots = [path.resolve(root), ...(settings.allowedLocalRoots || []).map((item) => path.resolve(item))];
    const resolved = path.resolve(root, value);
    if (!allowedRoots.some((allowed) => resolved === allowed || resolved.startsWith(`${allowed}${path.sep}`))) {
      errors.push("ローカルパスはリポジトリ内、または許可済みルートのみ登録できます。");
    }
  }
  return errors;
}

function normalizeLink(payload, existing = null) {
  return {
    id: existing?.id || normalizeString(payload.id) || makeId("link"),
    taskId: normalizeString(payload.taskId) || null,
    type: payload.type || "web",
    label: normalizeString(payload.label),
    value: normalizeString(payload.value),
    createdAt: existing?.createdAt || nowIso()
  };
}

function normalizeArtifact(payload, existing = null) {
  const timestamp = nowIso();
  return {
    id: existing?.id || normalizeString(payload.id) || makeId("artifact"),
    taskId: normalizeString(payload.taskId) || null,
    title: normalizeString(payload.title),
    description: normalizeString(payload.description),
    type: ARTIFACT_TYPES.includes(payload.type) ? payload.type : "other",
    pathOrUrl: normalizeString(payload.pathOrUrl),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeDepartment(payload, existing = null) {
  return {
    id: existing?.id || normalizeString(payload.id) || makeId("dept"),
    name: normalizeString(payload.name),
    description: normalizeString(payload.description),
    sortOrder: Number(payload.sortOrder ?? existing?.sortOrder ?? 100),
    isActive: payload.isActive !== false
  };
}

function normalizeEmployee(payload, existing = null) {
  return {
    id: existing?.id || normalizeString(payload.id) || makeId("emp"),
    name: normalizeString(payload.name),
    role: normalizeString(payload.role),
    departmentId: normalizeString(payload.departmentId) || null,
    iconPath: normalizeString(payload.iconPath) || null,
    isActive: payload.isActive !== false
  };
}

function normalizeEvaluation(payload, existing = null, all = null) {
  const timestamp = nowIso();
  const taskId = normalizeString(payload.taskId) || existing?.taskId || "";
  const id = existing?.id || normalizeString(payload.id) || makeId("evaluation");
  const allEvaluations = all?.evaluations || [];
  const humanWorkMinutes = optionalNumber(payload.humanWorkMinutes ?? existing?.humanWorkMinutes);
  const estimatedManualMinutes = optionalNumber(payload.estimatedManualMinutes ?? existing?.estimatedManualMinutes);
  return {
    id,
    taskId,
    evaluationType: enumValue(EVALUATION_TYPES, payload.evaluationType, existing?.evaluationType, "final"),
    revision: Number(payload.revision ?? existing?.revision ?? nextEvaluationRevision(taskId, allEvaluations, id)),
    status: enumValue(EVALUATION_STATUSES, payload.status, existing?.status, "evaluated"),
    actors: normalizeActors(payload.actors ?? existing?.actors),
    aiWorkLevel: enumValue(AI_WORK_LEVELS, payload.aiWorkLevel, existing?.aiWorkLevel, undefined),
    completionLevel: enumValue(COMPLETION_LEVELS, payload.completionLevel, existing?.completionLevel, "completed"),
    humanRevisionLevel: enumValue(HUMAN_REVISION_LEVELS, payload.humanRevisionLevel, existing?.humanRevisionLevel, "none"),
    reworkCount: Number(payload.reworkCount ?? existing?.reworkCount ?? 0),
    humanWorkMinutes,
    estimatedManualMinutes,
    reusability: enumValue(REUSABILITY_LEVELS, payload.reusability, existing?.reusability, "unknown"),
    adoption: enumValue(ADOPTION_LEVELS, payload.adoption, existing?.adoption, "pending"),
    artifactIds: arrayOfStrings(payload.artifactIds ?? existing?.artifactIds),
    nextImprovement: normalizeString(payload.nextImprovement ?? existing?.nextImprovement),
    evaluatedBy: normalizeString(payload.evaluatedBy ?? existing?.evaluatedBy),
    evaluatedAt: normalizeString(payload.evaluatedAt ?? existing?.evaluatedAt),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeActors(value) {
  if (!Array.isArray(value)) return [];
  return value.map((actor) => ({
    type: normalizeString(actor?.type),
    employeeId: normalizeString(actor?.employeeId) || null,
    label: normalizeString(actor?.label),
    role: normalizeString(actor?.role) || "support"
  })).filter((actor) => actor.type || actor.employeeId || actor.label);
}

function validateEvaluation(evaluation, all) {
  const errors = [];
  if (!all.tasks.some((task) => task.id === evaluation.taskId)) errors.push("存在しないタスクIDです。");
  if (!EVALUATION_STATUSES.includes(evaluation.status)) errors.push("不正な振り返り状態です。");
  if (!EVALUATION_TYPES.includes(evaluation.evaluationType)) errors.push("不正な振り返り種別です。");
  if (evaluation.aiWorkLevel && !AI_WORK_LEVELS.includes(evaluation.aiWorkLevel)) errors.push("不正なAI業務レベルです。");
  if (!Number.isInteger(evaluation.revision) || evaluation.revision < 1) errors.push("版数は1以上の整数で入力してください。");
  if (!COMPLETION_LEVELS.includes(evaluation.completionLevel)) errors.push("不正な完了度です。");
  if (!HUMAN_REVISION_LEVELS.includes(evaluation.humanRevisionLevel)) errors.push("不正な人間の修正量です。");
  if (!REUSABILITY_LEVELS.includes(evaluation.reusability)) errors.push("不正な再利用区分です。");
  if (!ADOPTION_LEVELS.includes(evaluation.adoption)) errors.push("不正な採否区分です。");
  if (!Number.isInteger(evaluation.reworkCount) || evaluation.reworkCount < 0) errors.push("手戻り回数は0以上の整数で入力してください。");
  for (const key of ["humanWorkMinutes", "estimatedManualMinutes"]) {
    const value = evaluation[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) errors.push(`${key}は0以上の数値で入力してください。`);
  }
  if (normalizeString(evaluation.nextImprovement).length > 300) errors.push("次回変えることは300文字以内で入力してください。");
  for (const actor of evaluation.actors || []) {
    if (!EXECUTION_ACTOR_TYPES.includes(actor.type)) errors.push("不正な実行主体です。");
    if (!EXECUTION_ACTOR_ROLES.includes(actor.role)) errors.push("不正な実行主体の役割です。");
    if (actor.employeeId && !all.employees.some((employee) => employee.id === actor.employeeId)) errors.push(`存在しない社員IDです: ${actor.employeeId}`);
  }
  for (const artifactId of evaluation.artifactIds || []) {
    const artifact = all.artifacts.find((item) => item.id === artifactId);
    if (!artifact) {
      errors.push(`存在しない成果物IDです: ${artifactId}`);
    } else if (artifact.taskId && artifact.taskId !== evaluation.taskId) {
      errors.push(`別タスクの成果物は紐付けできません: ${artifactId}`);
    }
  }
  return errors;
}

function latestEvaluationForTask(taskId, evaluations) {
  return [...(evaluations || [])]
    .filter((item) => item.taskId === taskId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0] || null;
}

function evaluationStatusForTask(taskId, evaluations) {
  return latestEvaluationForTask(taskId, evaluations)?.status || "not_evaluated";
}

async function addActivity(root, activity) {
  const all = await loadAll(root);
  const settings = all.settings;
  const item = {
    id: makeId("activity"),
    type: activity.type || "note",
    targetType: activity.targetType || "system",
    targetId: activity.targetId || null,
    message: normalizeString(activity.message),
    createdAt: nowIso()
  };
  const next = [item, ...all.activity].slice(0, Number(settings.activityLimit || 1000));
  await writeJson(root, "activity", next);
  return item;
}

async function dashboard(root) {
  const all = await loadAll(root);
  const today = new Date();
  const dueLimit = new Date(today);
  dueLimit.setDate(today.getDate() + Number(all.settings.dashboardDueSoonDays || 7));
  const currentMonth = today.toISOString().slice(0, 7);
  const activeTasks = all.tasks.filter((task) => task.status !== "completed");
  const dueSoon = activeTasks
    .filter((task) => task.endDate && new Date(`${task.endDate}T23:59:59`) <= dueLimit)
    .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))
    .slice(0, 8);
  const recentlyUpdated = [...all.tasks].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 8);
  const recentArtifacts = [...all.artifacts].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 8);
  return {
    counts: {
      inProgress: activeTasks.length,
      review: all.tasks.filter((task) => task.status === "review").length,
      codexWorking: all.tasks.filter((task) => task.status === "codex_working").length,
      completedThisMonth: all.tasks.filter((task) => task.completedAt?.startsWith(currentMonth)).length
    },
    evaluationCounts: {
      notEvaluated: all.tasks.filter((task) => evaluationStatusForTask(task.id, all.evaluations) === "not_evaluated").length,
      deferred: all.tasks.filter((task) => evaluationStatusForTask(task.id, all.evaluations) === "deferred").length,
      evaluated: all.tasks.filter((task) => evaluationStatusForTask(task.id, all.evaluations) === "evaluated").length,
      notApplicable: all.tasks.filter((task) => evaluationStatusForTask(task.id, all.evaluations) === "not_applicable").length
    },
    dueSoon,
    recentlyUpdated,
    recentArtifacts,
    byEmployee: countBy(all.tasks, "employeeIds", all.employees),
    byDepartment: countBy(all.tasks, "departmentId", all.departments),
    recentActivity: all.activity.slice(0, 10)
  };
}

function countBy(tasks, key, master) {
  return master.map((item) => ({
    id: item.id,
    name: item.name,
    count: tasks.filter((task) => key === "employeeIds" ? task.employeeIds?.includes(item.id) : task[key] === item.id).length
  })).filter((item) => item.count > 0);
}

async function evaluationSummary(root) {
  const all = await loadAll(root);
  return buildEvaluationSummary(all);
}

function buildEvaluationSummary(all) {
  const evaluations = all.evaluations || [];
  const latestByTask = new Map();
  for (const evaluation of evaluations) {
    const current = latestByTask.get(evaluation.taskId);
    if (!current || String(evaluation.updatedAt || evaluation.createdAt).localeCompare(String(current.updatedAt || current.createdAt)) > 0) {
      latestByTask.set(evaluation.taskId, evaluation);
    }
  }
  const latest = [...latestByTask.values()];
  const actorTypeCounts = {};
  for (const evaluation of latest) {
    for (const actor of evaluation.actors || []) {
      actorTypeCounts[actor.type] = (actorTypeCounts[actor.type] || 0) + 1;
    }
  }
  const humanWorkMinutes = latest.reduce((sum, item) => sum + Number(item.humanWorkMinutes || 0), 0);
  const estimatedSavedMinutes = latest.reduce((sum, item) => {
    if (item.humanWorkMinutes === undefined || item.estimatedManualMinutes === undefined) return sum;
    return sum + (Number(item.estimatedManualMinutes) - Number(item.humanWorkMinutes));
  }, 0);
  return {
    evaluatedCount: latest.filter((item) => item.status === "evaluated").length,
    adoptionCount: latest.filter((item) => ["adopted", "partially_adopted"].includes(item.adoption)).length,
    majorRevisionCount: latest.filter((item) => ["major", "rebuild"].includes(item.humanRevisionLevel)).length,
    reusableArtifactCount: latest.filter((item) => ["direct", "with_changes"].includes(item.reusability)).length,
    humanWorkMinutes,
    estimatedSavedMinutes,
    actorTypeCounts,
    nextImprovements: latest
      .filter((item) => normalizeString(item.nextImprovement))
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        taskId: item.taskId,
        taskTitle: all.tasks.find((task) => task.id === item.taskId)?.title || item.taskId,
        nextImprovement: item.nextImprovement,
        updatedAt: item.updatedAt
      }))
  };
}

module.exports = {
  ADOPTION_LEVELS,
  AI_WORK_LEVELS,
  ARTIFACT_TYPES,
  COMPLETION_LEVELS,
  EVALUATION_STATUSES,
  EVALUATION_TYPES,
  EXECUTION_ACTOR_ROLES,
  EXECUTION_ACTOR_TYPES,
  HUMAN_REVISION_LEVELS,
  LINK_TYPES,
  PRIORITIES,
  REUSABILITY_LEVELS,
  TASK_STATUSES,
  addActivity,
  dashboard,
  evaluationStatusForTask,
  evaluationSummary,
  loadAll,
  normalizeArtifact,
  normalizeDepartment,
  normalizeEmployee,
  normalizeEvaluation,
  normalizeLink,
  normalizeTask,
  validateEvaluation,
  validateLink,
  validateTask,
  writeJson
};
