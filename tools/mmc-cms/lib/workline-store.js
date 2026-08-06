"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { atomicWriteJson, safePath } = require("./repository");

const DATA_DIR = "tools/mmc-cms/data";

const TASK_STATUSES = [
  "idea",
  "planned",
  "inProgress",
  "review",
  "publishDecision",
  "completed",
  "canceled",
  "inquiry",
  "proposal",
  "waitingResponse",
  "accepted",
  "production",
  "clientReview",
  "delivered",
  "invoiced",
  "paid",
  "declined"
];

const LEGACY_STATUS_MAP = {
  consulting: "idea",
  specification: "planned",
  waiting_codex: "planned",
  codex_working: "inProgress",
  revision: "inProgress",
  preparing_publish: "publishDecision",
  on_hold: "planned"
};
const TASK_TYPES = ["project", "task", "subtask"];
const WORKFLOW_TYPES = ["general", "external"];
const GENERAL_STATUSES = ["idea", "planned", "inProgress", "review", "publishDecision", "completed", "canceled"];
const EXTERNAL_STATUSES = ["inquiry", "proposal", "waitingResponse", "accepted", "production", "clientReview", "delivered", "invoiced", "paid", "declined", "canceled"];
const VISIBILITY_TYPES = ["publicCandidate", "internal", "confidential", "pending"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const LINK_TYPES = ["chatgpt", "github", "issue", "pull_request", "codex", "web", "file", "folder", "note", "homepage", "session", "other"];
const ARTIFACT_TYPES = ["article", "image", "document", "code", "website", "data", "note", "homepage", "session", "other"];
const EVALUATION_STATUSES = ["unevaluated", "later", "evaluated", "notApplicable", "not_evaluated", "deferred", "not_applicable"];
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
  decisionLogs: `${DATA_DIR}/workline-decision-logs.json`,
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
    decisionLogs: [],
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
  const [rawTasks, links, artifacts, decisionLogs, rawEvaluations, employees, departments, activity, settings] = await Promise.all([
    readJson(root, "tasks"),
    readJson(root, "links"),
    readJson(root, "artifacts"),
    readJson(root, "decisionLogs"),
    readJson(root, "evaluations"),
    readJson(root, "employees"),
    readJson(root, "departments"),
    readJson(root, "activity"),
    readJson(root, "settings")
  ]);
  const tasks = rawTasks.map(normalizeStoredTask);
  const evaluations = rawEvaluations.map(normalizeStoredEvaluation);
  if (JSON.stringify(rawTasks) !== JSON.stringify(tasks)) await writeJson(root, "tasks", tasks);
  if (JSON.stringify(rawEvaluations) !== JSON.stringify(evaluations)) await writeJson(root, "evaluations", evaluations);
  return { tasks, links, artifacts, decisionLogs, evaluations, employees, departments, activity, settings: { ...DEFAULT_SETTINGS, ...settings } };
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

function normalizeStatus(value, workflowType = "general") {
  const mapped = LEGACY_STATUS_MAP[value] || value;
  const allowed = workflowType === "external" ? EXTERNAL_STATUSES : GENERAL_STATUSES;
  if (allowed.includes(mapped)) return mapped;
  if (TASK_STATUSES.includes(mapped)) return mapped;
  return workflowType === "external" ? "inquiry" : "idea";
}

function normalizeEvaluationStatus(value) {
  if (value === "not_evaluated") return "unevaluated";
  if (value === "deferred") return "later";
  if (value === "not_applicable") return "notApplicable";
  return EVALUATION_STATUSES.includes(value) ? value : "unevaluated";
}

function normalizeTaskType(value, parentTaskId) {
  if (TASK_TYPES.includes(value)) return value;
  return parentTaskId ? "subtask" : "task";
}

function normalizeWorkflowType(value) {
  return WORKFLOW_TYPES.includes(value) ? value : "general";
}

function normalizeVisibility(value) {
  return VISIBILITY_TYPES.includes(value) ? value : "internal";
}

function normalizeStoredTask(task) {
  const workflowType = normalizeWorkflowType(task.workflowType);
  const parentTaskId = normalizeString(task.parentTaskId) || null;
  const employeeIds = arrayOfStrings(task.employeeIds);
  const primaryAssigneeId = normalizeString(task.primaryAssigneeId) || employeeIds[0] || null;
  const supportAssigneeIds = arrayOfStrings(task.supportAssigneeIds).length
    ? arrayOfStrings(task.supportAssigneeIds)
    : employeeIds.filter((id) => id !== primaryAssigneeId);
  return {
    ...task,
    type: normalizeTaskType(task.type, parentTaskId),
    workflowType,
    status: normalizeStatus(task.status, workflowType),
    visibility: normalizeVisibility(task.visibility),
    nextAction: normalizeString(task.nextAction),
    primaryAssigneeId,
    supportAssigneeIds,
    reviewerIds: arrayOfStrings(task.reviewerIds),
    employeeIds: [...new Set([primaryAssigneeId, ...supportAssigneeIds, ...arrayOfStrings(task.reviewerIds)].filter(Boolean))],
    parentTaskId,
    decisionLogs: Array.isArray(task.decisionLogs) ? task.decisionLogs : [],
    external: task.external && typeof task.external === "object" ? task.external : {}
  };
}

function normalizeStoredEvaluation(evaluation) {
  return {
    ...evaluation,
    workItemId: normalizeString(evaluation.workItemId || evaluation.taskId),
    taskId: normalizeString(evaluation.taskId || evaluation.workItemId),
    evaluationStatus: normalizeEvaluationStatus(evaluation.evaluationStatus || evaluation.status),
    status: normalizeEvaluationStatus(evaluation.status || evaluation.evaluationStatus),
    aiUsed: Boolean(evaluation.aiUsed ?? isAiEvaluationLike(evaluation)),
    humanMinutes: evaluation.humanMinutes ?? evaluation.humanWorkMinutes,
    estimatedMinutesWithoutAI: evaluation.estimatedMinutesWithoutAI ?? evaluation.estimatedManualMinutes,
    humanWorkMinutes: evaluation.humanWorkMinutes ?? evaluation.humanMinutes,
    estimatedManualMinutes: evaluation.estimatedManualMinutes ?? evaluation.estimatedMinutesWithoutAI,
    specificationChangeCount: Number(evaluation.specificationChangeCount || 0),
    goodPoints: normalizeString(evaluation.goodPoints),
    problems: normalizeString(evaluation.problems),
    needsImprovement: Boolean(evaluation.needsImprovement)
  };
}

function isAiEvaluationLike(evaluation) {
  return (evaluation.actors || []).some((actor) => ["ai_employee", "chatgpt_task", "codex", "internal_app"].includes(actor.type));
}

function validateTask(task, all) {
  const errors = [];
  if (!normalizeString(task.title)) errors.push("タスク名は必須です。");
  if (!TASK_TYPES.includes(task.type)) errors.push("不正な項目種別です。");
  if (!WORKFLOW_TYPES.includes(task.workflowType)) errors.push("不正な業務フローです。");
  const allowedStatuses = task.workflowType === "external" ? EXTERNAL_STATUSES : GENERAL_STATUSES;
  if (!allowedStatuses.includes(task.status)) errors.push("業務フローに合わないステータスです。");
  if (!VISIBILITY_TYPES.includes(task.visibility)) errors.push("不正な公開範囲です。");
  if (!PRIORITIES.includes(task.priority)) errors.push("不正な優先度です。");
  if (!Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100) errors.push("進捗率は0から100の整数で入力してください。");
  if (task.departmentId && !all.departments.some((item) => item.id === task.departmentId)) errors.push("存在しない部署IDです。");
  if (task.primaryAssigneeId && !all.employees.some((item) => item.id === task.primaryAssigneeId)) errors.push(`存在しない主担当IDです: ${task.primaryAssigneeId}`);
  for (const employeeId of task.supportAssigneeIds || []) {
    if (!all.employees.some((item) => item.id === employeeId)) errors.push(`存在しない補助担当IDです: ${employeeId}`);
  }
  for (const employeeId of task.reviewerIds || []) {
    if (!all.employees.some((item) => item.id === employeeId)) errors.push(`存在しない確認担当IDです: ${employeeId}`);
  }
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
  const workflowType = normalizeWorkflowType(payload.workflowType ?? existing?.workflowType);
  const status = payload.status !== undefined
    ? (LEGACY_STATUS_MAP[payload.status] || payload.status)
    : normalizeStatus(existing?.status, workflowType);
  const completedAt = status === "completed"
    ? (existing?.completedAt || timestamp)
    : null;
  const parentTaskId = normalizeString(payload.parentTaskId ?? existing?.parentTaskId) || null;
  const fallbackEmployeeIds = arrayOfStrings(payload.employeeIds ?? existing?.employeeIds);
  const primaryAssigneeId = normalizeString(payload.primaryAssigneeId ?? existing?.primaryAssigneeId) || fallbackEmployeeIds[0] || null;
  const supportAssigneeIds = arrayOfStrings(payload.supportAssigneeIds ?? existing?.supportAssigneeIds)
    .filter((id) => id !== primaryAssigneeId);
  const reviewerIds = arrayOfStrings(payload.reviewerIds ?? existing?.reviewerIds);
  const employeeIds = [...new Set([primaryAssigneeId, ...supportAssigneeIds, ...reviewerIds, ...fallbackEmployeeIds].filter(Boolean))];
  return {
    id: existing?.id || normalizeString(payload.id) || makeId("task"),
    title: normalizeString(payload.title),
    description: normalizeString(payload.description),
    type: normalizeTaskType(payload.type ?? existing?.type, parentTaskId),
    workflowType,
    visibility: normalizeVisibility(payload.visibility ?? existing?.visibility),
    nextAction: normalizeString(payload.nextAction ?? existing?.nextAction),
    departmentId: normalizeString(payload.departmentId) || null,
    primaryAssigneeId,
    supportAssigneeIds,
    reviewerIds,
    employeeIds,
    startDate: normalizeString(payload.startDate) || null,
    endDate: normalizeString(payload.endDate) || null,
    status,
    priority: payload.priority || existing?.priority || "normal",
    progress: Number(payload.progress ?? existing?.progress ?? 0),
    parentTaskId,
    tags: arrayOfStrings(payload.tags),
    notes: normalizeString(payload.notes),
    codexInstruction: normalizeString(payload.codexInstruction),
    external: normalizeExternalInfo(payload.external ?? existing?.external),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    completedAt
  };
}

function normalizeExternalInfo(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    clientName: normalizeString(source.clientName),
    projectName: normalizeString(source.projectName),
    proposedAmount: optionalNumber(source.proposedAmount),
    taxType: ["taxIncluded", "taxExcluded", ""].includes(source.taxType) ? source.taxType : "",
    proposedAt: normalizeString(source.proposedAt) || null,
    desiredDueDate: normalizeString(source.desiredDueDate) || null,
    deliverables: normalizeString(source.deliverables),
    invoiceStatus: normalizeString(source.invoiceStatus),
    paymentStatus: normalizeString(source.paymentStatus)
  };
}

