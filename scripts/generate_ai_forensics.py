#!/usr/bin/env python3
from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any

from site_layout import apply_layout_to_file

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data" / "ai-forensics"
OUTPUT_DIR = ROOT / "ai-forensics"
INDEX_HTML_PATH = OUTPUT_DIR / "index.html"
BASE_URL = "https://mainichi-miru.netlify.app"
MAKOTO_ICON = "image/icon/icon_mmc010.jpg"

CATEGORY_LABELS = {
    "deepfake": "ディープフェイク",
    "misinformation": "誤情報・偽情報",
    "hallucination": "AIの誤回答",
    "privacy": "個人情報",
    "copyright": "著作権",
    "security": "セキュリティ",
    "scam": "詐欺",
    "search": "AI検索",
    "social-media": "SNS",
    "verification": "情報確認",
    "work-use": "仕事でのAI活用",
    "other": "その他",
}
DIFFICULTY_LABELS = {
    "beginner": "はじめて",
    "standard": "標準",
    "advanced": "発展",
}
VERIFICATION_LABELS = {
    1: "基本確認",
    2: "一度立ち止まる",
    3: "公式情報と照合",
    4: "慎重な確認",
    5: "行動を止めて相談",
}
PRIORITY_LABELS = {
    "high": "優先して確認",
    "medium": "できれば確認",
    "low": "補足確認",
}
CONFIDENCE_LABELS = {
    "high": "確度は高め",
    "medium": "追加確認の余地あり",
    "low": "現時点では判断材料が少ない",
}
SOURCE_TYPE_LABELS = {
    "government": "官公庁",
    "official": "公式発表",
    "research": "研究・論文",
    "news": "報道機関",
    "security": "セキュリティ機関",
    "other": "その他",
}
ACCENT_TONES = {"calm", "caution", "serious", "friendly"}
REQUIRED_KEYS = [
    "id",
    "publishedAt",
    "title",
    "shortTitle",
    "category",
    "difficulty",
    "targetAudience",
    "summary",
    "scenario",
    "question",
    "inspectionPoints",
    "verificationLevel",
    "verificationLabel",
    "verificationMessage",
    "verdict",
    "safeActions",
    "avoidActions",
    "positiveUse",
    "makotoComment",
    "oneLineLesson",
    "tags",
    "sources",
    "visualSuggestion",
]


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def warn(article_id: str, message: str) -> None:
    print(f"[ai-forensics] {article_id}: {message}")


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        warn(path.stem, f"JSONを読めませんでした: {exc}")
        return None
    if not isinstance(data, dict):
        warn(path.stem, "記事JSONはobjectにしてください。")
        return None
    return data


def validate_article(article: dict[str, Any], source: Path) -> bool:
    article_id = str(article.get("id") or source.stem)
    missing = [key for key in REQUIRED_KEYS if key not in article]
    if missing:
        warn(article_id, f"必須項目が不足しています: {', '.join(missing)}")
        return False
    if article["category"] not in CATEGORY_LABELS:
        warn(article_id, f"categoryが不正です: {article['category']}")
        return False
    if article["difficulty"] not in DIFFICULTY_LABELS:
        warn(article_id, f"difficultyが不正です: {article['difficulty']}")
        return False
    if article["verificationLevel"] not in [1, 2, 3, 4, 5]:
        warn(article_id, f"verificationLevelが不正です: {article['verificationLevel']}")
        return False
    if not isinstance(article.get("targetAudience"), list):
        warn(article_id, "targetAudienceは配列にしてください。")
        return False
    if not isinstance(article.get("tags"), list):
        warn(article_id, "tagsは配列にしてください。")
        return False
    if not isinstance(article.get("sources"), list):
        warn(article_id, "sourcesは配列にしてください。")
        return False
    if not isinstance(article.get("question", {}).get("recommendedAnswers"), list):
        warn(article_id, "question.recommendedAnswersは配列にしてください。")
        return False
    return True


def load_articles() -> list[dict[str, Any]]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    articles: list[dict[str, Any]] = []
    for path in sorted(DATA_DIR.glob("*.json")):
        article = read_json(path)
        if article is None:
            continue
        if validate_article(article, path):
            articles.append(article)
    return sorted(articles, key=lambda item: item.get("publishedAt", ""), reverse=True)


