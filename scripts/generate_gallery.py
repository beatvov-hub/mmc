#!/usr/bin/env python3
from __future__ import annotations

import html
import json
from pathlib import Path

from site_layout import apply_layout_to_file

ROOT = Path(__file__).resolve().parents[1]
GALLERY_DATA_PATH = ROOT / "src" / "data" / "galleryItems.json"
GALLERY_HTML_PATH = ROOT / "gallery.html"
BASE_URL = "https://mainichi-miru.com"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def load_items() -> list[dict]:
    items = json.loads(GALLERY_DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(items, list):
        raise ValueError("galleryItems.json must be a list.")
    required = [
        "id",
        "number",
        "title",
        "subtitle",
        "category",
        "sourceUrl",
        "detailUrl",
        "originalImage",
        "aiImage",
        "summary",
        "heiseiPoints",
        "goodPoints",
        "modernizePoints",
        "concept",
        "keiComment",
    ]
    for item in items:
        missing = [key for key in required if key not in item]
        if missing:
            raise ValueError(f"Gallery item missing keys {missing}: {item!r}")
    return items


def gallery_url(item: dict) -> str:
    detail = item["detailUrl"].removesuffix(".html")
    return f"{BASE_URL}/{detail}"


def render_global_nav(prefix: str, current: str) -> str:
    links = [
        ("index.html", "ホーム"),
        ("about.html", "会社概要"),
        ("members.html", "AI社員紹介"),
        ("works.html", "制作物"),
        ("lounge.html", "ラウンジ"),
        ("news.html", "ニュース"),
    ]
    parts = ['      <nav class="global-nav" aria-label="グローバルナビゲーション">']
    for href, label in links:
        attr = ' aria-current="page"' if href == current else ""
        parts.append(f'        <a href="{esc(prefix + href)}"{attr}>{esc(label)}</a>')
    parts.append("      </nav>")
    return "\n".join(parts)


def render_footer(prefix: str) -> str:
    links = [
        ("index.html", "ホーム"),
        ("about.html", "会社概要"),
        ("members.html", "AI社員紹介"),
        ("works.html", "制作物"),
        ("lounge.html", "ラウンジ"),
        ("news.html", "ニュース"),
        ("contact.html", "お問い合わせ"),
    ]
    lines = [
        '    <footer class="site-footer">',
        '      <div class="site-footer-inner">',
        '        <div class="site-footer-brand">',
        '          <strong>毎日見る<br />株式会社</strong>',
        '          <p>AIが働き、人間が考え、創造する。</p>',
        "        </div>",
        '        <nav class="site-footer-nav" aria-label="フッターナビゲーション">',
    ]
    for href, label in links:
        lines.append(f'          <a href="{esc(prefix + href)}">{esc(label)}</a>')
    lines.extend(
        [
            "        </nav>",
            "      </div>",
            '      <p class="site-footer-copy">© 毎日見る株式会社 Since 2026</p>',
            "    </footer>",
        ]
    )
    return "\n".join(lines)


def render_compare_shot(title: str, image: str, cls: str) -> str:
    return "\n".join(
        [
            f'              <figure class="gallery-shot {cls}">',
            f"                <figcaption>{esc(title)}</figcaption>",
            f'                <img src="{esc(image)}" alt="{esc(title)}" />',
            "              </figure>",
        ]
    )


def render_gallery_actions(item: dict) -> str:
    lines = [
        '            <div class="gallery-card-actions">',
        f'              <a class="mini-button mini-button-secondary" href="{esc(item["sourceUrl"])}" target="_blank" rel="noopener noreferrer">本家サイトを見る</a>',
        f'              <a class="mini-button" href="{esc(item["detailUrl"])}">AI化の詳細を見る</a>',
    ]
    redesign_url = item.get("redesignUrl")
    if redesign_url:
        lines.append(f'              <a class="mini-button" href="{esc(redesign_url)}">リデザインページを見る</a>')
    lines.append("            </div>")
    return "\n".join(lines)


def render_gallery_card(item: dict) -> str:
    return "\n".join(
        [
            '          <article class="gallery-card">',
            '            <div class="gallery-card-head">',
            f'              <span class="gallery-number">#{esc(item["number"])}</span>',
            f'              <span class="tag">{esc(item["category"])}</span>',
            "            </div>",
            f'            <h3>{esc(item["title"])}</h3>',
            f'            <p class="gallery-card-subtitle">{esc(item["subtitle"])}</p>',
            f'            <p class="gallery-card-summary">{esc(item["summary"])}</p>',
            '            <div class="gallery-compare">',
            render_compare_shot("本家サイト", item["originalImage"], "gallery-shot-original"),
            render_compare_shot("AI化リデザイン", item["aiImage"], "gallery-shot-ai"),
            "            </div>",
            render_gallery_actions(item),
            "          </article>",
        ]
    )


def render_gallery_main(items: list[dict]) -> str:
    lines = [
        '    <main class="page-main gallery-main">',
        '      <section class="page-hero gallery-hero">',
        "        <div>",
        '          <p class="section-kicker">Heisei AI Gallery</p>',
        "          <h1>平成AI化ギャラリー</h1>",
        "          <p class=\"page-lead\">懐かしいホームページ文化を、現代のUI/UXで再構成する広報部の実験企画です。古いサイトを笑うのではなく、当時の良さを残しながら、今の人にも伝わる形へ翻訳します。</p>",
        "        </div>",
        '        <aside class="page-note gallery-hero-note">',
        "          <strong>企画メモ</strong>",
        "          <p>本家への敬意を忘れず、良かったところから読み解きます。</p>",
        "        </aside>",
        "      </section>",
        "",
        '      <section class="content-section gallery-intro" aria-labelledby="gallery-intro-title">',
        "        <article class=\"split-section\">",
        '          <div class="section-copy">',
        '            <p class="section-kicker">About This Project</p>',
        '            <h2 id="gallery-intro-title">このギャラリーについて</h2>',
        "            <p>平成AI化ギャラリーは、平成初期〜2000年代前半のホームページ文化を題材に、現代のWebデザインへ再構成する企画です。</p>",
        "            <p>アクセスカウンター、掲示板、リンク集、キリ番、無料ホームページスペース。当時のWebにあった手作り感や交流の温度を、今のUI/UXでどう見せ直せるかを考えます。</p>",
        '            <ul class="pill-list"><li>手作り感</li><li>交流の温度</li><li>現代的な再編集</li></ul>',
        "          </div>",
        '          <div class="gallery-side-note">',
        "            <strong>Re: Heisei Web</strong>",
        "            <p>見やすさだけでなく、当時の空気まで残せるかを大事にしています。</p>",
        "          </div>",
        "        </article>",
        "      </section>",
        "",
        '      <section class="card-section gallery-list-section" aria-labelledby="gallery-list-title">',
        '        <div class="section-heading">',
        "          <div>",
        '            <p class="section-kicker">Gallery Index</p>',
        '            <h2 id="gallery-list-title">AI化ギャラリー一覧</h2>',
        "          </div>",
        "        </div>",
        '        <div class="gallery-grid">',
    ]
    for item in items:
        lines.append(render_gallery_card(item))
    lines.extend(
        [
            "        </div>",
            "      </section>",
            "",
            '      <section class="card-section gallery-policy" aria-labelledby="gallery-policy-title">',
            '        <div class="section-heading">',
            "          <div>",
            '            <p class="section-kicker">Policy</p>',
            '            <h2 id="gallery-policy-title">掲載方針</h2>',
            "          </div>",
            "        </div>",
            '        <div class="gallery-policy-card">',
            "          <p>このギャラリーは、過去のサイトを批評・嘲笑するものではありません。当時のWeb文化や制作者の工夫を尊重し、良かったところを読み解いたうえで、現代の見せ方へ再編集することを目的としています。</p>",
            "        </div>",
            "      </section>",
            "    </main>",
        ]
    )
    return "\n".join(lines)


def render_gallery_page(items: list[dict]) -> str:
    return "\n".join(
        [
            "<!doctype html>",
            '<html lang="ja">',
            "  <head>",
            '    <meta charset="utf-8" />',
            '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '    <title>平成AI化ギャラリー｜懐かしいホームページを現代UIで再構成｜毎日見る株式会社</title>',
            '    <meta name="description" content="平成AI化ギャラリーは、平成初期〜2000年代前半のホームページ文化を尊重しながら、現代のUI/UXで再設計する毎日見る株式会社 広報部の実験企画です。" />',
            '    <meta property="og:title" content="平成AI化ギャラリー｜懐かしいホームページを現代UIで再構成｜毎日見る株式会社" />',
            '    <meta property="og:description" content="平成AI化ギャラリーは、平成初期〜2000年代前半のホームページ文化を尊重しながら、現代のUI/UXで再設計する毎日見る株式会社 広報部の実験企画です。" />',
            '    <meta property="og:type" content="website" />',
            '    <meta property="og:url" content="https://mainichi-miru.com/gallery" />',
            '    <meta property="og:image" content="https://mainichi-miru.com/image/about003.jpg" />',
            '    <meta name="twitter:card" content="summary_large_image" />',
            '    <link rel="icon" href="favicon.ico" />',
            '    <link rel="stylesheet" href="styles.css" />',
            "  </head>",
            '  <body class="subpage gallery-page">',
            '    <header class="site-header" aria-label="サイトヘッダー">',
            '      <a class="brand" href="index.html" aria-label="毎日見る株式会社 ホーム">',
            '        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>',
            '        <span class="brand-text"><strong>毎日見る<br />株式会社</strong><small>Mainichi Miru Inc.</small></span>',
            "      </a>",
            render_global_nav("", "gallery.html"),
            '      <a class="contact-button" href="contact.html">お問い合わせ</a>',
            "    </header>",
            render_gallery_main(items),
            render_footer(""),
            "  </body>",
            "</html>",
            "",
        ]
    )


def render_list(items: list[str], class_name: str) -> str:
    lines = [f'          <ul class="{class_name}">']
    for item in items:
        lines.append(f"            <li>{esc(item)}</li>")
    lines.append("          </ul>")
    return "\n".join(lines)


def render_detail_page(item: dict) -> str:
    concept = item.get("concept", {})
    return "\n".join(
        [
            "<!doctype html>",
            '<html lang="ja">',
            "  <head>",
            '    <meta charset="utf-8" />',
            '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
            f'    <title>{esc(item["title"])}をAI化してみた｜平成AI化ギャラリー｜毎日見る株式会社</title>',
            f'    <meta name="description" content="{esc(item["summary"])}" />',
            f'    <meta property="og:title" content="{esc(item["title"])}をAI化してみた｜平成AI化ギャラリー｜毎日見る株式会社" />',
            f'    <meta property="og:description" content="{esc(item["summary"])}" />',
            '    <meta property="og:type" content="article" />',
            f'    <meta property="og:url" content="{esc(gallery_url(item))}" />',
            '    <meta property="og:image" content="https://mainichi-miru.com/image/about003.jpg" />',
            '    <meta name="twitter:card" content="summary_large_image" />',
            '    <link rel="icon" href="favicon.ico" />',
            '    <link rel="stylesheet" href="styles.css" />',
            "  </head>",
            '  <body class="subpage gallery-page gallery-detail-page">',
            '    <header class="site-header" aria-label="サイトヘッダー">',
            '      <a class="brand" href="index.html" aria-label="毎日見る株式会社 ホーム">',
            '        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>',
            '        <span class="brand-text"><strong>毎日見る<br />株式会社</strong><small>Mainichi Miru Inc.</small></span>',
            "      </a>",
            render_global_nav("", "gallery.html"),
            '      <a class="contact-button" href="contact.html">お問い合わせ</a>',
            "    </header>",
            '    <main class="gallery-detail-main">',
            '      <nav class="profile-breadcrumb" aria-label="パンくずリスト">',
            '        <a href="index.html">ホーム</a>',
            '        <span>平成AI化ギャラリー</span>',
            f'        <strong>{esc(item["title"])}</strong>',
            '        <a class="profile-back" href="gallery.html">ギャラリー一覧に戻る</a>',
            "      </nav>",
            '      <section class="page-hero gallery-detail-hero">',
            "        <div>",
            f'          <p class="section-kicker">Gallery {esc(item["number"])}</p>',
            f'          <h1>{esc(item["title"])}をAI化してみた</h1>',
            f'          <p class="page-lead">{esc(item["subtitle"])}</p>',
            "        </div>",
            '        <aside class="page-note gallery-hero-note">',
            "          <strong>本家への敬意</strong>",
            "          <p>良かったところを読み解いたうえで、今の人にも届く入口へ翻訳します。</p>",
            "        </aside>",
            "      </section>",
            '      <section class="gallery-detail-grid" aria-label="ギャラリー詳細">',
            '        <article class="gallery-detail-card gallery-detail-wide">',
            "          <h2>まず良かったところ</h2>",
            render_list(item.get("goodPoints", []), "gallery-point-list"),
            "        </article>",
            '        <article class="gallery-detail-card">',
            "          <h2>平成ポイント</h2>",
            render_list(item.get("heiseiPoints", []), "gallery-point-list"),
            "        </article>",
            '        <article class="gallery-detail-card">',
            "          <h2>現代化の方針</h2>",
            render_list(item.get("modernizePoints", []), "gallery-point-list"),
            "        </article>",
            '        <article class="gallery-detail-card gallery-detail-wide">',
            "          <h2>こだわりポイント</h2>",
            f'          <p>{esc(item["summary"])}</p>',
            "        </article>",
            '        <article class="gallery-detail-card gallery-detail-wide">',
            "          <h2>Before / After</h2>",
            '          <div class="gallery-compare gallery-compare-detail">',
            render_compare_shot("本家サイト", item["originalImage"], "gallery-shot-original"),
            render_compare_shot("AI化リデザイン", item["aiImage"], "gallery-shot-ai"),
            "          </div>",
            "        </article>",
            '        <article class="gallery-detail-card gallery-detail-wide gallery-concept-card">',
            "          <h2>新しくなったページはこうだ</h2>",
            f'          <strong>{esc(concept.get("name", ""))}</strong>',
            f'          <p class="gallery-concept-copy">{esc(concept.get("catchcopy", ""))}</p>',
            f'          <p>{esc(concept.get("description", ""))}</p>',
            "        </article>",
            '        <article class="gallery-detail-card gallery-detail-wide gallery-comment-card">',
            "          <h2>ケイ部長コメント</h2>",
            f'          <blockquote class="work-comment">{esc(item["keiComment"])}</blockquote>',
            "        </article>",
            "      </section>",
            '      <section class="work-detail-actions" aria-label="ギャラリー導線">',
            '        <a class="secondary-button" href="gallery.html">ギャラリー一覧に戻る</a>',
            f'        <a class="secondary-button work-public-button" href="{esc(item["sourceUrl"])}" target="_blank" rel="noopener noreferrer">本家サイトを見る</a>',
            "      </section>",
            "    </main>",
            render_footer(""),
            "  </body>",
            "</html>",
            "",
        ]
    )


def main() -> None:
    items = load_items()
    GALLERY_HTML_PATH.write_text(render_gallery_page(items), encoding="utf-8")
    apply_layout_to_file(GALLERY_HTML_PATH)
    for item in items:
        detail_path = ROOT / item["detailUrl"]
        detail_path.write_text(render_detail_page(item), encoding="utf-8")
        apply_layout_to_file(detail_path)
    print(f"Generated gallery.html and {len(items)} gallery detail pages.")


if __name__ == "__main__":
    main()
