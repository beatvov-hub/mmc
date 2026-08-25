#!/usr/bin/env python3
from __future__ import annotations

import html
import json
from pathlib import Path
from urllib.parse import urlparse

from generate_members import STAFF
from site_layout import apply_layout_to_file

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "src" / "data" / "faqItems.json"
OUTPUT_PATH = ROOT / "about" / "faq" / "index.html"

PAGE_TITLE = "よくあるようで、聞かれたことはない質問集｜毎日見る株式会社"
PAGE_DESCRIPTION = "毎日見る株式会社について、AI社員、会社の仕組み、Bean & Bits、制作物、犬の立場まで。よく聞かれそうなことから、たぶん誰も聞かないことまで答えます。"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def valid_href(value: str) -> bool:
    parsed = urlparse(value)
    return not parsed.scheme and not parsed.netloc and not value.startswith("//")


def replace_tokens(value: str, tokens: dict[str, str]) -> str:
    for token, replacement in tokens.items():
        value = value.replace(f"{{{{{token}}}}}", replacement)
    return value


def load_data() -> dict:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    categories = data.get("categories")
    items = data.get("items")
    if not isinstance(categories, list) or not isinstance(items, list):
        raise ValueError("FAQデータのcategoriesとitemsは配列にしてください。")
    category_ids = {category.get("id") for category in categories}
    if len(category_ids) != len(categories) or not all(category_ids):
        raise ValueError("FAQカテゴリIDが重複または不足しています。")
    item_ids = set()
    for item in items:
        if not isinstance(item, dict) or not item.get("id") or not item.get("question"):
            raise ValueError("FAQ項目にはidとquestionが必要です。")
        if item["id"] in item_ids:
            raise ValueError(f"FAQ項目IDが重複しています: {item['id']}")
        if item.get("category") not in category_ids:
            raise ValueError(f"FAQカテゴリが不正です: {item.get('category')}")
        if not isinstance(item.get("answer"), list) or not item["answer"]:
            raise ValueError(f"FAQ回答が不正です: {item['id']}")
        item_ids.add(item["id"])
    return data


def render_tabs(categories: list[dict]) -> str:
    return "\n".join(
        f'''          <button class="faq-tab" type="button" role="tab" id="faq-tab-{esc(category['id'])}" aria-selected="{'true' if index == 0 else 'false'}" aria-controls="{esc(category['id'])}" data-faq-tab="{esc(category['id'])}" tabindex="{'0' if index == 0 else '-1'}">{esc(category['tabLabel'])}</button>'''
        for index, category in enumerate(categories)
    )


def render_links(links: list[dict]) -> str:
    if not links:
        return ""
    rendered = []
    for link in links:
        href = str(link.get("href", ""))
        label = str(link.get("label", ""))
        if not label or not valid_href(href):
            continue
        rendered.append(f'<a href="{esc(href)}">{esc(label)} <span aria-hidden="true">→</span></a>')
    if not rendered:
        return ""
    return f'\n              <p class="faq-answer-links">{"".join(rendered)}</p>'


def render_item(item: dict, tokens: dict[str, str]) -> str:
    answer = "\n".join(
        f"              <p>{esc(replace_tokens(str(paragraph), tokens))}</p>"
        for paragraph in item["answer"]
    )
    links = render_links(item.get("links", []))
    return f'''          <details class="faq-item" id="{esc(item['id'])}">
            <summary>{esc(item['question'])}</summary>
            <div class="faq-answer">
{answer}{links}
            </div>
          </details>'''


def render_category(category: dict, items: list[dict], index: int, tokens: dict[str, str]) -> str:
    faq_items = "\n".join(render_item(item, tokens) for item in items if item["category"] == category["id"])
    return f'''        <section class="faq-level" id="{esc(category['id'])}" role="tabpanel" aria-labelledby="faq-tab-{esc(category['id'])}" data-faq-panel="{esc(category['id'])}" tabindex="-1">
          <header class="faq-level-heading">
            <p class="section-kicker">{esc(category['level'])}</p>
            <h2>{esc(category['title'])}</h2>
            <p>{esc(category['description'])}</p>
          </header>
          <div class="faq-list">
{faq_items}
          </div>
        </section>'''


def render_json_ld(categories: list[dict], items: list[dict], tokens: dict[str, str]) -> str:
    page_url = "https://mainichi-miru.com/about/faq"
    faq_entities = [
        {
            "@type": "Question",
            "name": item["question"],
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "\n\n".join(replace_tokens(str(paragraph), tokens) for paragraph in item["answer"]),
            },
        }
        for item in items
    ]
    structured = [
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://mainichi-miru.com/"},
                {"@type": "ListItem", "position": 2, "name": "会社概要", "item": "https://mainichi-miru.com/about"},
                {"@type": "ListItem", "position": 3, "name": "よくあるようで、聞かれたことはない質問集", "item": page_url},
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faq_entities,
        },
    ]
    return json.dumps(structured, ensure_ascii=False).replace("</", "<\\/")


def render_page(data: dict) -> str:
    categories = data["categories"]
    items = data["items"]
    tokens = {
        "employeeCount": str(
            sum(1 for member in STAFF.values() if member.get("slug") != "pechi")
        )
    }
    panels = "\n".join(render_category(category, items, index, tokens) for index, category in enumerate(categories))
    return f'''<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(PAGE_TITLE)}</title>
    <meta name="description" content="{esc(PAGE_DESCRIPTION)}" />
    <meta property="og:title" content="{esc(PAGE_TITLE)}" />
    <meta property="og:description" content="{esc(PAGE_DESCRIPTION)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://mainichi-miru.com/about/faq" />
    <meta property="og:site_name" content="毎日見る株式会社" />
    <meta property="og:image" content="https://mainichi-miru.com/image/about001.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="../../favicon.ico" />
    <link rel="stylesheet" href="../../styles.css" />
    <script type="application/ld+json">{render_json_ld(categories, items, tokens)}</script>
  </head>
  <body class="subpage about-page faq-page">
    <main class="page-main faq-main">
      <nav class="profile-breadcrumb faq-breadcrumb" aria-label="パンくずリスト">
        <a href="../../index.html">ホーム</a>
        <a href="../../about.html">会社概要</a>
        <strong>よくあるようで、聞かれたことはない質問集</strong>
      </nav>

      <section class="faq-hero" aria-labelledby="faq-page-title">
        <p class="section-kicker">Company Guide</p>
        <h1 id="faq-page-title">よくあるようで、聞かれたことはない質問集</h1>
        <p class="faq-catch">誰にも聞かれていないかもしれませんが、答えておきます。</p>
        <div class="faq-intro">
          <p>毎日見る株式会社について、よく聞かれそうなことから、今後もおそらく聞かれないことまでまとめました。</p>
          <p>AI社員のこと、会社の仕組み、Bean &amp; Bits、制作物、そして犬の立場まで。気になるところからどうぞ。</p>
        </div>
      </section>

      <nav class="faq-tabs" role="tablist" aria-label="質問集のカテゴリ" data-faq-tabs>
{render_tabs(categories)}
      </nav>

      <div class="faq-levels" data-faq-levels>
{panels}
      </div>

      <p class="faq-back"><a class="secondary-button" href="../../about.html">会社概要に戻る</a></p>
    </main>
    <script src="../../scripts/faq-tabs.js"></script>
  </body>
</html>
'''


def main() -> None:
    data = load_data()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_page(data), encoding="utf-8")
    apply_layout_to_file(OUTPUT_PATH)
    print(f"Generated FAQ page with {len(data['items'])} questions from {len(data['categories'])} categories.")


if __name__ == "__main__":
    main()
