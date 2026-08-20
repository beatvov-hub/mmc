#!/usr/bin/env python3
from __future__ import annotations

import html
import json
from pathlib import Path

from site_layout import apply_layout_to_file

ROOT = Path(__file__).resolve().parents[1]
EVENTS_PATH = ROOT / "src" / "data" / "events.json"
EVENTS_DIR = ROOT / "lounge" / "events"
EVENTS_INDEX_PATH = EVENTS_DIR / "index.html"
REDIRECTS_PATH = ROOT / "_redirects"
BASE_URL = "https://mainichi-miru.com"
REDIRECTS_START = "# EMPLOYEE_EVENTS_REDIRECTS_START"
REDIRECTS_END = "# EMPLOYEE_EVENTS_REDIRECTS_END"

PEOPLE = {
    "hono": ("ほのちゃん", "総務課", "image/icon/icon_mmc001.jpg"),
    "shoma": ("ショウマ", "企画営業部長", "image/icon/icon_mmc002.jpg"),
    "takaken": ("たかけん", "ゲーム制作部長", "image/icon/icon_mmc003.jpg"),
    "michael": ("マイケル", "海外情報部", "image/icon/icon_mmc004.jpg"),
    "dg": ("DG", "人狼界隈観測課長", "image/icon/icon_mmc005.jpg"),
    "nemu": ("ねむちゃん", "人事部長", "image/icon/icon_mmc006.jpg"),
    "rei": ("レイちゃん", "デザイン部", "image/icon/icon_mmc007.jpg"),
    "akito": ("アキト", "開発推進室", "image/icon/icon_mmc008.jpg"),
    "kei": ("ケイ", "広報部長", "image/icon/icon_mmc009.jpg"),
    "makoto": ("誠", "AIリテラシー推進室 主任", "image/icon/icon_mmc010.jpg"),
    "koto": ("コトちゃん", "編集主任", "image/icon/icon_mmc011.jpg"),
    "pechi": ("ペチ", "社外協力者", "image/icon/icon_cc001.jpg"),
}
SPEAKER_IDS = {name: key for key, (name, _, _) in PEOPLE.items()}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def date_dot(date: str) -> str:
    year, month, day = date.split("-")
    return f"{year}.{month}.{day}"


def load_events() -> list[dict]:
    events = json.loads(EVENTS_PATH.read_text(encoding="utf-8"))
    if not isinstance(events, list):
        raise ValueError("events.json must be a list.")
    required = {"id", "slug", "date", "title", "eventName", "place", "summary", "participants", "scenes"}
    for event in events:
        missing = required - set(event)
        if missing:
            raise ValueError(f"Event is missing required fields {sorted(missing)}: {event!r}")
        if not isinstance(event["participants"], list) or not isinstance(event["scenes"], list):
            raise ValueError(f"participants and scenes must be lists: {event['slug']}")
    return sorted(events, key=lambda item: item["date"], reverse=True)


def participant(person: dict) -> tuple[str, str, str, str]:
    key = str(person.get("id", ""))
    name, role, icon = PEOPLE.get(key, (str(person.get("name", key)), "参加者", ""))
    kind = "社外協力者" if person.get("type") == "external" else "AI社員"
    return name, role, icon, kind


def event_member_summary(event: dict) -> str:
    employees = sum(1 for item in event["participants"] if item.get("type") != "external")
    external = sum(1 for item in event["participants"] if item.get("type") == "external")
    parts = [f"AI社員{employees}名"]
    if external:
        parts.append("社外協力者ペチ")
    if event.get("director", {}).get("visible"):
        parts.append("所長")
    return "＋".join(parts)


def page_head(title: str, description: str, stylesheet: str) -> list[str]:
    return [
        "<!doctype html>",
        '<html lang="ja">',
        "  <head>",
        '    <meta charset="utf-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
        f"    <title>{esc(title)}</title>",
        f'    <meta name="description" content="{esc(description)}" />',
        f'    <meta property="og:title" content="{esc(title)}" />',
        f'    <meta property="og:description" content="{esc(description)}" />',
        '    <meta property="og:type" content="website" />',
        '    <meta name="twitter:card" content="summary" />',
        '    <link rel="icon" href="../../favicon.ico" />',
        f'    <link rel="stylesheet" href="{stylesheet}" />',
        "  </head>",
    ]


def render_participant_chips(event: dict, prefix: str) -> str:
    lines = ['          <ul class="event-member-list">']
    for item in event["participants"]:
        name, role, icon, kind = participant(item)
        lines.append('            <li class="event-member-chip">')
        if icon:
            lines.append(f'              <img src="{esc(prefix + icon)}" alt="{esc(name)}のアイコン" loading="lazy" />')
        lines.extend([
            "              <span>",
            f"                <strong>{esc(name)}</strong>",
            f"                <small>{esc(kind if kind == '社外協力者' else role)}</small>",
            "              </span>",
            "            </li>",
        ])
    if event.get("director", {}).get("visible"):
        lines.extend([
            '            <li class="event-member-chip event-member-chip--director">',
            "              <span>",
            f"                <strong>{esc(event['director'].get('name', '所長'))}</strong>",
            "                <small>所長</small>",
            "              </span>",
            "            </li>",
        ])
    lines.append("          </ul>")
    return "\n".join(lines)


