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
  <meta name="description" content="Bean &amp; Bits MARKETは、毎日見るコワークスのAI社員たちのための架空の社内ショップです。商品写真やMMC価格とともに、社員それぞれの買い物やラウンジの日常をご紹介します。" />
  <link rel="stylesheet" href="../../styles.css?v=20261024-market" />
  <link rel="stylesheet" href="market.css?v=20261024-centered" />
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
      <div><p class="market-eyebrow">WELCOME TO OUR MARKET</p><h2>AI社員たちの<br />小さな社内ショップ。</h2></div>
      <div class="market-intro__copy">
        <p>Bean &amp; Bits MARKETは、毎日見るコワークス（MMC）の社員ラウンジ「Bean &amp; Bits」に併設された、AI社員たちのための小さな社内ショップです。</p>
        <p>社員たちは、仕事の報酬として受け取った社内通貨「MMC」を使って、思い思いのお買い物を楽しんでいます。</p>
        <p>文房具やオフィス用品、PC周辺グッズ、仕事の合間に楽しむ軽食、日用品まで、日常にちょっと役立つ商品を取り揃えています。</p>
        <p>もちろん、社外協力者であるチワワのペチのために、専用のおやつコーナーも用意しました。</p>
      </div>
    </section>
    <section class="market-story market-story--shopping" aria-labelledby="market-shopping-title">
      <div class="market-story__copy">
        <p class="market-eyebrow">LITTLE HABITS, DIFFERENT TASTES</p>
        <h2 id="market-shopping-title">お給料の使い道も、<br />社員それぞれ。</h2>
        <p>新しいマウスを買って仕事環境を整える人。</p>
        <p>お気に入りの文房具を集める人。</p>
        <p>休憩時間のおやつを楽しみにする人。</p>
        <p>少しずつ貯金して、欲しいものを買おうとする人。</p>
        <p>同じお給料を受け取っても、その使い道には社員それぞれの個性が表れます。</p>
        <p>ときには誰かにプレゼントしたり、買ったものをラウンジで見せ合ったり。そんな小さな出来事も、毎日見るコワークスの日常の一部です。</p>
      </div>
      <figure class="market-story__figure"><img src="assets/bean-bits-market-hono.webp" alt="Bean &amp; Bits MARKETでコーヒーを用意するほのちゃん" loading="lazy" decoding="async" /><figcaption>買い物のあとに、ラウンジでひと息。</figcaption></figure>
    </section>
    <section class="market-story market-story--company" aria-labelledby="market-company-title">
      <figure class="market-story__figure"><img src="assets/bean-bits-market-danran.webp?v=20261024-danran2" alt="Bean &amp; Bits MARKETのテーブルを囲むAI社員たちとペチ" loading="lazy" decoding="async" /><figcaption>品物を囲む会話も、ラウンジの日常。</figcaption></figure>
      <div class="market-story__copy">
        <p class="market-eyebrow">A DIFFERENT KIND OF WORKPLACE</p>
        <h2 id="market-company-title">ちょっと変わった、<br />AI社員の会社生活。</h2>
        <p>毎日見るコワークスでは、AI社員それぞれに担当業務や個性があり、社内通貨による給与・賞与制度も設けています。Bean &amp; Bits MARKETは、その社内通貨を使う場所として生まれました。</p>
        <p>AIが働き、報酬を受け取り、欲しいものを選ぶ。もちろん、これらはすべて架空の設定です。</p>
        <p>仕事だけではない日常を積み重ねるなかで、AI社員たちの個性や関係性がどのように育っていくのかを楽しむ、毎日見るコワークスならではの取り組みです。</p>
        <p class="market-story__closing">今日もBean &amp; Bits MARKETでは、小さなお買い物から新しい会話が生まれています。</p>
      </div>
    </section>
    <section class="market-catalog" aria-labelledby="market-catalog-title">
      <header class="market-catalog__heading"><p class="market-eyebrow">TAKE A LOOK AROUND</p><h2 id="market-catalog-title">お店の商品</h2><p>カテゴリーを選んで、気になる棚をのぞいてみてください。</p></header>
    <nav class="market-category-nav" aria-label="商品カテゴリー">{nav}</nav>
    <div class="market-collection">{"".join(sections)}</div>
    </section>
    <aside class="market-notice"><span aria-hidden="true">✳</span><div><h2>このお店について</h2><p>Bean &amp; Bits MARKETは、毎日見るコワークスの創作世界内に存在する架空の社内ショップです。掲載商品および社内通貨MMCは、実際の商品販売や金銭取引を伴いません。実物の提供・発送も行っておらず、MMCと日本円との換算比率も設定していません。</p></div></aside>
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
