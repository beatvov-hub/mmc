#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
import sys
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from generate_lounge import load_logs, update_sitemap
from site_layout import apply_layout_to_file


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "src" / "data" / "todayOne.json"
MEMBERS_PATH = ROOT / "members.html"
OUTPUT_PATH = ROOT / "today-one.html"
ARCHIVE_DIR = ROOT / "today-one" / "archive"
ARCHIVE_INDEX_PATH = ARCHIVE_DIR / "index.html"
INDEX_PATH = ROOT / "index.html"
BASE_URL = "https://mainichi-miru.com"
CANONICAL_URL = f"{BASE_URL}/today-one"
TOKYO = ZoneInfo("Asia/Tokyo")
WEEKDAY_EN = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
PUBLISHED_REQUIRED_FIELDS = (
    "date",
    "slug",
    "name",
    "category",
    "officialUrl",
    "summary",
    "whyToday",
    "useFor",
    "keiComment",
    "verifiedAt",
    "status",
)
TEASER_START = "<!-- TODAY_ONE_TEASER_START -->"
TEASER_END = "<!-- TODAY_ONE_TEASER_END -->"
TEASER_RE = re.compile(
    rf"^[ \t]*{re.escape(TEASER_START)}[\s\S]*?^[ \t]*{re.escape(TEASER_END)}\s*",
    re.MULTILINE,
)
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def today_in_tokyo(now: datetime | None = None) -> date:
    current = now.astimezone(TOKYO) if now else datetime.now(TOKYO)
    return current.date()


def parse_iso_date(value: object, *, label: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a valid YYYY-MM-DD date: {value!r}") from exc


def is_safe_external_url(value: object) -> bool:
    parsed = urlparse(str(value))
    return parsed.scheme == "https" and bool(parsed.netloc)


def prefixed_path(value: str, prefix: str) -> str:
    if not value or value.startswith(("http://", "https://", "/")):
        return value
    return f"{prefix}{value}"


def published_entry_issues(entry: object, *, label: str) -> list[str]:
    if not isinstance(entry, dict):
        return [f"{label} must be an object."]
    if entry.get("status") != "published":
        return []

    issues: list[str] = []
    missing = [field for field in PUBLISHED_REQUIRED_FIELDS if not entry.get(field)]
    recommended = entry.get("recommendedFor")
    if not isinstance(recommended, dict):
        missing.append("recommendedFor")
    else:
        for field in ("employeeId", "reason"):
            if not recommended.get(field):
                missing.append(f"recommendedFor.{field}")
    if missing:
        issues.append(f"{label} is missing published fields: {', '.join(missing)}")

    if entry.get("slug") and not SLUG_RE.fullmatch(str(entry["slug"])):
        issues.append(f"{label}.slug must contain lowercase letters, numbers, and hyphens only.")

    if entry.get("officialUrl") and not is_safe_external_url(entry["officialUrl"]):
        issues.append(f"{label}.officialUrl must be an https URL.")
    if entry.get("githubUrl") and not is_safe_external_url(entry["githubUrl"]):
        issues.append(f"{label}.githubUrl must be an https URL when present.")
    if entry.get("verifiedAt"):
        try:
            parse_iso_date(entry["verifiedAt"], label=f"{label}.verifiedAt")
        except ValueError as exc:
            issues.append(str(exc))
    return issues


def is_renderable_published_entry(entry: object) -> bool:
    return (
        isinstance(entry, dict)
        and entry.get("status") == "published"
        and not published_entry_issues(entry, label="entry")
    )


class MemberCardParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.members: dict[str, dict[str, str]] = {}
        self.current: dict[str, str] | None = None
        self.article_depth = 0
        self.capture_tag = ""
        self.capture_key = ""
        self.capture_text: list[str] = []

    @staticmethod
    def classes(attrs: list[tuple[str, str | None]]) -> set[str]:
        value = dict(attrs).get("class") or ""
        return set(value.split())

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        classes = self.classes(attrs)
        if tag == "article" and "member-card" in classes and self.current is None:
            self.current = {}
            self.article_depth = 1
            return
        if self.current is None:
            return
        if tag == "article":
            self.article_depth += 1
        if tag == "img" and not self.current.get("image"):
            self.current["image"] = attrs_dict.get("src") or ""
        if tag == "a" and "mini-button" in classes:
            self.current["profileUrl"] = attrs_dict.get("href") or ""
        capture_key = ""
        if tag == "span" and "member-meta" in classes:
            capture_key = "meta"
        elif tag == "h2":
            capture_key = "name"
        elif tag == "strong":
            capture_key = "role"
        if capture_key:
            self.capture_tag = tag
            self.capture_key = capture_key
            self.capture_text = []

    def handle_data(self, data: str) -> None:
        if self.current is not None and self.capture_key:
            self.capture_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self.current is None:
            return
        if tag == self.capture_tag and self.capture_key:
            self.current[self.capture_key] = "".join(self.capture_text).strip()
            self.capture_tag = ""
            self.capture_key = ""
            self.capture_text = []
        if tag != "article":
            return
        self.article_depth -= 1
        if self.article_depth > 0:
            return
        meta = self.current.get("meta", "")
        employee_id, _, department = meta.partition("/")
        employee_id = employee_id.strip()
        if employee_id:
            self.current["employeeId"] = employee_id
            self.current["department"] = department.strip()
            self.members[employee_id] = self.current
        self.current = None


def load_members(path: Path = MEMBERS_PATH) -> dict[str, dict[str, str]]:
    parser = MemberCardParser()
    parser.feed(path.read_text(encoding="utf-8"))
    if not parser.members:
        raise ValueError(f"No member cards found in {path}")
    return parser.members


def load_data(path: Path = DATA_PATH) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("entries"), list):
        raise ValueError("todayOne.json must contain an entries array.")
    return data


