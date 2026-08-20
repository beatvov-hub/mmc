#!/usr/bin/env python3
from __future__ import annotations

import html
import json
from pathlib import Path

from site_layout import FOOTER_END, FOOTER_START, apply_layout_to_file, marked_block, render_footer

ROOT = Path(__file__).resolve().parents[1]
NEWS_DATA_PATH = ROOT / "src" / "data" / "newsItems.json"
INDEX_HTML_PATH = ROOT / "index.html"
NEWS_HTML_PATH = ROOT / "news.html"
ABOUT_HTML_PATH = ROOT / "about.html"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def date_dot(date: str) -> str:
    year, month, day = date.split("-")
    return f"{year}.{month}.{day}"


def date_jp(date: str) -> str:
    year, month, day = date.split("-")
    return f"{year}年{int(month)}月{int(day)}日"


def load_news() -> dict:
    data = json.loads(NEWS_DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("newsItems.json must be an object.")
    if not isinstance(data.get("items"), list):
        raise ValueError("newsItems.json must include an items list.")
    return data


def sort_key(item: dict) -> tuple[str, int]:
    return (item.get("date", ""), int(item.get("priority", 0)))


def sorted_items(data: dict) -> list[dict]:
    return sorted(data["items"], key=sort_key, reverse=True)


def timeline_sorted_items(data: dict) -> list[dict]:
    return sorted(timeline_items(data), key=lambda item: (item.get("date", ""), -int(item.get("priority", 0))))


def timeline_items(data: dict) -> list[dict]:
    return [item for item in sorted_items(data) if item.get("timelineVisible", True)]


def top_items(data: dict) -> list[dict]:
    return [item for item in sorted_items(data) if item.get("topVisible", True)]


def item_href(item: dict) -> str:
    if item.get("url"):
        return item["url"]
    related = item.get("relatedPage", "")
    if related and not related.endswith(".xml"):
        return related
    return "news.html"


def render_item_link(item: dict) -> str:
    label = item.get("linkLabel")
    if not label:
        return ""
    return f'<a class="text-link" href="{esc(item_href(item))}">{esc(label)}</a>'


def render_bullet(bullet: object) -> str:
    if isinstance(bullet, dict):
        text = esc(bullet.get("text", ""))
        href = bullet.get("href", "")
        label = bullet.get("linkLabel", "")
        if href and label:
            return f'{text}<a class="text-link" href="{esc(href)}">{esc(label)}</a>'
        return text
    return esc(bullet)


def render_tag(item: dict) -> str:
    tag = item.get("tag")
    if not tag:
        return ""
    return f'<span class="tag">{esc(tag)}</span>'


def render_index_news(data: dict) -> str:
    lines = [
        '        <div class="news-list">',
    ]
    for item in top_items(data)[:4]:
        title = item.get("topTitle") or item.get("title", "")
        summary = item.get("topSummary") or item.get("summary", "")
        related_link = render_item_link(item)
        lines.extend(
            [
                "          <article>",
                '            <div class="news-list-meta">',
                f'              <time datetime="{esc(item["date"])}">{esc(date_dot(item["date"]))}</time>{render_tag(item)}',
                "            </div>",
                f'            <a href="{esc(item_href(item))}">{esc(title)}</a>',
                f"            <p>{esc(summary)}</p>",
            ]
        )
        if related_link:
            lines.append(f"            {related_link}")
        lines.append("          </article>")
    lines.append("        </div>")
    return "\n".join(lines)


def update_index_html(data: dict) -> None:
    html_text = INDEX_HTML_PATH.read_text(encoding="utf-8")
    section_start = html_text.index('      <section id="news"')
    list_start = html_text.index('        <div class="news-list">', section_start)
    section_end = html_text.index("      </section>", list_start)
    html_text = html_text[:list_start] + render_index_news(data) + "\n" + html_text[section_end:]
    INDEX_HTML_PATH.write_text(html_text, encoding="utf-8")


def render_current(data: dict) -> str:
    latest = timeline_items(data)[0]
    return "\n".join(
        [
            '        <aside class="page-note news-current">',
            '          <span class="news-current-label">最新更新</span>',
            f'          <time datetime="{esc(latest["date"])}">{esc(date_dot(latest["date"]))}</time>',
            f'          <strong>{esc(latest.get("title", ""))}</strong>',
            f'          <p>{esc(latest.get("summary", ""))}</p>',
            "        </aside>",
        ]
    )


def render_dashboard(data: dict) -> str:
    lines = ['      <section class="news-dashboard" aria-label="更新サマリー">']
    for item in data.get("dashboard", []):
        lines.extend(
            [
                "        <article>",
                f'          <span>{esc(item.get("label", ""))}</span>',
                f'          <strong>{esc(item.get("value", ""))}</strong>',
                f'          <p>{esc(item.get("body", ""))}</p>',
                "        </article>",
            ]
        )
    lines.append("      </section>")
    return "\n".join(lines)


def render_daily_update(data: dict) -> str:
    today = data.get("today", {})
    lines = [
        '      <section class="daily-update-card" aria-labelledby="daily-update-title">',
        "        <div>",
        f'          <p class="section-kicker">{esc(today.get("kicker", "Today"))}</p>',
        f'          <h2 id="daily-update-title">{esc(today.get("title", "今日の更新"))}</h2>',
        f'          <p>{esc(today.get("body", ""))}</p>',
        "        </div>",
        '        <ul class="daily-update-list">',
    ]
    for item in today.get("items", []):
        lines.append(f'          <li><span>{esc(item.get("label", ""))}</span>{esc(item.get("text", ""))}</li>')
    lines.extend(["        </ul>", "      </section>"])
    return "\n".join(lines)


def render_news_items(data: dict) -> str:
    items = sorted_items(data)
    lines = [
        '      <section class="news-list-section" aria-labelledby="news-list-title">',
        '        <div class="section-heading">',
        "          <div>",
        '            <p class="section-kicker">News List</p>',
        '            <h2 id="news-list-title">ニュース一覧</h2>',
        "          </div>",
        "        </div>",
        "",
        '        <div class="news-card-list">',
    ]
    for item in items[:4]:
        related_link = render_item_link(item)
        lines.extend(
            [
                '          <article class="news-card">',
                '            <div class="news-card-header">',
                f'              <time datetime="{esc(item["date"])}">{esc(date_dot(item["date"]))}</time>{render_tag(item)}',
                "            </div>",
                f'            <h3><a href="{esc(item_href(item))}">{esc(item.get("title", ""))}</a></h3>',
                f'            <p>{esc(item.get("summary", ""))}</p>',
            ]
        )
        if related_link:
            lines.append(f"            {related_link}")
        bullets = item.get("bullets", [])
        if bullets:
            lines.append("            <ul>")
            for bullet in bullets:
                lines.append(f"              <li>{render_bullet(bullet)}</li>")
            lines.append("            </ul>")
        lines.append("          </article>")
    lines.append("        </div>")
    if len(items) > 4:
        lines.extend(
            [
                '        <details class="content-more news-list-more">',
                "          <summary>&#32154;&#12365;&#12434;&#35501;&#12416;</summary>",
                '          <div class="news-card-list news-card-list-more">',
            ]
        )
        for item in items[4:]:
            related_link = render_item_link(item)
            lines.extend(
                [
                    '            <article class="news-card">',
                    '              <div class="news-card-header">',
                    f'                <time datetime="{esc(item["date"])}">{esc(date_dot(item["date"]))}</time>{render_tag(item)}',
                    "              </div>",
                    f'              <h3><a href="{esc(item_href(item))}">{esc(item.get("title", ""))}</a></h3>',
                    f'              <p>{esc(item.get("summary", ""))}</p>',
                ]
            )
            if related_link:
                lines.append(f"              {related_link}")
            bullets = item.get("bullets", [])
            if bullets:
                lines.append("              <ul>")
                for bullet in bullets:
                    lines.append(f"                <li>{render_bullet(bullet)}</li>")
                lines.append("              </ul>")
            lines.append("            </article>")
        lines.extend(["          </div>", "        </details>"])
    lines.append("      </section>")
    return "\n".join(lines)


def render_timeline(data: dict) -> str:
    items = timeline_items(data)
    lines = [
        '      <section class="news-log-section" aria-labelledby="news-log-title">',
        '        <div class="section-heading">',
        "          <div>",
        '            <p class="section-kicker">Company Timeline</p>',
        '            <h2 id="news-log-title">会社沿革と更新ログ</h2>',
        "          </div>",
        "        </div>",
        "",
        '        <div class="news-log">',
    ]
    for index, item in enumerate(items[:4]):
        latest_class = " is-latest" if index == 0 else ""
        lines.extend(
            [
                f'          <article class="news-log-day{latest_class}">',
                f'            <time datetime="{esc(item["date"])}">{esc(date_dot(item["date"]))}</time>',
                '            <div class="news-log-body">',
                '              <div class="news-log-title-row">',
                f'                <h3>{esc(item.get("title", ""))}</h3>',
                f'                <span class="tag">{esc(item.get("tag", ""))}</span>',
                "              </div>",
                "              <ul>",
            ]
        )
        for bullet in item.get("bullets", []):
            lines.append(f"                <li>{render_bullet(bullet)}</li>")
        lines.extend(["              </ul>", "            </div>", "          </article>"])
        if index != min(len(items), 4) - 1:
            lines.append("")
    lines.append("        </div>")
    if len(items) > 4:
        lines.extend(
            [
                '        <details class="content-more news-log-more">',
                "          <summary>&#32154;&#12365;&#12434;&#35501;&#12416;</summary>",
                '          <div class="news-log">',
            ]
        )
        for index, item in enumerate(items[4:]):
            lines.extend(
                [
                    '            <article class="news-log-day">',
                    f'              <time datetime="{esc(item["date"])}">{esc(date_dot(item["date"]))}</time>',
                    '              <div class="news-log-body">',
                    '                <div class="news-log-title-row">',
                    f'                  <h3>{esc(item.get("title", ""))}</h3>',
                    f'                  <span class="tag">{esc(item.get("tag", ""))}</span>',
                    "                </div>",
                    "                <ul>",
                ]
            )
            for bullet in item.get("bullets", []):
                lines.append(f"                  <li>{render_bullet(bullet)}</li>")
            lines.extend(["                </ul>", "              </div>", "            </article>"])
            if index != len(items[4:]) - 1:
                lines.append("")
        lines.extend(["          </div>", "        </details>"])
    lines.append("      </section>")
    return "\n".join(lines)


def render_update_format(data: dict) -> str:
    fmt = data.get("updateFormat", {})
    lines = [
        '      <section class="news-update-format" aria-labelledby="update-format-title">',
        "        <div>",
        f'          <p class="section-kicker">{esc(fmt.get("kicker", "Update Format"))}</p>',
        f'          <h2 id="update-format-title">{esc(fmt.get("title", "今後の更新方針"))}</h2>',
        f'          <p>{esc(fmt.get("body", ""))}</p>',
        "        </div>",
        '        <div class="format-grid">',
    ]
    for item in fmt.get("items", []):
        lines.append(f'          <article><strong>{esc(item.get("title", ""))}</strong><span>{esc(item.get("text", ""))}</span></article>')
    lines.extend(["        </div>", "      </section>"])
    return "\n".join(lines)


def render_news_main(data: dict) -> str:
    hero = """    <main class="page-main news-main">
      <section class="page-hero news-hero">
        <div>
          <p class="section-kicker">News & Daily Log</p>
          <h1>ニュース・更新ログ</h1>
          <p class="page-lead">
            毎日見る株式会社の設立から日々の運用まで、会社の歩みを「毎日更新できるログ」として残していきます。
          </p>
        </div>
{current}
      </section>""".format(current=render_current(data))
    return "\n\n".join(
        [
            hero,
            render_dashboard(data),
            render_daily_update(data),
            render_news_items(data),
            render_timeline(data),
            render_update_format(data),
            "    </main>",
        ]
    )


def update_news_html(data: dict) -> None:
    html_text = NEWS_HTML_PATH.read_text(encoding="utf-8")
    main_start = html_text.index('    <main class="page-main news-main">')
    try:
        footer_start = html_text.index("    <!-- SITE_FOOTER_START", main_start)
        footer_text = html_text[footer_start:]
    except ValueError:
        try:
            footer_start = html_text.index("    <footer", main_start)
            footer_text = html_text[footer_start:]
        except ValueError:
            footer_start = html_text.index("  </body>", main_start)
            footer_text = (
                marked_block(FOOTER_START, render_footer(""), FOOTER_END)
                + "\n"
                + html_text[footer_start:]
            )
    html_text = html_text[:main_start] + render_news_main(data) + "\n\n" + footer_text
    NEWS_HTML_PATH.write_text(html_text, encoding="utf-8")


def render_about_timeline(data: dict) -> str:
    grouped: dict[str, list[dict]] = {}
    for item in timeline_sorted_items(data):
        if item.get("aboutVisible") is False:
            continue
        grouped.setdefault(item["date"], []).append(item)

    grouped_items = list(grouped.items())

    def render_group(date: str, items: list[dict]) -> list[str]:
        group_lines = [
            f'          <li><time datetime="{esc(date)}">{esc(date_jp(date))}</time><div>',
        ]
        for item in items:
            group_lines.extend(
                [
                    "            <article>",
                    f"              <h3>{esc(item.get('aboutTitle') or item.get('title', ''))}</h3>",
                    f"              <p>{esc(item.get('aboutSummary') or item.get('summary', ''))}</p>",
                ]
            )
            about_link = item.get("aboutLink")
            about_link_label = item.get("aboutLinkLabel")
            if about_link and about_link_label:
                group_lines.append(f'              <a class="text-link" href="{esc(about_link)}">{esc(about_link_label)}</a>')
            group_lines.append("            </article>")
        group_lines.append("          </div></li>")
        return group_lines

    lines = ['        <ol class="about-timeline">']
    for date, items in grouped_items[:4]:
        lines.extend(render_group(date, items))
    lines.append("        </ol>")
    if len(grouped_items) > 4:
        lines.extend(
            [
                '        <details class="content-more about-timeline-more">',
                "          <summary>&#32154;&#12365;&#12434;&#35501;&#12416;</summary>",
                '          <ol class="about-timeline about-timeline-extra">',
            ]
        )
        for date, items in grouped_items[4:]:
            lines.extend(render_group(date, items))
        lines.extend(["          </ol>", "        </details>"])
    return "\n".join(lines)


def update_about_html(data: dict) -> None:
    html_text = ABOUT_HTML_PATH.read_text(encoding="utf-8")
    section_start = html_text.index('<section class="about-rich-section" aria-labelledby="history-title">')
    list_start = html_text.index('        <ol class="about-timeline">', section_start)
    section_end = html_text.index("      </section>", list_start)
    html_text = html_text[:list_start] + render_about_timeline(data) + "\n" + html_text[section_end:]
    ABOUT_HTML_PATH.write_text(html_text, encoding="utf-8")


def main() -> None:
    data = load_news()
    update_index_html(data)
    update_news_html(data)
    update_about_html(data)
    for path in [INDEX_HTML_PATH, NEWS_HTML_PATH, ABOUT_HTML_PATH]:
        apply_layout_to_file(path)
    print(f"Generated top news list, news.html, and about timeline from {len(data['items'])} news items.")


if __name__ == "__main__":
    main()
