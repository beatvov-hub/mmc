#!/usr/bin/env python3
"""Strict, dependency-free validation for AI鑑識室 article data and generated pages."""
from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data" / "ai-forensics"
OUTPUT_DIR = ROOT / "ai-forensics"
SITEMAP_PATH = ROOT / "sitemap.xml"
REDIRECTS_PATH = ROOT / "_redirects"
BASE_URL = "https://mainichi-miru.com"

REQUIRED_KEYS = {
    "id", "publishedAt", "title", "shortTitle", "category", "difficulty",
    "targetAudience", "summary", "scenario", "question", "inspectionPoints",
    "verificationLevel", "verificationLabel", "verificationMessage", "verdict",
    "safeActions", "avoidActions", "positiveUse", "makotoComment", "oneLineLesson",
    "tags", "sources", "visualSuggestion",
}
VALID_CATEGORIES = {"media-literacy", "security", "scam", "health-ai", "work-use"}
VALID_DIFFICULTIES = {"beginner", "standard", "advanced"}
VALID_PRIORITIES = {"high", "medium", "low"}
VALID_CONFIDENCE = {"high", "medium", "low"}
VALID_SOURCE_TYPES = {
    "government", "official", "research", "news", "security", "security-guidance",
    "official-statistics", "official-consumer-guidance", "fact-check",
    "international-organization", "other",
    "ai-provider-safety-research", "ai-provider-safety-update",
    "financial-regulator-investor-guidance", "government-ai-risk-guidance",
    "government-ai-security-report", "government-consumer-alert",
    "government-consumer-guidance", "government-enforcement-case",
    "government-enforcement-release", "government-fraud-data",
    "government-investor-guidance", "government-regulatory-guidance",
    "government-regulatory-update", "government-security-advisory",
    "industry-primary-research", "industry-standard-guidance",
    "medical-professional-guidance", "official-enterprise-case-study",
    "official-media-literacy-guidance", "official-primary-research-explainer",
    "official-product-documentation", "official-product-update",
    "official-protocol-specification", "official-standard-guidance",
    "official-technical-standard-explainer", "peer-reviewed-medical-research",
    "peer-reviewed-perspective", "peer-reviewed-primary-research",
    "peer-reviewed-research", "primary-research-preprint",
    "primary-security-research", "researcher-authored-current-explainer",
    "security-best-practice-guidance", "security-research-explainer",
}
STRICT_CASE_ID = re.compile(r"^case-(\d{8})-(\d{2})$")
LEGACY_CASE_ID = re.compile(r"^case-\d{8}(?:-\d{2})?$")
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def is_nonempty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def valid_iso_date(value: object) -> bool:
    if not isinstance(value, str) or not ISO_DATE.fullmatch(value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def changed_json_paths(base: str) -> set[Path]:
    commands = [
        ["git", "diff", "--name-only", base, "--", "src/data/ai-forensics"],
        ["git", "ls-files", "--others", "--exclude-standard", "src/data/ai-forensics"],
    ]
    paths: set[Path] = set()
    for command in commands:
        result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=False)
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or "git changed-file lookup failed")
        for line in result.stdout.splitlines():
            path = ROOT / line
            if path.suffix == ".json":
                paths.add(path)
    return paths


def load_articles(errors: list[str]) -> list[tuple[Path, dict[str, Any]]]:
    articles: list[tuple[Path, dict[str, Any]]] = []
    for path in sorted(DATA_DIR.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            fail(errors, f"{path.relative_to(ROOT)}: JSON parse failed: {exc}")
            continue
        if not isinstance(payload, dict):
            fail(errors, f"{path.relative_to(ROOT)}: top-level JSON must be an object")
            continue
        articles.append((path, payload))
    return articles


def validate_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc) and not parsed.username and not parsed.password


