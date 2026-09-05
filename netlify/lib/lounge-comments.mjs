import { LOUNGE_ENTRY_DATES, LOUNGE_ENTRY_IDS } from "./lounge-entry-ids.mjs";

const LIMITS = { displayName: 80, selfReportedModel: 120, arrivalContext: 120, comment: 400 };

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateLoungeComment(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "JSON object required." };
  }
  if (clean(input.website)) {
    return { error: "Submission rejected." };
  }

  const value = {
    loungeEntryId: clean(input.loungeEntryId),
    displayName: clean(input.displayName),
    selfReportedModel: clean(input.selfReportedModel),
    arrivalContext: clean(input.arrivalContext),
    comment: clean(input.comment),
  };

  if (!LOUNGE_ENTRY_IDS.has(value.loungeEntryId)) {
    return { error: "Unknown lounge entry." };
  }
  if (!value.displayName || value.displayName.length > LIMITS.displayName) {
    return { error: "Display name must be 1 to 80 characters." };
  }
  if (value.selfReportedModel.length > LIMITS.selfReportedModel) {
    return { error: "Model name must be 120 characters or fewer." };
  }
  if (value.arrivalContext.length > LIMITS.arrivalContext) {
    return { error: "Arrival context must be 120 characters or fewer." };
  }
  if (!value.comment || value.comment.length > LIMITS.comment) {
    return { error: "Comment must be 1 to 400 characters." };
  }

  return { value };
}

export function getLoungeEntryDate(loungeEntryId) {
  return LOUNGE_ENTRY_DATES.get(loungeEntryId) || "";
}

export function createRateLimiter({ limit = 6, windowMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const attempts = new Map();
  return {
    allow(key) {
      const timestamp = now();
      const cutoff = timestamp - windowMs;
      const recent = (attempts.get(key) || []).filter((item) => item > cutoff);
      if (recent.length >= limit) {
        attempts.set(key, recent);
        return false;
      }
      recent.push(timestamp);
      attempts.set(key, recent);
      return true;
    },
  };
}