def category_label(value: str) -> str:
    return CATEGORY_LABELS.get(value, CATEGORY_LABELS["other"])


def difficulty_label(value: str) -> str:
    return DIFFICULTY_LABELS.get(value, value)


def verification_label(level: int, fallback: str = "") -> str:
    return fallback or VERIFICATION_LABELS.get(level, "確認レベル")


def priority_label(value: str) -> str:
    return PRIORITY_LABELS.get(value, value)


def confidence_label(value: str) -> str:
    return CONFIDENCE_LABELS.get(value, value)


def source_type_label(value: str) -> str:
    return SOURCE_TYPE_LABELS.get(value, SOURCE_TYPE_LABELS["other"])


def asset_src(src: object, prefix: str) -> str:
    value = str(src)
    if value.startswith(("http://", "https://", "/", "../")):
        return value
    return prefix + value.lstrip("./")


def render_makoto_avatar(prefix: str) -> str:
    icon_src = asset_src(MAKOTO_ICON, prefix)
    return "\n".join(
        [
            '          <figure class="forensics-makoto-avatar">',
            f'            <img src="{esc(icon_src)}" alt="誠のアイコン" loading="lazy" />',
            "          </figure>",
        ]
    )


def render_case_image(article: dict[str, Any], prefix: str = "../") -> str:
    image = article.get("caseImage")
    if not isinstance(image, dict) or not image.get("src"):
        return ""
    image_src = asset_src(image["src"], prefix)
    alt = image.get("alt") or article.get("title", "")
    caption = image.get("caption", "")
    caption_html = f"            <figcaption>{esc(caption)}</figcaption>" if caption else ""
    return "\n".join(
        [
            '          <figure class="scenario-image">',
            f'            <img src="{esc(image_src)}" alt="{esc(alt)}" loading="lazy" />',
            caption_html,
            "          </figure>",
        ]
    )


def article_path(article: dict[str, Any]) -> Path:
    return OUTPUT_DIR / f"{article['id']}.html"


def article_href(article: dict[str, Any], prefix: str = "") -> str:
    return f"{prefix}ai-forensics/{article['id']}.html"


def article_url(article: dict[str, Any]) -> str:
    return f"{BASE_URL}/ai-forensics/{article['id']}"


def index_url() -> str:
    return f"{BASE_URL}/ai-forensics"


def render_head(title: str, description: str, url: str, *, prefix: str, og_type: str = "website") -> str:
    return "\n".join(
        [
            "  <head>",
            '    <meta charset="utf-8" />',
            '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
            f"    <title>{esc(title)}</title>",
            f'    <meta name="description" content="{esc(description)}" />',
            f'    <link rel="canonical" href="{esc(url)}" />',
            f'    <meta property="og:title" content="{esc(title)}" />',
            f'    <meta property="og:description" content="{esc(description)}" />',
            f'    <meta property="og:type" content="{esc(og_type)}" />',
            f'    <meta property="og:url" content="{esc(url)}" />',
            f'    <meta property="og:image" content="{BASE_URL}/image/top005.jpg" />',
            '    <meta name="twitter:card" content="summary_large_image" />',
            f'    <link rel="icon" href="{prefix}favicon.ico" />',
            f'    <link rel="stylesheet" href="{prefix}styles.css" />',
            "  </head>",
        ]
    )


def render_level(level: int, label: str, message: str = "") -> str:
    dots = "\n".join(
        f'              <span class="forensics-level-dot{" is-active" if index <= level else ""}">{index}</span>'
        for index in range(1, 6)
    )
    message_line = f"            <p>{esc(message)}</p>" if message else ""
    return "\n".join(
        [
            '          <div class="forensics-level" aria-label="確認レベル">',
            '            <div class="forensics-level-head">',
            f"              <strong>確認レベル {level}</strong>",
            f"              <span>{esc(verification_label(level, label))}</span>",
            "            </div>",
            '            <div class="forensics-level-meter" aria-hidden="true">',
            dots,
            "            </div>",
            '            <small>危険度ではなく、必要な確認の程度を表しています。</small>',
            message_line,
            "          </div>",
        ]
    )


