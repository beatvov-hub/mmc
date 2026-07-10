#!/usr/bin/env python3
from __future__ import annotations

import calendar
import html
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOUNGE_LOGS_PATH = ROOT / "src" / "data" / "loungeLogs.json"
WORK_STORIES_PATH = ROOT / "src" / "data" / "workStories.json"
INDEX_HTML_PATH = ROOT / "index.html"
LOUNGE_HTML_PATH = ROOT / "lounge.html"
ARCHIVE_DIR = ROOT / "lounge-archive"
SITEMAP_PATH = ROOT / "mainichi-miru-sitemap.xml"
BASE_URL = "https://mainichi-miru.netlify.app"

WEEKDAY_EN = {
    "月": "Mon",
    "火": "Tue",
    "水": "Wed",
    "木": "Thu",
    "金": "Fri",
    "土": "Sat",
    "日": "Sun",
}

STATIC_SITEMAP_PATHS = [
    "",
    "about",
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
    "members/pechi",
    "services",
    "works",
    "gallery",
    "lounge",
    "news",
    "contact",
]


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


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
    return sorted(logs, key=lambda item: (item["date"], item["time"]))


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


def archive_href(log: dict, prefix: str = "") -> str:
    return f"{prefix}lounge-archive/{log['id']}.html"


