import { getStore } from "@netlify/blobs";
import { bearerToken, matchesSecret } from "../lib/bonus-auth.mjs";
import { BONUS_STORE_NAME, getBonusDocument } from "../lib/bonus-documents.mjs";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: RESPONSE_HEADERS
  });
}

export default async function bonusUpload(request) {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "POST request required." });
  }

  const expectedToken = process.env.BONUS_ADMIN_TOKEN;
  if (!expectedToken) {
    return jsonResponse(503, { error: "アップロードは準備中です。" });
  }

  if (!matchesSecret(bearerToken(request), expectedToken)) {
    return jsonResponse(401, { error: "Unauthorized." });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse(400, { error: "アップロード内容を確認できませんでした。" });
  }

  const document = getBonusDocument(form.get("document"));
  const file = form.get("file");

  if (!document || !file || typeof file.arrayBuffer !== "function") {
    return jsonResponse(400, { error: "対象の特典とPDFを指定してください。" });
  }

  if (file.type !== "application/pdf" || file.size > MAX_PDF_BYTES) {
    return jsonResponse(400, { error: "10MB以下のPDFだけをアップロードできます。" });
  }

  const store = getStore(BONUS_STORE_NAME);
  const bytes = await file.arrayBuffer();
  await store.set(document.blobKey, bytes, {
    metadata: {
      contentType: "application/pdf",
      originalFilename: file.name,
      uploadedAt: new Date().toISOString()
    }
  });

  return jsonResponse(200, {
    document: form.get("document"),
    label: document.label,
    ok: true
  });
}
