#!/usr/bin/env python3
"""Generate the static pages for the Daily Question series from JSON data."""

from __future__ import annotations

import html
import hashlib
import json
import random
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from site_layout import ROOT, apply_layout_to_file

DATA_PATH = ROOT / "src" / "data" / "dailyQuiz.json"
QUIZ_DIR = ROOT / "quiz"
SITE_URL = "https://mainichi-miru.com"
PRACTICE_PAGE_SIZE = 100
ROTATION_LOOKAHEAD_DAYS = 35
SELECTION_EPOCH = date(2026, 9, 28)
TOKYO = timezone(timedelta(hours=9))
OFFICIAL_INFO = {
    "g-kentei": ("一般社団法人 日本ディープラーニング協会（JDLA）", "https://www.jdla.org/certificate/general/", "G検定 公式サイトを見る"),
    "it-passport": ("独立行政法人 情報処理推進機構（IPA）", "https://www3.jitec.ipa.go.jp/JitesCbt/html/about/range.html", "ITパスポート 公式情報を見る"),
    "generative-ai-passport": ("一般社団法人 生成AI活用普及協会（GUGA）", "https://guga.or.jp/outline/", "生成AIパスポート 公式サイトを見る"),
    "ds-kentei": ("一般社団法人 データサイエンティスト協会", "https://www.datascientist.or.jp/dscertification/", "DS検定 公式サイトを見る"),
}
LEGACY_RELATED = {
    ("g-kentei", "2026-09-28"): (315, 471, 478),
    ("g-kentei", "2026-09-27"): (174, 301, 471),
    ("g-kentei", "2026-09-26"): (68, 69, 70),
    ("g-kentei", "2026-09-25"): (183, 474, 500),
    ("g-kentei", "2026-09-24"): (127, 128, 436),
    ("g-kentei", "2026-09-23"): (440, 141, 144),
    ("g-kentei", "2026-09-22"): (421, 133, 331),
    ("g-kentei", "2026-09-21"): (213, 413, 420),
    ("g-kentei", "2026-09-20"): (185, 455, 488),
    ("g-kentei", "2026-09-19"): (491, 492, 496),
    ("it-passport", "2026-09-28"): (197, 493, 494),
    ("it-passport", "2026-09-27"): (497, 399, 91),
    ("it-passport", "2026-09-26"): (283, 472, 474),
    ("it-passport", "2026-09-25"): (170, 449),
    ("it-passport", "2026-09-24"): (103, 110, 108),
    ("it-passport", "2026-09-23"): (44, 42, 41),
    ("it-passport", "2026-09-22"): (161, 446, 448),
    ("it-passport", "2026-09-21"): (483, 83, 85),
    ("it-passport", "2026-09-20"): (34, 29, 32),
    ("it-passport", "2026-09-19"): (25, 26, 419),
    ("generative-ai-passport", "2026-09-28"): (25, 32, 412),
    ("generative-ai-passport", "2026-09-27"): (60, 63, 430),
    ("generative-ai-passport", "2026-09-26"): (65, 66, 69),
    ("generative-ai-passport", "2026-09-25"): (77, 78, 80),
    ("generative-ai-passport", "2026-09-24"): (157, 268, 474),
    ("generative-ai-passport", "2026-09-23"): (33, 417, 412),
    ("generative-ai-passport", "2026-09-22"): (60, 61, 63),
    ("generative-ai-passport", "2026-09-21"): (47, 52, 51),
    ("generative-ai-passport", "2026-09-20"): (83, 285),
    ("generative-ai-passport", "2026-09-19"): (491, 492, 100),
    ("ds-kentei", "2026-09-28"): (11, 323, 144),
    ("ds-kentei", "2026-09-27"): (141, 147, 149),
    ("ds-kentei", "2026-09-26"): (133, 317, 448),
    ("ds-kentei", "2026-09-25"): (105, 106, 107),
    ("ds-kentei", "2026-09-24"): (370, 471, 472),
    ("ds-kentei", "2026-09-23"): (254, 255, 485),
    ("ds-kentei", "2026-09-22"): (29, 30, 446),
    ("ds-kentei", "2026-09-21"): (107, 195, 403),
    ("ds-kentei", "2026-09-20"): (239, 369, 370),
    ("ds-kentei", "2026-09-19"): (129, 31, 447),
}


def escape(value: object) -> str:
    return html.escape(str(value), quote=True)


def jp_date(value: str | date) -> str:
    parsed = value if isinstance(value, date) else date.fromisoformat(value)
    return f"{parsed.year}年{parsed.month}月{parsed.day}日"


