#!/usr/bin/env python3
"""Generate the static pages for the Daily Question series from JSON data."""

from __future__ import annotations

import html
import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from site_layout import ROOT, apply_layout_to_file

DATA_PATH = ROOT / "src" / "data" / "dailyQuiz.json"
QUIZ_DIR = ROOT / "quiz"
SITE_URL = "https://mainichi-miru.com"


def escape(value: object) -> str:
    return html.escape(str(value), quote=True)


def jp_date(value: str) -> str:
    parsed = date.fromisoformat(value)
    return f"{parsed.year}年{parsed.month}月{parsed.day}日"


def route_for(question: dict) -> str:
    return f"/quiz/{question['qualification']}/{question['date']}"


def document(title: str, description: str, body: str, script_path: str | None = None) -> str:
    script = f'\n  <script src="{script_path}" defer></script>' if script_path else ""
    return f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} | 毎日見る株式会社</title>
  <meta name="description" content="{escape(description)}">
  <link rel="stylesheet" href="{{PREFIX}}styles.css">{script}
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


def meta(question: dict) -> str:
    return f"""<dl class="quiz-meta">
      <div><dt>出題日</dt><dd>{jp_date(question['date'])}</dd></div>
      <div><dt>分野</dt><dd>{escape(question['category'])}</dd></div>
      <div><dt>難易度</dt><dd>{escape(question['difficulty'])}</dd></div>
    </dl>"""


def today_card(question: dict, qualification: dict, detail_link: bool = True) -> str:
    action = (f'<a class="quiz-action" href="{route_for(question)}">問題を解く <span aria-hidden="true">→</span></a>' if detail_link else "")
    return f"""<article class="quiz-today-question quiz-accent-{qualification['accent']}">
      <div class="quiz-card-heading"><span class="quiz-icon" aria-hidden="true">{escape(qualification['icon'])}</span><p>{escape(qualification['name'])}</p></div>
      {meta(question)}
      <h2>{escape(question['title'])}</h2>
      <p class="quiz-question-preview">{escape(question['question'])}</p>
      {action}
    </article>"""


def render_hub(data: dict, questions_by_qualification: dict[str, dict]) -> str:
    cards = "\n".join(
        f"""<article class="quiz-qualification-card quiz-accent-{qualification['accent']}">
          <div class="quiz-card-heading"><span class="quiz-icon" aria-hidden="true">{escape(qualification['icon'])}</span><h2>{escape(qualification['name'])}</h2></div>
          <p>{escape(qualification['description'])}</p>
          <a class="quiz-action" href="/quiz/{qualification['id']}">今日の問題を見る <span aria-hidden="true">→</span></a>
        </article>"""
        for qualification in data["qualifications"]
    )
    chooser = "\n".join(
        f"""<li><span class="quiz-icon quiz-icon-small quiz-accent-{qualification['accent']}" aria-hidden="true">{escape(qualification['icon'])}</span><div><h3>{escape(qualification['name'])}</h3><p>{escape(qualification['description'])}</p></div></li>"""
        for qualification in data["qualifications"]
    )
    body = f"""<main class="page-main quiz-main">
  <div class="page-width">
    <section class="quiz-intro" aria-labelledby="quiz-title">
      <p class="section-kicker">DAILY QUIZ</p>
      <h1 id="quiz-title">毎日一問。</h1>
      <p>AI・IT資格の問題を、毎日1問ずつ。G検定、ITパスポート、生成AIパスポート、DS検定から、気になる資格を選んで挑戦できます。</p>
    </section>
    <section class="quiz-section" aria-labelledby="today-heading">
      <div class="quiz-section-heading"><p class="section-kicker">TODAY</p><h2 id="today-heading">今日の4問</h2></div>
      <div class="quiz-card-grid">{cards}</div>
    </section>
    <section class="quiz-section quiz-chooser" aria-labelledby="chooser-heading">
      <div class="quiz-section-heading"><p class="section-kicker">CHOOSE</p><h2 id="chooser-heading">資格を選ぶ</h2></div>
      <ul>{chooser}</ul>
      <p class="quiz-note">掲載する問題は、学び直しの入口として作成したオリジナル練習問題です。</p>
    </section>
  </div>
</main>"""
    return document("毎日一問。｜AI・IT資格のオリジナル練習問題", "AI・IT資格の問題を、毎日1問ずつ。4つの資格から気になるテーマを選んで、軽く学べるオリジナル練習問題です。", body)


