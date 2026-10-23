#!/usr/bin/env python3
from __future__ import annotations

import html
import json
from pathlib import Path

from site_layout import apply_layout_to_file

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data" / "beanBitsMarketProducts.json"
OUT = ROOT / "lounge" / "market" / "index.html"


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def render() -> str:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    products = data["products"]
    categories = data["categories"]
    by_category = {
        category["id"]: [p for p in products if p["category"] == category["id"]]
        for category in categories
    }
    nav = "\n".join(
        f'<a href="#{esc(c["id"])}"><span>{esc(c["name"])}</span><small>{len(by_category[c["id"]])} ITEMS</small></a>'
        for c in categories
    )
    sections = []
    for category in categories:
        cards = []
        for product in by_category[category["id"]]:
            images = [product["image"]]
            if product.get("detailImage"):
                images.append(product["detailImage"])
            image_markup = "".join(
                f'<img src="assets/{esc(image)}" alt="{esc(product["alt"])}{("・別アングル" if i else "")}" loading="lazy" decoding="async" />'
                for i, image in enumerate(images)
            )
            gallery_class = " market-card__photos market-card__photos--pair" if len(images) > 1 else " market-card__photos"
            cards.append(
                f'''<article class="market-card">
  <div class="{gallery_class.strip()}">{image_markup}</div>
  <div class="market-card__body">
    <h3>{esc(product["name"])}</h3>
    <p class="market-card__price"><strong>{int(product["price"])}</strong><span>MMC</span></p>
  </div>
</article>'''
            )
        note = (
            '<p class="market-section__note">ペチのための専用コーナー。価格や商品はラウンジの創作設定です。</p>'
            if category["id"] == "pechi"
            else ""
        )
        note_line = f"  {note}\n" if note else ""
        sections.append(
            f'''<section class="market-section" id="{esc(category["id"])}" aria-labelledby="heading-{esc(category["id"])}">
  <header class="market-section__heading"><div><p class="market-eyebrow">{esc(category["eyebrow"])}</p><h2 id="heading-{esc(category["id"])}">{esc(category["name"])}</h2></div><span>{len(by_category[category["id"]]):02d} ITEMS</span></header>
{note_line}  <div class="market-grid">{"".join(cards)}</div>
</section>'''
        )

    return f'''<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bean &amp; Bits MARKET｜ラウンジショップ｜毎日見るコワークス</title>
  <meta name="description" content="Bean &amp; Bits MARKETは、毎日見るコワークスの社員ラウンジにある架空のショップです。文房具やおやつなど、商品写真とMMCの価格をご紹介します。" />
  <link rel="stylesheet" href="../../styles.css?v=20261024-market" />
  <link rel="stylesheet" href="market.css?v=20261024" />
</head>
<body class="subpage market-page">
  <main class="page-main market-main">
    <nav class="market-breadcrumb" aria-label="パンくずリスト"><a href="../../lounge">社員ラウンジ</a><span aria-hidden="true">/</span><span>Bean &amp; Bits MARKET</span></nav>
    <section class="market-hero" aria-labelledby="market-title">
      <img class="market-hero__image" src="assets/bean-bits-market-shelf-products.webp" alt="Bean &amp; Bits MARKETの棚に文房具やおやつが並ぶ店内" fetchpriority="high" />
      <div class="market-hero__shade"></div>
      <div class="market-hero__copy"><p class="market-eyebrow">A LITTLE SHOP IN THE LOUNGE</p><h1 id="market-title">Bean &amp; Bits<br /><span>MARKET</span></h1><p>働く場所に、ちょっとした買い物の楽しみを。</p></div>
      <span class="market-hero__seal">OPEN<br /><strong>IN MMC</strong></span>
    </section>
    <section class="market-intro" aria-label="ショップについて">
      <div><p class="market-eyebrow">WELCOME TO OUR MARKET</p><h2>ラウンジの片隅にある、<br />小さなお店。</h2></div>
      <div class="market-intro__copy"><p>Bean &amp; Bits MARKETは、毎日見るコワークスの社員ラウンジに併設された、創作世界のショップです。文房具や仕事道具、軽食、ペチのおやつなど、社員たちの日常に並ぶ品々を写真と一緒に紹介します。</p><p>表示価格の単位は、社内通貨として設定されたMMCです。ここで紹介する商品や買い物は物語の中の設定で、現実の商品販売・発送・決済は行っていません。</p></div>
    </section>
    <nav class="market-category-nav" aria-label="商品カテゴリー">{nav}</nav>
    <div class="market-collection">{"".join(sections)}</div>
    <aside class="market-notice"><span aria-hidden="true">✳</span><div><h2>このお店について</h2><p>Bean &amp; Bits MARKETはMMCの創作世界に登場する架空の社内ショップです。価格は架空の社内通貨MMCで、日本円との換算はありません。商品購入、実物の提供、発送、金銭取引は行っていません。</p></div></aside>
    <a class="market-back" href="../../lounge">← 社員ラウンジへ戻る</a>
  </main>
</body>
</html>
'''


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render(), encoding="utf-8")
    apply_layout_to_file(OUT)
    print(f"Generated {OUT.relative_to(ROOT)} from {DATA.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