def route_for(question: dict) -> str:
    if question.get("slug"):
        return f"/quiz/{question['qualification']}/questions/{question['slug']}"
    return f"/quiz/{question['qualification']}/{question['date']}"


def practice_route(qualification_id: str, page: int = 1) -> str:
    base = f"/quiz/{qualification_id}/practice"
    return base if page == 1 else f"{base}/{page}"


def practice_ranges(qualification_id: str, total: int, current_page: int | None = None) -> str:
    items = []
    for page in range(1, max(3, (total + PRACTICE_PAGE_SIZE - 1) // PRACTICE_PAGE_SIZE) + 1):
        start = (page - 1) * PRACTICE_PAGE_SIZE + 1
        end = page * PRACTICE_PAGE_SIZE
        label = f"{start}〜{end}問"
        if total >= start:
            count = min(total - start + 1, PRACTICE_PAGE_SIZE)
            current = page == current_page
            status = '<small>このページ</small>' if current else (f'<small>公開中：{count}問</small>' if count < PRACTICE_PAGE_SIZE else '')
            current_attr = ' aria-current="page"' if current else ''
            items.append(f'<a href="{practice_route(qualification_id, page)}"{current_attr}>{label}{status}</a>')
        else:
            items.append(f'<span>{label}<small>準備中</small></span>')
    return f'<nav class="quiz-range-links" aria-label="問題集の範囲">{" ".join(items)}</nav>'


def featured_question(questions: list[dict], qualification_id: str, day: date) -> dict:
    """Shuffle each complete cycle, then select one stable question per JST day."""
    if not questions:
        raise ValueError(f"No published questions: {qualification_id}")
    ordered = sorted(questions, key=lambda item: item["id"])
    cycle, position = divmod((day - SELECTION_EPOCH).days, len(ordered))
    seed = hashlib.sha256(f"{qualification_id}:{cycle}".encode("utf-8")).digest()
    random.Random(int.from_bytes(seed, "big")).shuffle(ordered)
    return ordered[position]


def rotation_day(now: datetime) -> date:
    """The next quiz day starts at 06:00 in Tokyo, not at midnight."""
    return (now.astimezone(TOKYO) - timedelta(hours=6)).date()


def document(title: str, description: str, body: str, script_path: str | None = None, structured_data: dict | None = None) -> str:
    script = f'\n  <script src="{script_path}" defer></script>' if script_path else ""
    schema = (
        '\n  <script type="application/ld+json">'
        + json.dumps(structured_data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
        + "</script>"
        if structured_data else ""
    )
    return f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} | 毎日見る株式会社</title>
  <meta name="description" content="{escape(description)}">
  <link rel="stylesheet" href="{{PREFIX}}styles.css">{script}{schema}
</head>
<body class="subpage quiz-page">
{body}
</body>
</html>
"""


def with_prefix(content: str, depth: int) -> str:
    return content.replace("{PREFIX}", "../" * depth)


def breadcrumb(items: list[tuple[str, str | None]]) -> str:
    parts = []
    for label, href in items:
        parts.append(f'<a href="{href}">{escape(label)}</a>' if href else f"<span aria-current=\"page\">{escape(label)}</span>")
    return f'<nav class="quiz-breadcrumbs" aria-label="パンくずリスト">{"<span aria-hidden=\"true\">/</span>".join(parts)}</nav>'


def breadcrumb_schema(items: list[tuple[str, str | None]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": index, "name": label, **({"item": SITE_URL + href} if href else {})}
            for index, (label, href) in enumerate(items, start=1)
        ],
    }


def answer_term(question: dict) -> str:
    return next(choice["text"] for choice in question["choices"] if choice["id"] == question["correctAnswer"])


def related_terms(question: dict, questions: list[dict]) -> list[dict]:
    by_term = {answer_term(item): item for item in questions if item.get("slug")}
    by_number = {int(item["slug"].split("-")[-1]): item for item in questions if item.get("slug")}
    if question.get("slug"):
        related = [by_term[choice["text"]] for choice in question["choices"]
                   if choice["id"] != question["correctAnswer"] and choice["text"] in by_term]
    else:
        related = [by_number[number] for number in LEGACY_RELATED.get((question["qualification"], question["date"]), ())]
    return [item for item in related if item["id"] != question["id"]]


def render_related_terms(related: list[dict]) -> str:
    rows = []
    for item in related:
        definition = item["explanation"]["correct"].split("。", 1)[0].strip() + "。"
        context = re.sub(r"最も適切なものはどれですか。$", "", item["question"]).strip()
        rows.append(
            f'<li><h4><a href="{route_for(item)}">{escape(answer_term(item))}</a></h4>'
            f'<p>{escape(definition)}</p>'
            f'<p class="quiz-term-context"><strong>使われる場面</strong> {escape(context)}</p></li>'
        )
    return (
        '<section class="quiz-related-terms" aria-labelledby="quiz-related-heading">'
        '<h3 id="quiz-related-heading">選択肢とあわせて学ぶ用語</h3>'
        '<p>この問題に関連する用語の意味と、判断に使う場面を確認できます。</p>'
        f'<ul>{"".join(rows)}</ul></section>'
    ) if rows else ""


def official_link(qualification_id: str) -> str:
    _, url, label = OFFICIAL_INFO[qualification_id]
    return f'<a href="{escape(url)}" target="_blank" rel="noopener noreferrer">{escape(label)} <span aria-hidden="true">↗</span><span class="visually-hidden">（外部サイト）</span></a>'


def meta(question: dict, *, show_date: bool = True) -> str:
    date_label = "公開日" if question.get("slug") else "出題日"
    date_row = f'      <div><dt>{date_label}</dt><dd>{jp_date(question["date"])}</dd></div>\n' if show_date else ""
    return f"""<dl class="quiz-meta">
{date_row}      <div><dt>分野</dt><dd>{escape(question['category'])}</dd></div>
      <div><dt>難易度</dt><dd>{escape(question['difficulty'])}</dd></div>
    </dl>"""


def today_card(question: dict, qualification: dict, detail_link: bool = True) -> str:
    action = (f'<a class="quiz-action" href="{route_for(question)}">問題を解く <span aria-hidden="true">→</span></a>' if detail_link else "")
    return f"""<article class="quiz-today-question quiz-accent-{qualification['accent']}">
      <div class="quiz-card-heading"><span class="quiz-icon" aria-hidden="true">{escape(qualification['icon'])}</span><p>{escape(qualification['name'])}</p></div>
      {meta(question, show_date=False)}
      <h2>{escape(question['title'])}</h2>
      <p class="quiz-question-preview">{escape(question['question'])}</p>
      {action}
    </article>"""


def render_question_body(question: dict, heading_level: int, key: str, *, number: int | None = None, show_meta: bool = False) -> str:
    choices = "\n".join(
        f'<button type="button" class="quiz-choice" data-quiz-choice aria-pressed="false"><span>{escape(choice["id"])}</span><strong>{escape(choice["text"])}</strong></button>'
        for choice in question["choices"]
    )
    explanations = "\n".join(
        f'<li><strong>{escape(choice)}</strong><span>{escape(explanation)}</span></li>'
        for choice, explanation in question["explanation"]["choices"].items()
    )
    keywords = "".join(f"<li>{escape(keyword)}</li>" for keyword in question["keywords"])
    source = f'<a href="{escape(question["sourceUrl"])}">{escape(question["sourceName"])}</a>'
    heading = f"h{heading_level}"
    subheading = f"h{heading_level + 1}"
    question_id = f"question-{key}"
    answer_id = f"quiz-answer-{key}"
    kicker = f"QUESTION {number}" if number is not None else "QUESTION"
    question_meta = f"\n        {meta(question)}" if show_meta else ""
    return f"""<section class="quiz-question-block" aria-labelledby="{question_id}">
        <p class="section-kicker">{kicker}</p>
        <{heading} id="{question_id}">{escape(question['title'])}</{heading}>{question_meta}
        <p class="quiz-question-text">{escape(question['question'])}</p>
        <div class="quiz-choices" role="group" aria-label="4つの選択肢">{choices}</div>
        <button class="quiz-reveal-button" type="button" data-quiz-reveal aria-controls="{answer_id}">答えを見る</button>
      </section>
      <section class="quiz-answer" id="{answer_id}" data-quiz-answer hidden aria-live="polite">
        <p class="section-kicker">ANSWER &amp; EXPLANATION</p>
        <{heading} class="quiz-answer-title">正解：{escape(question['correctAnswer'])}</{heading}>
        <p>{escape(question['explanation']['correct'])}</p>
        <{subheading}>選択肢のポイント</{subheading}><ul class="quiz-explanation-list">{explanations}</ul>
        <{subheading}>関連キーワード</{subheading}><ul class="quiz-keywords">{keywords}</ul>
        <p class="quiz-source">参考にした公式情報：{source} / 確認日：{jp_date(question['checkedAt'])}</p>
      </section>"""


def hub_question_cards(data: dict, featured: dict[str, dict]) -> str:
    return "\n".join(
        f"""<article class="quiz-detail quiz-home-question quiz-accent-{qualification['accent']}" data-quiz>
          <header class="quiz-home-question-heading"><span class="quiz-icon" aria-hidden="true">{escape(qualification['icon'])}</span><h3><a href="/quiz/{qualification['id']}">{escape(qualification['name'])}</a></h3></header>
          {render_question_body(featured[qualification['id']], 4, f"today-{qualification['id']}")}
          <p class="quiz-question-permalink"><a href="{route_for(featured[qualification['id']])}">この問題の個別ページ →</a></p>
        </article>"""
        for qualification in data["qualifications"]
    )


def rotation_payload(data: dict, questions_by_qualification: dict[str, list[dict]], first_day: date) -> dict:
    days = {}
    for offset in range(ROTATION_LOOKAHEAD_DAYS):
        day = first_day + timedelta(days=offset)
        featured = {
            qualification["id"]: featured_question(
                questions_by_qualification[qualification["id"]], qualification["id"], day
            )
            for qualification in data["qualifications"]
        }
        days[day.isoformat()] = hub_question_cards(data, featured)
    return {"days": days}


def render_hub(data: dict, featured: dict[str, dict], questions_by_qualification: dict[str, list[dict]], day: date) -> str:
    questions = hub_question_cards(data, featured)
    banks = "\n".join(
        f"""<article class="quiz-qualification-card quiz-accent-{qualification['accent']}">
          <div class="quiz-card-heading"><span class="quiz-icon" aria-hidden="true">{escape(qualification['icon'])}</span><h3><a href="/quiz/{qualification['id']}">{escape(qualification['name'])}</a></h3></div>
          <p>{escape(qualification['description'])} 現在{len(questions_by_qualification[qualification['id']])}問を公開中。</p>
          {practice_ranges(qualification['id'], len(questions_by_qualification[qualification['id']]))}
        </article>"""
        for qualification in data["qualifications"]
    )
    official_links = "".join(
        f'<li>{official_link(qualification["id"])}</li>'
        for qualification in data["qualifications"]
    )
    body = f"""<main class="page-main quiz-main">
  <div class="page-width">
    <section class="quiz-hero" aria-labelledby="quiz-title">
      <img class="quiz-hero-art" src="../image/quiz/daily-quiz-hero.webp" alt="クイズカード、ノート、図形を並べた学習机の挿絵" width="1536" height="1024" fetchpriority="high">
      <div class="quiz-hero-copy">
        <p class="section-kicker">DAILY QUIZ / 06:00 JST</p>
        <h1 id="quiz-title" class="quiz-hero-logo">毎日一問<span>。</span></h1>
        <p class="quiz-hero-catch">1問から、今日の学びを。</p>
        <p class="quiz-hero-description">G検定・ITパスポート・生成AIパスポート・DS検定。4つの問題集から、毎朝6時に1問ずつ選びます。</p>
        <a class="quiz-hero-action" href="#today-heading">今日の4問を解く <span aria-hidden="true">↘</span></a>
      </div>
    </section>
    <section class="quiz-section" aria-labelledby="today-heading" data-daily-day="{day.isoformat()}">
      <div class="quiz-section-heading"><p class="section-kicker" data-daily-date-label>TODAY / {jp_date(day)}</p><h2 id="today-heading">今日の4問</h2></div>
      <div class="quiz-card-grid quiz-today-grid" data-daily-rotation>{questions}</div>
    </section>
    <section class="quiz-section quiz-chooser" aria-labelledby="chooser-heading">
      <div class="quiz-section-heading"><p class="section-kicker">PRACTICE</p><h2 id="chooser-heading">資格別の問題集</h2></div>
      <div class="quiz-card-grid">{banks}</div>
      <p class="quiz-note">掲載する問題は、学び直しの入口として作成したオリジナル練習問題です。</p>
    </section>
    <section class="quiz-section quiz-guidance" aria-labelledby="guidance-heading">
      <div class="quiz-section-heading"><h2 id="guidance-heading">ご利用にあたって</h2></div>
      <p>本コンテンツは、AI・IT分野の学習を目的として、各資格・試験の公式サイト、公開されているシラバス、出題範囲、学習項目などを参考に作成しています。</p>
      <p>掲載している問題・選択肢・解説は、生成AIを活用して作成したオリジナル練習問題です。実際の試験問題や過去に出題された問題、各試験実施団体が提供する問題・模擬試験を再現したものではありません。</p>
      <p>内容は可能な範囲で確認していますが、試験制度、出題範囲、法令、サービス仕様、技術情報などは変更される場合があります。最新かつ正確な情報は、各試験実施団体・関係機関の公式情報をご確認ください。</p>
      <p>本コンテンツの利用によって、特定の試験への合格や得点向上を保証するものではありません。問題・解説に誤りや不適切な表現が確認された場合は、内容を修正・更新することがあります。</p>
      <p>各資格名・試験名・サービス名などは、それぞれの運営団体または権利者に帰属します。本サイトは、各試験実施団体による公式サービスではありません。</p>
      <h3>各資格の公式情報</h3>
      <ul class="quiz-official-links">{official_links}</ul>
    </section>
  </div>
</main>"""
    return document("毎日一問。｜AI・IT資格のオリジナル練習問題", "G検定、ITパスポート、生成AIパスポート、DS検定の問題集から毎日4問を選ぶオリジナル練習問題です。", body, "../scripts/daily-quiz.js")


def render_qualification(data: dict, qualification: dict, questions: list[dict], question: dict, day: date) -> str:
    published_rows = [
        f"""<li><div><time datetime="{item['date']}">{jp_date(item['date'])}</time><h3><a href="{route_for(item)}">{escape(item['title'])}</a></h3></div><div class="quiz-history-meta"><span>{escape(item['category'])}</span><span>{escape(item['difficulty'])}</span></div></li>"""
        for item in questions[:10]
    ]
    published_dates = {item["date"] for item in questions}
    pending_rows = [
        f"""<li><div><time datetime="{item['date']}">{jp_date(item['date'])}</time><h3>{escape(item['title'])}</h3></div><div class="quiz-history-meta"><span>{escape(item['category'])}</span><span>{escape(item['difficulty'])}</span><span class="quiz-coming-soon">公開準備中</span></div></li>"""
        for item in data["history"].get(qualification["id"], [])
        if item["date"] not in published_dates
    ]
    history_rows = "\n".join(published_rows + pending_rows)
    pending_note = '<p class="quiz-note">以前の問題は、公開済みのものから順に追加されます。</p>' if pending_rows else ""
    body = f"""<main class="page-main quiz-main">
  <div class="page-width">
    {breadcrumb([("毎日一問。", "/quiz"), (qualification['name'], None)])}
    <section class="quiz-intro quiz-intro-compact" aria-labelledby="quiz-title">
      <p class="section-kicker">DAILY QUIZ / {escape(qualification['icon'])}</p>
      <h1 id="quiz-title">{escape(qualification['name'])}｜毎日一問。</h1>
      <p>{escape(qualification['intro'])}</p>
      <p>現在{len(questions)}問のオリジナル練習問題を公開しています。</p>
      <p class="quiz-intro-disclaimer">本ページは毎日見る株式会社が独自に制作・運営する学習コンテンツです。各試験実施団体による公式サービスではありません。</p>
    </section>
    <section class="quiz-section" aria-labelledby="today-heading">
      <div class="quiz-section-heading"><p class="section-kicker">TODAY / {jp_date(day)}</p><h2 id="today-heading">今日の問題</h2></div>
      {today_card(question, qualification)}
    </section>
    <section class="quiz-section" aria-labelledby="history-heading">
      <div class="quiz-section-heading"><p class="section-kicker">ARCHIVE</p><h2 id="history-heading">最近の問題</h2></div>
      <ul class="quiz-history-list">{history_rows}</ul>
      <p class="quiz-note"><a href="{practice_route(qualification['id'])}">全{len(questions)}問の問題集を見る →</a></p>
{pending_note}
      <p class="quiz-note">2026年9月19日〜27日分は、2026年9月28日にまとめて公開しました。</p>
    </section>
    <section class="quiz-section quiz-official-info" aria-labelledby="official-heading">
      <div class="quiz-section-heading"><h2 id="official-heading">公式情報を確認する</h2></div>
      <p>試験内容・最新の出題範囲・受験情報については、試験実施団体の公式サイトをご確認ください。</p>
      <p class="quiz-official-organization">実施団体・機関：{escape(OFFICIAL_INFO[qualification['id']][0])}</p>
      <p class="quiz-official-action">{official_link(qualification['id'])}</p>
    </section>
  </div>
</main>"""
    return document(f"{qualification['name']}｜毎日一問。", f"{qualification['name']}のオリジナル練習問題を{len(questions)}問公開。4択問題と解説を一覧から選べます。", body)


def render_practice(qualification: dict, questions: list[dict], page: int) -> str:
    total = len(questions)
    page_count = (total + PRACTICE_PAGE_SIZE - 1) // PRACTICE_PAGE_SIZE
    if not 1 <= page <= page_count:
        raise ValueError(f"Unknown practice page: {qualification['id']} / {page}")
    start = (page - 1) * PRACTICE_PAGE_SIZE
    current = sorted(questions, key=lambda item: (item["date"], item["id"]))[start:start + PRACTICE_PAGE_SIZE]
    cards = "\n".join(
        f"""<article class="quiz-detail quiz-practice-question quiz-accent-{qualification['accent']}" id="item-{start + offset + 1}" data-quiz>
      {render_question_body(item, 3, f"practice-{start + offset + 1}", number=start + offset + 1, show_meta=True)}
      <p class="quiz-question-permalink"><a href="{route_for(item)}">この問題の個別ページ →</a></p>
    </article>"""
        for offset, item in enumerate(current)
    )
    page_label = f"{start + 1}〜{page * PRACTICE_PAGE_SIZE}問"
    body = f"""<main class="page-main quiz-main">
  <div class="page-width">
    {breadcrumb([("毎日一問。", "/quiz"), (qualification['name'], f"/quiz/{qualification['id']}"), (page_label, None)])}
    <section class="quiz-intro quiz-intro-compact" aria-labelledby="quiz-title">
      <p class="section-kicker">PRACTICE / {escape(qualification['icon'])}</p>
      <h1 id="quiz-title">{escape(qualification['name'])}｜オリジナル練習問題集 {page_label}</h1>
      <p>公開されている出題範囲を参考に、生成AIを活用して作成したオリジナルの4択練習問題です。各試験実施団体が提供する問題ではありません。現在{total}問を公開し、このページでは{len(current)}問に挑戦できます。</p>
    </section>
    <p class="quiz-range-heading">問題集のページを選ぶ <span>100問ずつ・全{total}問</span></p>
    {practice_ranges(qualification['id'], total, current_page=page)}
    <section class="quiz-section" aria-labelledby="list-heading">
      <div class="quiz-section-heading"><p class="section-kicker">QUESTIONS</p><h2 id="list-heading">公開中の第{start + 1}〜{start + len(current)}問</h2></div>
      <div class="quiz-practice-list">{cards}</div>
    </section>
  </div>
</main>"""
    return document(
        f"{qualification['name']}｜オリジナル練習問題集 {page_label}",
        f"{qualification['name']}のオリジナル4択練習問題集 {page_label}。現在{total}問を公開し、このページで解答と解説を確認できます。",
        body,
        "../../../scripts/daily-quiz.js" if page == 1 else "../../../../scripts/daily-quiz.js",
    )


def render_detail(qualification: dict, question: dict, previous: dict | None, next_question: dict | None, depth: int, bank_page: int = 1, related: list[dict] | None = None) -> str:
    choices = "\n".join(
        f"<button type=\"button\" class=\"quiz-choice\" data-quiz-choice aria-pressed=\"false\"><span>{escape(choice['id'])}</span><strong>{escape(choice['text'])}</strong></button>"
        for choice in question["choices"]
    )
    explanations = "\n".join(
        f"<li><strong>{escape(key)}</strong><span>{escape(value)}</span></li>"
        for key, value in question["explanation"]["choices"].items()
    )
    keyword_list = "".join(f"<li>{escape(keyword)}</li>" for keyword in question["keywords"])
    related_html = render_related_terms(related or [])
    source = f'<a href="{escape(question["sourceUrl"])}">{escape(question["sourceName"])}</a>' if question["sourceUrl"] else escape(question["sourceName"])
    previous_link = f'<a href="{route_for(previous)}">← 前の問題</a>' if previous else ""
    next_link = f'<a href="{route_for(next_question)}">次の問題 →</a>' if next_question else ""
    if question.get("slug"):
        detail_label = question["title"]
        crumbs = [("毎日一問。", "/quiz"), (qualification["name"], f"/quiz/{qualification['id']}"), ("問題集", practice_route(qualification["id"], bank_page)), (detail_label, None)]
    else:
        detail_label = f"{jp_date(question['date'])}の問題"
        crumbs = [("毎日一問。", "/quiz"), (qualification["name"], f"/quiz/{qualification['id']}"), (detail_label, None)]
    body = f"""<main class="page-main quiz-main">
  <div class="page-width quiz-detail-width">
    {breadcrumb(crumbs)}
    <article class="quiz-detail" data-quiz>
      <header class="quiz-detail-header quiz-accent-{qualification['accent']}">
        <div class="quiz-card-heading"><span class="quiz-icon" aria-hidden="true">{escape(qualification['icon'])}</span><p>{escape(qualification['name'])}</p></div>
        <h1>{escape(qualification['name'])}｜{escape(detail_label)}</h1>
        {meta(question)}
      </header>
      <section class="quiz-question-block" aria-labelledby="question-heading">
        <p class="section-kicker">QUESTION</p>
        <h2 id="question-heading">{escape(question['title'])}</h2>
        <p class="quiz-question-text">{escape(question['question'])}</p>
        <div class="quiz-choices" role="group" aria-label="4つの選択肢">{choices}</div>
        <button class="quiz-reveal-button" type="button" data-quiz-reveal aria-controls="quiz-answer">答えを見る</button>
      </section>
      <section class="quiz-answer" id="quiz-answer" data-quiz-answer hidden aria-live="polite">
        <p class="section-kicker">ANSWER &amp; EXPLANATION</p>
        <h2>正解：{escape(question['correctAnswer'])}</h2>
        <p>{escape(question['explanation']['correct'])}</p>
        <h3>選択肢のポイント</h3><ul class="quiz-explanation-list">{explanations}</ul>
        <h3>関連キーワード</h3><ul class="quiz-keywords">{keyword_list}</ul>
        {related_html}
        <p class="quiz-source">参考にした公式情報：{source} / 確認日：{jp_date(question['checkedAt'])}</p>
      </section>
      <aside class="quiz-origin-note" aria-label="この問題について">
        <h2>この問題について</h2>
        <p>本コンテンツの問題は、各資格・試験の公開情報や出題範囲などを参考に、生成AIを活用して作成したオリジナル練習問題です。実際の試験問題や過去に出題された問題、各試験実施団体が提供する問題を再現したものではありません。</p>
      </aside>
    </article>
    <nav class="quiz-next-nav" aria-label="問題の移動">{previous_link}{next_link}<a href="{practice_route(qualification['id'], bank_page)}">この資格の問題集</a><a href="/quiz/{qualification['id']}">資格トップ</a><a href="/quiz">毎日一問。トップ</a></nav>
  </div>
</main>"""
    description = (
        f"{qualification['name']}の{question['category']}を学ぶオリジナル4択問題「{question['title']}」。"
        "答え・解説と、関連する用語の意味や使われる場面を確認できます。"
    )
    return document(
        f"{qualification['name']}｜{detail_label}", description, body,
        "../" * depth + "scripts/daily-quiz.js", breadcrumb_schema(crumbs),
    )


def update_sitemap(routes: list[str], changed_routes: set[str]) -> None:
    path = ROOT / "sitemap.xml"
    text = path.read_text(encoding="utf-8")
    quiz_url = re.compile(
        r"^  <url><loc>(https://mainichi-miru\.com/quiz[^<]*)</loc><lastmod>(\d{4}-\d{2}-\d{2})</lastmod></url>\n?",
        re.MULTILINE,
    )
    previous_dates = dict(quiz_url.findall(text))
    text = quiz_url.sub("", text)
    today = datetime.now(TOKYO).date().isoformat()
    for route in routes:
        loc = f"{SITE_URL}{route}"
        if loc not in text:
            lastmod = today if route in changed_routes else previous_dates.get(loc, today)
            text = text.replace("</urlset>", f"  <url><loc>{loc}</loc><lastmod>{lastmod}</lastmod></url>\n</urlset>")
    path.write_text(text, encoding="utf-8")


def update_redirects(routes: list[str]) -> None:
    path = ROOT / "_redirects"
    text = path.read_text(encoding="utf-8")
    lines = ["# DAILY_QUIZ_REDIRECTS_START"]
    for route in routes:
        if route == "/":
            continue
        lines.append(f"{route} {route}/index.html 200")
    lines.append("# DAILY_QUIZ_REDIRECTS_END")
    block = "\n".join(lines)
    pattern = re.compile(r"# DAILY_QUIZ_REDIRECTS_START.*?# DAILY_QUIZ_REDIRECTS_END", re.DOTALL)
    if pattern.search(text):
        text = pattern.sub(block, text)
    else:
        text = text.rstrip() + "\n\n" + block + "\n"
    path.write_text(text, encoding="utf-8")


def validate(data: dict) -> None:
    qualification_ids = {item["id"] for item in data["qualifications"]}
    required = {"id", "qualification", "date", "title", "category", "difficulty", "question", "choices", "correctAnswer", "explanation", "keywords", "sourceName", "sourceUrl", "checkedAt"}
    seen_ids = set()
    seen_routes = set()
    for question in data["questions"]:
        missing = required - question.keys()
        if missing or question["qualification"] not in qualification_ids:
            raise ValueError(f"Invalid question data: {question.get('id', '?')}")
        if [choice["id"] for choice in question["choices"]] != ["A", "B", "C", "D"]:
            raise ValueError(f"Question must have A-D choices: {question['id']}")
        if question["correctAnswer"] not in {"A", "B", "C", "D"}:
            raise ValueError(f"Unknown correct answer: {question['id']}")
        if "slug" in question and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", question["slug"]):
            raise ValueError(f"Invalid question slug: {question['id']}")
        route = route_for(question)
        if question["id"] in seen_ids or route in seen_routes:
            raise ValueError(f"Duplicate question: {question['id']}")
        seen_ids.add(question["id"])
        seen_routes.add(route)
        date.fromisoformat(question["date"])
        if not question["sourceUrl"].startswith("https://") or set(question["explanation"]["choices"]) != {"A", "B", "C", "D"}:
            raise ValueError(f"Incomplete source or explanation: {question['id']}")


def write_page(path: Path, content: str, depth: int) -> bool:
    previous = path.read_text(encoding="utf-8") if path.exists() else None
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(with_prefix(content, depth), encoding="utf-8")
    apply_layout_to_file(path)
    return path.read_text(encoding="utf-8") != previous


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    validate(data)
    questions_by_qualification = {item["id"]: [] for item in data["qualifications"]}
    for question in data["questions"]:
        questions_by_qualification[question["qualification"]].append(question)
    for items in questions_by_qualification.values():
        items.sort(key=lambda item: item["date"], reverse=True)
    day = rotation_day(datetime.now(TOKYO))
    featured = {
        qualification["id"]: featured_question(questions_by_qualification[qualification["id"]], qualification["id"], day)
        for qualification in data["qualifications"]
    }
    routes = ["/quiz"]
    changed_routes = set()

    if write_page(QUIZ_DIR / "index.html", render_hub(data, featured, questions_by_qualification, day), 1):
        changed_routes.add("/quiz")
    (QUIZ_DIR / "daily-rotation.json").write_text(
        json.dumps(rotation_payload(data, questions_by_qualification, day), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    for qualification in data["qualifications"]:
        questions = questions_by_qualification[qualification["id"]]
        qualification_path = QUIZ_DIR / qualification["id"] / "index.html"
        qualification_route = f"/quiz/{qualification['id']}"
        if write_page(qualification_path, render_qualification(data, qualification, questions, featured[qualification["id"]], day), 2):
            changed_routes.add(qualification_route)
        routes.append(qualification_route)
        page_count = (len(questions) + PRACTICE_PAGE_SIZE - 1) // PRACTICE_PAGE_SIZE
        for page in range(1, page_count + 1):
            page_route = practice_route(qualification["id"], page)
            page_path = QUIZ_DIR / qualification["id"] / "practice"
            if page > 1:
                page_path /= str(page)
            if write_page(page_path / "index.html", render_practice(qualification, questions, page), 3 if page == 1 else 4):
                changed_routes.add(page_route)
            routes.append(page_route)
        bank_pages = {
            item["id"]: index // PRACTICE_PAGE_SIZE + 1
            for index, item in enumerate(sorted(questions, key=lambda item: (item["date"], item["id"])))
        }
        for index, question in enumerate(questions):
            detail_route = route_for(question)
            detail_path = ROOT / detail_route.lstrip("/") / "index.html"
            depth = len(Path(detail_route.lstrip("/")).parts)
            previous = questions[index + 1] if index + 1 < len(questions) else None
            next_question = questions[index - 1] if index else None
            if write_page(detail_path, render_detail(
                qualification, question, previous, next_question, depth,
                bank_pages[question["id"]], related_terms(question, questions),
            ), depth):
                changed_routes.add(detail_route)
            routes.append(detail_route)

    update_sitemap(routes, changed_routes)
    update_redirects(routes)
    print(f"Generated {len(routes)} daily quiz pages from {DATA_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