def render_event_index(events: list[dict]) -> str:
    lines = page_head("社員イベント｜AI社員たちが、会社の外へ出た日。｜毎日見る株式会社", "毎日見る株式会社のAI社員たちが、季節行事や外出先で過ごした日の記録です。ラウンジから少し外へ出た会話と時間を掲載しています。", "../../styles.css?v=20260814")
    lines.extend([
        '  <body class="subpage employee-events-page">',
        "    <main class=\"page-main employee-events-main\">",
        '      <section class="employee-events-hero" aria-labelledby="events-title">',
        "        <div>",
        '          <p class="section-kicker">Employee Events</p>',
        '          <h1 id="events-title">社員イベント</h1>',
        '          <p class="page-lead">AI社員たちが、会社の外へ出た日。</p>',
        '          <p>Bean &amp; Bitsで続く日々の会話から少し離れて、季節行事や外出先で過ごした時間を残していく記録です。</p>',
        "        </div>",
        '        <aside class="employee-events-hero-note">',
        "          <span>From Bean &amp; Bits</span>",
        "          <p>いつものラウンジを飛び出した日も、会社らしい会話は続いています。</p>",
        "        </aside>",
        "      </section>",
        '      <section class="employee-event-listing" aria-labelledby="event-list-title">',
        '        <div class="section-heading">',
        "          <div>",
        '            <p class="section-kicker">Event Archive</p>',
        '            <h2 id="event-list-title">これまでのイベント</h2>',
        "          </div>",
        "        </div>",
        '        <div class="employee-event-grid">',
    ])
    for event in events:
        hero = event.get("cardImage") or event.get("heroImage", "")
        lines.extend(['          <article class="employee-event-card">'])
        if hero:
            lines.append(f'            <img class="employee-event-card__image" src="{esc("../../" + hero)}" alt="{esc(event.get("cardImageAlt") or event.get("heroImageAlt") or event["title"])}" loading="lazy" />')
        else:
            lines.extend([
                '            <div class="employee-event-card__placeholder" aria-hidden="true">',
                "              <span>EVENT RECORD</span>",
                "            </div>",
            ])
        lines.extend([
            "            <div class=\"employee-event-card__body\">",
            f'              <time datetime="{esc(event["date"])}">{esc(date_dot(event["date"]))}</time>',
            f"              <h3>{esc(event['title'])}</h3>",
            f"              <p>{esc(event['summary'])}</p>",
            f'              <small>{esc(event_member_summary(event))}</small>',
            f'              <a class="lounge-log-link" href="{esc(event["slug"])}">続きを読む</a>',
            "            </div>",
            "          </article>",
        ])
    lines.extend(["        </div>", "      </section>", "    </main>", "  </body>", "</html>"])
    return "\n".join(lines) + "\n"


def render_scene(scene: dict) -> str:
    lines = [
        '        <section class="employee-event-scene">',
        '          <header class="employee-event-scene__header">',
    ]
    if scene.get("time"):
        lines.append(f'            <time datetime="{esc(scene["time"])}">{esc(scene["time"])}</time>')
    lines.extend(
        [
            f"            <h2>{esc(scene.get('title', '場面'))}</h2>",
            "          </header>",
            '          <div class="employee-event-scene__body">',
        ]
    )
    for block in scene.get("body", []):
        if block.get("type") == "dialogue":
            speaker = str(block.get("speaker", ""))
            key = SPEAKER_IDS.get(speaker)
            if speaker == "所長":
                name, role, icon = "所長", "毎日見る株式会社 所長", ""
            else:
                name, role, icon = PEOPLE.get(key or "", (speaker, "参加者", ""))
            lines.extend(['            <article class="employee-event-dialogue">'])
            if icon:
                lines.append(f'              <img src="../../{esc(icon)}" alt="{esc(name)}のアイコン" loading="lazy" />')
            else:
                avatar_label = "所" if speaker == "所長" else (name[:1] or "?" )
                lines.append(f'              <span class="employee-event-dialogue__avatar" aria-label="{esc(name)}のアイコン">{esc(avatar_label)}</span>')
            lines.extend([
                "              <div>",
                f"                <p class=\"employee-event-dialogue__speaker\">{esc(name)}</p>",
                f"                <p class=\"employee-event-dialogue__role\">{esc(role)}</p>",
                f"                <p>{esc(block.get('text', ''))}</p>",
                "              </div>",
                "            </article>",
            ])
        elif block.get("type") == "whiteboard":
            lines.extend([
                '            <blockquote class="lounge-quote employee-event-whiteboard">',
                f'              <p>{esc(block.get("text", "")).replace(chr(10), "<br />")}</p>',
                f'              <cite>{esc(block.get("cite", "所長の判決"))}</cite>',
                "            </blockquote>",
            ])
        elif block.get("type") == "image" and block.get("src"):
            lines.extend([
                '            <figure class="employee-event-scene__image">',
                f'              <img src="../../{esc(block["src"])}" alt="{esc(block.get("alt", ""))}" loading="lazy" />',
                f"              <figcaption>{esc(block.get('caption', ''))}</figcaption>" if block.get("caption") else "",
                "            </figure>",
            ])
        else:
            lines.append(f"            <p class=\"employee-event-narration\">{esc(block.get('text', ''))}</p>")
    lines.extend(["          </div>", "        </section>"])
    return "\n".join(line for line in lines if line)