def validate_data(data: dict, members: dict[str, dict[str, str]]) -> list[str]:
    warnings: list[str] = []
    updated_at = data.get("updatedAt")
    if updated_at is not None:
        try:
            datetime.fromisoformat(str(updated_at))
        except ValueError as exc:
            raise ValueError("updatedAt must be null or an ISO 8601 datetime.") from exc

    published_by_date: dict[str, int] = {}
    for index, entry in enumerate(data["entries"]):
        label = f"entries[{index}]"
        if not isinstance(entry, dict):
            warnings.append(f"{label} must be an object and was skipped.")
            continue
        status = entry.get("status")
        if status not in {"published", "draft"}:
            warnings.append(f"{label}.status must be published or draft; entry was skipped.")
            continue
        try:
            entry_date = parse_iso_date(entry.get("date"), label=f"{label}.date")
        except ValueError as exc:
            warnings.append(f"{exc} Entry was skipped.")
            continue
        if status == "draft":
            continue

        date_key = entry_date.isoformat()
        if date_key in published_by_date:
            first_index = published_by_date[date_key]
            raise ValueError(
                f"Duplicate published entries for {date_key}: entries[{first_index}] and {label}."
            )
        published_by_date[date_key] = index

        issues = published_entry_issues(entry, label=label)
        if issues:
            warnings.extend(f"{issue} Entry was skipped." for issue in issues)
            continue

        recommended = entry["recommendedFor"]
        employee_id = str(recommended["employeeId"])
        if employee_id not in members:
            warnings.append(
                f"{label}.recommendedFor.employeeId was not found in members.html: {employee_id}"
            )
    return warnings


def select_today_entry(data: dict, target_date: date) -> dict | None:
    target = target_date.isoformat()
    return next(
        (
            entry
            for entry in data["entries"]
            if is_renderable_published_entry(entry) and entry.get("date") == target
        ),
        None,
    )