def validate_article(path: Path, article: dict[str, Any], *, strict_id: bool, expected_date: str | None) -> list[str]:
    errors: list[str] = []
    name = str(path.relative_to(ROOT))
    missing = sorted(REQUIRED_KEYS - article.keys())
    if missing:
        fail(errors, f"{name}: missing required keys: {', '.join(missing)}")
        return errors

    article_id = article["id"]
    case_match = STRICT_CASE_ID.fullmatch(article_id) if isinstance(article_id, str) else None
    if path.stem.startswith("case-") and article_id != path.stem:
        fail(errors, f"{name}: id must match filename")
    if strict_id and not case_match:
        fail(errors, f"{name}: id must use case-YYYYMMDD-NN")
    elif not strict_id and path.stem.startswith("case-") and (not isinstance(article_id, str) or not LEGACY_CASE_ID.fullmatch(article_id)):
        fail(errors, f"{name}: case id is malformed")
    if expected_date and case_match and f"{case_match.group(1)[:4]}-{case_match.group(1)[4:6]}-{case_match.group(1)[6:]}" != expected_date:
        fail(errors, f"{name}: id date does not equal expected Tokyo date {expected_date}")

    if not valid_iso_date(article["publishedAt"]):
        fail(errors, f"{name}: publishedAt must be a valid YYYY-MM-DD date")
    elif expected_date and article["publishedAt"] != expected_date:
        fail(errors, f"{name}: publishedAt does not equal expected Tokyo date {expected_date}")
    if article["category"] not in VALID_CATEGORIES:
        fail(errors, f"{name}: category must be one of the five AI鑑識室 categories")
    if article["difficulty"] not in VALID_DIFFICULTIES:
        fail(errors, f"{name}: difficulty is invalid")
    if article["verificationLevel"] not in {1, 2, 3, 4, 5}:
        fail(errors, f"{name}: verificationLevel must be an integer from 1 to 5")

    for key in ("title", "shortTitle", "summary", "verificationLabel", "verificationMessage", "makotoComment", "oneLineLesson"):
        if not is_nonempty_string(article[key]):
            fail(errors, f"{name}: {key} must be a non-empty string")
    for key in ("targetAudience", "inspectionPoints", "safeActions", "avoidActions", "tags", "sources"):
        if not isinstance(article[key], list) or not article[key]:
            fail(errors, f"{name}: {key} must be a non-empty array")

    scenario = article["scenario"]
    if not isinstance(scenario, dict) or not all(is_nonempty_string(scenario.get(key)) for key in ("headline", "description", "whyItMatters")):
        fail(errors, f"{name}: scenario requires headline, description, and whyItMatters")
    question = article["question"]
    if not isinstance(question, dict) or not is_nonempty_string(question.get("text")) or not is_nonempty_string(question.get("explanation")):
        fail(errors, f"{name}: question requires text and explanation")
    else:
        choices = question.get("choices")
        recommended = question.get("recommendedAnswers")
        choice_ids = {item.get("id") for item in choices if isinstance(item, dict)} if isinstance(choices, list) else set()
        if not isinstance(choices, list) or len(choices) < 2 or not all(isinstance(item, dict) and all(is_nonempty_string(item.get(k)) for k in ("id", "label", "description")) for item in choices):
            fail(errors, f"{name}: question.choices requires at least two complete choices")
        if not isinstance(recommended, list) or not recommended or not set(recommended).issubset(choice_ids):
            fail(errors, f"{name}: question.recommendedAnswers must reference choices")
    for item in article["inspectionPoints"]:
        if not isinstance(item, dict) or not all(is_nonempty_string(item.get(k)) for k in ("title", "description")) or item.get("priority") not in VALID_PRIORITIES:
            fail(errors, f"{name}: every inspectionPoints item requires title, description, and valid priority")
    verdict = article["verdict"]
    if not isinstance(verdict, dict) or not all(is_nonempty_string(verdict.get(k)) for k in ("label", "description")) or verdict.get("confidence") not in VALID_CONFIDENCE:
        fail(errors, f"{name}: verdict requires label, description, and valid confidence")
    for key in ("safeActions", "avoidActions"):
        if not all(isinstance(item, dict) and all(is_nonempty_string(item.get(k)) for k in ("action", "reason")) for item in article[key]):
            fail(errors, f"{name}: every {key} item requires action and reason")
    positive = article["positiveUse"]
    if not isinstance(positive, dict) or not all(is_nonempty_string(positive.get(k)) for k in ("title", "description")) or not isinstance(positive.get("examples"), list) or not positive["examples"]:
        fail(errors, f"{name}: positiveUse requires title, description, and examples")
    visual = article["visualSuggestion"]
    if not isinstance(visual, dict) or not all(is_nonempty_string(visual.get(k)) for k in ("mainVisual", "cardIcon", "accentTone")):
        fail(errors, f"{name}: visualSuggestion requires mainVisual, cardIcon, and accentTone")
    elif any("](" in str(visual.get(key, "")) for key in ("mainVisual", "cardIcon", "accentTone")):
        fail(errors, f"{name}: visualSuggestion must not contain embedded link markup")
    for source in article["sources"]:
        if not isinstance(source, dict) or not all(is_nonempty_string(source.get(k)) for k in ("title", "publisher", "sourceType")):
            fail(errors, f"{name}: every source requires title, publisher, and sourceType")
            continue
        if any("](" in str(source.get(key, "")) for key in ("title", "publisher")):
            fail(errors, f"{name}: source title and publisher must not contain embedded link markup")
        if source["sourceType"] not in VALID_SOURCE_TYPES:
            fail(errors, f"{name}: sourceType is invalid")
        if not validate_url(source.get("url")):
            fail(errors, f"{name}: source URL must be an absolute HTTPS URL")
        published = source.get("publishedAt")
        if published is not None and not valid_iso_date(published):
            fail(errors, f"{name}: source publishedAt must be YYYY-MM-DD or null")
    return errors


