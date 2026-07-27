"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { detectUrlCandidates, validateForensics, validateLounge } = require("../lib/validator");

function validArticle() {
  return {
    id: "case-20260727",
    publishedAt: "2026-07-27",
    title: "テスト記事",
    shortTitle: "テスト",
    category: "verification",
    difficulty: "beginner",
    targetAudience: ["読者"],
    summary: "要約",
    scenario: { headline: "見出し", description: "説明", whyItMatters: "重要性" },
    question: {
      text: "確認することは？",
      choices: [{ id: "source", label: "情報源", description: "確認する" }],
      recommendedAnswers: ["source"],
      explanation: "解説"
    },
    inspectionPoints: [{ title: "情報源", description: "確認", priority: "high" }],
    verificationLevel: 2,
    verificationLabel: "情報源を確認",
    verificationMessage: "確認しましょう",
    verdict: { label: "要確認", description: "説明", confidence: "high" },
    safeActions: [{ action: "確認", reason: "安全" }],
    avoidActions: [{ action: "拡散", reason: "危険" }],
    positiveUse: { title: "活用", description: "説明", examples: ["例"] },
    makotoComment: "コメント",
    oneLineLesson: "一言",
    tags: ["確認"],
    sources: [{ title: "資料", publisher: "官庁", sourceType: "government", publishedAt: "2026-07-01", url: "https://example.com/source" }],
    visualSuggestion: { mainVisual: "画像案", cardIcon: "確認", accentTone: "calm" }
  };
}

test("AI鑑識室の有効な記事を受け付ける", () => {
  const article = validArticle();
  article.caseImage = {
    src: "image/ai-forensics/case-20260727-001.jpg",
    alt: "確認する場面",
    caption: "確認のイメージ"
  };
  const result = validateForensics(article, { availableImages: [article.caseImage.src] });
  assert.deepEqual(result.errors, []);
});

test("推奨回答が選択肢にない場合は停止する", () => {
  const article = validArticle();
  article.question.recommendedAnswers = ["missing"];
  const result = validateForensics(article);
  assert.ok(result.errors.some((message) => message.includes("推奨回答")));
});

test("不正URLとリポジトリ外画像を停止する", () => {
  const article = validArticle();
  article.sources[0].url = "javascript:alert(1)";
  article.caseImage = "../secret.jpg";
  const result = validateForensics(article, { availableImages: [] });
  assert.ok(result.errors.some((message) => message.includes("URL")));
  assert.ok(result.errors.some((message) => message.includes("画像")));
});

test("壊れたMarkdownリンクは候補として提示し、自動変更しない", () => {
  const value = { note: "参考: [公式] (https://example.com/page)" };
  const candidates = detectUrlCandidates(value);
  assert.equal(value.note, "参考: [公式] (https://example.com/page)");
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].suggested, "参考: [公式](https://example.com/page)");
});

test("ラウンジIDと日付・時刻の不整合を停止する", () => {
  const result = validateLounge({
    id: "2026-07-27-1200",
    date: "2026-07-27",
    time: "09:00",
    weekday: "月",
    period: "朝",
    title: "朝",
    participants: ["誠"],
    content: [{ type: "talks", items: [{ speaker: "誠", lines: [{ type: "text", text: "「確認します。」" }] }] }]
  });
  assert.ok(result.errors.some((message) => message.includes("ID")));
});

module.exports = { validArticle };
