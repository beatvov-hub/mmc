from __future__ import annotations

import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import generate_today_one as today_one


def published_entry(day: str, *, slug: str = "sample") -> dict:
    return {
        "date": day,
        "slug": slug,
        "name": "Sample Tool",
        "category": "MCP",
        "officialUrl": "https://example.com/",
        "summary": "短い説明です。",
        "whyToday": "今日選ぶ理由です。",
        "useFor": "仕事で使う場面です。",
        "recommendedFor": {"employeeId": "MMC-008", "reason": "相性が良さそうです。"},
        "keiComment": "確認してから使いたいですね。",
        "verifiedAt": day,
        "status": "published",
    }


class TodayOneTest(unittest.TestCase):
    def setUp(self) -> None:
        self.members = {"MMC-008": {"name": "アキト"}}

    def test_tokyo_date_uses_japan_boundary(self) -> None:
        utc_time = datetime(2026, 8, 27, 15, 30, tzinfo=timezone.utc)
        self.assertEqual(today_one.today_in_tokyo(utc_time), date(2026, 8, 28))

    def test_only_exact_published_entry_is_today(self) -> None:
        draft = published_entry("2026-08-28", slug="draft")
        draft["status"] = "draft"
        data = {"entries": [published_entry("2026-08-27"), draft]}
        self.assertIsNone(today_one.select_today_entry(data, date(2026, 8, 28)))

    def test_previous_entry_never_impersonates_today(self) -> None:
        previous = published_entry("2026-08-27")
        data = {"entries": [previous]}
        self.assertIsNone(today_one.select_today_entry(data, date(2026, 8, 28)))
        self.assertIs(today_one.select_previous_entry(data, date(2026, 8, 28)), previous)

    def test_duplicate_published_date_is_rejected(self) -> None:
        data = {
            "updatedAt": None,
            "entries": [
                published_entry("2026-08-28", slug="one"),
                published_entry("2026-08-28", slug="two"),
            ],
        }
        with self.assertRaisesRegex(ValueError, "Duplicate published entries"):
            today_one.validate_data(data, self.members)

    def test_unknown_employee_warns_without_failing(self) -> None:
        entry = published_entry("2026-08-28")
        entry["recommendedFor"]["employeeId"] = "MMC-999"
        warnings = today_one.validate_data({"updatedAt": None, "entries": [entry]}, self.members)
        self.assertEqual(len(warnings), 1)

    def test_invalid_published_entry_warns_and_is_not_rendered(self) -> None:
        entry = published_entry("2026-08-28")
        entry.pop("officialUrl")
        data = {"updatedAt": None, "entries": [entry]}
        warnings = today_one.validate_data(data, self.members)
        self.assertTrue(any("officialUrl" in warning for warning in warnings))
        self.assertIsNone(today_one.select_today_entry(data, date(2026, 8, 28)))

    def test_invalid_date_does_not_break_previous_selection(self) -> None:
        entry = published_entry("2026-08-27")
        entry["date"] = "not-a-date"
        data = {"updatedAt": None, "entries": [entry]}
        warnings = today_one.validate_data(data, self.members)
        self.assertTrue(any("valid YYYY-MM-DD" in warning for warning in warnings))
        self.assertIsNone(today_one.select_previous_entry(data, date(2026, 8, 28)))

    def test_existing_member_directory_joins_by_employee_id(self) -> None:
        members = today_one.load_members()
        self.assertEqual(members["MMC-008"]["name"], "アキト")
        self.assertEqual(members["MMC-008"]["role"], "AI開発推進主任")
        rendered = today_one.render_entry(
            published_entry("2026-08-28"), members, date(2026, 8, 28)
        )
        self.assertIn("アキト", rendered)
        self.assertIn("members/akito", rendered)
        self.assertIn("一言でいうと", rendered)

    def test_archive_keeps_published_entries_up_to_target_date(self) -> None:
        future = published_entry("2026-08-29", slug="future")
        draft = published_entry("2026-08-27", slug="draft")
        draft["status"] = "draft"
        data = {
            "entries": [
                published_entry("2026-08-26", slug="older"),
                future,
                draft,
                published_entry("2026-08-28", slug="today"),
            ]
        }
        entries = today_one.published_archive_entries(data, date(2026, 8, 28))
        self.assertEqual([entry["slug"] for entry in entries], ["today", "older"])

    def test_archive_uses_stable_date_and_slug_url(self) -> None:
        entry = published_entry("2026-08-28", slug="context-seven")
        self.assertEqual(
            today_one.archive_filename(entry),
            "2026-08-28-context-seven.html",
        )
        self.assertEqual(
            today_one.archive_url(entry),
            "https://mainichi-miru.com/today-one/archive/2026-08-28-context-seven",
        )

    def test_archive_detail_prefixes_existing_member_assets(self) -> None:
        members = today_one.load_members()
        rendered = today_one.render_archive_detail_page(
            published_entry("2026-08-28"),
            members,
        )
        self.assertIn('../../image/staff/mmc-008.jpg', rendered)
        self.assertIn('../../members/akito', rendered)

    def test_unsafe_slug_is_skipped(self) -> None:
        entry = published_entry("2026-08-28", slug="../unsafe")
        warnings = today_one.validate_data(
            {"updatedAt": None, "entries": [entry]},
            self.members,
        )
        self.assertTrue(any("slug" in warning for warning in warnings))
        self.assertFalse(today_one.is_renderable_published_entry(entry))


if __name__ == "__main__":
    unittest.main()