def select_previous_entry(data: dict, target_date: date) -> dict | None:
    previous = []
    for entry in data["entries"]:
        if not is_renderable_published_entry(entry):
            continue
        try:
            entry_date = parse_iso_date(entry.get("date"), label="entry.date")
        except ValueError:
            continue
        if entry_date < target_date:
            previous.append(entry)
    return max(previous, key=lambda item: item["date"], default=None)


def display_date(value: date) -> str:
    return f"{value:%Y.%m.%d} {WEEKDAY_EN[value.weekday()]}"


def archive_filename(entry: dict) -> str:
    return f'{entry["date"]}-{entry["slug"]}.html'


def archive_url(entry: dict) -> str:
    return f'{BASE_URL}/today-one/archive/{entry["date"]}-{entry["slug"]}'


def published_archive_entries(data: dict, target_date: date) -> list[dict]:
    entries: list[dict] = []
    for entry in data["entries"]:
        if not is_renderable_published_entry(entry):
            continue
        try:
            entry_date = parse_iso_date(entry.get("date"), label="entry.date")
        except ValueError:
            continue
        if entry_date <= target_date:
            entries.append(entry)
    return sorted(entries, key=lambda item: (item["date"], item["slug"]), reverse=True)


def render_member(
    entry: dict,
    members: dict[str, dict[str, str]],
    *,
    prefix: str = "",
) -> str:
    recommendation = entry.get("recommendedFor") or {}
    employee_id = str(recommendation.get("employeeId", ""))
    reason = recommendation.get("reason", "")
    member = members.get(employee_id)
    if not member:
        return f'''        <section class="today-one-section today-one-recommendation" aria-labelledby="today-one-recommendation-title">
          <p class="section-kicker">Recommended For</p>
          <h2 id="today-one-recommendation-title">誰に持たせたい？</h2>
          <p>{esc(reason)}</p>
        </section>'''

    department = member.get("department", "")
    role = member.get("role", "")
    department_html = f'<span>{esc(department)}</span>' if department else ""
    profile_url = member.get("profileUrl", "")
    profile_link = (
        f'<a class="today-one-profile-link" href="{esc(prefixed_path(profile_url, prefix))}">プロフィールを見る</a>'
        if profile_url
        else ""
    )
    image_html = (
        f'<img src="{esc(prefixed_path(member["image"], prefix))}" alt="{esc(member.get("name", ""))}" loading="lazy" />'
        if member.get("image")
        else ""
    )
    return f'''        <section class="today-one-section today-one-recommendation" aria-labelledby="today-one-recommendation-title">
          <p class="section-kicker">Recommended For</p>
          <h2 id="today-one-recommendation-title">誰に持たせたい？</h2>
          <div class="today-one-member-card">
            {image_html}
            <div>
              <small>{esc(employee_id)}</small>
              <h3>{esc(member.get("name", ""))}</h3>
              <p class="today-one-member-role">{esc(role)} {department_html}</p>
              <p>{esc(reason)}</p>
              {profile_link}
            </div>
          </div>
        </section>'''


def render_kei_comment(
    entry: dict,
    members: dict[str, dict[str, str]],
    *,
    prefix: str = "",
) -> str:
    kei = members.get("MMC-009", {})
    image_html = (
        f'<img src="{esc(prefixed_path(kei["image"], prefix))}" alt="{esc(kei.get("name", "ケイ"))}" loading="lazy" />'
        if kei.get("image")
        else ""
    )
    byline = "｜".join(filter(None, [kei.get("name", "ケイ"), kei.get("role", "広報部長")]))
    return f'''        <section class="today-one-section today-one-kei" aria-labelledby="today-one-kei-title">
          <p class="section-kicker">Kei's Note</p>
          <h2 id="today-one-kei-title">ケイのひとこと</h2>
          <div class="today-one-kei-note">
            <div class="today-one-kei-copy">
              <div class="today-one-kei-person">
                {image_html}
                <strong>{esc(byline)}</strong>
              </div>
              <p>{esc(entry.get("keiComment", ""))}</p>
            </div>
            <figure class="today-one-kei-visual">
              <img src="{esc(prefixed_path('image/today-one/kei-note.webp', prefix))}" alt="メガホン、ノート、虫眼鏡のコラージュ" loading="lazy" />
              <figcaption><span>KEI'S NOTE</span><strong>伝える前に<br />確かめる。</strong></figcaption>
            </figure>
          </div>
        </section>'''


