"use strict";

const {
  CATEGORIES,
  DIFFICULTIES,
  LOUNGE_PERIODS,
  REQUIRED_FORENSICS_KEYS,
  SOURCE_TYPES,
  WEEKDAYS
} = require("./constants");

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateLounge(entry) {
  const errors = [];
  const warnings = [];
  if (!plainObject(entry)) return { errors: ["ラウンジデータはオブジェクトにしてください。"], warnings };
  for (const key of ["id", "date", "time", "weekday", "period", "title", "participants", "content"]) {
    if (!(key in entry)) errors.push(`必須項目 ${key} がありません。`);
  }
  if (!validDate(entry.date)) errors.push("日付は YYYY-MM-DD 形式の実在する日付にしてください。");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(entry.time || ""))) errors.push("時刻は HH:MM 形式にしてください。");
  if (!WEEKDAYS.includes(entry.weekday)) errors.push("曜日は 日〜土 の1文字にしてください。");
  if (!LOUNGE_PERIODS.includes(entry.period)) errors.push("時間帯が不正です。");
  const expectedId = validDate(entry.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(entry.time || ""))
    ? `${entry.date}-${entry.time.replace(":", "")}` : "";
  if (expectedId && entry.id !== expectedId) errors.push(`IDは日付と時刻に合わせて ${expectedId} にしてください。`);
  if (!String(entry.title || "").trim()) errors.push("タイトルを入力してください。");
  if (!Array.isArray(entry.participants)) errors.push("参加者は配列にしてください。");
  if (!Array.isArray(entry.content) || !entry.content.length) errors.push("本文ブロックを1つ以上追加してください。");
  if (Array.isArray(entry.content)) {
    entry.content.forEach((block, index) => {
      const label = `ブロック${index + 1}`;
      if (!plainObject(block)) return errors.push(`${label} が不正です。`);
      if (!["scene", "talks", "quote", "signature", "dailyWords"].includes(block.type)) {
        return errors.push(`${label} の種類が不正です。`);
      }
      if (block.type === "scene" && (!Array.isArray(block.paragraphs) || !block.paragraphs.length)) errors.push(`${label} の情景文が空です。`);
      if (block.type === "talks") {
        if (!Array.isArray(block.items) || !block.items.length) errors.push(`${label} に発言者がいません。`);
        else block.items.forEach((item, itemIndex) => {
          if (!String(item.speaker || "").trim()) errors.push(`${label} 発言${itemIndex + 1}の発言者が空です。`);
          if (!Array.isArray(item.lines) || !item.lines.length) errors.push(`${label} 発言${itemIndex + 1}のセリフが空です。`);
          else item.lines.forEach((line) => {
            if (!["text", "note", "strongNote"].includes(line.type)) errors.push(`${label} の文章種別が不正です。`);
            if (!String(line.text || "").trim()) errors.push(`${label} に空の文章があります。`);
          });
        });
      }
      if (block.type === "quote" && !String(block.text || "").trim()) errors.push(`${label} の引用文が空です。`);
      if (block.type === "signature" && !String(block.text || "").trim()) errors.push(`${label} の署名が空です。`);
      if (block.type === "dailyWords" && (!Array.isArray(block.items) || !block.items.length)) errors.push(`${label} の今日の一言が空です。`);
    });
  }
  if (Array.isArray(entry.participants) && !entry.participants.length) warnings.push("参加者が空です。");
  return { errors, warnings };
}

function walkStrings(value, path = "$", found = []) {
  if (typeof value === "string") found.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, index) => walkStrings(item, `${path}[${index}]`, found));
  else if (plainObject(value)) Object.entries(value).forEach(([key, item]) => walkStrings(item, `${path}.${key}`, found));
  return found;
}

