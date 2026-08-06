"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_MARKERS = [
  "src/data/loungeLogs.json",
  "scripts/generate_lounge.py",
  "scripts/generate_ai_forensics.py",
  "tools/mmc-cms"
];

function isMmcRepoRoot(candidate) {
  if (!candidate) return false;
  const resolved = path.resolve(candidate);
  return REPO_MARKERS.every((relativePath) => fs.existsSync(path.join(resolved, relativePath)));
}

function findMmcRepoRoot(startPaths) {
  const visited = new Set();
  for (const startPath of startPaths.filter(Boolean)) {
    let current = path.resolve(startPath);
    try {
      if (fs.existsSync(current) && fs.statSync(current).isFile()) current = path.dirname(current);
    } catch {
      continue;
    }
    while (!visited.has(current)) {
      visited.add(current);
      if (isMmcRepoRoot(current)) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return "";
}

module.exports = { REPO_MARKERS, findMmcRepoRoot, isMmcRepoRoot };
