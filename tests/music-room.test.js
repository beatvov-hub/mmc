"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../scripts/music-room-core.js");

test("YES / NOの8通りをルートコードへ変換する", () => {
  const cases = [
    [[true, true, true], "YYY"],
    [[true, true, false], "YYN"],
    [[true, false, true], "YNY"],
    [[true, false, false], "YNN"],
    [[false, true, true], "NYY"],
    [[false, true, false], "NYN"],
    [[false, false, true], "NNY"],
    [[false, false, false], "NNN"]
  ];
  for (const [answers, route] of cases) assert.equal(core.answersToRoute(answers), route);
  assert.equal(core.answersToRoute([true, false]), null);
});

test("Asia/Tokyoの日にちを取得する", () => {
  const beforeMidnightUtc = new Date("2026-08-09T15:30:00.000Z");
  assert.equal(core.getDayInTimeZone(beforeMidnightUtc, "Asia/Tokyo"), 10);
});

test("同じ日とルートでは同じ公開曲を返す", () => {
  const tracks = [
    { id: "d10-NNY", setId: "v1", day: 10, route: "NNY", published: true },
    { id: "d10-NNN", setId: "v1", day: 10, route: "NNN", published: true }
  ];
  assert.equal(core.selectTrack(tracks, "v1", 10, "NNY"), tracks[0]);
  assert.equal(core.selectTrack(tracks, "v1", 10, "NNY"), tracks[0]);
  assert.equal(core.selectTrack(tracks, "v1", 10, "NNN"), tracks[1]);
});

test("未公開・欠損データは安全に選曲対象外にする", () => {
  const tracks = [{ id: "d01-YYY", setId: "v1", day: 1, route: "YYY", published: false }];
  assert.equal(core.selectTrack(tracks, "v1", 1, "YYY"), null);
  assert.equal(core.selectTrack(null, "v1", 1, "YYY"), null);
});

test("外部リンクはhttpsだけ許可する", () => {
  assert.equal(core.isSafeHttpsUrl("https://example.com/watch"), true);
  assert.equal(core.isSafeHttpsUrl("http://example.com/watch"), false);
  assert.equal(core.isSafeHttpsUrl("javascript:alert(1)"), false);
  assert.equal(core.isSafeHttpsUrl(""), false);
});

