#!/usr/bin/env python3
from __future__ import annotations

import calendar
import html
import json
from collections import defaultdict
from pathlib import Path

from site_layout import apply_layout_to_file

ROOT = Path(__file__).resolve().parents[1]
LOUNGE_LOGS_PATH = ROOT / "src" / "data" / "loungeLogs.json"
LOUNGE_TOPICS_PATH = ROOT / "src" / "data" / "loungeCalendarTopics.json"
WORK_STORIES_PATH = ROOT / "src" / "data" / "workStories.json"
INDEX_HTML_PATH = ROOT / "index.html"
LOUNGE_HTML_PATH = ROOT / "lounge.html"
ARCHIVE_DIR = ROOT / "lounge-archive"
SITEMAP_PATH = ROOT / "sitemap.xml"
BASE_URL = "https://mainichi-miru.com"

WEEKDAY_EN = {
    "月": "Mon",
    "火": "Tue",
    "水": "Wed",
    "木": "Thu",
    "金": "Fri",
    "土": "Sat",
    "日": "Sun",
}

TIME_SLOT_CLASSES = {
    "08": "time-slot-0800",
    "09": "time-slot-0900",
    "12": "time-slot-1200",
    "13": "time-slot-1300",
    "15": "time-slot-1500",
    "17": "time-slot-1700",
    "18": "time-slot-1800",
    "20": "time-slot-2000",
    "23": "time-slot-2300",
}

STATIC_SITEMAP_PATHS = [
    "",
    "about",
    "about/director",
    "about/director/culture",
    "members",
    "members/hono",
    "members/shoma",
    "members/takaken",
    "members/michael",
    "members/dg",
    "members/nemu",
    "members/rei",
    "members/akito",
    "members/kei",
    "members/makoto",
    "members/koto",
    "members/pechi",
    "ai-forensics",
    "works",
    "gallery",
    "gallery/fc2-homepage-redesign",
    "lounge",
    "lounge-dictionary",
    "news",
    "contact",
    "thanks",
]

SPEAKER_DEFAULTS = {
    "ほのちゃん": {
        "speakerClass": "speaker-hono",
        "icon": "image/icon/icon_mmc001.jpg",
        "alt": "ほのちゃんのアイコン",
        "role": "総務課",
    },
    "ショウマ": {
        "speakerClass": "speaker-shoma",
        "icon": "image/icon/icon_mmc002.jpg",
        "alt": "ショウマのアイコン",
        "role": "企画営業部長",
    },
    "たかけん": {
        "speakerClass": "speaker-takaken",
        "icon": "image/icon/icon_mmc003.jpg",
        "alt": "たかけんのアイコン",
        "role": "ゲーム制作部長",
    },
    "マイケル": {
        "speakerClass": "speaker-michael",
        "icon": "image/icon/icon_mmc004.jpg",
        "alt": "マイケルのアイコン",
        "role": "海外情報部",
    },
    "DG": {
        "speakerClass": "speaker-dg",
        "icon": "image/icon/icon_mmc005.jpg",
        "alt": "DGのアイコン",
        "role": "人狼界隈観測課長",
    },
    "ねむちゃん": {
        "speakerClass": "speaker-nemu",
        "icon": "image/icon/icon_mmc006.jpg",
        "alt": "ねむちゃんのアイコン",
        "role": "人事部長",
    },
    "レイちゃん": {
        "speakerClass": "speaker-rei",
        "icon": "image/icon/icon_mmc007.jpg",
        "alt": "レイちゃんのアイコン",
        "role": "デザイン部",
    },
    "アキト": {
        "speakerClass": "speaker-akito",
        "icon": "image/icon/icon_mmc008.jpg",
        "alt": "アキトのアイコン",
        "role": "開発推進室",
    },
    "ケイ": {
        "speakerClass": "speaker-kei",
        "icon": "image/icon/icon_mmc009.jpg",
        "alt": "ケイのアイコン",
        "role": "広報部長",
    },
    "誠": {
        "speakerClass": "speaker-makoto",
        "icon": "image/icon/icon_mmc010.jpg",
        "alt": "誠のアイコン",
        "role": "AIリテラシー推進室 主任",
    },
    "誠さん": {
        "speakerClass": "speaker-makoto",
        "icon": "image/icon/icon_mmc010.jpg",
        "alt": "誠のアイコン",
        "role": "AIリテラシー推進室 主任",
    },
    "誠主任": {
        "speakerClass": "speaker-makoto",
        "icon": "image/icon/icon_mmc010.jpg",
        "alt": "誠のアイコン",
        "role": "AIリテラシー推進室 主任",
    },
    "コトちゃん": {
        "speakerClass": "speaker-koto",
        "icon": "image/icon/icon_mmc011.jpg",
        "alt": "コトちゃんのアイコン",
        "role": "編集主任",
    },
    "ペチ": {
        "speakerClass": "speaker-pechi",
        "icon": "image/icon/icon_cc001.jpg",
        "alt": "ペチのアイコン",
        "role": "社外協力者",
    },
    "所長": {
        "speakerClass": "speaker-director",
        "icon": "",
        "alt": "",
        "role": "毎日見る株式会社 所長",
    },
}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def apply_speaker_defaults(item: dict) -> None:
    defaults = SPEAKER_DEFAULTS.get(str(item.get("speaker", "")))
    if not defaults:
        return
    for key, value in defaults.items():
        item.setdefault(key, value)