def render_card(article: dict[str, Any], *, featured: bool = False, href_prefix: str = "") -> str:
    tags = "".join(f"<li>{esc(tag)}</li>" for tag in article.get("tags", [])[:3])
    audience = "".join(f"<li>{esc(item)}</li>" for item in article.get("targetAudience", [])[:2])
    search_text = " ".join(
        [
            article.get("title", ""),
            article.get("shortTitle", ""),
            article.get("summary", ""),
            category_label(article.get("category", "")),
            difficulty_label(article.get("difficulty", "")),
            " ".join(article.get("tags", [])),
            " ".join(article.get("targetAudience", [])),
        ]
    )
    level = int(article.get("verificationLevel", 1))
    tone = article.get("visualSuggestion", {}).get("accentTone", "calm")
    if tone not in ACCENT_TONES:
        tone = "calm"
    class_name = "forensics-card is-featured" if featured else "forensics-card"
    return "\n".join(
        [
            f'          <a class="{class_name} tone-{esc(tone)}" href="{esc(href_prefix + article["id"] + ".html")}" data-forensics-card data-category="{esc(article["category"])}" data-level="{level}" data-difficulty="{esc(article["difficulty"])}" data-search-text="{esc(search_text)}">',
            '            <div class="forensics-card-head">',
            f'              <span class="forensics-card-icon" aria-hidden="true">{esc(article.get("visualSuggestion", {}).get("cardIcon", "確認"))}</span>',
            '              <div>',
            f'                <p>{esc(article["shortTitle"])}</p>',
            f'                <h3>{esc(article["title"])}</h3>',
            "              </div>",
            "            </div>",
            '            <div class="forensics-card-meta">',
            f'              <time datetime="{esc(article["publishedAt"])}">{esc(article["publishedAt"].replace("-", "."))}</time>',
            f'              <span>{esc(category_label(article["category"]))}</span>',
            f'              <span>{esc(difficulty_label(article["difficulty"]))}</span>',
            "            </div>",
            f'            <p class="forensics-card-summary">{esc(article["summary"])}</p>',
            '            <div class="forensics-card-level">',
            f'              <strong>確認レベル {level}</strong>',
            f'              <span>{esc(verification_label(level, article.get("verificationLabel", "")))}</span>',
            "            </div>",
            f'            <ul class="forensics-card-audience">{audience}</ul>',
            f'            <ul class="pill-list forensics-card-tags">{tags}</ul>',
            '            <span class="mini-button">記事を見る</span>',
            "          </a>",
        ]
    )


