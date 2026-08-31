import { getStore } from "@netlify/blobs";
import { matchesSecret } from "../lib/bonus-auth.mjs";
import { BONUS_STORE_NAME, getBonusDocument } from "../lib/bonus-documents.mjs";

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

function downloadDisposition(filename) {
  const asciiFallback = "mmc-paid-bonus.pdf";
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export default async function bonusDownload(request) {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "POST request required." });
  }

  const expectedPassword = process.env.BONUS_DOWNLOAD_PASSWORD;
  if (!expectedPassword) {
    return jsonResponse(503, { error: "特典ダウンロードは準備中です。" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "リクエストを確認できませんでした。" });
  }

  if (!matchesSecret(body.password, expectedPassword)) {
    return jsonResponse(401, { error: "合言葉を確認できませんでした。" });
  }

  if (!body.file) {
    return jsonResponse(200, { ok: true });
  }

  const document = getBonusDocument(body.file);
  if (!document) {
    return jsonResponse(404, { error: "対象の特典が見つかりません。" });
  }

  const store = getStore(BONUS_STORE_NAME);
  const file = await store.get(document.blobKey, { consistency: "strong" });
  if (!file) {
    return jsonResponse(404, { error: "特典ファイルは準備中です。" });
  }

  return new Response(file, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": downloadDisposition(document.filename),
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}