def normalize_lounge_log(log: dict) -> None:
    for block in log.get("content", []):
        if block.get("type") != "talks":
            continue
        for item in block.get("items", []):
            apply_speaker_defaults(item)


def text_with_breaks(value: str) -> str:
    return "<br />".join(esc(part) for part in str(value).split("\n"))


def load_logs() -> list[dict]:
    logs = json.loads(LOUNGE_LOGS_PATH.read_text(encoding="utf-8"))
    if not isinstance(logs, list):
        raise ValueError("loungeLogs.json must be a list.")
    for log in logs:
        required = ["id", "date", "time", "weekday", "period", "title", "participants", "content"]
        missing = [key for key in required if key not in log]
        if missing:
            raise ValueError(f"Log is missing required keys {missing}: {log!r}")
        if not isinstance(log["participants"], list):
            raise ValueError(f"participants must be a list: {log['id']}")
        if not isinstance(log["content"], list):
            raise ValueError(f"content must be a list: {log['id']}")
        normalize_lounge_log(log)
    return sorted(logs, key=lambda item: (item["date"], item["time"]))


def load_calendar_topics() -> dict[str, dict[str, dict]]:
    if not LOUNGE_TOPICS_PATH.exists():
        return {}
    data = json.loads(LOUNGE_TOPICS_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("loungeCalendarTopics.json must be a list.")
    topics: dict[str, dict[str, dict]] = {}
    for day in data:
        if not isinstance(day, dict):
            continue
        date = day.get("date")
        slots = day.get("slots", [])
        if not isinstance(date, str) or not isinstance(slots, list):
            continue
        topics[date] = {}
        for slot in slots:
            if not isinstance(slot, dict):
                continue
            time = slot.get("time")
            if isinstance(time, str):
                topics[date][time] = slot
    return topics


def load_work_paths() -> list[str]:
    if not WORK_STORIES_PATH.exists():
        return []
    works = json.loads(WORK_STORIES_PATH.read_text(encoding="utf-8"))
    if not isinstance(works, list):
        return []
    paths: list[str] = []
    for work in works:
        slug = work.get("slug")
        if isinstance(slug, str) and slug:
            paths.append(f"works/{slug}")
    return paths


def load_gallery_paths() -> list[str]:
    gallery_path = ROOT / "src" / "data" / "galleryItems.json"
    if not gallery_path.exists():
        return []
    items = json.loads(gallery_path.read_text(encoding="utf-8"))
    if not isinstance(items, list):
        return []
    paths: list[str] = []
    for item in items:
        detail = item.get("detailUrl")
        if isinstance(detail, str) and detail.endswith(".html"):
            paths.append(detail.removesuffix(".html"))
    return paths


def load_ai_forensics_paths() -> list[str]:
    data_dir = ROOT / "src" / "data" / "ai-forensics"
    if not data_dir.exists():
        return []
    return [f"ai-forensics/{path.stem}" for path in sorted(data_dir.glob("*.json"))]


def date_parts(log: dict) -> tuple[int, int, int]:
    year, month, day = [int(part) for part in log["date"].split("-")]
    return year, month, day


def date_dot(log: dict) -> str:
    year, month, day = date_parts(log)
    return f"{year:04d}.{month:02d}.{day:02d}"


def date_jp(log: dict) -> str:
    year, month, day = date_parts(log)
    weekday = f"（{log['weekday']}）" if log.get("weekday") else ""
    return f"{year}年{month}月{day}日{weekday}{log['time']}"


def time_display(log: dict) -> str:
    weekday = WEEKDAY_EN.get(log.get("weekday"), "")
    suffix = f" {weekday}" if weekday else ""
    return f"{date_dot(log)}{suffix} {log['time']}"


def time_slot_class(log: dict) -> str:
    hour = str(log.get("time", "")).split(":", 1)[0].zfill(2)
    return TIME_SLOT_CLASSES.get(hour, "")


def compact_topic(value: object, fallback: str) -> str:
    text = str(value or fallback).replace(" ラウンジ観測記録", "").strip()
    if len(text) > 25:
        return text[:24] + "…"
    return text


def topic_html(topic: str) -> str:
    text = str(topic).strip()
    if text.startswith("**") and text.endswith("**") and len(text) > 4:
        return f"<strong>{esc(text[2:-2])}</strong>"
    return esc(text)


def calendar_slot(log: dict, topics_by_date: dict[str, dict[str, dict]]) -> tuple[str, str]:
    slot = topics_by_date.get(log["date"], {}).get(log["time"], {})
    topic = compact_topic(slot.get("topic"), log.get("title", ""))
    anchor = str(slot.get("anchor") or log["id"])
    return topic, anchor


def archive_href(log: dict, prefix: str = "") -> str:
    return f"{prefix}lounge-archive/{log['date']}.html#{log['id']}"


def archive_href_with_anchor(log: dict, anchor: str, prefix: str = "") -> str:
    return f"{prefix}lounge-archive/{log['date']}.html#{anchor}"


def archive_url(log: dict) -> str:
    return f"{BASE_URL}/lounge-archive/{log['date']}#{log['id']}"


def archive_day_href(date: str, prefix: str = "") -> str:
    return f"{prefix}lounge-archive/{date}.html"


def archive_day_url(date: str) -> str:
    return f"{BASE_URL}/lounge-archive/{date}"


def og_image_for_log(log: dict) -> str:
    period = log.get("period", "")
    if period == "朝":
        image = "image/lounge/lounge-morning001.jpg"
    elif period == "夕方":
        image = "image/lounge/lounge-evening001.jpg"
    elif period == "夜":
        image = "image/lounge/lounge-night001.jpg"
    elif period in {"深夜", "閉店前"}:
        image = "image/lounge/lounge-midnight001.jpg"
    else:
        image = "image/lounge/lounge-noon001.jpg"
    return f"{BASE_URL}/{image}"


def period_label(log: dict) -> str:
    return f"{log['period']}のラウンジ" if log.get("period") else "ラウンジ"


def participants_text(log: dict) -> str:
    return "、".join(log.get("participants", []))


def render_scene(paragraphs: list[str], signature: str | None = None) -> str:
    lines = ['        <div class="lounge-log-scene">']
    for paragraph in paragraphs:
        lines.append(f"          <p>{text_with_breaks(paragraph)}</p>")
    if signature:
        lines.append(f'          <p class="lounge-log-signature">{text_with_breaks(signature)}</p>')
    lines.append("        </div>")
    return "\n".join(lines)


def render_talks(block: dict, prefix: str) -> str:
    aria = esc(block.get("ariaLabel", "ラウンジ会話"))
    lines = [f'        <section class="lounge-talk lounge-log-flow" aria-label="{aria}">']
    for item in block.get("items", []):
        speaker_class = esc(item.get("speakerClass", ""))
        icon = esc(prefix + item.get("icon", ""))
        alt = esc(item.get("alt", ""))
        lines.append(f'          <article class="talk-bubble {speaker_class}">')
        if item.get("icon"):
            lines.append(f'            <img src="{icon}" alt="{alt}" />')
        lines.extend(
            [
                "            <div>",
                f'              <p class="talk-name">{esc(item.get("speaker", ""))}</p>',
                f'              <p class="talk-role">{esc(item.get("role", ""))}</p>',
            ]
        )
        for line in item.get("lines", []):
            line_type = line.get("type")
            text = text_with_breaks(line.get("text", ""))
            if line_type == "note":
                lines.append(f'              <p class="talk-note">{text}</p>')
            elif line_type == "strongNote":
                lines.append(f'              <p class="talk-note talk-note-strong">{text}</p>')
            else:
                lines.append(f'              <p class="talk-text">{text}</p>')
        lines.extend(["            </div>", "          </article>"])
    lines.append("        </section>")
    return "\n".join(lines)


def render_quote(block: dict) -> str:
    return "\n".join(
        [
            '        <blockquote class="lounge-quote">',
            f'          <p>{text_with_breaks(block.get("text", ""))}</p>',
            f'          <cite>{esc(block.get("cite", ""))}</cite>',
            "        </blockquote>",
        ]
    )


def render_image(block: dict, prefix: str) -> str:
    src = str(block.get("src", ""))
    if src.startswith(("http://", "https://", "/", "../")):
        image_src = src
    else:
        image_src = prefix + src
    caption = block.get("caption", "")
    lines = [
        '        <figure class="lounge-log-image">',
        f'          <img src="{esc(image_src)}" alt="{esc(block.get("alt", ""))}" loading="lazy" decoding="async" />',
    ]
    if caption:
        lines.append(f"          <figcaption>{text_with_breaks(caption)}</figcaption>")
    lines.append("        </figure>")
    return "\n".join(lines)


def render_daily_words(block: dict) -> str:
    lines = [
        '        <div class="lounge-daily-words">',
        f'          <h3>{esc(block.get("title", "今日の一言"))}</h3>',
    ]
    for item in block.get("items", []):
        lines.extend(
            [
                "          <article>",
                f'            <strong>{esc(item.get("speaker", ""))}</strong>',
                f'            <p>{text_with_breaks(item.get("text", ""))}</p>',
                "          </article>",
            ]
        )
    lines.append("        </div>")
    return "\n".join(lines)


def render_content(log: dict, prefix: str) -> str:
    rendered: list[str] = []
    blocks = log.get("content", [])
    index = 0
    while index < len(blocks):
        block = blocks[index]
        block_type = block.get("type")
        if block_type == "scene":
            signature = None
            if index + 1 < len(blocks) and blocks[index + 1].get("type") == "signature":
                signature = blocks[index + 1].get("text", "")
                index += 1
            rendered.append(render_scene(block.get("paragraphs", []), signature))
        elif block_type == "talks":
            rendered.append(render_talks(block, prefix))
        elif block_type == "quote":
            rendered.append(render_quote(block))
        elif block_type == "image":
            rendered.append(render_image(block, prefix))
        elif block_type == "dailyWords":
            pass
        elif block_type == "signature":
            rendered.append(render_scene([], block.get("text", "")))
        index += 1
    return "\n\n".join(rendered)


def render_log_article(log: dict, prefix: str, latest: bool = False, daily: bool = False) -> str:
    heading_tag = "h2" if latest or daily else "h1"
    kicker = "Latest Log" if latest else "Archive Log"
    title_id = ' id="today-lounge-title"' if latest else ""
    section_tag = "section" if latest else "article"
    aria = ' aria-labelledby="today-lounge-title"' if latest else ""
    label = "最新のラウンジ会話" if latest else "ラウンジ会話"
    content_log = json.loads(json.dumps(log))
    for block in content_log.get("content", []):
        if block.get("type") == "talks":
            block["ariaLabel"] = label
    article_id = f' id="{esc(log["id"])}"' if not latest else ""
    slot = time_slot_class(log)
    slot_class = f" {slot}" if daily and slot else ""
    lines = [
        f'      <{section_tag}{article_id} class="lounge-today lounge-log{slot_class}"{aria}>',
        '        <div class="lounge-post-header">',
        "          <div>",
        f'            <p class="section-kicker">{kicker}</p>',
        f"            <{heading_tag}{title_id}>{esc(log['title'])}</{heading_tag}>",
        "          </div>",
        f'          <time datetime="{esc(log["date"])}T{esc(log["time"])}">{esc(time_display(log))}</time>',
        "        </div>",
        "",
        '        <div class="lounge-log-meta">',
        f"          <span>{esc(date_jp(log))}</span>",
        f"          <span>{esc(period_label(log))}</span>",
        f"          <span>参加：{esc(participants_text(log))}</span>",
        "        </div>",
        "",
        render_content(content_log, prefix),
        "",
    ]
    if latest:
        lines.append(f'        <a class="lounge-log-link" href="{esc(archive_href(log))}">この会話を個別ページで読む</a>')
    elif daily:
        lines.append(f'        <a class="lounge-log-link" href="#top">この日の先頭へ戻る</a>')
    else:
        lines.append('        <a class="lounge-log-link" href="../lounge.html">ラウンジトップに戻る</a>')
    lines.append(f"      </{section_tag}>")
    return "\n".join(lines)


def render_archive_page(date: str, logs: list[dict]) -> str:
    first_log = logs[0]
    latest_log = logs[-1]
    year, month, day = date_parts(first_log)
    date_label = f"{year}年{month}月{day}日（{first_log.get('weekday', '')}）"
    time_list = "、".join(log["time"] for log in logs)
    page_title = f"{date_label}｜ラウンジ観測記録アーカイブ｜毎日見る株式会社"
    description = f"{date_label}のAI社員ラウンジ観測記録。{time_list}の会話を1日分のアーカイブとしてまとめています。"
    log_nav = "\n".join(
        [
            f'          <a class="{esc(time_slot_class(log))}" href="#{esc(log["id"])}"><span>{esc(log["time"])}</span>{esc(log["title"].replace(" ラウンジ観測記録", ""))}</a>'
            for log in logs
        ]
    )
    log_articles = "\n\n".join(render_log_article(log, "../", daily=True) for log in logs)
    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(page_title)}</title>
    <meta
      name="description"
      content="{esc(description)}"
    />
    <meta property="og:title" content="{esc(page_title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="{esc(archive_day_url(date))}" />
    <meta property="og:image" content="{esc(og_image_for_log(latest_log))}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="../favicon.ico" />
    <link rel="stylesheet" href="../styles.css" />
  </head>
  <body id="top" class="subpage lounge-page lounge-log-page">
    <header class="site-header" aria-label="サイトヘッダー">
      <a class="brand" href="../index.html" aria-label="毎日見る株式会社 ホーム">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="brand-text"><strong>毎日見る<br />株式会社</strong><small>Mainichi Miru Inc.</small></span>
      </a>
      <nav class="global-nav" aria-label="グローバルナビゲーション">
        <a href="../index.html">ホーム</a>
        <a href="../about.html">会社概要</a>
        <a href="../members.html">AI社員紹介</a>
        <a href="../works.html">制作物</a>
        <a href="../lounge.html" aria-current="page">ラウンジ</a>
        <a href="../news.html">ニュース</a>
      </nav>
      <a class="contact-button" href="../contact.html">お問い合わせ</a>
    </header>

    <main class="page-main lounge-log-main">
      <nav class="profile-breadcrumb" aria-label="パンくずリスト">
        <a href="../index.html">ホーム</a>
        <span>ラウンジ</span>
        <strong>{esc(date_label)}</strong>
        <a class="profile-back" href="../lounge.html">ラウンジに戻る</a>
      </nav>

      <section class="lounge-day-archive" aria-labelledby="lounge-day-title">
        <div class="lounge-post-header">
          <div>
            <p class="section-kicker">Daily Archive</p>
            <h1 id="lounge-day-title">{esc(date_label)}のラウンジ</h1>
          </div>
          <span>{len(logs)}件の観測記録</span>
        </div>
        <p class="lounge-day-archive__lead">このページでは、{esc(time_list)}のラウンジ観測記録を1日分としてまとめています。</p>
        <nav class="lounge-day-nav" aria-label="この日の時間別ログ">
{log_nav}
        </nav>
      </section>

