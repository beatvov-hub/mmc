from __future__ import annotations

import sys
import unittest
import json
import re
from copy import deepcopy
from datetime import date, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import generate_daily_quiz as quiz


class DailyQuizTest(unittest.TestCase):
    def test_featured_selection_is_stable_and_covers_bank_before_repeating(self) -> None:
        questions = [{"id": f"g-{number}"} for number in range(10)]
        first = date(2026, 9, 28)
        selected = [
            quiz.featured_question(questions, "g-kentei", first + timedelta(days=offset))["id"]
            for offset in range(10)
        ]
        self.assertEqual(len(set(selected)), 10)
        self.assertEqual(
            quiz.featured_question(list(reversed(questions)), "g-kentei", first)["id"],
            selected[0],
        )

    def test_practice_pages_split_at_one_hundred_without_empty_pages(self) -> None:
        qualification = {"id": "g-kentei", "name": "G検定", "icon": "G"}
        questions = [
            {
                "id": f"g-{number}",
                "qualification": "g-kentei",
                "date": (date(2026, 1, 1) + timedelta(days=number)).isoformat(),
                "title": f"テーマ{number}",
                "category": "AI",
                "difficulty": "基礎",
            }
            for number in range(205)
        ]
        pages = [quiz.render_practice(qualification, questions, page) for page in (1, 2, 3)]
        self.assertEqual([page.count('<h3><a href="/quiz/g-kentei/') for page in pages], [100, 100, 5])
        self.assertIn('href="/quiz/g-kentei/practice/3"', pages[0])
        self.assertNotIn("テーマ205", pages[2])
        with self.assertRaises(ValueError):
            quiz.render_practice(qualification, questions, 4)

    def test_bank_questions_can_share_a_publish_date_without_changing_legacy_routes(self) -> None:
        data = json.loads(quiz.DATA_PATH.read_text(encoding="utf-8"))
        original = data["questions"][0]
        bank_question = deepcopy(original)
        bank_question["id"] = "bank-route-test"
        bank_question["slug"] = "bank-route-test"
        data["questions"].append(bank_question)
        quiz.validate(data)
        self.assertEqual(quiz.route_for(original), f"/quiz/{original['qualification']}/{original['date']}")
        self.assertEqual(quiz.route_for(bank_question), f"/quiz/{original['qualification']}/questions/bank-route-test")
        qualification = next(item for item in data["qualifications"] if item["id"] == original["qualification"])
        page = quiz.render_detail(qualification, bank_question, None, None, 4)
        self.assertIn('href="/quiz/' + original["qualification"] + '/practice"', page)
        self.assertIn('src="../../../../scripts/daily-quiz.js"', page)
        duplicate = deepcopy(bank_question)
        duplicate["id"] = "another-id"
        data["questions"].append(duplicate)
        with self.assertRaises(ValueError):
            quiz.validate(data)

    def test_generated_hub_and_bank_links_resolve_to_answerable_pages(self) -> None:
        data = json.loads(quiz.DATA_PATH.read_text(encoding="utf-8"))
        hub = (quiz.QUIZ_DIR / "index.html").read_text(encoding="utf-8")
        self.assertEqual(hub.count('class="quiz-action"'), len(data["qualifications"]))
        for qualification in data["qualifications"]:
            qualification_id = qualification["id"]
            practice_route = quiz.practice_route(qualification_id)
            self.assertIn(f'href="{practice_route}"', hub)
            qualification_page = (quiz.QUIZ_DIR / qualification_id / "index.html").read_text(encoding="utf-8")
            self.assertIn(f'href="{practice_route}"', qualification_page)
            practice_page = (quiz.QUIZ_DIR / qualification_id / "practice" / "index.html").read_text(encoding="utf-8")
            self.assertEqual(practice_page.count('<h3><a href="/quiz/'), 10)
            self.assertIn(f'<link rel="canonical" href="{quiz.SITE_URL}{practice_route}"', practice_page)
        for route in re.findall(r'href="(/quiz(?:/[^"#?]*)?)"', hub):
            page = (quiz.ROOT / route.lstrip("/") / "index.html").read_text(encoding="utf-8")
            if "/practice" not in route and route.count("/") == 3:
                self.assertIn("data-quiz-reveal", page)
                self.assertIn("daily-quiz.js", page)
        for page_path in quiz.QUIZ_DIR.rglob("index.html"):
            page = page_path.read_text(encoding="utf-8")
            for route in re.findall(r'href="(/quiz(?:/[^"#?]*)?)"', page):
                self.assertTrue(
                    (quiz.ROOT / route.lstrip("/") / "index.html").is_file(),
                    f"Broken quiz link in {page_path}: {route}",
                )


if __name__ == "__main__":
    unittest.main()
