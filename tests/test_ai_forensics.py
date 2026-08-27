from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import validate_ai_forensics as validator


class AiForensicsValidatorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.path = ROOT / "src" / "data" / "ai-forensics" / "case-20260827-01.json"
        cls.article = json.loads(cls.path.read_text(encoding="utf-8"))

    def test_current_article_passes_schema_validation(self) -> None:
        errors = validator.validate_article(self.path, self.article, strict_id=True, expected_date="2026-08-27")
        self.assertEqual(errors, [])

    def test_id_must_match_the_filename(self) -> None:
        article = copy.deepcopy(self.article)
        article["id"] = "case-20260827-02"
        errors = validator.validate_article(self.path, article, strict_id=True, expected_date="2026-08-27")
        self.assertTrue(any("match filename" in error for error in errors))

    def test_source_must_be_https_and_have_a_nullable_date(self) -> None:
        article = copy.deepcopy(self.article)
        article["sources"][0]["url"] = "http://example.com"
        article["sources"][0]["publishedAt"] = "2026-99-99"
        errors = validator.validate_article(self.path, article, strict_id=True, expected_date="2026-08-27")
        self.assertTrue(any("absolute HTTPS" in error for error in errors))
        self.assertTrue(any("publishedAt" in error for error in errors))

    def test_recommended_answers_must_reference_choices(self) -> None:
        article = copy.deepcopy(self.article)
        article["question"]["recommendedAnswers"] = ["not-a-choice"]
        errors = validator.validate_article(self.path, article, strict_id=True, expected_date="2026-08-27")
        self.assertTrue(any("recommendedAnswers" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
