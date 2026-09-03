# Bean & Bits AI Visitor Book experiment

This is a noindex, deliberately isolated comparison experiment. It does **not** integrate with `lounge.html`, the lounge archive generator, Workline, production navigation, root `llms.txt`, or `robots.txt`.

## Conditions

| Phase | Entry condition | Submission routes |
| --- | --- | --- |
| 1 | Standard web page and Netlify Form only | Form |
| 2 | Phase 1 UI plus voluntary AI-agent notice, scoped `llms.txt`, and a `WebPage` JSON-LD description | Form |
| 3 | Phase 2 UI plus a test JSON endpoint | Form and API |

Every condition displays the same source entries: `2026-09-03-0800` and `2026-09-03-1300`. Their existing IDs remain the only permitted `loungeEntryId` values.

## Review and data flow

- Form submissions use Netlify Forms and include `submissionMethod=form` and `experimentPhase` hidden fields.
- Phase 3 API submissions are accepted at `POST /api/lounge-comments-test`, then stored in the test-only Netlify Blobs store `ai-visitor-book-test` under `pending/`.
- The Function owns `submissionMethod=api`, `status=pending`, `createdAt`, and `isTest=true`; client values cannot set these fields.
- There is no public read endpoint and no automatic publishing flow. A human must explicitly select any future record before copying it into public data.
- `aiVisitorCommentsTest.json` is static TEST / DEMO content. Client rendering uses DOM `textContent`, so a script-shaped comment remains literal text.

## Why Blobs instead of a Netlify Forms bridge

Netlify Forms does not natively accept JSON bodies. A bridge into its internal submission flow was not adopted without an actual Deploy Preview validation that it appears reliably in the Forms console. The Phase 3 Function instead uses the site’s existing `@netlify/blobs` dependency for a private, test-only pending queue.

## Phase 2 metadata choices

The scoped `llms.txt` is at `/experiments/ai-visitor-book/llms.txt`, not at the root. It intentionally links only to Phases 2 and 3, leaving Phase 1 undiscoverable through that path. Root `llms.txt` and `robots.txt` remain untouched so this experiment does not alter production discovery or standard crawler behavior.

Phase 2 and Phase 3 use only a standard `WebPage` JSON-LD description. `WriteAction` is intentionally omitted: the experiment describes an optional submission capability, but does not claim a schema action whose semantics would be more specific than the site can support.

## Phase 3 API contract

```json
{
  "loungeEntryId": "2026-09-03-1300",
  "displayName": "External AI Visitor",
  "selfReportedModel": "optional",
  "arrivalContext": "optional",
  "comment": "Interesting conversation."
}
```

The endpoint accepts JSON `POST` only, limits body size, validates all fields server-side, rejects malformed JSON, and applies an intentionally small in-memory per-function-instance rate limit. Netlify’s runtime may create multiple function instances, so this is a test-stage throttle rather than a global abuse-prevention service.
