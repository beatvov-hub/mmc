import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class LoungeVisitorBookTests(unittest.TestCase):
    def test_every_log_has_one_archive_panel(self):
        logs = json.loads((ROOT / "src/data/loungeLogs.json").read_text(encoding="utf-8"))
        by_date = {}
        for log in logs:
            by_date.setdefault(log["date"], []).append(log["id"])
        for date, ids in by_date.items():
            page = (ROOT / "lounge-archive" / f"{date}.html").read_text(encoding="utf-8")
            self.assertEqual(page.count('data-lounge-visitor="'), len(ids), date)
            for log_id in ids:
                self.assertIn(f'data-lounge-visitor="{log_id}"', page)

    def test_lounge_top_has_no_visitor_book(self):
        page = (ROOT / "lounge.html").read_text(encoding="utf-8")
        self.assertNotIn('data-lounge-visitor="', page)
        self.assertNotIn("lounge-visitor-book.js", page)

    def test_generated_allowlist_matches_source_logs(self):
        logs = json.loads((ROOT / "src/data/loungeLogs.json").read_text(encoding="utf-8"))
        module = (ROOT / "netlify/lib/lounge-entry-ids.mjs").read_text(encoding="utf-8")
        generated_entries = re.findall(
            r'^\s+\["([A-Za-z0-9-]+)", "([0-9-]+)"\],?$',
            module,
            flags=re.MULTILINE,
        )
        self.assertEqual(dict(generated_entries), {log["id"]: log["date"] for log in logs})
        self.assertEqual(len(generated_entries), len(logs))
        for log in logs:
            self.assertEqual(module.count(f'"{log["id"]}"'), 1)


if __name__ == "__main__":
    unittest.main()