function validateLink(link, root, settings) {
  const errors = [];
  if (!LINK_TYPES.includes(link.type)) errors.push("不正なリンク種別です。");
  if (!normalizeString(link.label)) errors.push("リンク名は必須です。");
  const value = normalizeString(link.value);
  if (["chatgpt", "github", "issue", "pull_request", "codex", "web", "note", "homepage", "session", "other"].includes(link.type)) {
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
  const taskId = normalizeString(payload.taskId || payload.workItemId) || existing?.taskId || existing?.workItemId || "";
  const id = existing?.id || normalizeString(payload.id) || makeId("evaluation");
  const allEvaluations = all?.evaluations || [];
  const humanWorkMinutes = optionalNumber(payload.humanWorkMinutes ?? existing?.humanWorkMinutes);
  const estimatedManualMinutes = optionalNumber(payload.estimatedManualMinutes ?? existing?.estimatedManualMinutes);
  const humanMinutes = optionalNumber(payload.humanMinutes ?? humanWorkMinutes);
  const estimatedMinutesWithoutAI = optionalNumber(payload.estimatedMinutesWithoutAI ?? estimatedManualMinutes);
  const rawEvaluationStatus = payload.evaluationStatus ?? payload.status;
  const evaluationStatus = rawEvaluationStatus !== undefined
    ? (rawEvaluationStatus === "not_evaluated" ? "unevaluated" : rawEvaluationStatus === "deferred" ? "later" : rawEvaluationStatus === "not_applicable" ? "notApplicable" : rawEvaluationStatus)
    : normalizeEvaluationStatus(existing?.evaluationStatus || existing?.status);
  return {
    id,
    taskId,
    workItemId: taskId,
    evaluationType: enumValue(EVALUATION_TYPES, payload.evaluationType, existing?.evaluationType, "final"),
    revision: Number(payload.revision ?? existing?.revision ?? nextEvaluationRevision(taskId, allEvaluations, id)),
    status: evaluationStatus,
    evaluationStatus,
    reviewMode: normalizeString(payload.reviewMode ?? existing?.reviewMode) || "quick",
    aiUsed: Boolean(payload.aiUsed ?? existing?.aiUsed),
    aiTools: arrayOfStrings(payload.aiTools ?? existing?.aiTools),
    aiTasks: normalizeString(payload.aiTasks ?? existing?.aiTasks),
    humanChecks: normalizeString(payload.humanChecks ?? existing?.humanChecks),
    actors: normalizeActors(payload.actors ?? existing?.actors),
    aiWorkLevel: enumValue(AI_WORK_LEVELS, payload.aiWorkLevel, existing?.aiWorkLevel, undefined),
    completionLevel: enumValue(COMPLETION_LEVELS, payload.completionLevel, existing?.completionLevel, "completed"),
    humanRevisionLevel: enumValue(HUMAN_REVISION_LEVELS, payload.humanRevisionLevel, existing?.humanRevisionLevel, "none"),
    reworkCount: Number(payload.reworkCount ?? existing?.reworkCount ?? 0),
    specificationChangeCount: Number(payload.specificationChangeCount ?? existing?.specificationChangeCount ?? 0),
    humanMinutes,
    estimatedMinutesWithoutAI,
    humanWorkMinutes,
    estimatedManualMinutes,
    goodPoints: normalizeString(payload.goodPoints ?? existing?.goodPoints),
    problems: normalizeString(payload.problems ?? existing?.problems),
    reusability: enumValue(REUSABILITY_LEVELS, payload.reusability, existing?.reusability, "unknown"),
    adoption: enumValue(ADOPTION_LEVELS, payload.adoption, existing?.adoption, "pending"),
    artifactIds: arrayOfStrings(payload.artifactIds ?? existing?.artifactIds),
    nextImprovement: normalizeString(payload.nextImprovement ?? existing?.nextImprovement),
    needsImprovement: Boolean(payload.needsImprovement ?? existing?.needsImprovement),
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
  if (!EVALUATION_STATUSES.includes(evaluation.status) || !["unevaluated", "later", "evaluated", "notApplicable"].includes(evaluation.evaluationStatus)) errors.push("不正な振り返り状態です。");
  if (!EVALUATION_TYPES.includes(evaluation.evaluationType)) errors.push("不正な振り返り種別です。");
  if (evaluation.aiWorkLevel && !AI_WORK_LEVELS.includes(evaluation.aiWorkLevel)) errors.push("不正なAI業務レベルです。");
  if (!Number.isInteger(evaluation.revision) || evaluation.revision < 1) errors.push("版数は1以上の整数で入力してください。");
  if (!COMPLETION_LEVELS.includes(evaluation.completionLevel)) errors.push("不正な完了度です。");
  if (!HUMAN_REVISION_LEVELS.includes(evaluation.humanRevisionLevel)) errors.push("不正な人間の修正量です。");
  if (!REUSABILITY_LEVELS.includes(evaluation.reusability)) errors.push("不正な再利用区分です。");
  if (!ADOPTION_LEVELS.includes(evaluation.adoption)) errors.push("不正な採否区分です。");
  if (!Number.isInteger(evaluation.reworkCount) || evaluation.reworkCount < 0) errors.push("手戻り回数は0以上の整数で入力してください。");
  if (!Number.isInteger(evaluation.specificationChangeCount) || evaluation.specificationChangeCount < 0) errors.push("仕様変更回数は0以上の整数で入力してください。");
  for (const key of ["humanWorkMinutes", "estimatedManualMinutes", "humanMinutes", "estimatedMinutesWithoutAI"]) {
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

function normalizeDecisionLog(payload, existing = null) {
  const timestamp = nowIso();
  return {
    id: existing?.id || normalizeString(payload.id) || makeId("decision"),
    workItemId: normalizeString(payload.workItemId || payload.taskId || existing?.workItemId || existing?.taskId),
    taskId: normalizeString(payload.taskId || payload.workItemId || existing?.taskId || existing?.workItemId),
    decidedAt: normalizeString(payload.decidedAt ?? existing?.decidedAt) || timestamp.slice(0, 10),
    decidedBy: normalizeString(payload.decidedBy ?? existing?.decidedBy),
    summary: normalizeString(payload.summary ?? existing?.summary),
    reason: normalizeString(payload.reason ?? existing?.reason),
    createdAt: existing?.createdAt || timestamp
  };
}

function validateDecisionLog(decisionLog, all) {
  const errors = [];
  if (!all.tasks.some((task) => task.id === decisionLog.workItemId)) errors.push("存在しない項目IDです。");
  if (!decisionLog.summary) errors.push("決定内容は必須です。");
  if (!decisionLog.decidedAt) errors.push("決定日は必須です。");
  return errors;
}

function latestEvaluationForTask(taskId, evaluations) {
  return [...(evaluations || [])]
    .filter((item) => item.taskId === taskId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0] || null;
}

function evaluationStatusForTask(taskId, evaluations) {
  return latestEvaluationForTask(taskId, evaluations)?.evaluationStatus || "unevaluated";
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
      inProgress: activeTasks.filter((task) => ["inProgress", "production"].includes(task.status)).length,
      review: all.tasks.filter((task) => task.status === "review").length,
      externalWaiting: all.tasks.filter((task) => ["proposal", "waitingResponse", "clientReview"].includes(task.status)).length,
      completedThisMonth: all.tasks.filter((task) => task.completedAt?.startsWith(currentMonth)).length
    },
    evaluationCounts: {
      notEvaluated: all.tasks.filter((task) => evaluationStatusForTask(task.id, all.evaluations) === "unevaluated").length,
      deferred: all.tasks.filter((task) => evaluationStatusForTask(task.id, all.evaluations) === "later").length,
      evaluated: all.tasks.filter((task) => evaluationStatusForTask(task.id, all.evaluations) === "evaluated").length,
      notApplicable: all.tasks.filter((task) => evaluationStatusForTask(task.id, all.evaluations) === "notApplicable").length
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
  const humanWorkMinutes = latest.reduce((sum, item) => sum + Number(item.humanMinutes ?? item.humanWorkMinutes ?? 0), 0);
  const estimatedSavedMinutes = latest.reduce((sum, item) => {
    const human = item.humanMinutes ?? item.humanWorkMinutes;
    const estimated = item.estimatedMinutesWithoutAI ?? item.estimatedManualMinutes;
    if (human === undefined || estimated === undefined) return sum;
    return sum + (Number(estimated) - Number(human));
  }, 0);
  return {
    aiUsedCount: latest.filter((item) => item.aiUsed || isAiEvaluationLike(item)).length,
    evaluatedCount: latest.filter((item) => item.evaluationStatus === "evaluated").length,
    evaluatedRate: all.tasks.length ? Math.round((latest.filter((item) => item.evaluationStatus === "evaluated").length / all.tasks.length) * 100) : 0,
    needsImprovementCount: latest.filter(needsImprovementEvaluation).length,
    reworkCount: latest.reduce((sum, item) => sum + Number(item.reworkCount || 0), 0),
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

function needsImprovementEvaluation(item) {
  return Boolean(item.needsImprovement) ||
    ["major", "rebuild"].includes(item.humanRevisionLevel) ||
    item.adoption === "rejected" ||
    Number(item.reworkCount || 0) >= 3 ||
    ["incomplete", "cancelled"].includes(item.completionLevel);
}

module.exports = {
  ADOPTION_LEVELS,
  AI_WORK_LEVELS,
  ARTIFACT_TYPES,
  COMPLETION_LEVELS,
  EVALUATION_STATUSES,
  EVALUATION_TYPES,
  EXTERNAL_STATUSES,
  EXECUTION_ACTOR_ROLES,
  EXECUTION_ACTOR_TYPES,
  GENERAL_STATUSES,
  HUMAN_REVISION_LEVELS,
  LINK_TYPES,
  PRIORITIES,
  REUSABILITY_LEVELS,
  TASK_TYPES,
  TASK_STATUSES,
  VISIBILITY_TYPES,
  WORKFLOW_TYPES,
  addActivity,
  dashboard,
  evaluationStatusForTask,
  evaluationSummary,
  loadAll,
  normalizeArtifact,
  normalizeDepartment,
  normalizeEmployee,
  normalizeEvaluation,
  normalizeDecisionLog,
  normalizeLink,
  normalizeTask,
  validateDecisionLog,
  validateEvaluation,
  validateLink,
  validateTask,
  writeJson
};