def render_index_page(articles: list[dict[str, Any]]) -> str:
    latest = articles[0] if articles else None
    card_grid = "\n".join(render_card(article) for article in articles)
    featured = render_card(latest, featured=True) if latest else '<div class="forensics-empty-card">AI鑑識室の記事を準備しています。</div>'
    category_options = "\n".join(
        f'              <option value="{esc(key)}">{esc(value)}</option>' for key, value in CATEGORY_LABELS.items()
    )
    level_options = "\n".join(
        f'              <option value="{level}">確認レベル {level}｜{esc(label)}</option>' for level, label in VERIFICATION_LABELS.items()
    )
    difficulty_options = "\n".join(
        f'              <option value="{esc(key)}">{esc(value)}</option>' for key, value in DIFFICULTY_LABELS.items()
    )
    return "\n".join(
        [
            "<!doctype html>",
            '<html lang="ja">',
            render_head(
                "AI鑑識室｜毎日見る株式会社",
                "生成AIやインターネット上の情報を、怖がるためではなく安心して使うために確認する、毎日見る株式会社のAIリテラシーコンテンツです。",
                index_url(),
                prefix="../",
            ),
            '  <body class="subpage ai-forensics-page">',
            '    <header class="site-header" aria-label="サイトヘッダー"></header>',
            "",
            '    <main class="forensics-main">',
            '      <section class="forensics-hero" aria-labelledby="forensics-title">',
            "        <div>",
            '          <p class="section-kicker">毎日見る株式会社<br />AIリテラシー推進室</p>',
            '          <h1 id="forensics-title">AI鑑識室</h1>',
            "          <p>AIやインターネットの情報を、怖がるためではなく、安心して使うために確認する場所です。情報源、画像、動画、AIの回答。身近な事例を見ながら、「どこを確認すればよいか」を一緒に考えます。</p>",
            '          <p class="forensics-catch">疑うためではなく、安心して使うために確認する。</p>',
            '          <div class="forensics-hero-actions">',
            '            <a class="primary-button" href="#latest-cases">最新の事例を見る</a>',
            '            <a class="secondary-button" href="#about-forensics">AI鑑識室について</a>',
            "          </div>",
            "        </div>",
            '        <div class="forensics-visual" aria-label="情報を整理して確認する図解">',
            '          <div class="forensics-visual-card is-checked"><span>確認済み</span><strong>公式発表あり</strong><small>出どころを確認</small></div>',
            '          <div class="forensics-visual-card is-pending"><span>要確認</span><strong>SNS投稿</strong><small>日時と元投稿を見る</small></div>',
            '          <div class="forensics-visual-card is-guess"><span>推測</span><strong>AIの回答</strong><small>根拠を分ける</small></div>',
            '          <div class="forensics-visual-note">Think. Check. Use.</div>',
            "        </div>",
            "      </section>",
            "",
            '      <section class="forensics-steps card-section" id="about-forensics" aria-labelledby="forensics-steps-title">',
            '        <div class="section-heading"><div><p class="section-kicker">How to Read</p><h2 id="forensics-steps-title">AI鑑識室の読み方</h2></div></div>',
            '        <div class="forensics-step-grid">',
            '          <article><span>1</span><strong>事例を知る</strong><p>身近に起こりそうな場面から始めます。</p></article>',
            '          <article><span>2</span><strong>自分で考える</strong><p>すぐ答えを見る前に、取れる行動を選びます。</p></article>',
            '          <article><span>3</span><strong>確認する</strong><p>情報源、日時、根拠などを見るポイントを整理します。</p></article>',
            '          <article><span>4</span><strong>安全に対処する</strong><p>共有、保存、相談など、落ち着いた行動へつなげます。</p></article>',
            '          <article><span>5</span><strong>前向きに活用する</strong><p>AIを確認作業や整理の相棒として使います。</p></article>',
            "        </div>",
            "      </section>",
            "",
            '      <section class="card-section" id="latest-cases" aria-labelledby="latest-cases-title">',
            '        <div class="section-heading"><div><p class="section-kicker">Latest Case</p><h2 id="latest-cases-title">最新の鑑識事例</h2></div></div>',
            '        <div class="forensics-featured-grid">',
            featured,
            "        </div>",
            "      </section>",
            "",
            '      <section class="card-section forensics-search-section" aria-labelledby="forensics-search-title">',
            '        <div class="section-heading"><div><p class="section-kicker">Find by Theme</p><h2 id="forensics-search-title">テーマから探す</h2></div></div>',
            '        <form class="forensics-filters" role="search" aria-label="AI鑑識室の記事を絞り込む">',
            '          <label>カテゴリ<select data-forensics-filter="category"><option value="all">すべて</option>',
            category_options,
            "          </select></label>",
            '          <label>確認レベル<select data-forensics-filter="level"><option value="all">すべて</option>',
            level_options,
            "          </select></label>",
            '          <label>難易度<select data-forensics-filter="difficulty"><option value="all">すべて</option>',
            difficulty_options,
            "          </select></label>",
            '          <label>キーワード<input type="search" data-forensics-filter="search" placeholder="SNS、画像、著作権など" /></label>',
            "        </form>",
            '        <p class="forensics-empty-message" data-forensics-empty hidden>該当する事例は、現在準備中です。別の条件でも探してみてください。</p>',
            '        <div class="forensics-card-grid">',
            card_grid or '<div class="forensics-empty-card">AI鑑識室の記事を準備しています。</div>',
            "        </div>",
            "      </section>",
            "",
            '      <section class="forensics-makoto card-section" aria-labelledby="forensics-makoto-title">',
            '        <div class="forensics-makoto-card">',
            render_makoto_avatar("../"),
            "          <div>",
            '            <p class="section-kicker">AIリテラシー推進室 主任</p>',
            '            <h2 id="forensics-makoto-title">誠</h2>',
            "            <p>AIだから疑うのではなく、出どころを確認することが大切です。</p>",
            "            <p>分からないことを急いで決める必要はありません。今分かっていることと、まだ確認が必要なことを、一緒に整理していきましょう。</p>",
            '            <a class="mini-button mini-button-secondary" href="../members/makoto.html">誠の社員プロフィールを見る</a>',
            "          </div>",
            "        </div>",
            "      </section>",
            "",
            '      <aside class="forensics-disclaimer" aria-label="AI鑑識室の補足">',
            "        <p>AI鑑識室は、一般的な情報確認やAI活用の考え方を紹介するコンテンツです。</p>",
            "        <p>法律、医療、金融、契約など、専門的な判断が必要な場合は、公式窓口や専門家へご相談ください。</p>",
            "      </aside>",
            "    </main>",
            '    <script src="../scripts/ai-forensics.js?v=20260716"></script>',
            '    <footer class="site-footer"></footer>',
            "  </body>",
            "</html>",
        ]
    )


