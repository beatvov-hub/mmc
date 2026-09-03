const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const comments = JSON.parse(fs.readFileSync(path.join(root, "experiments/ai-visitor-book/aiVisitorCommentsTest.json"), "utf8"));
const script = fs.readFileSync(path.join(root, "experiments/ai-visitor-book/ai-visitor-book.js"), "utf8");
const entryIds = ["2026-09-03-0800", "2026-09-03-1300"];
const phasePage = (phase) => fs.readFileSync(path.join(root, `experiments/ai-visitor-book/${phase}/index.html`), "utf8");

function assertFormContract(page, phase) {
  assert.match(page, /<meta name="robots" content="noindex, noarchive"/);
  assert.equal((page.match(/name="ai-visitor-book-test"/g) || []).length, 2);
  assert.equal((page.match(/data-netlify="true"/g) || []).length, 2);
  assert.equal((page.match(new RegExp(`name="experimentPhase" value="${phase}"`, "g")) || []).length, 2);
  assert.equal((page.match(/name="submissionMethod" value="form"/g) || []).length, 2);
  entryIds.forEach((entryId) => {
    assert.match(page, new RegExp(`data-lounge-entry-id="${entryId}"`));
    assert.match(page, new RegExp(`name="loungeEntryId" value="${entryId}"`));
  });
  assert.equal((page.match(/name="displayName"[^>]*required/g) || []).length, 2);
  assert.equal((page.match(/name="arrivalContext"[^>]*maxlength="120"/g) || []).length, 2);
  assert.equal((page.match(/name="comment" rows="5" maxlength="400" required/g) || []).length, 2);
}

test("all phases retain the same two lounge logs and distinguish form submissions", () => {
  ["phase1", "phase2", "phase3"].forEach((phase) => assertFormContract(phasePage(phase), phase));
});

test("phase conditions stay separated", () => {
  const phase1 = phasePage("phase1");
  const phase2 = phasePage("phase2");
  const phase3 = phasePage("phase3");
  assert.doesNotMatch(phase1, /llms\.txt|application\/ld\+json|lounges-comments-test|lounge-comments-test|Test API/);
  assert.match(phase2, /Experiment llms\.txt/);
  assert.match(phase2, /application\/ld\+json/);
  assert.doesNotMatch(phase2, /lounge-comments-test|Test API/);
  assert.match(phase3, /POST \/api\/lounge-comments-test/);
  assert.match(phase3, /application\/ld\+json/);
});

test("only published test comments bind to their exact lounge entry and render as text", () => {
  entryIds.forEach((entryId) => {
    const published = comments.filter((comment) => comment.status === "published" && comment.loungeEntryId === entryId);
    assert.equal(published.length, 1);
    assert.equal(published[0].isTest, true);
  });
  assert.match(comments[0].comment, /<script>alert\(1\)<\/script>/);
  assert.match(script, /element\.textContent = value/);
  assert.doesNotMatch(script, /innerHTML/);
});

test("the experiment llms file only points to phases two and three", () => {
  const llms = fs.readFileSync(path.join(root, "experiments/ai-visitor-book/llms.txt"), "utf8");
  assert.match(llms, /phase2/);
  assert.match(llms, /phase3/);
  assert.doesNotMatch(llms, /phase1/);
});
