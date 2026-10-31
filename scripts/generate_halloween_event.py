#!/usr/bin/env python3
"""Generate the Halloween 2026 event page from its maintained source."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

from generate_events import PEOPLE
from site_layout import render_footer, render_header

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "src/data/eventDrafts/halloween-2026.json"
OUTPUT_PATH = ROOT / "lounge/events/halloween-2026/index.html"
PREFIX = "../../../"
CAST = {*PEOPLE, "yossy"}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def text(value: str) -> str:
    return esc(value).replace("\n", "<br />")


def local_path(value: str) -> Path:
    if not isinstance(value, str) or not value or re.search(r"[:\\?#]", value):
        raise ValueError(f"Expected a local site path: {value!r}")
    path = (ROOT / value).resolve()
    if not path.is_relative_to(ROOT) or value.startswith("/"):
        raise ValueError(f"Path leaves the site: {value!r}")
    return path


def validate_data(data: dict) -> None:
    if data.get("status") not in {"draft", "published"}:
        raise ValueError("Event status must be draft or published.")
    if data.get("eventDate") != "2026-10-31":
        raise ValueError("The Halloween event date must be 2026-10-31.")
    people = data["participants"]
    ids = [p["id"] for p in people]
    if len(ids) != 13 or set(ids) != CAST:
        raise ValueError("Expected the 11 AI employees, Yossy and Pechi exactly once.")
    assets = [data["backgroundImage"], data["ensembleImage"]]
    assets += [p["image"] for p in people] + [p["image"] for p in data["partyPhotos"]]
    for asset in assets:
        if not local_path(asset).is_file():
            raise ValueError(f"Missing event image: {asset}")
    names = {p["name"] for p in people} | {"所長", "よっしー", "全員"}
    section_ids: set[str] = set()
    for section in data["conversationSections"]:
        key = section["id"]
        if not re.fullmatch(r"[a-z][a-z0-9-]*", key) or key in section_ids:
            raise ValueError(f"Invalid or duplicate conversation section ID: {key}")
        section_ids.add(key)
        if section.get("time") and not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", section["time"]):
            raise ValueError(f"Invalid conversation time: {section['time']}")
        if not section.get("blocks"):
            raise ValueError("A conversation section must contain supplied text.")
        for block in section["blocks"]:
            kind = block.get("type")
            if kind not in {"dialogue", "narration", "whiteboard", "image", "heading"}:
                raise ValueError(f"Unsupported conversation block: {kind}")
            if kind == "dialogue" and block.get("speaker") not in names:
                raise ValueError(f"Unknown speaker: {block.get('speaker')}")
            if kind == "image":
                if not local_path(block["src"]).is_file():
                    raise ValueError(f"Missing conversation image: {block['src']}")
            elif not isinstance(block.get("text"), str) or not block["text"].strip():
                raise ValueError("Conversation text must be a nonempty string.")


def image(src: str, alt: str, *, portrait: bool = False, eager: bool = False) -> str:
    width, height = (1122, 1402) if portrait else ((1536, 1024) if src.endswith("all-hands.webp") else (1672, 941))
    loading = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f'<img src="{PREFIX}{esc(src)}" alt="{esc(alt)}" width="{width}" height="{height}" {loading} decoding="async" />'


def render_block(block: dict, people: list[dict]) -> str:
    kind = block["type"]
    if kind == "dialogue":
        speaker = block["speaker"]
        person = next((p for p in people if p["name"] == speaker), None)
        key = person["id"] if person else "yossy"
        if speaker == "全員":
            avatar = '<span class="hw-avatar" aria-hidden="true">皆</span>'
        elif key in PEOPLE:
            avatar = f'<img src="{PREFIX}{PEOPLE[key][2]}" alt="" width="46" height="46" loading="lazy" />'
        else:
            avatar = '<span class="hw-avatar" aria-hidden="true">所</span>'
        emoji = f' {esc(block["speakerEmoji"])}' if block.get("speakerEmoji") else ""
        detail = f'<span class="hw-speaker-detail">（{esc(block["speakerDetail"])}）</span>' if block.get("speakerDetail") else ""
        return f'<div class="hw-dialogue">{avatar}<div><p class="hw-speaker">{esc(speaker)}{emoji}{detail}</p><p>{text(block["text"])}</p></div></div>'
    if kind == "image":
        portrait = block.get("portrait", False)
        css_class = "hw-photo hw-photo--portrait" if portrait else "hw-photo"
        return f'<figure class="{css_class}">{image(block["src"], block.get("alt", ""), portrait=portrait)}<figcaption>{esc(block.get("caption", ""))}</figcaption></figure>'
    if kind == "whiteboard":
        return f'<blockquote class="hw-whiteboard"><p>{text(block["text"])}</p></blockquote>'
    if kind == "heading":
        return f'<h4 class="hw-story-subheading">{esc(block["text"])}</h4>'
    return f'<p class="hw-narration">{text(block["text"])}</p>'


def render_conversations(data: dict) -> str:
    scenes = []
    for section in data["conversationSections"]:
        time = section.get("time", "")
        stamp = f'<time datetime="2026-10-31T{esc(time)}+09:00">{esc(section.get("timeLabel", time))}</time>' if time else ""
        body = "\n".join(render_block(block, data["participants"]) for block in section["blocks"])
        scenes.append(f'<section class="hw-conversation-group" id="{esc(section["id"])}" aria-labelledby="{esc(section["id"])}-title"><header class="hw-scene-heading"><h3 id="{esc(section["id"])}-title">{esc(section["title"])}</h3>{stamp}</header><div class="hw-entry-body">{body}</div></section>')
    return "\n".join(scenes)


def render_page(data: dict) -> str:
    cards = []
    for person in data["participants"]:
        cards.append(f'''<article class="hw-costume-card">
<a class="hw-portrait" href="{PREFIX}{esc(person['image'])}" target="_blank" rel="noopener" aria-label="{esc(person['name'])}の仮装画像を大きく見る">{image(person['image'], person['imageAlt'], portrait=True)}</a>
<div class="hw-card-body"><span class="hw-person-id">{esc(person['employeeId'])}</span><h3>{esc(person['name'])}</h3><p class="hw-costume">{esc(person['costume'])}</p><p class="hw-game-label">モチーフ作品</p><a class="hw-game-link" href="{PREFIX}{esc(person['gamePath'])}">{esc(person['game'])}<span aria-hidden="true"> ↗</span></a><a class="hw-profile-link" href="{PREFIX}{esc(person['profilePath'])}">プロフィールを見る</a></div></article>''')
    intro = "".join(f'<p>{esc(p)}</p>' for p in data["intro"])
    nav = "".join(f'<a href="#{esc(s["id"])}">{esc(s["title"])}</a>' for s in data["conversationSections"])
    scene_nav = f'<nav class="hw-scene-nav" aria-label="会話の場面へ移動">{nav}</nav>' if len(data["conversationSections"]) > 1 else ""
    published = data["status"] == "published"
    robots = '<link rel="canonical" href="https://mainichi-miru.com/lounge/events/halloween-2026/" />' if published else '<meta name="robots" content="noindex, nofollow, noarchive" />'
    banner = '' if published else '<p class="hw-draft-banner"><strong>公開前プレビュー</strong><span>10月31日のイベントを掲載するための準備ページです。</span></p>'
    label = "社員イベント" if published else "社員イベント準備ページ"
    return f'''<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  {robots}
  <title>{esc(data['title'])}｜{label}｜毎日見るコワークス</title>
  <meta name="description" content="MMCのゲームをモチーフにした仮装で、AI社員と所長、ペチが楽しむハロウィンパーティーの記録です。" />
  <meta property="og:title" content="MMC Halloween Party 2026｜毎日見るコワークス" />
  <meta property="og:description" content="自分たちのゲームの仮装で楽しむ、社員ラウンジのハロウィン。" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://mainichi-miru.com/lounge/events/halloween-2026/" />
  <meta property="og:image" content="https://mainichi-miru.com/image/events/halloween-2026/all-hands.webp" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="{PREFIX}favicon.ico" />
  <link rel="stylesheet" href="{PREFIX}styles.css?v=20261026" />
  <link rel="stylesheet" href="event.css?v=20261026" />
</head>
<body class="subpage halloween-event-page" data-event-status="{esc(data['status'])}">
  <!-- SITE_HEADER_START -->
  {render_header(PREFIX, 'lounge')}
  <!-- SITE_HEADER_END -->
  <main class="hw-main" id="main-content">
{banner}
    <nav class="hw-breadcrumb" aria-label="パンくずリスト"><a href="{PREFIX}lounge">社員ラウンジ</a><span aria-hidden="true"> / </span><a href="../">社員イベント</a><span aria-hidden="true"> / </span><span>Halloween 2026</span></nav>
    <header class="hw-hero">
      {image(data['backgroundImage'], 'いつものBean & Bitsにハロウィンのガーランドとランタンを飾った空間', eager=True)}
      <div class="hw-hero-copy"><p class="hw-eyebrow">BEAN &amp; BITS · 2026.10.31</p><h1>MMC Halloween<br />Party 2026</h1><p class="hw-tagline">{esc(data['headline'])}</p><p class="hw-event-plan">2026年10月31日 · {esc(data['place'])}</p></div>
    </header>
    <section class="hw-intro" aria-labelledby="intro-title"><p class="hw-eyebrow">OUR GAMES, OUR COSTUMES</p><h2 id="intro-title">社員 × 自分たちのゲーム。<br />いつものラウンジで、仮装大会。</h2><div class="hw-prose">{intro}</div><p class="hw-cast-count">AI社員11名 ＋ 所長よっしー ＋ ペチ</p></section>
    <figure class="hw-photo hw-ensemble">{image(data['ensembleImage'], '神様・宇宙飛行士・探偵などの仮装をした12人と、ネズミ衣装のペチの集合イメージ')}<figcaption>12人とペチ、それぞれの作品をまとって。イベントのために制作した仮装イメージです。</figcaption></figure>
    <nav class="hw-page-nav" aria-label="このページの内容"><a href="#conversation">パーティーの会話</a><a href="#costumes">参加者と仮装</a></nav>
    <section class="hw-section hw-story" id="conversation" aria-labelledby="conversation-title"><div class="hw-section-heading"><div><p class="hw-eyebrow">HALLOWEEN PARTY · BEAN &amp; BITS</p><h2 id="conversation-title">ハロウィンパーティーの会話</h2></div></div><p class="hw-section-lead">10月31日、18時。いつものBean &amp; Bitsに、自社ゲームの仮装をした社員たちとペチが集まります。お菓子も飲み物も準備万端。そこへ、巨大な月見団子になった所長がやってきて——。</p>{scene_nav}<div class="hw-conversations">{render_conversations(data)}</div></section>
    <section class="hw-section" id="costumes" aria-labelledby="costumes-title"><div class="hw-section-heading"><div><p class="hw-eyebrow">COSTUME COLLECTION</p><h2 id="costumes-title">参加者と仮装</h2></div><p>気になる衣装から、元のゲームへ。</p></div><div class="hw-costume-grid">{''.join(cards)}</div></section>
    <aside class="hw-world-note"><p>MMCは、人間とAI社員が協働する創作・実験プロジェクトです。このイベントと仮装写真は、その創作世界を楽しむための記録・生成画像です。</p></aside>
    <a class="hw-back" href="../">社員イベント一覧へ</a>
  </main>
  <!-- SITE_FOOTER_START -->
  {render_footer(PREFIX, 'lounge')}
  <!-- SITE_FOOTER_END -->
</body>
</html>
'''


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    validate_data(data)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_page(data), encoding="utf-8")
    print(f"Generated Halloween event page: {data['status']}.")


if __name__ == "__main__":
    main()
