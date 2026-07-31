"use strict";

const LOUNGE_PERIODS = ["朝", "昼", "夕方", "夜", "深夜"];
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const SPEAKERS = [
  "ほのちゃん", "ショウマ", "たかけん", "マイケル", "DG", "ねむちゃん",
  "レイちゃん", "アキト", "ケイ", "誠", "誠さん", "ペチ", "所長"
];
const CATEGORIES = [
  "deepfake", "misinformation", "hallucination", "privacy", "copyright",
  "security", "scam", "search", "social-media", "verification", "work-use",
  "health-ai", "health-misinformation", "media-literacy", "other"
];
const DIFFICULTIES = ["beginner", "standard", "advanced"];
const SOURCE_TYPES = [
  "government", "official", "research", "news", "security", "fact-check",
  "international-organization", "other"
];
const REQUIRED_FORENSICS_KEYS = [
  "id", "publishedAt", "title", "shortTitle", "category", "difficulty",
  "targetAudience", "summary", "scenario", "question", "inspectionPoints",
  "verificationLevel", "verificationLabel", "verificationMessage", "verdict",
  "safeActions", "avoidActions", "positiveUse", "makotoComment", "oneLineLesson",
  "tags", "sources", "visualSuggestion"
];

module.exports = {
  CATEGORIES,
  DIFFICULTIES,
  LOUNGE_PERIODS,
  REQUIRED_FORENSICS_KEYS,
  SOURCE_TYPES,
  SPEAKERS,
  WEEKDAYS
};