def verify_source_urls(targets: list[tuple[Path, dict[str, Any]]]) -> list[str]:
    errors: list[str] = []
    for path, article in targets:
        for source in article.get("sources", []):
            if not isinstance(source, dict) or not validate_url(source.get("url")):
                continue
            request = urllib.request.Request(source["url"], headers={"User-Agent": "MMC-AI-Forensics-Validator/1.0"})
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    if response.status < 200 or response.status >= 400:
                        fail(errors, f"{path.relative_to(ROOT)}: source URL returned HTTP {response.status}: {source['url']}")
            except (urllib.error.URLError, TimeoutError, ValueError) as exc:
                # Some Windows-managed networks add a trusted enterprise TLS root that
                # is visible to curl/Windows but not to Python's bundled CA store.
                # Fall back to curl without disabling certificate verification.
                curl = shutil.which("curl.exe") or shutil.which("curl")
                if curl:
                    fallback = subprocess.run(
                        [curl, "--fail", "--location", "--silent", "--show-error", "--output", "NUL", source["url"]],
                        text=True,
                        capture_output=True,
                        timeout=30,
                        check=False,
                    )
                    if fallback.returncode == 0:
                        continue
                fail(errors, f"{path.relative_to(ROOT)}: source URL is not reachable: {source['url']} ({exc})")
    return errors


def validate_generated(targets: list[tuple[Path, dict[str, Any]]]) -> list[str]:
    errors: list[str] = []
    sitemap = SITEMAP_PATH.read_text(encoding="utf-8") if SITEMAP_PATH.exists() else ""
    redirects = REDIRECTS_PATH.read_text(encoding="utf-8") if REDIRECTS_PATH.exists() else ""
    for _, article in targets:
        article_id = article["id"]
        page_path = OUTPUT_DIR / f"{article_id}.html"
        if not page_path.exists():
            fail(errors, f"missing generated page: {page_path.relative_to(ROOT)}")
            continue
        page = page_path.read_text(encoding="utf-8")
        required_fragments = [
            article["title"], article["summary"], article["scenario"]["headline"],
            article["question"]["text"], "確認ポイント", article["verdict"]["label"],
            "安全な対処方法", "避けたい行動", "AIの前向きな活用", article["makotoComment"],
            "情報源", *article["tags"], f'<link rel="canonical" href="{BASE_URL}/ai-forensics/{article_id}"',
        ]
        for fragment in required_fragments:
            if fragment not in page and html.escape(fragment, quote=True) not in page:
                fail(errors, f"{page_path.relative_to(ROOT)}: generated page is missing expected content")
                break
        for source in article["sources"]:
            if source["url"] not in page:
                fail(errors, f"{page_path.relative_to(ROOT)}: source is not rendered as a link")
        sitemap_entry = f"<loc>{BASE_URL}/ai-forensics/{article_id}</loc><lastmod>{article['publishedAt']}</lastmod>"
        if sitemap_entry not in sitemap:
            fail(errors, f"sitemap.xml: missing entry for {article_id}")
        if f"/ai-forensics/{article_id} /ai-forensics/{article_id}.html 200" not in redirects:
            fail(errors, f"_redirects: missing clean URL route for {article_id}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--changed-only", action="store_true", help="validate changed/new article JSON while always checking global duplicate IDs")
    parser.add_argument("--base", default="HEAD", help="git base used by --changed-only")
    parser.add_argument("--strict-id", action="store_true", help="require new case-YYYYMMDD-NN IDs")
    parser.add_argument("--expected-date", help="require changed article IDs and publishedAt to equal this Asia/Tokyo YYYY-MM-DD date")
    parser.add_argument("--verify-source-urls", action="store_true", help="request every selected source URL and fail on an unreachable response")
    parser.add_argument("--check-generated", action="store_true", help="check pages, sitemap, canonical URLs, links, and redirects after generation")
    args = parser.parse_args()
    errors: list[str] = []
    if args.expected_date and not valid_iso_date(args.expected_date):
        parser.error("--expected-date must be a valid YYYY-MM-DD date")
    articles = load_articles(errors)
    ids: dict[str, Path] = {}
    for path, article in articles:
        article_id = article.get("id")
        if not isinstance(article_id, str):
            continue
        if article_id in ids:
            fail(errors, f"duplicate article id {article_id}: {ids[article_id].relative_to(ROOT)} and {path.relative_to(ROOT)}")
        ids[article_id] = path
    selected = articles
    if args.changed_only:
        try:
            changed = changed_json_paths(args.base)
        except RuntimeError as exc:
            fail(errors, str(exc))
            changed = set()
        selected = [(path, article) for path, article in articles if path in changed]
        if not selected:
            fail(errors, "no changed or untracked AI鑑識室 JSON was found")
    for path, article in selected:
        errors.extend(validate_article(path, article, strict_id=args.strict_id, expected_date=args.expected_date))
    if args.verify_source_urls and not errors:
        errors.extend(verify_source_urls(selected))
    if args.check_generated and not errors:
        errors.extend(validate_generated(selected))
    if errors:
        print("AI鑑識室 validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"AI鑑識室 validation passed ({len(selected)} article(s)).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
