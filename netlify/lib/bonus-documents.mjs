export const BONUS_STORE_NAME = "mmc-paid-bonuses";

export const BONUS_DOCUMENTS = Object.freeze({
  "kotocchan-3-model-comparison": {
    blobKey: "2026-08-31/kotocchan-3-model-comparison.pdf",
    filename: "2026-08-31_質問プロンプト10問_コトちゃん編_3モデル回答比較.pdf",
    label: "質問プロンプト10問｜コトちゃん編｜3モデル回答比較"
  },
  "kotocchan-persona-transfer-post-analysis": {
    blobKey: "2026-08-31/kotocchan-persona-transfer-post-analysis.pdf",
    filename: "2026-08-31_AI人格移設実験_事後分析レポート.pdf",
    label: "AI人格移設実験｜事後分析レポート"
  },
  "kotocchan-persona-transfer-preliminary-memo": {
    blobKey: "2026-08-31/kotocchan-persona-transfer-preliminary-memo.pdf",
    filename: "2026-08-31_AI社員実験室_コトちゃん人格移植実験_事前メモ.pdf",
    label: "AI社員実験室｜コトちゃん人格移植実験｜事前メモ"
  }
});

export function getBonusDocument(documentId) {
  return BONUS_DOCUMENTS[documentId] || null;
}