def render_value(value: object) -> str:
    if isinstance(value, list):
        items = "".join(f"<li>{esc(item)}</li>" for item in value if item not in (None, ""))
        return f"<ul>{items}</ul>" if items else ""
    return esc(value)


def render_basic_info(entry: dict) -> str:
    rows: list[str] = []
    rows.append(f"<div><dt>種別</dt><dd>{esc(entry.get('category', ''))}</dd></div>")
    rows.append(
        '<div><dt>公式サイト</dt><dd>'
        f'<a href="{esc(entry.get("officialUrl", ""))}" target="_blank" rel="noopener noreferrer">公式サイトを開く（外部サイト）</a>'
        "</dd></div>"
    )
    rows.append(
        f'<div><dt>確認日</dt><dd><time datetime="{esc(entry.get("verifiedAt", ""))}">{esc(entry.get("verifiedAt", ""))}</time></dd></div>'
    )
    optional_fields = (
        ("pricing", "料金"),
        ("conditions", "利用条件"),
        ("license", "ライセンス"),
        ("notes", "補足"),
    )
    for field, label in optional_fields:
        value = entry.get(field)
        if value not in (None, "", []):
            rows.append(f"<div><dt>{esc(label)}</dt><dd>{render_value(value)}</dd></div>")
    if entry.get("githubUrl"):
        rows.append(
            '<div><dt>GitHub</dt><dd>'
            f'<a href="{esc(entry["githubUrl"])}" target="_blank" rel="noopener noreferrer">GitHubを開く（外部サイト）</a>'
            "</dd></div>"
        )
    return f'''        <section class="today-one-section today-one-basic" aria-labelledby="today-one-basic-title">
          <p class="section-kicker">Basic Information</p>
          <h2 id="today-one-basic-title">基本情報</h2>
          <dl>{''.join(rows)}</dl>
        </section>'''


def render_entry(
    entry: dict,
    members: dict[str, dict[str, str]],
    target_date: date,
    *,
    prefix: str = "",
    entry_label: str = "今日のひとつ",
) -> str:
    return f'''      <article class="today-one-entry" aria-labelledby="today-one-entry-name">
        <header class="today-one-entry-header">
          <div class="today-one-entry-meta">
            <time datetime="{esc(entry["date"])}">{esc(display_date(target_date))}</time>
            <span>{esc(entry.get("category", ""))}</span>
          </div>
          <p class="today-one-entry-label">{esc(entry_label)}</p>
          <h2 id="today-one-entry-name">{esc(entry.get("name", ""))}</h2>
          <p class="today-one-summary-label">一言でいうと</p>
          <p class="today-one-summary">{esc(entry.get("summary", ""))}</p>
          <a class="today-one-official-link" href="{esc(entry.get("officialUrl", ""))}" target="_blank" rel="noopener noreferrer">公式サイトを見る <span aria-hidden="true">↗</span><span class="visually-hidden">（外部サイト）</span></a>
        </header>
        <div class="today-one-content-grid">
          <section class="today-one-section" aria-labelledby="today-one-why-title">
            <p class="section-kicker">Why Today</p>
            <h2 id="today-one-why-title">なぜ今日はこれ？</h2>
            <p>{esc(entry.get("whyToday", ""))}</p>
          </section>
          <section class="today-one-section" aria-labelledby="today-one-use-title">
            <p class="section-kicker">Use For</p>
            <h2 id="today-one-use-title">何に使える？</h2>
            <p>{esc(entry.get("useFor", ""))}</p>
          </section>
          {render_member(entry, members, prefix=prefix)}
          {render_kei_comment(entry, members, prefix=prefix)}
          {render_basic_info(entry)}
        </div>
      </article>'''