{log_articles}
    </main>

    <footer class="site-footer">
      <div class="site-footer-inner">
        <div class="site-footer-brand">
          <strong>毎日見る<br />株式会社</strong>
          <p>AIが働き、人間が考え、創造する。</p>
        </div>
        <nav class="site-footer-nav" aria-label="フッターナビゲーション">
          <a href="../index.html">ホーム</a>
          <a href="../about.html">会社概要</a>
          <a href="../members.html">AI社員紹介</a>
          <a href="../works.html">制作物</a>
          <a href="../lounge.html">ラウンジ</a>
          <a href="../news.html">ニュース</a>
          <a href="../contact.html">お問い合わせ</a>
        </nav>
      </div>
      <p class="site-footer-copy">© 毎日見る株式会社 Since 2026</p>
    </footer>
  </body>
</html>
"""


def next_month(year: int, month: int) -> tuple[int, int]:
    if month == 12:
        return year + 1, 1
    return year, month + 1


def render_calendar_month(
    year: int,
    month: int,
    by_date: dict[str, list[dict]],
    topics_by_date: dict[str, dict[str, dict]],
    latest_date: str,
    active: bool,
) -> list[str]:
    _, days_in_month = calendar.monthrange(year, month)
    blanks = (calendar.weekday(year, month, 1) + 1) % 7
    month_key = f"{year:04d}-{month:02d}"
    hidden = "" if active else " hidden"
    lines = [
        f'            <div class="lounge-calendar__month" data-calendar-month="{month_key}"{hidden}>',
        '              <div class="lounge-calendar__grid">',
        '                <span class="lounge-calendar__dow">日</span>',
        '                <span class="lounge-calendar__dow">月</span>',
        '                <span class="lounge-calendar__dow">火</span>',
        '                <span class="lounge-calendar__dow">水</span>',
        '                <span class="lounge-calendar__dow">木</span>',
        '                <span class="lounge-calendar__dow">金</span>',
        '                <span class="lounge-calendar__dow">土</span>',
        "",
    ]
    for _ in range(blanks):
        lines.append('                <span class="lounge-calendar__blank" aria-hidden="true"></span>')

    month_has_logs = False
    for day in range(1, days_in_month + 1):
        date = f"{year:04d}-{month:02d}-{day:02d}"
        items = by_date.get(date, [])
        if items:
            month_has_logs = True
            latest_class = " is-latest" if date == latest_date else ""
            lines.append(f'                <div class="lounge-calendar__day is-active{latest_class}">')
            lines.append(f'                  <span class="lounge-calendar__date">{day}</span>')
            lines.append(f'                  <span class="lounge-calendar__count">{len(items)}件</span>')
            for item in items:
                topic, anchor = calendar_slot(item, topics_by_date)
                lines.extend(
                    [
                        f'                  <a class="lounge-calendar__slot {esc(time_slot_class(item))}" href="{esc(archive_href_with_anchor(item, anchor))}" title="{esc(topic)}">',
                        f'                    <span class="lounge-calendar__slot-time">{esc(item["time"])}</span>',
                        f'                    <span class="lounge-calendar__slot-topic">{topic_html(topic)}</span>',
                        "                  </a>",
                    ]
                )
            lines.append("                </div>")
        else:
            lines.append(f'                <span class="lounge-calendar__day">{day}</span>')

    lines.append("              </div>")
    if not month_has_logs:
        lines.append('              <p class="lounge-calendar__empty">この月の記録は、これから追加されます。</p>')
    lines.append("            </div>")
    return lines


def render_calendar(logs: list[dict]) -> str:
    latest = logs[-1]
    latest_year, latest_month, _ = date_parts(latest)
    topics_by_date = load_calendar_topics()
    by_date: dict[str, list[dict]] = defaultdict(list)
    for log in logs:
        by_date[log["date"]].append(log)
    for items in by_date.values():
        items.sort(key=lambda item: item["time"])

    months = sorted({
        (date_parts(log)[0], date_parts(log)[1])
        for log in logs
    })
    preview_month = next_month(latest_year, latest_month)
    if preview_month not in months:
        months.append(preview_month)
    selected_month = (latest_year, latest_month)
    selected_key = f"{latest_year:04d}-{latest_month:02d}"

    lines = [
        '      <section class="lounge-archive" aria-labelledby="archive-title">',
        '        <div class="section-heading">',
        "          <div>",
        '            <p class="section-kicker">Archive</p>',
        '            <h2 id="archive-title">ラウンジカレンダー</h2>',
        "            <p>1日最大5回の更新を、日付と時間でたどれるアーカイブです。</p>",
        "          </div>",
        "        </div>",
        "",
        '        <div class="lounge-archive-layout">',
        '          <section class="lounge-archive-list" aria-label="最新アーカイブ一覧">',
        "            <h3>最新アーカイブ</h3>",
        '            <div class="lounge-archive-list__grid">',
    ]
    for item in reversed(logs[-6:]):
        topic, anchor = calendar_slot(item, topics_by_date)
        lines.extend(
            [
                f'              <a class="lounge-archive-entry {esc(time_slot_class(item))}" href="{esc(archive_href_with_anchor(item, anchor))}">',
                f'                <time datetime="{esc(item["date"])}T{esc(item["time"])}">{esc(date_dot(item))} {esc(item["time"])}</time>',
                f"                <span>{topic_html(topic)}</span>",
                f"                <small>{esc(participants_text(item))}</small>",
                "              </a>",
            ]
        )
    lines.extend(
        [
            "            </div>",
            '            <p class="lounge-archive-help">',
            "              最新6件を上に並べています。気になるカードを選ぶと、その時間帯の会話へ移動します。",
            "            </p>",
            "          </section>",
            "",
        f'          <article class="lounge-calendar" data-lounge-calendar aria-label="{latest_year}年{latest_month}月のラウンジ更新カレンダー">',
        '            <div class="lounge-calendar__header">',
        '              <button class="lounge-calendar__nav" type="button" data-calendar-prev aria-label="前の月を表示" title="前の月" disabled><span aria-hidden="true">‹</span></button>',
        '              <div class="lounge-calendar__month-title">',
        '                <span>表示中の月</span>',
        f"                <h3 data-calendar-title>{latest_year}年{latest_month}月</h3>",
        "              </div>",
        '              <button class="lounge-calendar__nav" type="button" data-calendar-next aria-label="次の月を表示" title="次の月"><span aria-hidden="true">›</span></button>',
        "            </div>",
        '            <label class="lounge-calendar__picker">',
        '              <span>月を選ぶ</span>',
        '              <select data-calendar-select aria-label="表示する月">',
    ]
    )
    for year, month in months:
        month_key = f"{year:04d}-{month:02d}"
        selected = " selected" if month_key == selected_key else ""
        lines.append(f'                <option value="{month_key}"{selected}>{year}年{month}月</option>')
    lines.extend(
        [
            "              </select>",
            "            </label>",
        ]
    )
    for year, month in months:
        lines.extend(
            render_calendar_month(
                year,
                month,
                by_date,
                topics_by_date,
                latest["date"],
                (year, month) == selected_month,
            )
        )
    lines.extend(
        [
            "          </article>",
            '          <p class="lounge-archive-help lounge-calendar-help">',
            "            カレンダーは月を切り替えられます。各日付の時間帯には、その時に話したテーマを表示しています。",
            "          </p>",
            "        </div>",
            "      </section>",
        ]
    )
    return "\n".join(lines)


def update_lounge_html(logs: list[dict]) -> None:
    html_text = LOUNGE_HTML_PATH.read_text(encoding="utf-8")
    latest_start = html_text.index('      <section class="lounge-today lounge-log"')
    archive_start = html_text.index('      <section class="lounge-archive"', latest_start)
    dictionary_start = html_text.index(
        '      <section class="lounge-dictionary-promo"', archive_start
    )
    latest_html = render_log_article(logs[-1], "", latest=True)
    archive_html = render_calendar(logs)
    html_text = (
        html_text[:latest_start]
        + latest_html
        + "\n\n"
        + archive_html
        + "\n\n"
        + html_text[dictionary_start:]
    )
    LOUNGE_HTML_PATH.write_text(html_text, encoding="utf-8")


def render_today_words(log: dict) -> str:
    today_words = log.get("todayWords", [])
    if not today_words:
        return ""
    lines = ['        <div class="today-words-grid">']
    for item in today_words:
        lines.extend(
            [
                "          <article>",
                f"            <span>{esc(item.get('speaker', ''))}</span>",
                f"            <p>{text_with_breaks(item.get('text', ''))}</p>",
                "          </article>",
            ]
        )
    lines.extend(
        [
            "        </div>",
            f'        <a class="today-words-link" href="{esc(archive_href(log))}">朝のラウンジ観測記録を読む</a>',
        ]
    )
    return "\n".join(lines)


def first_speaker(log: dict) -> dict | None:
    for block in log.get("content", []):
        if block.get("type") != "talks":
            continue
        for item in block.get("items", []):
            if item.get("speaker"):
                return item
    return None


def latest_topic_text(log: dict) -> str:
    description = str(log.get("description", ""))
    if "が、" in description and "について話します" in description:
        topic = description.split("が、", 1)[1].split("について話します", 1)[0]
        return f"{topic}について相談中。"
    return "制作物、ニュース、ゲーム開発、ちょっとした思いつきまで。"


def render_lounge_board(log: dict | None) -> str:
    fallback = [
        '        <aside class="lounge-board" id="lounge" aria-label="今日のラウンジ">',
        '          <p class="lounge-board__label">Today at Bean &amp; Bits</p>',
        "          <h2>今日のラウンジ</h2>",
        '          <p class="lounge-board__lead">AI社員たちは、今日も雑談中。</p>',
        '          <p class="lounge-board__summary">制作物、ニュース、ゲーム開発、ちょっとした思いつきまで。</p>',
        '          <p class="lounge-board__note">毎日の会話から、次の企画が生まれています。</p>',
        '          <a class="lounge-board__button" href="lounge.html">社内ラウンジを覗く</a>',
        "        </aside>",
    ]
    if not log:
        return "\n".join(fallback)

    speaker = first_speaker(log)
    if not speaker:
        return "\n".join(fallback)

    lines = [
        '        <aside class="lounge-board" id="lounge" aria-label="今日のラウンジ">',
        '          <p class="lounge-board__label">Today at Bean &amp; Bits</p>',
        "          <h2>今日のラウンジ</h2>",
        '          <p class="lounge-board__lead">AI社員たちは、今日も雑談中。</p>',
        '          <div class="lounge-board__latest">',
        f'            <time datetime="{esc(log["date"])}T{esc(log["time"])}">{esc(date_dot(log))} {esc(WEEKDAY_EN.get(log.get("weekday", ""), ""))} {esc(log["time"])}</time>',
        '            <div class="lounge-board__speaker">',
        f'              <img src="{esc(speaker.get("icon", "image/icon/icon_mmc001.jpg"))}" alt="{esc(speaker.get("alt", speaker.get("speaker", "")))}" />',
        "              <div>",
        f'                <strong>{esc(speaker.get("speaker", ""))}</strong>',
        f'                <span>{esc(speaker.get("role", "AI社員"))}</span>',
        "              </div>",
        "            </div>",
        f'            <p>{esc(latest_topic_text(log))}</p>',
        "          </div>",
        '          <p class="lounge-board__note">毎日の会話から、次の企画が生まれています。</p>',
        '          <a class="lounge-board__button" href="lounge.html">社内ラウンジを覗く</a>',
        "        </aside>",
    ]
    return "\n".join(lines)


def update_index_html(logs: list[dict]) -> None:
    today_log = next((log for log in reversed(logs) if log.get("todayWords")), None)
    latest_log = logs[-1] if logs else None

    html_text = INDEX_HTML_PATH.read_text(encoding="utf-8")
    board_start = html_text.index('        <aside class="lounge-board"')
    board_end = html_text.index("        </aside>", board_start) + len("        </aside>")
    html_text = html_text[:board_start] + render_lounge_board(latest_log) + html_text[board_end:]
    if today_log:
        section_start = html_text.index('      <section id="today-words"')
        grid_start = html_text.index('        <div class="today-words-grid">', section_start)
        section_end = html_text.index("      </section>", grid_start)
        replacement = render_today_words(today_log)
        html_text = html_text[:grid_start] + replacement + "\n" + html_text[section_end:]
    INDEX_HTML_PATH.write_text(html_text, encoding="utf-8")


def update_sitemap(logs: list[dict]) -> None:
    urls = []
    for path in STATIC_SITEMAP_PATHS:
        suffix = f"/{path}" if path else "/"
        urls.append(f"{BASE_URL}{suffix}")
    urls.extend(f"{BASE_URL}/{path}" for path in load_work_paths())
    urls.extend(f"{BASE_URL}/{path}" for path in load_gallery_paths())
    urls.extend(f"{BASE_URL}/{path}" for path in load_ai_forensics_paths())
    archive_dates = sorted({log["date"] for log in logs})
    urls.extend(f"{BASE_URL}/lounge-archive/{date}" for date in archive_dates)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines.extend(f"  <url><loc>{esc(url)}</loc></url>" for url in urls)
    lines.append("</urlset>")
    SITEMAP_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    logs = load_logs()
    ARCHIVE_DIR.mkdir(exist_ok=True)
    for path in ARCHIVE_DIR.glob("*.html"):
        path.unlink()
    logs_by_date: dict[str, list[dict]] = defaultdict(list)
    for log in logs:
        logs_by_date[log["date"]].append(log)
    for items in logs_by_date.values():
        items.sort(key=lambda item: item["time"])
    archive_paths = []
    for date, date_logs in sorted(logs_by_date.items()):
        archive_path = ARCHIVE_DIR / f"{date}.html"
        archive_path.write_text(render_archive_page(date, date_logs), encoding="utf-8")
        archive_paths.append(archive_path)
    update_lounge_html(logs)
    update_index_html(logs)
    update_sitemap(logs)
    for path in [LOUNGE_HTML_PATH, INDEX_HTML_PATH, *archive_paths]:
        apply_layout_to_file(path)
    print(f"Generated {len(archive_paths)} daily lounge archive pages from {len(logs)} logs, lounge.html, index.html, and sitemap.")


if __name__ == "__main__":
    main()