function detectUrlCandidates(value) {
  const candidates = [];
  for (const item of walkStrings(value)) {
    let suggested = item.value;
    const reasons = [];
    if (/[\u200B-\u200D\uFEFF]/.test(suggested)) {
      suggested = suggested.replace(/[\u200B-\u200D\uFEFF]/g, "");
      reasons.push("URLを壊す不可視文字を除去");
    }
    suggested = suggested.replace(/\[([^\]]+)\]\s+\((https?:\/\/[^)\s]+)\)/g, (_all, label, url) => {
      reasons.push("Markdownリンクの余分な空白を除去");
      return `[${label}](${url})`;
    });
    suggested = suggested.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)\]]+)(?=$|\s)/g, (_all, label, url) => {
      reasons.push("Markdownリンクの閉じ括弧を補完");
      return `[${label}](${url})`;
    });
    if (suggested !== item.value) candidates.push({ path: item.path, original: item.value, suggested, reason: [...new Set(reasons)].join("・") });
  }
  return candidates;
}

function validateForensics(article, options = {}) {
  const errors = [];
  const warnings = [];
  if (!plainObject(article)) return { errors: ["記事JSONはオブジェクトにしてください。"], warnings, urlCandidates: [] };
  for (const key of REQUIRED_FORENSICS_KEYS) {
    if (!(key in article)) errors.push(`必須項目 ${key} がありません。`);
  }
  if (!/^case-\d{8}(?:-\d{2})?$/.test(String(article.id || ""))) errors.push("IDは case-YYYYMMDD または case-YYYYMMDD-02 形式にしてください。");
  if (!validDate(article.publishedAt)) errors.push("公開日は YYYY-MM-DD 形式の実在する日付にしてください。");
  if (validDate(article.publishedAt) && /^case-\d{8}/.test(String(article.id || ""))) {
    const expected = `case-${article.publishedAt.replaceAll("-", "")}`;
    if (!article.id.startsWith(expected)) errors.push(`IDの日付部分を公開日に合わせて ${expected} にしてください。`);
  }
  if (!CATEGORIES.includes(article.category)) errors.push("カテゴリが不正です。");
  if (!DIFFICULTIES.includes(article.difficulty)) errors.push("難易度が不正です。");
  if (![1, 2, 3, 4, 5].includes(Number(article.verificationLevel))) errors.push("確認レベルは1〜5にしてください。");
  for (const key of ["targetAudience", "inspectionPoints", "safeActions", "avoidActions", "tags", "sources"]) {
    if (!Array.isArray(article[key])) errors.push(`${key} は配列にしてください。`);
  }
  if (!plainObject(article.scenario)) errors.push("scenario はオブジェクトにしてください。");
  if (!plainObject(article.question)) errors.push("question はオブジェクトにしてください。");
  if (!plainObject(article.verdict)) errors.push("verdict はオブジェクトにしてください。");
  if (!plainObject(article.positiveUse)) errors.push("positiveUse はオブジェクトにしてください。");
  if (!plainObject(article.visualSuggestion)) errors.push("visualSuggestion はオブジェクトにしてください。");
  for (const key of ["title", "shortTitle", "summary", "verificationLabel", "verificationMessage", "makotoComment", "oneLineLesson"]) {
    if (key in article && !String(article[key] || "").trim()) errors.push(`${key} を入力してください。`);
  }
  if (plainObject(article.scenario)) {
    for (const key of ["headline", "description", "whyItMatters"]) {
      if (!String(article.scenario[key] || "").trim()) errors.push(`scenario.${key} を入力してください。`);
    }
  }

  if (plainObject(article.question)) {
    const choices = article.question.choices;
    const recommended = article.question.recommendedAnswers;
    if (!Array.isArray(choices) || !choices.length) errors.push("question.choices を1件以上入力してください。");
    if (!Array.isArray(recommended) || !recommended.length) errors.push("question.recommendedAnswers を1件以上選択してください。");
    if (Array.isArray(choices)) {
      const ids = choices.map((choice) => String(choice.id || "")).filter(Boolean);
      if (ids.length !== choices.length) errors.push("すべての選択肢にIDを入力してください。");
      if (new Set(ids).size !== ids.length) errors.push("選択肢IDが重複しています。");
      choices.forEach((choice, index) => {
        if (!plainObject(choice)) return errors.push(`選択肢${index + 1}が不正です。`);
        if (!String(choice.label || "").trim()) errors.push(`選択肢${index + 1}のラベルを入力してください。`);
        if (!String(choice.description || "").trim()) errors.push(`選択肢${index + 1}の説明を入力してください。`);
      });
      if (Array.isArray(recommended)) {
        const invalid = recommended.filter((id) => !ids.includes(id));
        if (invalid.length) errors.push(`推奨回答が選択肢にありません: ${invalid.join(", ")}`);
      }
    }
    if (!String(article.question.text || "").trim()) errors.push("question.text を入力してください。");
    if (!String(article.question.explanation || "").trim()) errors.push("question.explanation を入力してください。");
  }
  if (Array.isArray(article.inspectionPoints)) article.inspectionPoints.forEach((item, index) => {
    if (!plainObject(item)) return errors.push(`確認ポイント${index + 1}が不正です。`);
    if (!String(item.title || "").trim() || !String(item.description || "").trim()) errors.push(`確認ポイント${index + 1}のタイトルと説明を入力してください。`);
    if (!["high", "medium", "low"].includes(item.priority)) errors.push(`確認ポイント${index + 1}の優先度が不正です。`);
  });
  for (const key of ["safeActions", "avoidActions"]) {
    if (Array.isArray(article[key])) article[key].forEach((item, index) => {
      if (!plainObject(item) || !String(item.action || "").trim() || !String(item.reason || "").trim()) {
        errors.push(`${key} ${index + 1}の行動と理由を入力してください。`);
      }
    });
  }
  if (plainObject(article.verdict)) {
    if (!String(article.verdict.label || "").trim() || !String(article.verdict.description || "").trim()) errors.push("verdict のラベルと説明を入力してください。");
    if (!["high", "medium", "low"].includes(article.verdict.confidence)) errors.push("verdict.confidence が不正です。");
  }
  if (plainObject(article.positiveUse)) {
    if (!String(article.positiveUse.title || "").trim() || !String(article.positiveUse.description || "").trim()) errors.push("positiveUse のタイトルと説明を入力してください。");
    if (!Array.isArray(article.positiveUse.examples)) errors.push("positiveUse.examples は配列にしてください。");
  }
  if (Array.isArray(article.sources)) article.sources.forEach((source, index) => {
    if (!plainObject(source)) return errors.push(`情報源${index + 1}が不正です。`);
    if (!String(source.title || "").trim() || !String(source.publisher || "").trim()) errors.push(`情報源${index + 1}のタイトルと発行元を入力してください。`);
    if (!validHttpUrl(source.url)) errors.push(`情報源${index + 1}のURLが不正です。`);
    if (source.sourceType && !SOURCE_TYPES.includes(source.sourceType)) errors.push(`情報源${index + 1}の種別が不正です。`);
  });
  if (article.caseImage) {
    const imagePath = typeof article.caseImage === "string" ? article.caseImage : article.caseImage.src;
    if (!plainObject(article.caseImage) && typeof article.caseImage !== "string") errors.push("caseImage は文字列または画像情報オブジェクトにしてください。");
    if (!/^image\/ai-forensics\/[^/\\]+$/.test(String(imagePath || ""))) errors.push("画像は image/ai-forensics 内から選択してください。");
    if (options.availableImages && !options.availableImages.includes(imagePath)) errors.push("選択された画像ファイルが見つかりません。");
  }
  if (Array.isArray(article.inspectionPoints) && !article.inspectionPoints.length) warnings.push("確認ポイントが空です。");
  if (Array.isArray(article.sources) && !article.sources.length) warnings.push("情報源が空です。");
  if (plainObject(article.visualSuggestion) && !["calm", "caution", "serious", "friendly"].includes(article.visualSuggestion.accentTone)) {
    errors.push("visualSuggestion.accentTone が不正です。");
  }
  const urlCandidates = detectUrlCandidates(article);
  if (urlCandidates.length) warnings.push(`${urlCandidates.length}件のURL/Markdown修正候補があります。保存前に確認してください。`);
  return { errors, warnings, urlCandidates };
}

module.exports = {
  detectUrlCandidates,
  validDate,
  validHttpUrl,
  validateForensics,
  validateLounge
};