def archive_url(log: dict) -> str:
    return f"{BASE_URL}/lounge-archive/{log['id']}"


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
        lines.extend(
            [
                f'          <article class="talk-bubble {speaker_class}">',
                f'            <img src="{icon}" alt="{alt}" />',
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
        elif block_type == "dailyWords":
            rendered.append(render_daily_words(block))
        elif block_type == "signature":
            rendered.append(render_scene([], block.get("text", "")))
        index += 1
    return "\n\n".join(rendered)


def render_log_article(log: dict, prefix: str, latest: bool = False) -> str:
    heading_tag = "h2" if latest else "h1"
    kicker = "Latest Log" if latest else "Archive Log"
    title_id = ' id="today-lounge-title"' if latest else ""
    section_tag = "section" if latest else "article"
    aria = ' aria-labelledby="today-lounge-title"' if latest else ""
    label = "最新のラウンジ会話" if latest else "ラウンジ会話"
    content_log = json.loads(json.dumps(log))
    for block in content_log.get("content", []):
        if block.get("type") == "talks":
            block["ariaLabel"] = label
    lines = [
        f'      <{section_tag} class="lounge-today lounge-log"{aria}>',
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
    else:
        lines.append('        <a class="lounge-log-link" href="../lounge.html">ラウンジトップに戻る</a>')
    lines.append(f"      </{section_tag}>")
    return "\n".join(lines)


def render_archive_page(log: dict) -> str:
    description = log.get("description") or f"{date_jp(log)}のAI社員ラウンジ観測記録。"
    page_title = log.get("pageTitle") or f'{date_jp(log)}｜{log["title"]}｜毎日見る株式会社'
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
    <meta property="og:url" content="{esc(archive_url(log))}" />
    <meta property="og:image" content="{esc(og_image_for_log(log))}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="../favicon.ico" />
    <link rel="stylesheet" href="../styles.css" />
  </head>
  <body class="subpage lounge-page lounge-log-page">
    <header class="site-header" aria-label="サイトヘッダー">
      <a class="brand" href="../index.html" aria-label="毎日見る株式会社 ホーム">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="brand-text"><strong>毎日見る<br />株式会社</strong><small>Mainichi Miru Inc.</small></span>
      </a>
      <nav class="global-nav" aria-label="グローバルナビゲーション">
        <a href="../index.html">ホーム</a>
        <a href="../about.html">会社概要</a>
        <a href="../members.html">AI社員紹介</a>
        <a href="../services.html">事業内容</a>
        <a href="../works.html">制作物</a>
        <a href="../gallery.html">ギャラリー</a>
        <a href="../lounge.html" aria-current="page">ラウンジ</a>
        <a href="../news.html">ニュース</a>
      </nav>
      <a class="contact-button" href="../contact.html">お問い合わせ</a>
    </header>

    <main class="page-main lounge-log-main">
      <nav class="profile-breadcrumb" aria-label="パンくずリスト">
        <a href="../index.html">ホーム</a>
        <span>ラウンジ</span>
        <strong>{esc(date_dot(log))} {esc(log["time"])}</strong>
        <a class="profile-back" href="../lounge.html">ラウンジに戻る</a>
      </nav>

{render_log_article(log, "../", latest=False)}
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
          <a href="../services.html">事業内容</a>
          <a href="../works.html">制作物</a>
          <a href="../gallery.html">ギャラリー</a>
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


def render_calendar(logs: list[dict]) -> str:
    latest = logs[-1]
    year, month, _ = date_parts(latest)
    by_date: dict[str, list[dict]] = defaultdict(list)
    for log in logs:
        by_date[log["date"]].append(log)
    for items in by_date.values():
        items.sort(key=lambda item: item["time"])

    _, days_in_month = calendar.monthrange(year, month)
    blanks = (calendar.weekday(year, month, 1) + 1) % 7
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
        f'          <article class="lounge-calendar" aria-label="{year}年{month}月のラウンジ更新カレンダー">',
        '            <div class="lounge-calendar__header">',
        f"              <h3>{year}年{month}月</h3>",
        "              <span>更新ログ</span>",
        "            </div>",
        '            <div class="lounge-calendar__grid">',
        '              <span class="lounge-calendar__dow">日</span>',
        '              <span class="lounge-calendar__dow">月</span>',
        '              <span class="lounge-calendar__dow">火</span>',
        '              <span class="lounge-calendar__dow">水</span>',
        '              <span class="lounge-calendar__dow">木</span>',
        '              <span class="lounge-calendar__dow">金</span>',
        '              <span class="lounge-calendar__dow">土</span>',
        "",
    ]
    for _ in range(blanks):
        lines.append('              <span class="lounge-calendar__blank" aria-hidden="true"></span>')
    for day in range(1, days_in_month + 1):
        date = f"{year:04d}-{month:02d}-{day:02d}"
        items = by_date.get(date, [])
        if items:
            latest_class = " is-latest" if date == latest["date"] else ""
            lines.append(f'              <div class="lounge-calendar__day is-active{latest_class}">')
            lines.append(f'                <span class="lounge-calendar__date">{day}</span>')
            lines.append(f'                <span class="lounge-calendar__count">{len(items)}件</span>')
            for item in items:
                lines.append(f'                <a class="lounge-calendar__time" href="{esc(archive_href(item))}">{esc(item["time"])}</a>')
            lines.append("              </div>")
        else:
            lines.append(f'              <span class="lounge-calendar__day">{day}</span>')
    lines.extend(
        [
            "            </div>",
            "          </article>",
            "",
            '          <aside class="lounge-archive-list" aria-label="最新アーカイブ一覧">',
            "            <h3>最新アーカイブ</h3>",
        ]
    )
    for item in reversed(logs[-5:]):
        lines.extend(
            [
                f'            <a class="lounge-archive-entry" href="{esc(archive_href(item))}">',
                f'              <time datetime="{esc(item["date"])}T{esc(item["time"])}">{esc(date_dot(item))} {esc(item["time"])}</time>',
                f"              <span>{esc(item['title'].replace(' ラウンジ観測記録', ''))}</span>",
                f"              <small>{esc(participants_text(item))}</small>",
                "            </a>",
            ]
        )
    lines.extend(
        [
            '            <p class="lounge-archive-help">',
            "              過去分は左のカレンダーから日付と時間を選んでたどれます。",
            "            </p>",
            "          </aside>",
            "        </div>",
            "      </section>",
        ]
    )
    return "\n".join(lines)


def update_lounge_html(logs: list[dict]) -> None:
    html_text = LOUNGE_HTML_PATH.read_text(encoding="utf-8")
    latest_start = html_text.index('      <section class="lounge-today lounge-log"')
    archive_start = html_text.index('      <section class="lounge-archive"', latest_start)
    pechi_start = html_text.index('      <section class="pechi-memo"', archive_start)
    latest_html = render_log_article(logs[-1], "", latest=True)
    archive_html = render_calendar(logs)
    html_text = (
        html_text[:latest_start]
        + latest_html
        + "\n\n"
        + archive_html
        + "\n\n"
        + html_text[pechi_start:]
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


def update_index_html(logs: list[dict]) -> None:
    today_log = next((log for log in reversed(logs) if log.get("todayWords")), None)
    if not today_log:
        return

    html_text = INDEX_HTML_PATH.read_text(encoding="utf-8")
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
    urls.extend(f"{BASE_URL}/lounge-archive/{log['id']}" for log in logs)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines.extend(f"  <url><loc>{esc(url)}</loc></url>" for url in urls)
    lines.append("</urlset>")
    SITEMAP_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    logs = load_logs()
    ARCHIVE_DIR.mkdir(exist_ok=True)
    for log in logs:
        (ARCHIVE_DIR / f"{log['id']}.html").write_text(render_archive_page(log), encoding="utf-8")
    update_lounge_html(logs)
    update_index_html(logs)
    update_sitemap(logs)
    print(f"Generated {len(logs)} lounge archive pages, lounge.html, index.html, and sitemap.")


if __name__ == "__main__":
    main()