def render_list(items: list[str], class_name: str = "") -> str:
    cls = f' class="{class_name}"' if class_name else ""
    return "<ul{}>{}</ul>".format(cls, "".join(f"<li>{esc(item)}</li>" for item in items))


def render_question(article: dict[str, Any]) -> str:
    question = article["question"]
    recommended = set(question.get("recommendedAnswers", []))
    choices = []
    for choice in question.get("choices", []):
        choice_id = choice.get("id", "")
        choices.append(
            "\n".join(
                [
                    f'              <label class="forensics-choice-card" data-choice-card>',
                    f'                <input type="checkbox" value="{esc(choice_id)}" data-choice-id="{esc(choice_id)}" />',
                    "                <span>",
                    f'                  <strong>{esc(choice.get("label", ""))}</strong>',
                    f'                  <small>{esc(choice.get("description", ""))}</small>',
                    "                </span>",
                    "              </label>",
                ]
            )
        )
    recommended_labels = [
        choice.get("label", "")
        for choice in question.get("choices", [])
        if choice.get("id", "") in recommended
    ]
    return "\n".join(
        [
            f'        <section class="forensics-article-section forensics-question" data-forensics-question data-recommended="{esc(",".join(question.get("recommendedAnswers", [])))}">',
            "          <div class=\"forensics-step-label\">Step 2</div>",
            "          <h2>あなたならどうする？</h2>",
            "          <fieldset>",
            f"            <legend>{esc(question.get('text', ''))}</legend>",
            '            <div class="forensics-choice-grid">',
            "\n".join(choices),
            "            </div>",
            "          </fieldset>",
            '          <button class="mini-button forensics-answer-button" type="button" data-check-answer>回答を確認する</button>',
            '          <div class="forensics-answer-result" data-answer-result hidden tabindex="-1">',
            '            <p class="forensics-answer-empty" data-answer-empty hidden>まず一つ以上選んでから確認してみてください。</p>',
            "            <strong>推奨される行動</strong>",
            render_list(recommended_labels),
            "            <p>選んだカードの表示を見ながら、今回はどの行動が安心につながるか確認できます。</p>",
            f"            <p>{esc(question.get('explanation', ''))}</p>",
            "          </div>",
            "        </section>",
        ]
    )


def render_sources(article: dict[str, Any]) -> str:
    sources = article.get("sources", [])
    if not sources:
        return '<p class="forensics-source-empty">この記事は一般的な架空事例をもとに作成しています。</p>'
    lines = ['          <ul class="forensics-source-list">']
    for source in sources:
        date = source.get("publishedAt")
        date_part = f'<time datetime="{esc(date)}">{esc(date)}</time>' if date else ""
        url = source.get("url", "")
        title = source.get("title", "情報源")
        link = (
            f'<a href="{esc(url)}" target="_blank" rel="noopener noreferrer">{esc(title)}<span class="visually-hidden">（外部リンク）</span></a>'
            if url
            else esc(title)
        )
        lines.extend(
            [
                "            <li>",
                f"              <strong>{link}</strong>",
                f'              <span>{esc(source.get("publisher", ""))}</span>',
                f'              <span>{esc(source_type_label(source.get("sourceType", "other")))}</span>',
                f"              {date_part}",
                "            </li>",
            ]
        )
    lines.append("          </ul>")
    return "\n".join(lines)


