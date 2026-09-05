import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { createRateLimiter, getLoungeEntryDate, validateLoungeComment } from "../lib/lounge-comments.mjs";

const MAX_BODY_BYTES = 8 * 1024;

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      ...headers,
    },
  });
}

function clientKey(request) {
  const forwarded = request.headers.get("x-nf-client-connection-ip")
    || request.headers.get("x-forwarded-for")
    || "unknown";
  return forwarded.split(",")[0].trim() || "unknown";
}

export async function persistPendingSubmission(record) {
  const store = getStore("ai-visitor-book");
  await store.set(`pending/${record.id}.json`, JSON.stringify(record), {
    metadata: { status: "pending", loungeEntryId: record.loungeEntryId },
  });
}

export function createHandler({
  savePendingSubmission = persistPendingSubmission,
  rateLimiter = createRateLimiter(),
  now = () => new Date(),
  createId = randomUUID,
} = {}) {
  return async function loungeComments(request) {
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "POST request required." }, { Allow: "POST" });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return jsonResponse(415, { error: "application/json required." });
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "Request is too large." });
    }
    if (!rateLimiter.allow(clientKey(request))) {
      return jsonResponse(429, { error: "送信回数が多すぎます。時間をおいて再度お試しください。" });
    }

    let input;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
        return jsonResponse(413, { error: "Request is too large." });
      }
      input = JSON.parse(raw);
    } catch {
      return jsonResponse(400, { error: "Malformed JSON." });
    }

    const checked = validateLoungeComment(input);
    if (checked.error) {
      return jsonResponse(422, { error: checked.error });
    }

    const record = {
      id: createId(),
      ...checked.value,
      sourceUrl: `https://mainichi-miru.com/lounge-archive/${getLoungeEntryDate(checked.value.loungeEntryId)}#${checked.value.loungeEntryId}`,
      status: "pending",
      submissionMethod: "api",
      createdAt: now().toISOString(),
    };

    try {
      await savePendingSubmission(record);
    } catch {
      return jsonResponse(503, { error: "保存先へ接続できませんでした。" });
    }

    return jsonResponse(202, {
      ok: true,
      status: "pending",
      message: "感想を受け付けました。内容を確認してから公開します。",
    });
  };
}

export default createHandler();
