import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from site_layout import apply_page_admax


class AdmaxPlacementTests(unittest.TestCase):
    def test_requested_pages_have_one_ad_and_generation_is_idempotent(self):
        paths = [ROOT / "lounge.html", ROOT / "today-one.html"]
        for folder in ("lounge-archive", "ai-forensics", "quiz", "today-one/archive"):
            paths.extend((ROOT / folder).rglob("*.html"))
        for path in paths:
            with self.subTest(path=path.relative_to(ROOT)):
                page = path.read_text(encoding="utf-8")
                self.assertEqual(page.count('src="https://adm.shinobi.jp/s/9de8679fb7ebe5155a6a7ef6b4beb1f3"'), 1)
                self.assertLess(page.index("<!-- MMC_ADMAX_START -->"), page.index("</main>"))
                self.assertEqual(apply_page_admax(page, path), page)

    def test_unrequested_pages_remain_unchanged(self):
        page = "<main>content</main>"
        for name in ("about.html", "members/hono.html", "lounge/events/index.html"):
            with self.subTest(name=name):
                self.assertEqual(apply_page_admax(page, ROOT / name), page)

    def test_new_page_can_receive_the_ad(self):
        page = apply_page_admax("<main>new article</main>", ROOT / "ai-forensics/case-new.html")
        self.assertIn("<!-- MMC_ADMAX_START -->", page)
        self.assertLess(page.index("<!-- MMC_ADMAX_START -->"), page.index("</main>"))

    def test_home_ad_follows_about_and_survives_regeneration(self):
        page = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertEqual(page.count('src="https://adm.shinobi.jp/s/9de8679fb7ebe5155a6a7ef6b4beb1f3"'), 1)
        self.assertLess(page.index('id="about"'), page.index("<!-- MMC_ADMAX_START -->"))
        self.assertLess(page.index("<!-- MMC_ADMAX_END -->"), page.index('class="daily-collection"'))
        self.assertEqual(apply_page_admax(page, ROOT / "index.html"), page)


if __name__ == "__main__":
    unittest.main()
