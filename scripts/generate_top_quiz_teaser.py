#!/usr/bin/env python3
"""Render the small daily-quiz preview on the home page from quiz data."""

from __future__ import annotations

import html
import json
import re
from datetime import datetime
from pathlib import Path

import generate_daily_quiz as quiz


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "index.html"
START = "<!-- DAILY_QUIZ_TEASER_START -->"
END = "<!-- DAILY_QUIZ_TEASER_END -->"
MARKER = re.compile(rf"^[ \t]*{re.escape(START)}[\s\S]*?^[ \t]*{re.escape(END)}", re.MULTILINE)


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def render_card(question: dict, qualification: dict) -> str:
    return f'''          <article class="daily-quiz-teaser-card quiz-accent-{esc(qualification['accent'])}" data-home-quiz-card>
            <div class="daily-quiz-teaser-card__heading">
              <span class="daily-quiz-teaser-card__icon" aria-hidden="true">{esc(qualification['icon'])}</span>
              <h3><a href="/quiz/{esc(qualification['id'])}">{esc(qualification['name'])}</a></h3>
            </div>
            <p class="daily-quiz-teaser-card__meta"><span>{esc(question['category'])}</span><span>{esc(question['difficulty'])}</span></p>
            <p class="daily-quiz-teaser-card__question">{esc(question['question'])}</p>
            <a class="daily-quiz-teaser-card__link" href="{esc(quiz.route_for(question))}">今日の問題を解く →</a>
          </article>'''


def render(data: dict, featured: dict[str, dict], day: str) -> str:
    cards = "\n".join(
        render_card(featured[qualification["id"]], qualification)
        for qualification in data["qualifications"]
    )
    return f'''      {START}
      <section id="daily-quiz-teaser" class="daily-quiz-teaser" aria-labelledby="daily-quiz-teaser-title" data-home-quiz-day="{day}">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Daily Quiz</p>
            <h2 id="daily-quiz-teaser-title">毎日一問。</h2>
          </div>
          <a class="text-link" href="quiz">問題集を見る →</a>
        </div>
        <p class="daily-quiz-teaser-lead">AI・IT資格を、今日も一問ずつ。気になるところから、気軽にどうぞ。</p>
        <div class="daily-quiz-teaser-grid" data-home-quiz-grid>
{cards}
        </div>
      </section>
      {END}'''


def main() -> None:
    data = json.loads(quiz.DATA_PATH.read_text(encoding="utf-8"))
    quiz.validate(data)
    day = quiz.rotation_day(datetime.now(quiz.TOKYO))
    by_qualification = {qualification["id"]: [] for qualification in data["qualifications"]}
    for question in data["questions"]:
        by_qualification[question["qualification"]].append(question)
    featured = {
        qualification["id"]: quiz.featured_question(
            by_qualification[qualification["id"]], qualification["id"], day
        )
        for qualification in data["qualifications"]
    }
    current = INDEX_PATH.read_text(encoding="utf-8")
    if not MARKER.search(current):
        raise RuntimeError("Daily quiz teaser markers were not found in index.html")
    INDEX_PATH.write_text(MARKER.sub(render(data, featured, day.isoformat()), current, count=1), encoding="utf-8")
    print(f"Updated the home daily quiz teaser for {day.isoformat()}")


if __name__ == "__main__":
    main()