def render_empty(members: dict[str, dict[str, str]], target_date: date) -> str:
    kei = members.get("MMC-009", {})
    image_html = (
        f'<img src="{esc(kei["image"])}" alt="{esc(kei.get("name", "ケイ"))}" loading="lazy" />'
        if kei.get("image")
        else ""
    )
    return f'''      <section class="today-one-empty" aria-labelledby="today-one-empty-title">
        <time datetime="{target_date.isoformat()}">{display_date(target_date)}</time>
        <div class="today-one-empty-inner">
          {image_html}
          <div>
            <p class="section-kicker">Today's One</p>
            <h2 id="today-one-empty-title">本日のひとつは、まだ届いていません。</h2>
            <p>ケイ、まだ巡回中です。今日の仕事道具が決まったら、ここへ一件だけ届きます。</p>
          </div>
        </div>
      </section>'''


def render_archive_promo(entries: list[dict], target_date: date) -> str:
    previous = next(
        (entry for entry in entries if entry["date"] < target_date.isoformat()),
        None,
    )
    if previous:
        previous_html = f'''        <a class="today-one-archive-latest" href="today-one/archive/{esc(archive_filename(previous))}">
          <time datetime="{esc(previous["date"])}">{esc(previous["date"].replace("-", "."))}</time>
          <strong>{esc(previous["name"])}</strong>
          <span>この日のひとつを見る →</span>
        </a>'''
    else:
        previous_html = '        <p class="today-one-archive-empty">過去のひとつは、ここへ少しずつ増えていきます。</p>'
    return f'''      <section class="today-one-archive-promo" aria-labelledby="today-one-archive-promo-title">
        <div>
          <p class="section-kicker">Archive</p>
          <h2 id="today-one-archive-promo-title">これまでのひとつ。</h2>
        </div>
{previous_html}
        <a class="today-one-archive-index-link" href="today-one/archive/index.html">アーカイブを見る <span aria-hidden="true">→</span></a>
      </section>'''


def render_archive_card(entry: dict) -> str:
    return f'''          <a class="today-one-archive-card" href="{esc(archive_filename(entry))}">
            <div class="today-one-archive-card-meta">
              <time datetime="{esc(entry["date"])}">{esc(entry["date"].replace("-", "."))}</time>
              <span>{esc(entry["category"])}</span>
            </div>
            <h2>{esc(entry["name"])}</h2>
            <p>{esc(entry["summary"])}</p>
            <strong>この日のひとつを見る <span aria-hidden="true">→</span></strong>
          </a>'''


