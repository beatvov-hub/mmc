const test = require("node:test");
const assert = require("node:assert/strict");
const { gameWorks, selectTodayGame } = require("../scripts/today-game.js");

const atUtc = (year, month, day, hour, minute = 0) => Date.UTC(year, month - 1, day, hour, minute);

const works = [
  { slug: "tool", category: "社内ツール", title: "Tool" },
  { slug: "game-b", category: "ゲーム / パズル", title: "Game B" },
  { slug: "game-a", category: "ゲーム", title: "Game A" }
];

test("gameWorks excludes non-game works and keeps a stable order", () => {
  assert.deepEqual(gameWorks(works).map((work) => work.slug), ["game-a", "game-b"]);
});

test("the same JST game day always selects the same game", () => {
  const beforeReload = selectTodayGame(works, atUtc(2026, 9, 15, 5, 0));
  const afterReload = selectTodayGame(works, atUtc(2026, 9, 15, 18, 0));
  assert.equal(beforeReload.slug, afterReload.slug);
});

test("selection changes at 08:00 JST", () => {
  const beforeSwitch = selectTodayGame(works, atUtc(2026, 9, 14, 22, 59));
  const atSwitch = selectTodayGame(works, atUtc(2026, 9, 14, 23, 0));
  assert.notEqual(beforeSwitch.slug, atSwitch.slug);
});

test("an empty game list returns no selection", () => {
  assert.equal(selectTodayGame([{ slug: "tool", category: "ツール" }]), null);
});