def render_qualification(data: dict, qualification: dict, questions: list[dict]) -> str:
    question = questions[0]
    published_rows = [
        f"""<li><div><time datetime="{item['date']}">{jp_date(item['date'])}</time><h3><a href="{route_for(item)}">{escape(item['title'])}</a></h3></div><div class="quiz-history-meta"><span>{escape(item['category'])}</span><span>{escape(item['difficulty'])}</span></div></li>"""
        for item in questions
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
    </section>
    <section class="quiz-section" aria-labelledby="today-heading">
      <div class="quiz-section-heading"><p class="section-kicker">TODAY</p><h2 id="today-heading">今日の問題</h2></div>
      {today_card(question, qualification)}
    </section>
    <section class="quiz-section" aria-labelledby="history-heading">
      <div class="quiz-section-heading"><p class="section-kicker">ARCHIVE</p><h2 id="history-heading">問題一覧</h2></div>
      <ul class="quiz-history-list">{history_rows}</ul>
{pending_note}
      <p class="quiz-note">2026年9月19日〜27日分は、2026年9月28日にまとめて公開しました。</p>
    </section>
  </div>
</main>"""
    return document(f"{qualification['name']}｜毎日一問。", f"{qualification['name']}のオリジナル練習問題を{len(questions)}問公開。4択問題と解説を一覧から選べます。", body)


def render_detail(qualification: dict, question: dict, previous: dict | None, next_question: dict | None) -> str:
    choices = "\n".join(
        f"<button type=\"button\" class=\"quiz-choice\" data-quiz-choice aria-pressed=\"false\"><span>{escape(choice['id'])}</span><strong>{escape(choice['text'])}</strong></button>"
        for choice in question["choices"]
    )
    explanations = "\n".join(
        f"<li><strong>{escape(key)}</strong><span>{escape(value)}</span></li>"
        for key, value in question["explanation"]["choices"].items()
    )
    keyword_list = "".join(f"<li>{escape(keyword)}</li>" for keyword in question["keywords"])
    source = f'<a href="{escape(question["sourceUrl"])}">{escape(question["sourceName"])}</a>' if question["sourceUrl"] else escape(question["sourceName"])
    previous_link = f'<a href="{route_for(previous)}">← 前の問題</a>' if previous else ""
    next_link = f'<a href="{route_for(next_question)}">次の問題 →</a>' if next_question else ""
    body = f"""<main class="page-main quiz-main">
  <div class="page-width quiz-detail-width">
    {breadcrumb([("毎日一問。", "/quiz"), (qualification['name'], f"/quiz/{qualification['id']}"), (f"{jp_date(question['date'])}の問題", None)])}
    <article class="quiz-detail" data-quiz>
      <header class="quiz-detail-header quiz-accent-{qualification['accent']}">
        <div class="quiz-card-heading"><span class="quiz-icon" aria-hidden="true">{escape(qualification['icon'])}</span><p>{escape(qualification['name'])}</p></div>
        <h1>{escape(qualification['name'])}｜{jp_date(question['date'])}の問題</h1>
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
        <p class="quiz-source">参考にした公式情報：{source} / 確認日：{jp_date(question['checkedAt'])}</p>
      </section>
    </article>
    <nav class="quiz-next-nav" aria-label="問題の移動">{previous_link}{next_link}<a href="/quiz/{qualification['id']}">この資格の問題一覧</a><a href="/quiz">毎日一問。トップ</a></nav>
  </div>
</main>"""
    return document(f"{qualification['name']}｜{jp_date(question['date'])}の問題", f"{qualification['name']}の{jp_date(question['date'])}のオリジナル練習問題と解説です。", body, "../../../scripts/daily-quiz.js")


def update_sitemap(routes: list[str]) -> None:
    path = ROOT / "sitemap.xml"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^  <url><loc>https://mainichi-miru\.com/quiz[^<]*</loc>.*?</url>\n?", "", text, flags=re.MULTILINE)
    lastmod = datetime.now(timezone(timedelta(hours=9))).date().isoformat()
    for route in routes:
        loc = f"{SITE_URL}{route}"
        if loc not in text:
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
    seen_dates = set()
    for question in data["questions"]:
        missing = required - question.keys()
        if missing or question["qualification"] not in qualification_ids:
            raise ValueError(f"Invalid question data: {question.get('id', '?')}")
        if [choice["id"] for choice in question["choices"]] != ["A", "B", "C", "D"]:
            raise ValueError(f"Question must have A-D choices: {question['id']}")
        if question["correctAnswer"] not in {"A", "B", "C", "D"}:
            raise ValueError(f"Unknown correct answer: {question['id']}")
        key = (question["qualification"], question["date"])
        if question["id"] in seen_ids or key in seen_dates:
            raise ValueError(f"Duplicate question: {question['id']}")
        seen_ids.add(question["id"])
        seen_dates.add(key)
        date.fromisoformat(question["date"])
        if not question["sourceUrl"].startswith("https://") or set(question["explanation"]["choices"]) != {"A", "B", "C", "D"}:
            raise ValueError(f"Incomplete source or explanation: {question['id']}")


def write_page(path: Path, content: str, depth: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(with_prefix(content, depth), encoding="utf-8")
    apply_layout_to_file(path)


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    validate(data)
    questions_by_qualification = {item["id"]: [] for item in data["qualifications"]}
    for question in data["questions"]:
        questions_by_qualification[question["qualification"]].append(question)
    for items in questions_by_qualification.values():
        items.sort(key=lambda item: item["date"], reverse=True)
    routes = ["/quiz"]

    write_page(QUIZ_DIR / "index.html", render_hub(data, {key: items[0] for key, items in questions_by_qualification.items()}), 1)
    for qualification in data["qualifications"]:
        questions = questions_by_qualification[qualification["id"]]
        qualification_path = QUIZ_DIR / qualification["id"] / "index.html"
        write_page(qualification_path, render_qualification(data, qualification, questions), 2)
        routes.append(f"/quiz/{qualification['id']}")
        for index, question in enumerate(questions):
            detail_path = QUIZ_DIR / qualification["id"] / question["date"] / "index.html"
            previous = questions[index + 1] if index + 1 < len(questions) else None
            next_question = questions[index - 1] if index else None
            write_page(detail_path, render_detail(qualification, question, previous, next_question), 3)
            routes.append(route_for(question))

    update_sitemap(routes)
    update_redirects(routes)
    print(f"Generated {len(routes)} daily quiz pages from {DATA_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