def render_archive_index_page(entries: list[dict]) -> str:
    title = "AGENT SKILLS ライブラリ｜これまでのひとつ。｜毎日見る株式会社"
    description = "AGENT SKILLS ライブラリ「今日ひとつ。」のアーカイブ。AIと働くための仕事道具を、一日ひとつずつ記録します。"
    cards = "\n".join(render_archive_card(entry) for entry in entries)
    archive_body = (
        f'        <div class="today-one-archive-grid">\n{cards}\n        </div>'
        if cards
        else '        <p class="today-one-archive-page-empty">アーカイブは、これから少しずつ増えていきます。</p>'
    )
    structured_data = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "これまでのひとつ。",
        "description": description,
        "url": f"{BASE_URL}/today-one/archive",
        "inLanguage": "ja-JP",
        "keywords": ["AGENT SKILLS", "AGENT SKILLS ライブラリ", "AIエージェント", "仕事道具"],
    }
    return f'''<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(description)}" />
    <meta name="keywords" content="AGENT SKILLS, AGENT SKILLS ライブラリ, AIエージェント, Codex, MCP, 仕事道具" />
    <link rel="canonical" href="{BASE_URL}/today-one/archive" />
    <meta property="og:title" content="{esc(title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{BASE_URL}/today-one/archive" />
    <meta property="og:site_name" content="毎日見る株式会社" />
    <meta property="og:image" content="{BASE_URL}/image/top009.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="../../favicon.ico" />
    <link rel="stylesheet" href="../../styles.css" />
    <script type="application/ld+json">{json.dumps(structured_data, ensure_ascii=False)}</script>
  </head>
  <body class="subpage today-one-page today-one-archive-page">
    <header class="site-header" aria-label="サイトヘッダー"></header>
    <main class="today-one-main">
      <nav class="profile-breadcrumb today-one-breadcrumb" aria-label="パンくずリスト">
        <a href="../../index.html">ホーム</a>
        <a href="../../today-one.html">今日ひとつ。</a>
        <strong>これまでのひとつ。</strong>
      </nav>
      <header class="today-one-archive-heading">
        <p class="section-kicker">Archive</p>
        <h1>これまでのひとつ。</h1>
        <p>今日ひとつだけ選んだ仕事道具を、日付ごとに残しています。</p>
      </header>
{archive_body}
    </main>
    <footer class="site-footer"></footer>
  </body>
</html>
'''


def render_archive_detail_page(
    entry: dict,
    members: dict[str, dict[str, str]],
) -> str:
    entry_date = parse_iso_date(entry["date"], label="entry.date")
    title = f'{entry["name"]}｜AGENT SKILLS ライブラリ｜{entry["date"].replace("-", ".")}｜毎日見る株式会社'
    description = f'AGENT SKILLS ライブラリ「今日ひとつ。」の記録。{entry["summary"]}'
    canonical = archive_url(entry)
    structured_data = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": f'{entry["date"]}の今日ひとつ。｜{entry["name"]}',
        "description": description,
        "url": canonical,
        "datePublished": entry["date"],
        "inLanguage": "ja-JP",
        "keywords": ["AGENT SKILLS", "AGENT SKILLS ライブラリ", entry["category"], entry["name"]],
        "isPartOf": {
            "@type": "CollectionPage",
            "name": "AGENT SKILLS ライブラリ｜これまでのひとつ。",
            "url": f"{BASE_URL}/today-one/archive",
        },
    }
    return f'''<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(description)}" />
    <meta name="keywords" content="AGENT SKILLS, AGENT SKILLS ライブラリ, AIエージェント, Codex, MCP, 仕事道具" />
    <link rel="canonical" href="{canonical}" />
    <meta property="og:title" content="{esc(title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:site_name" content="毎日見る株式会社" />
    <meta property="og:image" content="{BASE_URL}/image/top009.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="../../favicon.ico" />
    <link rel="stylesheet" href="../../styles.css" />
    <script type="application/ld+json">{json.dumps(structured_data, ensure_ascii=False)}</script>
  </head>
  <body class="subpage today-one-page today-one-archive-detail-page">
    <header class="site-header" aria-label="サイトヘッダー"></header>
    <main class="today-one-main">
      <nav class="profile-breadcrumb today-one-breadcrumb" aria-label="パンくずリスト">
        <a href="../../index.html">ホーム</a>
        <a href="../../today-one.html">今日ひとつ。</a>
        <a href="./">これまでのひとつ。</a>
        <strong>{esc(entry["name"])}</strong>
      </nav>
      <header class="today-one-archive-detail-heading">
        <p class="section-kicker">Today's One Archive</p>
        <h1>{esc(entry["date"].replace("-", "."))}のひとつ。</h1>
      </header>
{render_entry(entry, members, entry_date, prefix="../../", entry_label="この日のひとつ")}
      <nav class="today-one-archive-back" aria-label="今日ひとつ。アーカイブへの戻り先">
        <a href="./">これまでのひとつ。へ戻る</a>
        <a href="../../today-one.html">今日のひとつを見る</a>
      </nav>
    </main>
    <footer class="site-footer"></footer>
  </body>
</html>
'''