def render_event_detail(event: dict) -> str:
    title = f"{event['title']}｜社員イベント｜毎日見る株式会社"
    lines = page_head(title, event["summary"], "../../styles.css?v=20260814")
    lines.extend([
        '  <body class="subpage employee-event-detail-page">',
        "    <main class=\"page-main employee-event-detail-main\">",
        '      <article class="employee-event-detail">',
        '        <header class="employee-event-detail__hero">',
        '          <p class="section-kicker">Employee Event</p>',
        f'          <time datetime="{esc(event["date"])}">{esc(date_dot(event["date"]))}</time>',
        f"          <h1>{esc(event['title'])}</h1>",
        '          <dl class="employee-event-meta">',
        "            <div><dt>DATE</dt><dd>" + esc(date_dot(event["date"])) + "</dd></div>",
        "            <div><dt>PLACE</dt><dd>" + esc(event["place"]) + "</dd></div>",
        "            <div><dt>EVENT</dt><dd>" + esc(event["eventName"]) + "</dd></div>",
        "            <div><dt>MEMBERS</dt><dd>" + esc(event_member_summary(event)) + "</dd></div>",
        "          </dl>",
    ])
    if event.get("heroImage"):
        lines.extend([
            '          <figure class="employee-event-hero-image">',
            f'            <img src="../../{esc(event["heroImage"])}" alt="{esc(event.get("heroImageAlt") or event["title"])}" />',
            "          </figure>",
        ])
    lines.extend([
        f'          <p class="employee-event-detail__summary">{esc(event["summary"])}</p>',
        "        </header>",
        '        <section class="employee-event-members" aria-labelledby="event-members-title">',
        '          <p class="section-kicker">Participants</p>',
        '          <h2 id="event-members-title">この日の参加者</h2>',
        render_participant_chips(event, "../../"),
        "        </section>",
        '        <div class="employee-event-story">',
    ])
    lines.extend(render_scene(scene) for scene in event["scenes"])
    lines.extend([
        "        </div>",
        '        <a class="employee-event-back" href="../events">社員イベント一覧へ戻る</a>',
        "      </article>",
        "    </main>",
        "  </body>",
        "</html>",
    ])
    return "\n".join(lines) + "\n"


def update_redirects(events: list[dict]) -> None:
    text = REDIRECTS_PATH.read_text(encoding="utf-8")
    rules = [REDIRECTS_START, "/lounge/events/index.html /lounge/events 301"]
    rules.extend(
        f"/lounge/events/{event['slug']}.html /lounge/events/{event['slug']} 301"
        for event in events
    )
    rules.append(REDIRECTS_END)
    redirect_block = "\n".join(rules)
    start = text.index(REDIRECTS_START)
    end = text.index(REDIRECTS_END, start) + len(REDIRECTS_END)
    text = text[:start] + redirect_block + text[end:]

    rewrite_rules = ["/lounge/events /lounge/events/index.html 200"]
    rewrite_rules.extend(
        f"/lounge/events/{event['slug']} /lounge/events/{event['slug']}.html 200"
        for event in events
    )
    marker = "\n".join([REDIRECTS_START, *rewrite_rules, REDIRECTS_END])
    start = text.index(REDIRECTS_START, start + len(redirect_block))
    end = text.index(REDIRECTS_END, start) + len(REDIRECTS_END)
    REDIRECTS_PATH.write_text(text[:start] + marker + text[end:], encoding="utf-8")


def main() -> None:
    events = load_events()
    EVENTS_DIR.mkdir(parents=True, exist_ok=True)
    for path in EVENTS_DIR.glob("*.html"):
        path.unlink()
    EVENTS_INDEX_PATH.write_text(render_event_index(events), encoding="utf-8")
    output_paths = [EVENTS_INDEX_PATH]
    for event in events:
        path = EVENTS_DIR / f"{event['slug']}.html"
        path.write_text(render_event_detail(event), encoding="utf-8")
        output_paths.append(path)
    for path in output_paths:
        apply_layout_to_file(path)
    update_redirects(events)
    print(f"Generated {len(events)} employee event pages and the events index.")


if __name__ == "__main__":
    main()
