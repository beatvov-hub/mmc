"use strict";

const { SPEAKERS, WEEKDAYS } = require("./constants");

function normalizeDate(year, month, day) {
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function periodForTime(time) {
  const hour = Number(String(time || "09:00").slice(0, 2));
  if (hour < 6) return "深夜";
  if (hour < 11) return "朝";
  if (hour < 16) return "昼";
  if (hour < 19) return "夕方";
  if (hour < 23) return "夜";
  return "深夜";
}

function weekdayForDate(date) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : WEEKDAYS[parsed.getDay()];
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/^\*\*(.*?)\*\*$/, "$1")
    .trim();
}

function speakerFromLine(line) {
  let match = line.match(/^\s*\*\*([^*：:]+)\*\*\s*[：:]?\s*(.*)$/);
  if (match) return { speaker: match[1].trim(), rest: match[2].trim() };
  match = line.match(/^\s*([^：:]{1,20})[：:]\s*(.*)$/);
  if (match && SPEAKERS.includes(match[1].trim())) {
    return { speaker: match[1].trim(), rest: match[2].trim() };
  }
  return null;
}

function isDialogue(line) {
  const value = stripMarkdown(line);
  return /^[「『“"]/.test(value) && /[」』”"]$/.test(value);
}

function isNote(line) {
  const value = stripMarkdown(line);
  return (
    (/^[（(].+[）)]$/.test(value) && !isDialogue(value)) ||
    (/^[_*][^*_].*[_*]$/.test(line.trim()) && !/^\*\*.+\*\*$/.test(line.trim()))
  );
}

function noteText(line) {
  return stripMarkdown(line).replace(/^[（(_*]\s*/, "").replace(/\s*[）)_*]$/, "");
}

function stripDialogueMarks(text) {
  const value = String(text || "").trim();
  const pairs = [["「", "」"], ["『", "』"], ["“", "”"], ['"', '"']];
  const pair = pairs.find(([open, close]) => value.startsWith(open) && value.endsWith(close));
  return pair ? value.slice(pair[0].length, -pair[1].length).trim() : value;
}

function normalizeLoungeEntry(entry) {
  const normalized = JSON.parse(JSON.stringify(entry || {}));
  const content = Array.isArray(normalized.content) ? normalized.content : [];
  const dailyItems = content
    .filter((block) => block.type === "dailyWords")
    .flatMap((block) => block.items || [])
    .filter((item) => item.speaker || item.text)
    .map((item) => ({
      speaker: String(item.speaker || "").trim(),
      text: stripDialogueMarks(item.text)
    }));

  normalized.content = content.filter((block) => block.type !== "dailyWords");
  if (dailyItems.length) normalized.todayWords = dailyItems;
  else if (Array.isArray(normalized.todayWords)) {
    normalized.todayWords = normalized.todayWords.map((item) => ({
      ...item,
      text: stripDialogueMarks(item.text)
    }));
  }
  return normalized;
}

