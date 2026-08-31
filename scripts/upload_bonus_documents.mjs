import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const [comparisonPath, postAnalysisPath, preliminaryMemoPath] = process.argv.slice(2);
const endpoint = process.env.BONUS_UPLOAD_ENDPOINT || "https://mainichi-miru.com/.netlify/functions/bonus-upload";
const adminToken = process.env.BONUS_ADMIN_TOKEN;

const uploads = [
  ["kotocchan-3-model-comparison", comparisonPath],
  ["kotocchan-persona-transfer-post-analysis", postAnalysisPath],
  ["kotocchan-persona-transfer-preliminary-memo", preliminaryMemoPath]
];

if (!adminToken || uploads.some(([, filePath]) => !filePath)) {
  throw new Error("Usage: BONUS_ADMIN_TOKEN=<token> node scripts/upload_bonus_documents.mjs <comparison.pdf> <post-analysis.pdf> <preliminary-memo.pdf>");
}

for (const [document, filePath] of uploads) {
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.set("document", document);
  form.set("file", new Blob([bytes], { type: "application/pdf" }), basename(filePath));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: form
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${document}: ${result.error || response.statusText}`);
  }

  console.log(`${document}: uploaded`);
}