def related_articles(current: dict[str, Any], articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    current_tags = set(current.get("tags", []))
    matches = []
    for article in articles:
        if article["id"] == current["id"]:
            continue
        if article["category"] == current["category"] or current_tags.intersection(article.get("tags", [])):
            matches.append(article)
    return matches[:3]


def render_article_page(article: dict[str, Any], articles: list[dict[str, Any]]) -> str:
    level = int(article["verificationLevel"])
    scenario = article["scenario"]
    verdict = article["verdict"]
    positive = article["positiveUse"]
    article_index = articles.index(article)
    previous_article = articles[article_index + 1] if article_index + 1 < len(articles) else None
    next_article = articles[article_index - 1] if article_index > 0 else None
    related = related_articles(article, articles)
    inspection = "\n".join(
        [
            "\n".join(
                [
                    f'            <article class="inspection-card priority-{esc(point.get("priority", "medium"))}">',
                    f'              <span>{esc(priority_label(point.get("priority", "medium")))}</span>',
                    f'              <h3>{esc(point.get("title", ""))}</h3>',
                    f'              <p>{esc(point.get("description", ""))}</p>',
                    "            </article>",
                ]
            )
            for point in article.get("inspectionPoints", [])
        ]
    )
    safe_actions = "\n".join(
        f'            <li><strong>{esc(item.get("action", ""))}</strong><span>{esc(item.get("reason", ""))}</span></li>'
        for item in article.get("safeActions", [])
    )
    avoid_actions = "\n".join(
        f'            <li><strong>{esc(item.get("action", ""))}</strong><span>{esc(item.get("reason", ""))}</span></li>'
        for item in article.get("avoidActions", [])
    )
    related_block = ""
    if related:
        related_block = "\n".join(
            [
                '        <section class="forensics-article-section forensics-related">',
                "          <h2>関連記事</h2>",
                '          <div class="forensics-related-grid">',
                "\n".join(render_card(item) for item in related),
                "          </div>",
                "        </section>",
            ]
        )
    previous_link = f'<a class="mini-button mini-button-secondary" href="{esc(previous_article["id"])}.html">前の記事</a>' if previous_article else ""
    next_link = f'<a class="mini-button mini-button-secondary" href="{esc(next_article["id"])}.html">次の記事</a>' if next_article else ""
    return "\n".join(
        [
            "<!doctype html>",
            '<html lang="ja">',
            render_head(
                f"{article['title']}｜AI鑑識室｜毎日見る株式会社",
                article["summary"],
                article_url(article),
                prefix="../",
                og_type="article",
            ),
            '  <body class="subpage ai-forensics-page forensics-article-page">',
            '    <header class="site-header" aria-label="サイトヘッダー"></header>',
            "",
            '    <main class="forensics-article-main">',
            '      <nav class="profile-breadcrumb forensics-breadcrumb" aria-label="パンくずリスト">',
            '        <a href="../index.html">ホーム</a>',
            '        <a href="index.html">AI鑑識室</a>',
            f'        <strong>{esc(article["shortTitle"])}</strong>',
            '        <a class="profile-back" href="index.html">記事一覧へ戻る</a>',
            "      </nav>",
            "",
            '      <article class="forensics-article">',
            '        <header class="forensics-article-hero">',
            "          <div>",
            '            <div class="forensics-article-meta">',
            f'              <span>{esc(category_label(article["category"]))}</span>',
            f'              <span>{esc(difficulty_label(article["difficulty"]))}</span>',
            f'              <time datetime="{esc(article["publishedAt"])}">{esc(article["publishedAt"].replace("-", "."))}</time>',
            "            </div>",
            f'            <h1>{esc(article["title"])}</h1>',
            f'            <p>{esc(article["summary"])}</p>',
            f'            {render_list(article.get("targetAudience", []), "forensics-target-list")}',
            f'            {render_list(article.get("tags", []), "pill-list forensics-article-tags")}',
            "          </div>",
            render_level(level, article.get("verificationLabel", ""), article.get("verificationMessage", "")),
            "        </header>",
            "",
            '        <section class="forensics-article-section">',
            "          <div class=\"forensics-step-label\">Step 1</div>",
            "          <h2>身近な事例を知る</h2>",
            f'          <article class="scenario-card"><h3>{esc(scenario.get("headline", ""))}</h3><p>{esc(scenario.get("description", ""))}</p></article>',
            render_case_image(article),
            f'          <aside class="scenario-note"><strong>なぜ確認が必要？</strong><p>{esc(scenario.get("whyItMatters", ""))}</p></aside>',
            "        </section>",
            "",
            render_question(article),
            "",
            '        <section class="forensics-article-section">',
            "          <div class=\"forensics-step-label\">Step 3</div>",
            "          <h2>確認ポイント</h2>",
            '          <div class="inspection-grid">',
            inspection,
            "          </div>",
            "        </section>",
            "",
            '        <section class="forensics-article-section verdict-section">',
            "          <div class=\"forensics-step-label\">Step 4</div>",
            "          <h2>現時点での見立て</h2>",
            f'          <div class="verdict-card"><span>{esc(confidence_label(verdict.get("confidence", "medium")))}</span><strong>{esc(verdict.get("label", ""))}</strong><p>{esc(verdict.get("description", ""))}</p></div>',
            "        </section>",
            "",
            '        <section class="forensics-article-section action-section">',
            "          <div class=\"forensics-step-label\">Step 5</div>",
            "          <h2>安全な対処方法</h2>",
            '          <div class="action-grid">',
            '            <div><h3>安心につながる行動</h3><ul class="action-list safe-action-list">',
            safe_actions,
            "            </ul></div>",
            '            <div><h3>避けたい行動</h3><ul class="action-list avoid-action-list">',
            avoid_actions,
            "            </ul></div>",
            "          </div>",
            "        </section>",
            "",
            '        <section class="forensics-article-section positive-use-section">',
            "          <div class=\"forensics-step-label\">Step 6</div>",
            "          <h2>AIの前向きな活用</h2>",
            f'          <h3>{esc(positive.get("title", ""))}</h3>',
            f'          <p>{esc(positive.get("description", ""))}</p>',
            f'          {render_list(positive.get("examples", []), "positive-example-list")}',
            "        </section>",
            "",
            '        <section class="makoto-comment-section">',
            render_makoto_avatar("../"),
            "          <div>",
            "            <h2>誠主任からひとこと</h2>",
            f"            <blockquote>{esc(article['makotoComment'])}</blockquote>",
            "          </div>",
            "        </section>",
            "",
            '        <section class="one-line-lesson">',
            "          <h2>今回、覚えておきたいこと</h2>",
            f"          <p>{esc(article['oneLineLesson'])}</p>",
            "        </section>",
            "",
            '        <section class="forensics-article-section sources-section">',
            "          <h2>情報源</h2>",
            render_sources(article),
            "        </section>",
            related_block,
            '        <nav class="forensics-article-nav" aria-label="記事ナビゲーション">',
            '          <a class="mini-button" href="index.html">AI鑑識室の記事一覧へ戻る</a>',
            previous_link,
            next_link,
            "        </nav>",
            "      </article>",
            "    </main>",
            '    <script src="../scripts/ai-forensics.js?v=20260716"></script>',
            '    <footer class="site-footer"></footer>',
            "  </body>",
            "</html>",
        ]
    )


def write_pages(articles: list[dict[str, Any]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_HTML_PATH.write_text(render_index_page(articles), encoding="utf-8")
    apply_layout_to_file(INDEX_HTML_PATH)
    for article in articles:
        path = article_path(article)
        path.write_text(render_article_page(article, articles), encoding="utf-8")
        apply_layout_to_file(path)


def main() -> None:
    articles = load_articles()
    write_pages(articles)
    print(f"Generated AI鑑識室 pages from {len(articles)} article(s).")


if __name__ == "__main__":
    main()
