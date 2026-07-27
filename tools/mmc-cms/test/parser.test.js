"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseLoungeDraft, periodForTime, weekdayForDate } = require("../lib/parser");

test("ラウンジ原稿から基本情報と主要ブロックを抽出する", () => {
  const draft = `# 2026年7月27日（月） 17:00
# 夕方のラウンジ観測記録
参加者：ほのちゃん、誠、所長

夕方の光がBean & Bitsに差し込む。

**ほのちゃん**
「お疲れさまです。」
（コーヒーを置く。）

**所長**：「今日も確認しましょう。」

## ホワイトボード
> 余白は、未来の景色。 — 所長

## 今日の一言
**誠**：迷ったら、一次情報へ戻りましょう。`;

  const result = parseLoungeDraft(draft);
  assert.equal(result.entry.id, "2026-07-27-1700");
  assert.equal(result.entry.weekday, "月");
  assert.equal(result.entry.period, "夕方");
  assert.deepEqual(result.entry.participants, ["ほのちゃん", "誠", "所長"]);
  assert.equal(result.entry.content[0].type, "scene");
  assert.equal(result.entry.content[1].type, "talks");
  assert.equal(result.entry.content[1].items[0].lines[1].type, "note");
  assert.equal(result.entry.content.find((block) => block.type === "quote").cite, "所長");
  assert.equal(result.entry.content.find((block) => block.type === "dailyWords").items[0].speaker, "誠");
});

test("日付と時刻がない原稿には決定的な既定値を入れる", () => {
  const now = new Date(2026, 6, 28, 12, 0, 0);
  const result = parseLoungeDraft("**誠**\n「確認します。」", now);
  assert.equal(result.entry.date, "2026-07-28");
  assert.equal(result.entry.time, "09:00");
  assert.equal(result.entry.id, "2026-07-28-0900");
  assert.ok(result.warnings.length >= 2);
});

test("時間帯と曜日を算出する", () => {
  assert.equal(periodForTime("23:00"), "深夜");
  assert.equal(periodForTime("12:00"), "昼");
  assert.equal(weekdayForDate("2026-07-27"), "月");
});

test("空行を挟んで続く情景文を一つのブロックへまとめる", () => {
  const draft = `# 2026年7月28日（火） 09:00
# 朝のラウンジ観測記録

火曜日の朝。

窓からやわらかな光が差し込む。

カウンターにはコーヒーが並んでいる。

**誠**
「今日も確認します。」`;

  const result = parseLoungeDraft(draft);
  assert.equal(result.entry.content.length, 2);
  assert.deepEqual(result.entry.content[0], {
    type: "scene",
    paragraphs: [
      "火曜日の朝。",
      "窓からやわらかな光が差し込む。",
      "カウンターにはコーヒーが並んでいる。"
    ]
  });
  assert.equal(result.entry.content[1].type, "talks");
});
