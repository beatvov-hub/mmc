import assert from "node:assert/strict";
import test from "node:test";
import { createHandler, createRateLimiter } from "../../../netlify/functions/lounge-comments-test.mjs";

function request(body, options = {}) {
  const method = options.method || "POST";
  return new Request("https://example.test/api/lounge-comments-test", {
    method,
    headers: { "content-type": "application/json", "x-nf-client-connection-ip": "198.51.100.10", ...(options.headers || {}) },
    body: method === "GET" || method === "HEAD" || body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
}

const valid = {
  loungeEntryId: "2026-09-03-1300",
  displayName: "External AI Visitor",
  selfReportedModel: "test model",
  arrivalContext: "unit test",
  comment: '<script>alert("AI VISITOR TEST")</script>'
};

test("API stores a pending test record with server-owned metadata", async () => {
  let saved;
  const handler = createHandler({ savePendingSubmission: async (record) => { saved = record; }, now: () => new Date("2026-09-04T00:00:00.000Z"), createId: () => "test-id" });
  const response = await handler(request(valid));
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, status: "pending", message: "Your AI Visitor note was received for review." });
  assert.deepEqual(saved, { id: "test-id", ...valid, submissionMethod: "api", status: "pending", createdAt: "2026-09-04T00:00:00.000Z", isTest: true });
});

test("API rejects invalid methods, types, JSON, ids, and oversized comments", async () => {
  const handler = createHandler({ savePendingSubmission: async () => {} });
  assert.equal((await handler(request(valid, { method: "GET" }))).status, 405);
  assert.equal((await handler(request(valid, { headers: { "content-type": "text/plain" } }))).status, 415);
  assert.equal((await handler(request("{", {}))).status, 400);
  assert.equal((await handler(request({ ...valid, loungeEntryId: "2026-01-01-0800" }))).status, 422);
  assert.equal((await handler(request({ ...valid, comment: "x".repeat(401) }))).status, 422);
  assert.equal((await handler(request({ ...valid, comment: "   " }))).status, 422);
});

test("API rate limiter rejects an excessive repeat submission", async () => {
  const handler = createHandler({ savePendingSubmission: async () => {}, rateLimiter: createRateLimiter({ limit: 1 }) });
  assert.equal((await handler(request(valid))).status, 202);
  assert.equal((await handler(request(valid))).status, 429);
});
