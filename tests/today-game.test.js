const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { gameWorks, selectTodayGame } = require("../scripts/today-game.js");

const atUtc = (year, month, day, hour, minute = 0) => Date.UTC(year, month - 1, day, hour, minute);

const works = [
  { slug: "tool", category: "社内ツール", title: "Tool" },
  { slug: "game-b", category: "ゲーム / パズル", title: "Game B", statusLabel: "MVP公開中", publicLabel: "ゲームを遊ぶ", publicUrl: "https://example.com/b" },
  { slug: "game-a", category: "ゲーム", title: "Game A", statusLabel: "公開中", publicLabel: "ゲームを遊ぶ", publicUrl: "https://example.com/a" },
  { slug: "dev", category: "ゲーム", statusLabel: "開発中", publicLabel: "ゲームを遊ぶ", publicUrl: "https://example.com/dev" },
  { slug: "empty", category: "ゲーム", statusLabel: "公開中", publicLabel: "ゲームを遊ぶ", publicUrl: " " },
  { slug: "detail", category: "ゲーム", statusLabel: "公開中", publicLabel: "ゲームを遊ぶ", publicUrl: "https://mainichi-miru.com/works/detail" },
  { slug: "intro", category: "ゲーム", statusLabel: "公開中", publicLabel: "作品紹介を見る", publicUrl: "https://example.com/info" }
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

test("no playable candidates hides the fallback and shows an empty state", async () => {
  const card = { hidden: false };
  const empty = { hidden: true };
  const section = { querySelector: selector => selector === '.today-game-card' ? card : empty };
  const context = { document: { querySelector: () => section }, fetch: async () => ({ ok: true, json: async () => [] }), URL, Date };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'scripts/today-game.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(card.hidden, true);
  assert.equal(empty.hidden, false);
});

test("the homepage includes a meaningful today-game fallback before JavaScript runs", () => {
  const homepage = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const section = homepage.match(/<section id="today-game"[\s\S]*?<\/section>/)?.[0] || "";

  assert.ok(section);
  assert.doesNotMatch(section.match(/^<section[^>]*>/)[0], /\shidden(?:\s|>)/);
  assert.match(section, /data-today-game-category>[^<]+</);
  assert.match(section, /data-today-game-title>[^<]+</);
  assert.match(section, /data-today-game-summary>[^<]+</);
  assert.match(section, /data-today-game-link href="https?:\/\/[^"\s]+"/);
});
