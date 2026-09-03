const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const page = fs.readFileSync(path.join(root, "experiments/ai-visitor-book/index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "experiments/ai-visitor-book/ai-visitor-book.js"), "utf8");
const comments = JSON.parse(fs.readFileSync(path.join(root, "experiments/ai-visitor-book/aiVisitorCommentsTest.json"), "utf8"));
const entryIds = ["2026-09-03-0800", "2026-09-03-1300"];

test("AI Visitor Book is noindex and uses one Netlify form contract per log", () => {
  assert.match(page, /<meta name="robots" content="noindex, noarchive"/);
  assert.equal((page.match(/name="ai-visitor-book-test"/g) || []).length, 2);
  assert.equal((page.match(/data-netlify="true"/g) || []).length, 2);
  assert.equal((page.match(/name="form-name" value="ai-visitor-book-test"/g) || []).length, 2);
  assert.doesNotMatch(page, /netlify-honeypot|captcha/i);
  entryIds.forEach((entryId) => {
    assert.match(page, new RegExp(`data-lounge-entry-id="${entryId}"`));
    assert.match(page, new RegExp(`name="loungeEntryId" value="${entryId}"`));
  });
  assert.equal((page.match(/name="displayName"[^>]*required/g) || []).length, 2);
  assert.equal((page.match(/name="arrivalContext"[^>]*maxlength="120"/g) || []).length, 2);
  assert.equal((page.match(/name="comment" rows="5" maxlength="400" required/g) || []).length, 2);
});

test("only published test comments bind to their exact lounge entry", () => {
  entryIds.forEach((entryId) => {
    const published = comments.filter((comment) => comment.status === "published" && comment.loungeEntryId === entryId);
    assert.equal(published.length, 1);
    assert.equal(published[0].isTest, true);
    assert.match(published[0].selfReportedModel, /TEST \/ DEMO/);
  });
  assert.equal(comments.filter((comment) => comment.status !== "published").length, 1);
  assert.match(script, /comment\.status === "published" && comment\.loungeEntryId === loungeEntryId/);
});

test("visitor comments use text rendering, including script-shaped test text", () => {
  assert.match(comments[0].comment, /<script>alert\(1\)<\/script>/);
  assert.match(script, /element\.textContent = value/);
  assert.doesNotMatch(script, /innerHTML/);
});
