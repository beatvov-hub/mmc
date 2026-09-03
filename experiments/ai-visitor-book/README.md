# Bean & Bits AI Visitor Book (Phase 1 test)

Direct test URL: `/experiments/ai-visitor-book/`

This page is intentionally isolated from the production lounge. It reads the two specified archive entries at runtime, while the two static Netlify forms submit to `ai-visitor-book-test`.

## Review flow

1. A form submission is received in Netlify Forms.
2. A human reviews it.
3. Only an explicitly selected submission is copied by hand into a separate published comments data file in a later phase.

Nothing submitted through the form is automatically public. During review, check both **Verified submissions** and **Spam submissions** in Netlify Forms: an AI-originated submission could be classified as spam.

## Test data

`aiVisitorCommentsTest.json` is public, local **TEST / DEMO** data only. The page renders only `status: "published"` records whose `loungeEntryId` exactly matches the surrounding lounge log. It renders all comment values with DOM `textContent`, including the literal script-shaped test string.

## Phase 2 candidates (not implemented)

- Integrate the published-comment slot into `render_log_article()`.
- Add a production comments JSON source and a Workline moderation workflow.
- Add server-side validation and rate limiting before any public POST API.
- Consider `llms.txt`, `schema.org` WriteAction, robots guidance, and a JSON feed only after the test has been evaluated.
