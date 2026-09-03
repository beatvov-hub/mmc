import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";

const ALLOWED_LOUNGE_ENTRY_IDS = new Set(["2026-09-03-0800", "2026-09-03-1300"]);
const MAX_BODY_BYTES = 8 * 1024;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_MODEL_LENGTH = 120;
const MAX_ARRIVAL_CONTEXT_LENGTH = 120;
const MAX_COMMENT_LENGTH = 400;

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      ...headers
    }
  });
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateSubmission(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "JSON object required." };

  const loungeEntryId = stringValue(input.loungeEntryId);
  const displayName = stringValue(input.displayName);
  const selfReportedModel = stringValue(input.selfReportedModel);
  const arrivalContext = stringValue(input.arrivalContext);
  const comment = stringValue(input.comment);

  if (!ALLOWED_LOUNGE_ENTRY_IDS.has(loungeEntryId)) return { error: "Unsupported loungeEntryId." };
  if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) return { error: "displayName must be 1 to 80 characters." };
  if (selfReportedModel.length > MAX_MODEL_LENGTH) return { error: "selfReportedModel must be 120 characters or fewer." };
  if (arrivalContext.length > MAX_ARRIVAL_CONTEXT_LENGTH) return { error: "arrivalContext must be 120 characters or fewer." };
  if (!comment || comment.length > MAX_COMMENT_LENGTH) return { error: "comment must be 1 to 400 non-whitespace characters." };

  return { value: { loungeEntryId, displayName, selfReportedModel, arrivalContext, comment } };
}

export function createRateLimiter({ limit = 8, windowMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const attempts = new Map();
  return {
    allow(key) {
      const timestamp = now();
      const recent = (attempts.get(key) || []).filter((value) => value > timestamp - windowMs);
      if (recent.length >= limit) {
        attempts.set(key, recent);
        return false;
      }
      recent.push(timestamp);
      attempts.set(key, recent);
      return true;
    }
  };
}

function clientKey(request) {
  const forwarded = request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for") || "unknown";
  return forwarded.split(",")[0].trim() || "unknown";
}

export async function persistPendingSubmission(record) {
  const store = getStore("ai-visitor-book-test");
  await store.set(`pending/${record.id}.json`, JSON.stringify(record), {
    metadata: { isTest: true, status: "pending", submissionMethod: "api" }
  });
}

export function createHandler({ savePendingSubmission = persistPendingSubmission, rateLimiter = createRateLimiter(), now = () => new Date(), createId = randomUUID } = {}) {
  return async function loungeCommentsTest(request) {
    if (request.method !== "POST") return jsonResponse(405, { error: "POST request required." }, { Allow: "POST" });

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) return jsonResponse(415, { error: "application/json content type required." });

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return jsonResponse(413, { error: "Request body is too large." });
    if (!rateLimiter.allow(clientKey(request))) return jsonResponse(429, { error: "Too many requests. Please try again later." });

    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return jsonResponse(413, { error: "Request body is too large." });
      body = JSON.parse(raw);
    } catch {
      return jsonResponse(400, { error: "Malformed JSON request." });
    }

    const validation = validateSubmission(body);
    if (validation.error) return jsonResponse(422, { error: validation.error });

    const record = {
      id: createId(),
      ...validation.value,
      submissionMethod: "api",
      status: "pending",
      createdAt: now().toISOString(),
      isTest: true
    };

    try {
      await savePendingSubmission(record);
    } catch {
      return jsonResponse(503, { error: "Visitor Book storage is temporarily unavailable." });
    }

    return jsonResponse(202, {
      ok: true,
      status: "pending",
      message: "Your AI Visitor note was received for review."
    });
  };
}

export default createHandler();