def render_page(
    entry: dict | None,
    archive_entries: list[dict],
    members: dict[str, dict[str, str]],
    target_date: date,
) -> str:
    title = "AGENT SKILLS ライブラリ｜今日ひとつ。｜毎日見る株式会社"
    description = "AGENT SKILLS ライブラリ「今日ひとつ。」は、AIエージェントや人が仕事で使う道具を毎日1つ選び、用途と持たせたいAI社員を整理するページです。"
    structured_data = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "AGENT SKILLS ライブラリ｜今日ひとつ。",
        "description": description,
        "url": CANONICAL_URL,
        "inLanguage": "ja-JP",
        "keywords": ["AGENT SKILLS", "AGENT SKILLS ライブラリ", "AIエージェント", "Codex", "MCP", "仕事道具"],
        "about": {
            "@type": "Thing",
            "name": "AGENT SKILLS ライブラリ",
            "description": "AIエージェントと人の共同作業に役立つ仕事道具を、一日ひとつずつ紹介するライブラリ。",
        },
        "isPartOf": {
            "@type": "WebSite",
            "name": "毎日見る株式会社",
            "url": f"{BASE_URL}/",
        },
    }
    content = render_entry(entry, members, target_date) if entry else render_empty(members, target_date)
    return f'''<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(description)}" />
    <meta name="keywords" content="AGENT SKILLS, AGENT SKILLS ライブラリ, AIエージェント, Codex, MCP, 仕事道具" />
    <link rel="canonical" href="{CANONICAL_URL}" />
    <meta property="og:title" content="{esc(title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{CANONICAL_URL}" />
    <meta property="og:site_name" content="毎日見る株式会社" />
    <meta property="og:image" content="{BASE_URL}/image/top009.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="favicon.ico" />
    <link rel="stylesheet" href="styles.css" />
    <script type="application/ld+json">{json.dumps(structured_data, ensure_ascii=False)}</script>
  </head>
  <body class="subpage today-one-page">
    <header class="site-header" aria-label="サイトヘッダー"></header>
    <main class="today-one-main">
      <nav class="profile-breadcrumb today-one-breadcrumb" aria-label="パンくずリスト">
        <a href="index.html">ホーム</a>
        <strong>今日ひとつ。</strong>
      </nav>
      <section class="today-one-intro" aria-labelledby="today-one-title">
        <img class="today-one-hero-art" src="image/today-one/hero-workbench.webp" alt="ノート、書籍、コーヒー、ノートPCでつくる仕事机のコラージュ" fetchpriority="high" />
        <div class="today-one-intro-copy">
          <p class="section-kicker">AGENT SKILLS LIBRARY / 07:30 JST</p>
          <h1 id="today-one-title"><img src="image/today-one/today-one-logo.png" alt="今日ひとつ。" /></h1>
          <p class="today-one-catch">何に使えるか。<br />誰に持たせたいか。</p>
          <div class="today-one-library-note">
            <h2>AGENT SKILLS ライブラリとは</h2>
            <p>AIエージェントに仕事を持たせるためのAgent Skillsを中心に、MCP・API・OSSなど周辺の仕事道具も紹介します。「今日ひとつ。」では、大量に並べず、その日に見る1件だけを選びます。</p>
          </div>
        </div>
      </section>
{content}
{render_archive_promo(archive_entries, target_date)}
    </main>
    <footer class="site-footer"></footer>
  </body>
</html>
'''


