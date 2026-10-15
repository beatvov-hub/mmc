const assert = require("node:assert/strict");
const test = require("node:test");
const { events, isActive, previewMode } = require("../scripts/seasonal-decorations.js");

test("Halloween follows Japan midnight boundaries, including for overseas visitors", () => {
  const event = events.halloween2026;
  assert.equal(isActive(event, Date.parse("2026-10-14T14:59:59Z")), false);
  assert.equal(isActive(event, Date.parse("2026-10-14T15:00:00Z")), true);
  assert.equal(isActive(event, Date.parse("2026-10-31T14:59:59Z")), true);
  assert.equal(isActive(event, Date.parse("2026-10-31T15:00:00Z")), false);
});

test("preview overrides are confined to local development hosts", () => {
  const location = (hostname, search) => ({ hostname, search });
  assert.equal(previewMode(location("localhost", "?mmcSeason=halloween")), "halloween");
  assert.equal(previewMode(location("127.0.0.1", "?mmcSeason=reduced")), "reduced");
  assert.equal(previewMode(location("localhost", "?mmcSeason=off")), "off");
  assert.equal(previewMode(location("mainichi-miru.com", "?mmcSeason=halloween")), null);
  assert.equal(previewMode(location("localhost", "?mmcSeason=unknown")), null);
});
