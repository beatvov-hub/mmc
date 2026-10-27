import json
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import generate_lounge as lounge
import generate_daily_quiz as quiz
import generate_events as events
import site_layout

NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def entries(path):
    root = ElementTree.parse(path).getroot()
    return [
        (item.findtext("s:loc", namespaces=NS), item.findtext("s:lastmod", namespaces=NS))
        for item in root.findall("s:url", NS)
    ]


class HeadMetadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and attrs.get("rel", "").lower() == "canonical":
            self.canonicals.append(attrs.get("href"))
        if tag == "meta" and attrs.get("name", "").lower() == "robots":
            self.noindex |= "noindex" in attrs.get("content", "").lower()


class LoungeSitemapTests(unittest.TestCase):
    def test_all_sitemap_pages_have_matching_canonical_and_are_indexable(self):
        problems = []
        for url, _ in entries(ROOT / "sitemap.xml"):
            parsed = urlsplit(url)
            if parsed.scheme != "https" or parsed.netloc != "mainichi-miru.com" or parsed.query or parsed.fragment:
                problems.append((url, "invalid public URL"))
                continue
            route = unquote(parsed.path).lstrip("/")
            if not route:
                candidates = [ROOT / "index.html"]
            elif parsed.path.endswith("/"):
                candidates = [ROOT / route / "index.html"]
            else:
                candidates = [ROOT / (route + ".html"), ROOT / route / "index.html", ROOT / route]
            page = next((p for p in candidates if p.is_file() and p.resolve().is_relative_to(ROOT)), None)
            if page is None:
                problems.append((url, "missing page"))
                continue
            head = page.read_text(encoding="utf-8").split("</head>", 1)[0]
            meta = HeadMetadata()
            meta.feed(head)
            if meta.noindex or meta.canonicals != [url]:
                problems.append((url, "noindex or canonical mismatch", meta.canonicals))
        self.assertFalse(problems, f"Sitemap inconsistencies: {problems[:20]}")

    def test_regeneration_preserves_existing_urls_and_dates(self):
        original = entries(ROOT / "sitemap.xml")
        self.assertEqual(len(original), len({url for url, _ in original}))
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "sitemap.xml"
            target.write_bytes((ROOT / "sitemap.xml").read_bytes())
            with patch.object(lounge, "SITEMAP_PATH", target):
                lounge.update_sitemap(lounge.load_logs())
            regenerated = entries(target)
        self.assertEqual(len(regenerated), len({url for url, _ in regenerated}))
        self.assertEqual(dict(original), dict(regenerated))
        self.assertIn((f"{lounge.BASE_URL}/office-tour/", None), regenerated)
        self.assertIn((f"{lounge.BASE_URL}/privacy-policy", None), regenerated)
        self.assertTrue(all(url.endswith("/") for url, _ in regenerated if "/quiz/" in url))

    def test_directory_routes_use_the_served_canonical_form(self):
        redirects = (ROOT / "_redirects").read_text(encoding="utf-8").splitlines()
        for route in ("about/faq", "office-tour", "works/gallery", "lounge/events", "lounge/market", "today-one/archive"):
            with self.subTest(route=route):
                self.assertEqual(site_layout.canonical_url(ROOT / route / "index.html"), f"{lounge.BASE_URL}/{route}/")
                self.assertIn(f"/{route}/index.html /{route}/ 301", redirects)
                self.assertIn(f"/{route} /{route}/ 301", redirects)
                self.assertIn(f"/{route}/ /{route}/index.html 200", redirects)
                self.assertNotIn(f"/{route}/ /{route} 301", redirects)

    def test_event_redirect_generator_keeps_the_canonical_index_route(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "_redirects"
            target.write_bytes((ROOT / "_redirects").read_bytes())
            with patch.object(events, "REDIRECTS_PATH", target):
                events.update_redirects(events.load_events())
            text = target.read_text(encoding="utf-8")
        self.assertIn("/lounge/events/index.html /lounge/events/ 301", text)
        self.assertIn("/lounge/events /lounge/events/ 301", text)
        self.assertIn("/lounge/events/ /lounge/events/index.html 200", text)

    def test_quiz_routes_keep_dates_and_normalize_old_spelling(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            quiz = root / "quiz"
            (quiz / "sample").mkdir(parents=True)
            (quiz / "new").mkdir()
            for file in (quiz / "index.html", quiz / "sample/index.html", quiz / "new/index.html"):
                file.write_text("", encoding="utf-8")
            data = root / "data.json"
            data.write_text(json.dumps({"updatedAt": "2026-09-30T08:00:00+09:00"}), encoding="utf-8")
            sitemap = root / "sitemap.xml"
            sitemap.write_text(
                '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                '<url><loc>https://mainichi-miru.com/quiz</loc><lastmod>2026-10-18</lastmod></url>'
                '<url><loc>https://mainichi-miru.com/quiz/sample/</loc><lastmod>2026-10-27</lastmod></url>'
                '</urlset>', encoding="utf-8"
            )
            with patch.object(lounge, "ROOT", root), patch.object(lounge, "SITEMAP_PATH", sitemap), patch.object(lounge, "DAILY_QUIZ_DATA_PATH", data):
                actual, _ = lounge.load_daily_quiz_sitemap_entries()
            self.assertEqual(dict(actual), {"quiz/": "2026-10-18", "quiz/sample/": "2026-10-27", "quiz/new/": "2026-09-30"})

    def test_quiz_regeneration_keeps_other_urls_and_lastmods(self):
        original = entries(ROOT / "sitemap.xml")
        routes = [url.removeprefix(quiz.SITE_URL) for url, _ in original if url.startswith(f"{quiz.SITE_URL}/quiz/")]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "sitemap.xml"
            target.write_bytes((ROOT / "sitemap.xml").read_bytes())
            with patch.object(quiz, "ROOT", root):
                quiz.update_sitemap(routes, set())
            regenerated = entries(target)
        self.assertEqual(len(regenerated), len({url for url, _ in regenerated}))
        self.assertEqual(dict(original), dict(regenerated))

    def test_malformed_sitemap_is_not_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "quiz").mkdir()
            sitemap = root / "sitemap.xml"
            sitemap.write_text("<broken", encoding="utf-8")
            with patch.object(lounge, "ROOT", root), patch.object(lounge, "SITEMAP_PATH", sitemap), patch.object(lounge, "DAILY_QUIZ_DATA_PATH", root / "missing.json"):
                with self.assertRaises(ValueError):
                    lounge.load_daily_quiz_sitemap_entries()
            self.assertEqual(sitemap.read_text(encoding="utf-8"), "<broken")


if __name__ == "__main__":
    unittest.main()
