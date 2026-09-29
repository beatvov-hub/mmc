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
        data = json.loads(quiz.DATA_PATH.read_text(encoding="utf-8"))
        qualification = next(item for item in data["qualifications"] if item["id"] == "g-kentei")
        original = next(item for item in data["questions"] if item["qualification"] == "g-kentei")
        questions = [
            {
                **original,
                "id": f"g-{number}",
                "slug": f"g-{number}",
                "date": (date(2026, 1, 1) + timedelta(days=number)).isoformat(),
                "title": f"テーマ{number}",
            }
            for number in range(205)
        ]
        pages = [quiz.render_practice(qualification, questions, page) for page in (1, 2, 3)]
        self.assertEqual([page.count('class="quiz-detail quiz-practice-question') for page in pages], [100, 100, 5])
        self.assertEqual([page.count('data-quiz-reveal') for page in pages], [100, 100, 5])
        self.assertEqual([page.count('data-quiz-choice') for page in pages], [400, 400, 20])
        self.assertIn('href="/quiz/g-kentei/practice/3"', pages[0])
        self.assertIn('src="../../../../scripts/daily-quiz.js"', pages[1])
        self.assertNotIn("テーマ205", pages[2])
        self.assertIn('id="quiz-answer-practice-205"', pages[2])
        self.assertNotIn('href="/quiz/g-kentei/practice/4"', pages[2])
        with self.assertRaises(ValueError):
            quiz.render_practice(qualification, questions, 4)

    def test_unpublished_ranges_are_visible_without_broken_links(self) -> None:
        ranges = quiz.practice_ranges("g-kentei", 10)
        self.assertIn('href="/quiz/g-kentei/practice"', ranges)
        self.assertIn('101〜200問<small>準備中</small>', ranges)
        self.assertNotIn('href="/quiz/g-kentei/practice/2"', ranges)
        self.assertIn('href="/quiz/g-kentei/practice/3"', quiz.practice_ranges("g-kentei", 205))

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
        page_two = quiz.render_detail(qualification, bank_question, None, None, 4, bank_page=2)
        self.assertIn('href="/quiz/' + original["qualification"] + '/practice/2"', page_two)
        duplicate = deepcopy(bank_question)
        duplicate["id"] = "another-id"
        data["questions"].append(duplicate)
        with self.assertRaises(ValueError):
            quiz.validate(data)

    def test_generated_hub_and_bank_links_resolve_to_answerable_pages(self) -> None:
        data = json.loads(quiz.DATA_PATH.read_text(encoding="utf-8"))
        hub = (quiz.QUIZ_DIR / "index.html").read_text(encoding="utf-8")
        self.assertEqual(hub.count('class="quiz-detail quiz-home-question'), len(data["qualifications"]))
        self.assertEqual(hub.count('data-quiz-reveal'), len(data["qualifications"]))
        self.assertIn("ご利用にあたって", hub)
        self.assertIn("生成AIを活用して作成したオリジナル練習問題", hub)
        for qualification in data["qualifications"]:
            qualification_id = qualification["id"]
            _, official_url, official_label = quiz.OFFICIAL_INFO[qualification_id]
            self.assertIn(f'href="{official_url}" target="_blank" rel="noopener noreferrer"', hub)
            self.assertIn(official_label, hub)
            practice_route = quiz.practice_route(qualification_id)
            self.assertIn(f'href="{practice_route}"', hub)
            second_route = quiz.practice_route(qualification_id, 2)
            self.assertIn(f'href="{second_route}"', hub)
            third_route = quiz.practice_route(qualification_id, 3)
            self.assertIn(f'href="{third_route}"', hub)
            fourth_route = quiz.practice_route(qualification_id, 4)
            self.assertIn(f'href="{fourth_route}"', hub)
            fifth_route = quiz.practice_route(qualification_id, 5)
            self.assertIn(f'href="{fifth_route}"', hub)
            qualification_page = (quiz.QUIZ_DIR / qualification_id / "index.html").read_text(encoding="utf-8")
            self.assertIn(f'href="{practice_route}"', qualification_page)
            self.assertIn(f'href="{official_url}" target="_blank" rel="noopener noreferrer"', qualification_page)
            self.assertIn("各試験実施団体による公式サービスではありません", qualification_page)
            detail_route = quiz.route_for(next(item for item in data["questions"] if item["qualification"] == qualification_id))
            detail_page = (quiz.ROOT / detail_route.lstrip("/") / "index.html").read_text(encoding="utf-8")
            self.assertIn("この問題について", detail_page)
            self.assertIn("生成AIを活用して作成したオリジナル練習問題", detail_page)
            self.assertIn("data-quiz-reveal", detail_page)
            practice_page = (quiz.QUIZ_DIR / qualification_id / "practice" / "index.html").read_text(encoding="utf-8")
            self.assertEqual(practice_page.count('class="quiz-detail quiz-practice-question'), 100)
            self.assertEqual(practice_page.count('data-quiz-reveal'), 100)
            self.assertEqual(practice_page.count('data-quiz-choice'), 400)
            self.assertIn(f'<link rel="canonical" href="{quiz.SITE_URL}{practice_route}"', practice_page)
            self.assertIn('daily-quiz.js', practice_page)
            second_page = (quiz.QUIZ_DIR / qualification_id / "practice" / "2" / "index.html").read_text(encoding="utf-8")
            self.assertEqual(second_page.count('class="quiz-detail quiz-practice-question'), 100)
            self.assertEqual(second_page.count('data-quiz-reveal'), 100)
            self.assertEqual(second_page.count('data-quiz-choice'), 400)
            self.assertIn(f'<link rel="canonical" href="{quiz.SITE_URL}{second_route}"', second_page)
            self.assertIn('daily-quiz.js', second_page)
            third_page = (quiz.QUIZ_DIR / qualification_id / "practice" / "3" / "index.html").read_text(encoding="utf-8")
            self.assertEqual(third_page.count('class="quiz-detail quiz-practice-question'), 100)
            self.assertEqual(third_page.count('data-quiz-reveal'), 100)
            self.assertEqual(third_page.count('data-quiz-choice'), 400)
            self.assertIn(f'<link rel="canonical" href="{quiz.SITE_URL}{third_route}"', third_page)
            self.assertIn('daily-quiz.js', third_page)
            fourth_page = (quiz.QUIZ_DIR / qualification_id / "practice" / "4" / "index.html").read_text(encoding="utf-8")
            self.assertEqual(fourth_page.count('class="quiz-detail quiz-practice-question'), 100)
            self.assertEqual(fourth_page.count('data-quiz-reveal'), 100)
            self.assertEqual(fourth_page.count('data-quiz-choice'), 400)
            self.assertIn(f'<link rel="canonical" href="{quiz.SITE_URL}{fourth_route}"', fourth_page)
            self.assertIn('daily-quiz.js', fourth_page)
            fifth_page = (quiz.QUIZ_DIR / qualification_id / "practice" / "5" / "index.html").read_text(encoding="utf-8")
            self.assertEqual(fifth_page.count('class="quiz-detail quiz-practice-question'), 100)
            self.assertEqual(fifth_page.count('data-quiz-reveal'), 100)
            self.assertEqual(fifth_page.count('data-quiz-choice'), 400)
            self.assertIn(f'<link rel="canonical" href="{quiz.SITE_URL}{fifth_route}"', fifth_page)
            self.assertIn('daily-quiz.js', fifth_page)
        self.assertIn('daily-quiz.js', hub)
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
