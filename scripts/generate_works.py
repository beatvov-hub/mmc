#!/usr/bin/env python3
from __future__ import annotations

import html
import json
from pathlib import Path

from site_layout import apply_layout_to_file

ROOT = Path(__file__).resolve().parents[1]
WORKS_DATA_PATH = ROOT / "src" / "data" / "workStories.json"
WORKS_HTML_PATH = ROOT / "works.html"
WORKS_DIR = ROOT / "works"
BASE_URL = "https://mainichi-miru.com"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def load_works() -> list[dict]:
    works = json.loads(WORKS_DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(works, list):
        raise ValueError("workStories.json must be a list.")
    required = [
        "slug",
        "title",
        "category",
        "summary",
        "storySummary",
        "overview",
        "trigger",
        "background",
        "members",
        "statusLabel",
        "statusBody",
        "nextSteps",
        "keiComment",
    ]
    for work in works:
        missing = [key for key in required if key not in work]
        if missing:
            raise ValueError(f"Work is missing required keys {missing}: {work!r}")
        if not isinstance(work["members"], list):
            raise ValueError(f"members must be a list: {work['slug']}")
        if not isinstance(work["nextSteps"], list):
            raise ValueError(f"nextSteps must be a list: {work['slug']}")
    return works


def local_href(prefix: str, href: str) -> str:
    if href.startswith(("http://", "https://", "#", "mailto:", "tel:")):
        return href
    return f"{prefix}{href}"


def work_href(work: dict, prefix: str = "") -> str:
    return f"{prefix}works/{work['slug']}.html"


def work_url(work: dict) -> str:
    return f"{BASE_URL}/works/{work['slug']}"


def render_member_chips(work: dict) -> str:
    return "".join(f"<li>{esc(item.get('name', ''))}</li>" for item in work.get("members", []))


def render_member_details(work: dict) -> str:
    lines = ['          <ul class="work-member-list">']
    for item in work.get("members", []):
        lines.extend(
            [
                "            <li>",
                f"              <strong>{esc(item.get('name', ''))}</strong>",
                f"              <span>{esc(item.get('role', ''))}</span>",
                "            </li>",
            ]
        )
    lines.append("          </ul>")
    return "\n".join(lines)


def render_extra_sections(work: dict) -> list[str]:
    lines: list[str] = []
    for section in work.get("detailSections", []):
        classes = ["work-detail-card"]
        if section.get("wide", True):
            classes.append("work-detail-wide")
        if section.get("tone") == "caution":
            classes.append("work-detail-caution")
        lines.extend(
            [
                f'        <article class="{" ".join(classes)}">',
                f"          <h2>{esc(section.get('title', '補足'))}</h2>",
            ]
        )
        for paragraph in section.get("paragraphs", []):
            lines.append(f"          <p>{esc(paragraph)}</p>")
        items = section.get("items", [])
        if items:
            lines.append('          <ul class="work-next-list">')
            for item in items:
                lines.append(f"            <li>{esc(item)}</li>")
            lines.append("          </ul>")
        lines.append("        </article>")
    return lines


def detail_has_section(work: dict, title: str) -> bool:
    return any(section.get("title") == title for section in work.get("detailSections", []))


def render_work_paragraphs(paragraphs: list[object]) -> list[str]:
    return [f"          <p>{esc(paragraph)}</p>" for paragraph in paragraphs if str(paragraph).strip()]


def render_work_items(items: list[object]) -> list[str]:
    if not items:
        return []
    lines = ['          <ul class="work-next-list">']
    for item in items:
        lines.append(f"            <li>{esc(item)}</li>")
    lines.append("          </ul>")
    return lines


def rich_detail_sections(work: dict) -> list[dict]:
    sections: list[dict] = [
        {
            "id": "overview",
            "title": "作品概要",
            "lead": work.get("storySummary", ""),
            "paragraphs": [work.get("overview", "")],
            "wide": True,
        },
        {
            "id": "trigger",
            "title": "生まれたきっかけ",
            "paragraphs": [work.get("trigger", "")],
            "wide": True,
        },
        {
            "id": "background",
            "title": "制作背景",
            "paragraphs": [work.get("background", "")],
            "wide": True,
        },
    ]
    for index, section in enumerate(work.get("detailSections", []), start=1):
        sections.append(
            {
                "id": section.get("id") or f"detail-{index}",
                "title": section.get("title", "補足"),
                "lead": section.get("lead", ""),
                "paragraphs": section.get("paragraphs", []),
                "items": section.get("items", []),
                "wide": section.get("wide", True),
                "tone": section.get("tone", ""),
            }
        )
    sections.extend(
        [
            {
                "id": "members",
                "title": "担当AI社員",
                "kind": "members",
                "wide": False,
            },
            {
                "id": "status",
                "title": "現在の状態",
                "paragraphs": [work.get("statusBody", "")],
                "wide": False,
            },
        ]
    )
    if not detail_has_section(work, "今後やりたいこと"):
        sections.append(
            {
                "id": "next",
                "title": "今後やりたいこと",
                "items": work.get("nextSteps", []),
                "wide": False,
            }
        )
    sections.append(
        {
            "id": "kei-comment",
            "title": "ケイ部長コメント",
            "kind": "comment",
            "wide": True,
        }
    )
    return sections


def render_rich_detail_nav(sections: list[dict]) -> str:
    lines = [
        '        <aside class="work-side-nav" aria-label="ページ内目次">',
        "          <strong>目次</strong>",
        "          <nav>",
    ]
    for section in sections:
        lines.append(f'            <a href="#{esc(section["id"])}">{esc(section["title"])}</a>')
    lines.extend(["          </nav>", "        </aside>"])
    return "\n".join(lines)


def render_rich_detail_article(work: dict, section: dict) -> str:
    classes = ["work-detail-card"]
    if section.get("wide", True):
        classes.append("work-detail-wide")
    if section.get("tone") == "caution":
        classes.append("work-detail-caution")
    if section.get("id") == "overview":
        classes.append("work-detail-overview")
    if section.get("kind") == "comment":
        classes.extend(["work-comment-card", "work-closing-comment"])

    lines = [
        f'        <article id="{esc(section["id"])}" class="{" ".join(classes)}">',
        f"          <h2>{esc(section['title'])}</h2>",
    ]
    lead = section.get("lead")
    if lead:
        lines.append(f'          <p class="work-section-lead">{esc(lead)}</p>')

    if section.get("kind") == "members":
        lines.append(render_member_details(work))
    elif section.get("kind") == "comment":
        lines.extend(
            [
                '          <blockquote class="work-comment">',
                f"            <p>{esc(work['keiComment'])}</p>",
                "          </blockquote>",
            ]
        )
    else:
        lines.extend(render_work_paragraphs(section.get("paragraphs", [])))
        lines.extend(render_work_items(section.get("items", [])))
    lines.append("        </article>")
    return "\n".join(lines)


def render_quick_look(work: dict) -> str:
    items = work.get("quickLook") or [
        work.get("summary", ""),
        work.get("storySummary", ""),
        work.get("statusBody", ""),
    ]
    lines = [
        '      <section class="work-summary-box" aria-label="この作品を3行で">',
        '        <p class="section-kicker">Quick Look</p>',
        "        <h2>この作品を3行で</h2>",
        "        <ul>",
    ]
    for item in items[:3]:
        if str(item).strip():
            lines.append(f"          <li>{esc(item)}</li>")
    lines.extend(["        </ul>", "      </section>"])
    return "\n".join(lines)


def render_work_card(work: dict) -> str:
    public_url = work.get("publicUrl")
    public_label = work.get("publicLabel", "公開ページ")
    lines = [
        '          <article class="work-card work-story-card">',
        '            <div class="work-card-top">',
        f'              <span class="tag">{esc(work["category"])}</span>',
        f'              <span class="work-status-chip">{esc(work["statusLabel"])}</span>',
        "            </div>",
        f'            <h3>{esc(work["title"])}</h3>',
        f'            <p class="work-summary">{esc(work["summary"])}</p>',
        f'            <p class="work-story-summary">{esc(work["storySummary"])}</p>',
        '            <div class="work-card-meta">',
        f'              <span class="work-meta-label">担当AI社員</span><ul class="pill-list work-member-chips">{render_member_chips(work)}</ul>',
        "            </div>",
        '            <div class="work-links">',
        f'              <a class="mini-button" href="{esc(work_href(work))}">制作背景を読む</a>',
    ]
    if public_url:
        lines.append(f'              <a class="mini-button mini-button-secondary" href="{esc(local_href("", public_url))}">{esc(public_label)}</a>')
    lines.extend(["            </div>", "          </article>"])
    return "\n".join(lines)


def render_works_main(works: list[dict]) -> str:
    published = sum(1 for work in works if work.get("publicUrl"))
    lines = [
        '    <main class="page-main works-main">',
        '      <section class="page-hero works-hero">',
        "        <div>",
        '          <p class="section-kicker">Works</p>',
        "          <h1>制作物</h1>",
        '          <p class="page-lead">完成品、企画、運用中のページまで。毎日見る株式会社で生まれた制作物を、背景ごと読める形で残していきます。</p>',
        "        </div>",
        '        <aside class="page-note works-note">',
        '          <strong>Works Log</strong>',
        f'          <p>{len(works)}件の制作物を記録中。公開中 {published}件、企画・設計段階も含めて、会社の活動記録として整理しています。</p>',
        "        </aside>",
        "      </section>",
        "",
        '      <section class="card-section works-intro-section" aria-labelledby="works-intro-title">',
        '        <div class="section-heading">',
        "          <div>",
        '            <p class="section-kicker">Story First</p>',
        '            <h2 id="works-intro-title">なぜ生まれたかから読む</h2>',
        "          </div>",
        "        </div>",
        '        <div class="works-story-intro">',
        '          <article>',
        "            <strong>作品概要</strong>",
        "            <p>何を作ったかだけでなく、どんな課題に対して作ったかを短く整理しています。</p>",
        "          </article>",
        '          <article>',
        "            <strong>制作背景</strong>",
        "            <p>ラウンジの雑談、社内の困りごと、企画の転換点を、読み物として残します。</p>",
        "          </article>",
        '          <article>',
        "            <strong>担当AI社員</strong>",
        "            <p>誰が関わり、どの専門性が入っているのかを作品ごとに見えるようにしています。</p>",
        "          </article>",
        "        </div>",
        "      </section>",
        "",
        '      <section class="card-section works-grid works-story-grid" aria-label="制作物一覧">',
    ]
    for work in works:
        lines.append(render_work_card(work))
    lines.extend(["      </section>", "    </main>"])
    return "\n".join(lines)


def update_works_html(works: list[dict]) -> None:
    html_text = WORKS_HTML_PATH.read_text(encoding="utf-8")
    html_text = html_text.replace('<body class="subpage">', '<body class="subpage works-page">')
    if '    <main class="page-main works-main">' in html_text:
        main_start = html_text.index('    <main class="page-main works-main">')
    else:
        main_start = html_text.index('    <main class="page-main">')
    footer_start = html_text.index("    <footer", main_start)
    html_text = html_text[:main_start] + render_works_main(works) + "\n" + html_text[footer_start:]
    WORKS_HTML_PATH.write_text(html_text, encoding="utf-8")


def render_rich_detail_page(work: dict) -> str:
    title = work.get("metaTitle") or f'{work["title"]}｜制作背景と企画記録｜毎日見る株式会社'
    description = work.get("metaDescription") or work.get("storySummary") or work.get("summary", "")
    public_url = work.get("publicUrl")
    public_label = work.get("publicLabel", "公開ページを見る")
    sections = rich_detail_sections(work)
    lines = [
        "<!doctype html>",
        '<html lang="ja">',
        "  <head>",
        '    <meta charset="utf-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
        f"    <title>{esc(title)}</title>",
        f'    <meta name="description" content="{esc(description)}" />',
        f'    <meta property="og:title" content="{esc(title)}" />',
        f'    <meta property="og:description" content="{esc(description)}" />',
        '    <meta property="og:type" content="article" />',
        f'    <meta property="og:url" content="{esc(work_url(work))}" />',
        '    <meta property="og:image" content="https://mainichi-miru.com/image/top004.jpg" />',
        '    <meta name="twitter:card" content="summary_large_image" />',
        '    <link rel="icon" href="../favicon.ico" />',
        '    <link rel="stylesheet" href="../styles.css" />',
        "  </head>",
        '  <body class="subpage works-page work-detail-page">',
        '    <header class="site-header" aria-label="サイトヘッダー">',
        '      <a class="brand" href="../index.html" aria-label="毎日見る株式会社 ホーム">',
        '        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>',
        '        <span class="brand-text"><strong>毎日見る<br />株式会社</strong><small>Mainichi Miru Inc.</small></span>',
        "      </a>",
        '      <nav class="global-nav" aria-label="グローバルナビゲーション">',
        '        <a href="../index.html">ホーム</a>',
        '        <a href="../about.html">会社概要</a>',
        '        <a href="../members.html">AI社員紹介</a>',
        '        <a href="../services.html">事業内容</a>',
        '        <a href="../ai-forensics/">AI鑑識室</a>',
        '        <a href="../works.html" aria-current="page">制作物</a>',
        '        <a href="../lounge.html">ラウンジ</a>',
        '        <a href="../news.html">ニュース</a>',
        "      </nav>",
        '      <a class="contact-button" href="../contact.html">お問い合わせ</a>',
        "    </header>",
        "",
        '    <main class="work-detail-main">',
        '      <nav class="profile-breadcrumb" aria-label="パンくずリスト">',
        '        <a href="../index.html">ホーム</a>',
        '        <span>制作物</span>',
        f'        <strong>{esc(work["title"])}</strong>',
        '        <a class="profile-back" href="../works.html">制作物一覧に戻る</a>',
        "      </nav>",
        "",
        '      <section class="page-hero work-detail-hero">',
        "        <div>",
        f'          <p class="section-kicker">{esc(work["category"])}</p>',
        f'          <h1>{esc(work["title"])}</h1>',
        f'          <p class="page-lead">{esc(work["summary"])}</p>',
        f'          <p class="work-story-summary work-story-summary-large">{esc(work["storySummary"])}</p>',
        "        </div>",
        '        <aside class="page-note work-detail-note">',
        f'          <span class="work-status-chip">{esc(work["statusLabel"])}</span>',
        f'          <p>{esc(work["statusBody"])}</p>',
        "        </aside>",
        "      </section>",
        "",
        render_quick_look(work),
        "",
        '      <div class="work-detail-layout">',
        render_rich_detail_nav(sections),
        "",
        '        <section class="work-detail-grid work-detail-content" aria-label="制作背景詳細">',
    ]
    for section in sections:
        lines.append(render_rich_detail_article(work, section))
    lines.extend(
        [
            "        </section>",
            "      </div>",
            "",
            '      <section class="work-detail-actions" aria-label="制作物導線">',
            '        <a class="secondary-button" href="../works.html">制作物一覧に戻る</a>',
        ]
    )
    if public_url:
        lines.append(f'        <a class="secondary-button work-public-button" href="{esc(local_href("../", public_url))}">{esc(public_label)}</a>')
    lines.extend(
        [
            "      </section>",
            "    </main>",
            '    <footer class="site-footer">',
            '      <div class="site-footer-inner">',
            '        <div class="site-footer-brand">',
            '          <strong>毎日見る<br />株式会社</strong>',
            '          <p>AIが働き、人間が考え、創造する。</p>',
            "        </div>",
            '        <nav class="site-footer-nav" aria-label="フッターナビゲーション">',
            '          <a href="../index.html">ホーム</a>',
            '          <a href="../about.html">会社概要</a>',
            '          <a href="../members.html">AI社員紹介</a>',
            '          <a href="../services.html">事業内容</a>',
            '          <a href="../ai-forensics/">AI鑑識室</a>',
            '          <a href="../works.html">制作物</a>',
            '          <a href="../lounge.html">ラウンジ</a>',
            '          <a href="../news.html">ニュース</a>',
            '          <a href="../contact.html">お問い合わせ</a>',
            "        </nav>",
            "      </div>",
            '      <p class="site-footer-copy">© 毎日見る株式会社 Since 2026</p>',
            "    </footer>",
            '    <script src="../scripts/work-side-nav.js"></script>',
            "  </body>",
            "</html>",
        ]
    )
    return "\n".join(lines) + "\n"


def render_detail_page(work: dict) -> str:
    if work.get("richDetailPage"):
        return render_rich_detail_page(work)

    title = work.get("metaTitle") or f'{work["title"]}｜制作背景と企画記録｜毎日見る株式会社'
    description = work.get("metaDescription") or work.get("storySummary") or work.get("summary", "")
    public_url = work.get("publicUrl")
    public_label = work.get("publicLabel", "公開ページを見る")
    lines = [
        "<!doctype html>",
        '<html lang="ja">',
        "  <head>",
        '    <meta charset="utf-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
        f"    <title>{esc(title)}</title>",
        f'    <meta name="description" content="{esc(description)}" />',
        f'    <meta property="og:title" content="{esc(title)}" />',
        f'    <meta property="og:description" content="{esc(description)}" />',
        '    <meta property="og:type" content="article" />',
        f'    <meta property="og:url" content="{esc(work_url(work))}" />',
        '    <meta property="og:image" content="https://mainichi-miru.com/image/top004.jpg" />',
        '    <meta name="twitter:card" content="summary_large_image" />',
        '    <link rel="icon" href="../favicon.ico" />',
        '    <link rel="stylesheet" href="../styles.css" />',
        "  </head>",
        '  <body class="subpage works-page work-detail-page">',
        '    <header class="site-header" aria-label="サイトヘッダー">',
        '      <a class="brand" href="../index.html" aria-label="毎日見る株式会社 ホーム">',
        '        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>',
        '        <span class="brand-text"><strong>毎日見る<br />株式会社</strong><small>Mainichi Miru Inc.</small></span>',
        "      </a>",
        '      <nav class="global-nav" aria-label="グローバルナビゲーション">',
        '        <a href="../index.html">ホーム</a>',
        '        <a href="../about.html">会社概要</a>',
        '        <a href="../members.html">AI社員紹介</a>',
        '        <a href="../services.html">事業内容</a>',
        '        <a href="../works.html" aria-current="page">制作物</a>',
        '        <a href="../lounge.html">ラウンジ</a>',
        '        <a href="../news.html">ニュース</a>',
        "      </nav>",
        '      <a class="contact-button" href="../contact.html">お問い合わせ</a>',
        "    </header>",
        "",
        '    <main class="work-detail-main">',
        '      <nav class="profile-breadcrumb" aria-label="パンくずリスト">',
        '        <a href="../index.html">ホーム</a>',
        '        <span>制作物</span>',
        f'        <strong>{esc(work["title"])}</strong>',
        '        <a class="profile-back" href="../works.html">制作物一覧に戻る</a>',
        "      </nav>",
        "",
        '      <section class="page-hero work-detail-hero">',
        "        <div>",
        f'          <p class="section-kicker">{esc(work["category"])}</p>',
        f'          <h1>{esc(work["title"])}</h1>',
        f'          <p class="page-lead">{esc(work["summary"])}</p>',
        f'          <p class="work-story-summary work-story-summary-large">{esc(work["storySummary"])}</p>',
        "        </div>",
        '        <aside class="page-note work-detail-note">',
        f'          <span class="work-status-chip">{esc(work["statusLabel"])}</span>',
        f'          <p>{esc(work["statusBody"])}</p>',
        "        </aside>",
        "      </section>",
        "",
        '      <section class="work-detail-grid" aria-label="制作背景詳細">',
        '        <article class="work-detail-card work-detail-overview">',
        "          <h2>作品概要</h2>",
        f"          <p>{esc(work['overview'])}</p>",
        "        </article>",
        '        <article class="work-detail-card">',
        "          <h2>生まれたきっかけ</h2>",
        f"          <p>{esc(work['trigger'])}</p>",
        "        </article>",
        '        <article class="work-detail-card work-detail-wide">',
        "          <h2>制作背景</h2>",
        f"          <p>{esc(work['background'])}</p>",
        "        </article>",
        *render_extra_sections(work),
        '        <article class="work-detail-card">',
        "          <h2>担当AI社員</h2>",
        render_member_details(work),
        "        </article>",
        '        <article class="work-detail-card">',
        "          <h2>現在の状態</h2>",
        f"          <p>{esc(work['statusBody'])}</p>",
        "        </article>",
        '        <article class="work-detail-card">',
        "          <h2>今後やりたいこと</h2>",
        '          <ul class="work-next-list">',
    ]
    for item in work.get("nextSteps", []):
        lines.append(f"            <li>{esc(item)}</li>")
    lines.extend(
        [
            "          </ul>",
            "        </article>",
            '        <article class="work-detail-card work-detail-wide work-comment-card">',
            "          <h2>ケイ部長コメント</h2>",
            f'          <blockquote class="work-comment">{esc(work["keiComment"])}</blockquote>',
            "        </article>",
            "      </section>",
            "",
            '      <section class="work-detail-actions" aria-label="制作物導線">',
            '        <a class="secondary-button" href="../works.html">制作物一覧に戻る</a>',
        ]
    )
    if public_url:
        lines.append(f'        <a class="secondary-button work-public-button" href="{esc(local_href("../", public_url))}">{esc(public_label)}</a>')
    lines.extend(
        [
            "      </section>",
            "    </main>",
            '    <footer class="site-footer">',
            '      <div class="site-footer-inner">',
            '        <div class="site-footer-brand">',
            '          <strong>毎日見る<br />株式会社</strong>',
            '          <p>AIが働き、人間が考え、創造する。</p>',
            "        </div>",
            '        <nav class="site-footer-nav" aria-label="フッターナビゲーション">',
            '          <a href="../index.html">ホーム</a>',
            '          <a href="../about.html">会社概要</a>',
            '          <a href="../members.html">AI社員紹介</a>',
            '          <a href="../services.html">事業内容</a>',
            '          <a href="../works.html">制作物</a>',
            '          <a href="../lounge.html">ラウンジ</a>',
            '          <a href="../news.html">ニュース</a>',
            '          <a href="../contact.html">お問い合わせ</a>',
            "        </nav>",
            "      </div>",
            '      <p class="site-footer-copy">© 毎日見る株式会社 Since 2026</p>',
            "    </footer>",
            "  </body>",
            "</html>",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> None:
    works = load_works()
    WORKS_DIR.mkdir(exist_ok=True)
    update_works_html(works)
    apply_layout_to_file(WORKS_HTML_PATH)
    for work in works:
        detail_path = WORKS_DIR / f"{work['slug']}.html"
        if work.get("preserveDetailPage") and detail_path.exists():
            apply_layout_to_file(detail_path)
            continue
        detail_path.write_text(render_detail_page(work), encoding="utf-8")
        apply_layout_to_file(detail_path)
    print(f"Generated works.html and {len(works)} work detail pages.")


if __name__ == "__main__":
    main()