function parseLoungeDraft(draft, now = new Date()) {
  const raw = String(draft || "").replace(/\r\n?/g, "\n").trim();
  const lines = raw.split("\n");
  const warnings = [];

  let date = "";
  let time = "";
  let explicitWeekday = "";
  let explicitPeriod = "";
  let title = "";
  let participants = [];
  const consumed = new Set();

  lines.forEach((line, index) => {
    const value = line.trim();
    let match;
    if (!date && (match = value.match(/(20\d{2})[年\/\-.](\d{1,2})[月\/\-.](\d{1,2})日?/))) {
      date = normalizeDate(match[1], match[2], match[3]);
      if (/^(?:日付|日時|date)\s*[：:]/i.test(value) || value === match[0] || /^#{1,3}\s+/.test(value)) consumed.add(index);
    }
    if (!time && (match = value.match(/(?:^|\s)([01]?\d|2[0-3])[:：時](\d{2})(?:分)?(?:\s|$)/))) {
      time = `${String(match[1]).padStart(2, "0")}:${match[2]}`;
      if (/^(?:時刻|日時|time)\s*[：:]/i.test(value) || value === match[0].trim() || /^#{1,3}\s+/.test(value)) consumed.add(index);
    }
    if (!explicitWeekday && (match = value.match(/[（(]([月火水木金土日])(?:曜(?:日)?)?[）)]/))) {
      explicitWeekday = match[1];
    }
    if (!explicitPeriod && (match = value.match(/(?:時間帯|period)\s*[：:]\s*(朝|昼|夕方|夜|深夜)/i))) {
      explicitPeriod = match[1];
      consumed.add(index);
    }
    if (!participants.length && (match = value.match(/^(?:参加者|登場人物|メンバー)\s*[：:]\s*(.+)$/))) {
      participants = match[1].split(/[、,，・／/]/).map((item) => item.trim()).filter(Boolean);
      consumed.add(index);
    }
    if (!title && (match = value.match(/^#{1,3}\s+(.+)$/))) {
      const candidate = match[1].trim();
      const looksLikeDateHeading = /20\d{2}[年\/\-.]\d{1,2}[月\/\-.]\d{1,2}/.test(candidate);
      if (!looksLikeDateHeading && !/今日の一言|ホワイトボード|引用/.test(candidate)) {
        title = candidate;
        consumed.add(index);
      }
    }
    if (!title && (match = value.match(/^タイトル\s*[：:]\s*(.+)$/))) {
      title = match[1].trim();
      consumed.add(index);
    }
  });

  if (!date) {
    date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    warnings.push("日付を検出できなかったため、本日の日付を入れました。");
  }
  if (!time) {
    time = "09:00";
    warnings.push("時刻を検出できなかったため、09:00を入れました。");
  }
  if (!title) {
    title = `${periodForTime(time)}のラウンジ観測記録`;
    warnings.push("タイトルを検出できなかったため、仮タイトルを入れました。");
  }

  const content = [];
  let sceneParagraphs = [];
  let talkItems = [];
  let currentSpeaker = "";
  let inDailyWords = false;
  let dailyItems = [];
  let dailyTitle = "今日の一言";
  let pendingQuoteCite = "";

  function flushScene() {
    if (sceneParagraphs.length) {
      content.push({ type: "scene", paragraphs: sceneParagraphs });
      sceneParagraphs = [];
    }
  }
  function flushTalks() {
    if (talkItems.length) {
      content.push({ type: "talks", items: talkItems });
      talkItems = [];
    }
  }
  function flushDaily() {
    if (dailyItems.length) content.push({ type: "dailyWords", title: dailyTitle, items: dailyItems });
    dailyItems = [];
  }
  function addTalkLine(speaker, lineType, text) {
    let item = talkItems[talkItems.length - 1];
    if (!item || item.speaker !== speaker) {
      item = { speaker, lines: [] };
      talkItems.push(item);
    }
    item.lines.push({ type: lineType, text });
  }

  lines.forEach((original, index) => {
    if (consumed.has(index)) return;
    const trimmed = original.trim();
    if (!trimmed || /^[-=]{3,}$/.test(trimmed)) {
      return;
    }
    if (/^#{1,6}\s*(今日の一言|本日の一言)/.test(trimmed) || /^(今日の一言|本日の一言)\s*[：:]?$/.test(trimmed)) {
      flushScene();
      flushTalks();
      inDailyWords = true;
      dailyTitle = stripMarkdown(trimmed).replace(/[：:]$/, "");
      currentSpeaker = "";
      return;
    }

    const speakerInfo = speakerFromLine(trimmed);
    if (speakerInfo) {
      if (inDailyWords) {
        const text = stripMarkdown(speakerInfo.rest);
        if (text) dailyItems.push({ speaker: speakerInfo.speaker, text });
        else currentSpeaker = speakerInfo.speaker;
        return;
      }
      flushScene();
      currentSpeaker = speakerInfo.speaker;
      if (speakerInfo.rest) {
        addTalkLine(currentSpeaker, isNote(speakerInfo.rest) ? "note" : "text", isNote(speakerInfo.rest) ? noteText(speakerInfo.rest) : stripMarkdown(speakerInfo.rest));
      }
      return;
    }

    if (inDailyWords) {
      if (/^#{1,6}\s+/.test(trimmed)) {
        flushDaily();
        inDailyWords = false;
      } else {
        const value = stripMarkdown(trimmed);
        if (currentSpeaker && value) {
          dailyItems.push({ speaker: currentSpeaker, text: value });
          currentSpeaker = "";
        } else if (value) {
          const match = value.match(/^([^：:]{1,20})[：:]\s*(.+)$/);
          if (match) dailyItems.push({ speaker: match[1].trim(), text: match[2].trim() });
          else warnings.push(`「今日の一言」の発言者を判定できませんでした: ${value}`);
        }
        return;
      }
    }

    const quoteHeading = trimmed.match(/^#{0,6}\s*(?:ホワイトボード|引用)(?:\s*[：:]\s*(.*))?$/);
    if (quoteHeading) {
      flushScene();
      flushTalks();
      pendingQuoteCite = quoteHeading[1] || "ホワイトボード";
      return;
    }
    if (pendingQuoteCite || /^>\s?/.test(trimmed)) {
      flushScene();
      flushTalks();
      const value = stripMarkdown(trimmed);
      const citeMatch = value.match(/^(.*?)(?:\s*[—―-]\s*|\s*（)([^）]+)）?$/);
      content.push({
        type: "quote",
        text: citeMatch ? citeMatch[1].trim() : value,
        cite: citeMatch ? citeMatch[2].trim() : pendingQuoteCite || "引用"
      });
      pendingQuoteCite = "";
      return;
    }

    if (currentSpeaker && (isDialogue(trimmed) || isNote(trimmed))) {
      flushScene();
      addTalkLine(currentSpeaker, isNote(trimmed) ? "note" : "text", isNote(trimmed) ? noteText(trimmed) : stripMarkdown(trimmed));
      return;
    }

    if (talkItems.length) flushTalks();
    currentSpeaker = "";
    sceneParagraphs.push(stripMarkdown(trimmed));
  });

  flushScene();
  flushTalks();
  flushDaily();

  const detectedSpeakers = content
    .filter((block) => block.type === "talks")
    .flatMap((block) => block.items.map((item) => item.speaker));
  if (!participants.length) participants = [...new Set(detectedSpeakers)];
  if (!content.length) warnings.push("本文ブロックを抽出できませんでした。");

  const id = `${date}-${time.replace(":", "")}`;
  return {
    entry: {
      id,
      date,
      time,
      weekday: explicitWeekday || weekdayForDate(date),
      period: explicitPeriod || periodForTime(time),
      title,
      participants,
      content
    },
    warnings
  };
}

module.exports = {
  normalizeDate,
  normalizeLoungeEntry,
  parseLoungeDraft,
  periodForTime,
  speakerFromLine,
  weekdayForDate
};
