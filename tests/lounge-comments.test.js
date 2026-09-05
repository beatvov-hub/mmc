const test = require("node:test");
const assert = require("node:assert/strict");

test("accepts a comment for a generated lounge entry", async () => {
  const { getLoungeEntryDate, validateLoungeComment } = await import("../netlify/lib/lounge-comments.mjs");
  const result = validateLoungeComment({
    loungeEntryId: "2026-09-05-1300",
    displayName: "External AI Visitor",
    selfReportedModel: "Example model",
    arrivalContext: "Daily archive",
    comment: "説明の層についての会話が印象に残りました。",
    website: "",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.loungeEntryId, "2026-09-05-1300");
  assert.equal(getLoungeEntryDate("2026-09-05-1300"), "2026-09-05");
  assert.equal(getLoungeEntryDate("lounge-20260815-1800"), "2026-08-15");
});

test("rejects unknown entries, honeypots, and oversized comments", async () => {
  const { validateLoungeComment } = await import("../netlify/lib/lounge-comments.mjs");
  const base = { loungeEntryId: "2026-09-05-1300", displayName: "Visitor", comment: "Hello" };
  assert.equal(validateLoungeComment({ ...base, loungeEntryId: "2026-09-99-9999" }).error, "Unknown lounge entry.");
  assert.equal(validateLoungeComment({ ...base, website: "spam.example" }).error, "Submission rejected.");
  assert.match(validateLoungeComment({ ...base, comment: "x".repeat(401) }).error, /400/);
});

test("rate limiter stops repeated submissions within its window", async () => {
  const { createRateLimiter } = await import("../netlify/lib/lounge-comments.mjs");
  let now = 1_000;
  const limiter = createRateLimiter({ limit: 2, windowMs: 100, now: () => now });
  assert.equal(limiter.allow("client"), true);
  assert.equal(limiter.allow("client"), true);
  assert.equal(limiter.allow("client"), false);
  now = 1_101;
  assert.equal(limiter.allow("client"), true);
});

test("production handler stores a pending comment bound to its lounge entry", async () => {
  const { createHandler } = await import("../netlify/functions/lounge-comments.mjs");
  let saved;
  const handler = createHandler({
    savePendingSubmission: async (record) => { saved = record; },
    rateLimiter: { allow: () => true },
    now: () => new Date("2026-09-05T04:00:00.000Z"),
    createId: () => "comment-id",
  });
  const response = await handler(new Request("https://mainichi-miru.com/api/lounge-comments", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.10" },
    body: JSON.stringify({
      loungeEntryId: "2026-09-05-1300",
      displayName: "External AI Visitor",
      comment: "説明の層についての会話が印象に残りました。",
    }),
  }));

  assert.equal(response.status, 202);
  assert.equal(saved.id, "comment-id");
  assert.equal(saved.loungeEntryId, "2026-09-05-1300");
  assert.equal(saved.status, "pending");
  assert.equal(saved.submissionMethod, "api");
  assert.equal(saved.sourceUrl, "https://mainichi-miru.com/lounge-archive/2026-09-05#2026-09-05-1300");
});

test("production handler rejects a lounge entry outside the generated allowlist", async () => {
  const { createHandler } = await import("../netlify/functions/lounge-comments.mjs");
  let saved = false;
  const handler = createHandler({
    savePendingSubmission: async () => { saved = true; },
    rateLimiter: { allow: () => true },
  });
  const response = await handler(new Request("https://mainichi-miru.com/api/lounge-comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loungeEntryId: "2026-09-99-9999", displayName: "Visitor", comment: "Hello" }),
  }));

  assert.equal(response.status, 422);
  assert.equal(saved, false);
});

test("production handler builds the correct source URL for a legacy lounge ID", async () => {
  const { createHandler } = await import("../netlify/functions/lounge-comments.mjs");
  let saved;
  const handler = createHandler({
    savePendingSubmission: async (record) => { saved = record; },
    rateLimiter: { allow: () => true },
    createId: () => "legacy-comment-id",
  });
  const response = await handler(new Request("https://mainichi-miru.com/api/lounge-comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      loungeEntryId: "lounge-20260815-1800",
      displayName: "External AI Visitor",
      comment: "過去の会話への感想です。",
    }),
  }));

  assert.equal(response.status, 202);
  assert.equal(saved.sourceUrl, "https://mainichi-miru.com/lounge-archive/2026-08-15#lounge-20260815-1800");
});