def render_teaser(entry: dict | None, members: dict[str, dict[str, str]]) -> str:
    if entry:
        recommendation = entry.get("recommendedFor") or {}
        member = members.get(str(recommendation.get("employeeId", "")), {})
        member_name = member.get("name", "")
        member_role = member.get("role", "")
        member_html = f'''          <div class="today-one-teaser-for">
            <span class="today-one-teaser-label">For</span>
            <strong>{esc(member_name)}</strong>
            <small>{esc(member_role)}</small>
          </div>''' if member_name else ""
        selection_html = f'''          <p class="today-one-teaser-selection">Today's selection</p>
          <h3>{esc(entry.get("name", ""))}</h3>
          <p class="today-one-teaser-category">{esc(entry.get("category", ""))}</p>
          <p class="today-one-teaser-summary">{esc(entry.get("summary", ""))}</p>
{member_html}
          <a class="today-one-teaser-link" href="today-one.html">今日のひとつを見る <span aria-hidden="true">→</span></a>'''
        date_html = f'<time datetime="{esc(entry.get("date", ""))}">{esc(str(entry.get("date", "")).replace("-", "."))}</time>'
    else:
        selection_html = '''          <p class="today-one-teaser-selection">Today's selection</p>
          <h3>本日のひとつは、まだ届いていません。</h3>
          <p class="today-one-teaser-summary">ケイ、巡回中です。</p>
          <a class="today-one-teaser-link" href="today-one.html">ページを見る <span aria-hidden="true">→</span></a>'''
        date_html = '<span class="today-one-teaser-empty-date">Today</span>'
    body = f'''      <section id="today-one-teaser" class="today-one-teaser" aria-labelledby="today-one-teaser-title">
        <div class="today-one-teaser-inner">
          <header class="today-one-teaser-heading">
            <p class="today-one-teaser-eyebrow">AGENT SKILLS LIBRARY</p>
            {date_html}
            <h2 id="today-one-teaser-title">今日ひとつ。</h2>
            <p class="today-one-teaser-lead">AIと働くための道具を、毎日ひとつだけ。</p>
          </header>
          <div class="today-one-teaser-selection">
{selection_html}
          </div>
        </div>
      </section>'''
    return f"    {TEASER_START}\n{body}\n    {TEASER_END}\n"


def update_index(entry: dict | None, members: dict[str, dict[str, str]]) -> None:
    html_text = INDEX_PATH.read_text(encoding="utf-8")
    teaser = render_teaser(entry, members)
    if TEASER_RE.search(html_text):
        html_text = TEASER_RE.sub(teaser, html_text, count=1)
    else:
        insert_at = html_text.index('      <section id="news"')
        html_text = html_text[:insert_at] + teaser + "\n" + html_text[insert_at:]
    INDEX_PATH.write_text(html_text, encoding="utf-8")


def generate(target_date: date | None = None) -> None:
    target = target_date or today_in_tokyo()
    members = load_members()
    data = load_data()
    for warning in validate_data(data, members):
        print(f"WARNING: {warning}", file=sys.stderr)
    entry = select_today_entry(data, target)
    archive_entries = published_archive_entries(data, target)
    OUTPUT_PATH.write_text(
        render_page(entry, archive_entries, members, target),
        encoding="utf-8",
    )
    update_index(entry, members)

    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    for path in ARCHIVE_DIR.glob("*.html"):
        path.unlink()
    ARCHIVE_INDEX_PATH.write_text(
        render_archive_index_page(archive_entries),
        encoding="utf-8",
    )
    archive_paths: list[Path] = []
    for archive_entry in archive_entries:
        archive_path = ARCHIVE_DIR / archive_filename(archive_entry)
        archive_path.write_text(
            render_archive_detail_page(archive_entry, members),
            encoding="utf-8",
        )
        archive_paths.append(archive_path)

    for path in (OUTPUT_PATH, INDEX_PATH, ARCHIVE_INDEX_PATH, *archive_paths):
        apply_layout_to_file(path)
    update_sitemap(load_logs())
    state = entry.get("name") if entry else "empty state"
    print(
        f"Generated today-one.html, top teaser, and {len(archive_paths)} archive pages "
        f"for {target.isoformat()}: {state}"
    )


if __name__ == "__main__":
    generate()
