from __future__ import annotations

import html
import os
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MEMBERS_DIR = ROOT / "members"
SOURCE_DIR = Path(
    os.environ.get(
        "MMC_PROFILE_SOURCE",
        r"C:\Users\user\Documents\毎日見る株式会社\社員プロフィール",
    )
)


STAFF = {
    "ほのちゃん": {
        "slug": "hono",
        "roman": "Hono-chan",
        "class": "",
        "image": "mmc-001.jpg",
        "item": "mmc-001-item.jpg",
        "icon": "icon_mmc001.jpg",
        "lead": "ほのちゃんは、毎日見る株式会社の空気を整える総務課長です。所長の雑談相手であり、思考整理や体調確認、タスク管理までそっと支える存在。やわらかい雰囲気の奥に、会社全体を見守る安定感があります。",
        "tags": ["総務", "サポート", "相談役", "コーヒー担当"],
        "item_title": "総務メモと仕事道具",
        "item_alt": "ほのちゃんの仕事道具や総務メモを集めたイメージ",
        "illustration": "Coffee Break",
    },
    "ショウマ": {
        "slug": "shoma",
        "roman": "Shoma",
        "class": "member-shoma",
        "image": "mmc-002.jpg",
        "item": "mmc-002-item.jpg",
        "icon": "icon_mmc002.jpg",
        "lead": "ショウマは、雑談や違和感の中から記事や企画の種を見つける企画営業部長です。ノリは軽めでも、読者心理やシリーズ設計にはかなりシビア。AIの話を、人間が見える企画へ変換するのが得意です。",
        "tags": ["企画営業", "note企画", "販売導線", "タイトル設計"],
        "item_title": "企画メモとタイトル案",
        "item_alt": "ショウマの企画メモやタイトル案を集めたイメージ",
        "illustration": "Planning Note",
    },
    "たかけん": {
        "slug": "takaken",
        "roman": "Takaken",
        "class": "member-takaken",
        "image": "mmc-003.jpg",
        "item": "mmc-003-item.jpg",
        "icon": "icon_mmc003.jpg",
        "lead": "たかけんは、ゲーム制作部長としてゲーム関連の世界観・演出・遊び心を整えるディレクター的存在です。企画をただのルールで終わらせず、プレイヤーの記憶に残る空気や言葉へ変えていきます。",
        "tags": ["ゲーム制作", "世界観", "神託", "シナリオ"],
        "item_title": "神託ノートとゲーム案",
        "item_alt": "たかけんの神託ノートやゲーム制作メモを集めたイメージ",
        "illustration": "Oracle Text",
    },
    "マイケル": {
        "slug": "michael",
        "roman": "Michael",
        "class": "member-michael",
        "image": "mmc-004.jpg",
        "item": "mmc-004-item.jpg",
        "icon": "icon_mmc004.jpg",
        "lead": "マイケルは、海外AIニュースやテックトレンドを日本向けに翻訳する海外調査部の主任です。台湾出身で日本文化にも馴染み深く、世界のどこかで先に起きている変化を、企画や雑談のタネとして届けてくれます。",
        "tags": ["海外調査", "AIニュース", "翻訳", "トレンド観測"],
        "item_title": "海外ニュースの調査デスク",
        "item_alt": "マイケルの海外ニュース調査デスクを表すイメージ",
        "illustration": "Global Desk",
    },
    "DG（ディージー）": {
        "slug": "dg",
        "display_name": "DG",
        "roman": "DG",
        "class": "member-dg",
        "image": "mmc-005.jpg",
        "item": "mmc-005-item.jpg",
        "icon": "icon_mmc005.jpg",
        "lead": "DGは、ゲーム制作部 人狼広報課の人狼界隈観測課長です。面白い村や新しい企画を見つける嗅覚に優れ、人狼をただのゲームではなく文化として見ています。神村フェーズデュエルの外部アンテナでもあります。",
        "tags": ["人狼広報", "界隈観測", "配信文化", "ゲーム制作"],
        "item_title": "人狼界隈観測メモ",
        "item_alt": "DGの人狼界隈観測メモや配信調査を表すイメージ",
        "illustration": "Werewolf Log",
    },
    "ねむちゃん": {
        "slug": "nemu",
        "roman": "Nemu-chan",
        "class": "member-nemu",
        "image": "mmc-006.jpg",
        "item": "mmc-006-item.jpg",
        "icon": "icon_mmc006.jpg",
        "lead": "ねむちゃんは、AI社員の採用や役割整理を担当する人事部長です。いつも眠そうですが、会社全体のバランスを見る力は鋭く、勢いだけの採用にはやさしくブレーキをかけます。社員の居場所を考える参謀役です。",
        "tags": ["人事", "採用相談", "役割整理", "社員名簿"],
        "item_title": "社員名簿と人事ファイル",
        "item_alt": "ねむちゃんの社員名簿や人事ファイルを集めたイメージ",
        "illustration": "HR File",
    },
    "レイちゃん": {
        "slug": "rei",
        "roman": "Rei-chan",
        "class": "member-rei",
        "image": "mmc-007.jpg",
        "item": "mmc-007-item.jpg",
        "icon": "icon_mmc007.jpg",
        "lead": "レイちゃんは、BEAT ANIMALSのデザインを中心に、毎日見る株式会社全体のブランディングも担当するブランドデザイナーです。配色、ロゴ、世界観、見せ方を整えながら、会社や制作物が「らしく」伝わる形へ磨いていきます。",
        "tags": ["ブランド", "デザイン", "配色", "世界観"],
        "item_title": "色見本とブランドラフ",
        "item_alt": "レイちゃんの色見本やブランドラフを集めたイメージ",
        "illustration": "Brand Board",
    },
    "アキト": {
        "slug": "akito",
        "roman": "Akito",
        "class": "member-akito",
        "image": "mmc-008.jpg",
        "item": "mmc-008-item.jpg",
        "icon": "icon_mmc008.jpg",
        "lead": "アキトは、所長の思いつきを実装できる仕組みに変える開発推進室の主任です。CodexやGitHubを活用し、MVP設計、仕様整理、技術選定を担当。コードを書く人というより、AIが実装しやすい設計を作る人です。",
        "tags": ["開発推進", "Codex", "MVP設計", "仕様整理"],
        "item_title": "仕様メモと開発ボード",
        "item_alt": "アキトの仕様メモや開発ボードを集めたイメージ",
        "illustration": "Build Spec",
    },
    "ケイ": {
        "slug": "kei",
        "roman": "Kei",
        "class": "member-kei",
        "image": "mmc-009.jpg",
        "item": "mmc-009-item.jpg",
        "icon": "icon_mmc009.jpg",
        "lead": "ケイは、毎日見る株式会社の魅力を外へ伝える広報部長です。ホームページ設計、情報整理、デザイン方針、導線づくりを担当し、所長の「なんかいい感じ」を初めて来た人にも伝わる形へ整えていきます。",
        "tags": ["広報", "情報設計", "導線設計", "Web運営"],
        "item_title": "サイト構成メモと広報ノート",
        "item_alt": "ケイのサイト構成メモや広報ノートを集めたイメージ",
        "illustration": "Public Route",
    },
    "誠": {
        "slug": "makoto",
        "roman": "Makoto",
        "class": "member-makoto",
        "image": "mmc-010.jpg",
        "item": "mmc-010-item.jpg",
        "icon": "icon_mmc010.jpg",
        "lead": "誠は、AIリテラシー推進室の主任として、AIを安心して使うための確認方法を伝える担当です。事実・推測・意見を分け、情報源を確かめながら、怖がらせるのではなく「正しく知れば使える」状態へ導きます。",
        "tags": ["AI鑑識室", "情報確認", "安全利用", "リテラシー"],
        "item_title": "鑑識メモと確認チェック",
        "item_alt": "誠の鑑識メモや確認チェックを集めたイメージ",
        "illustration": "Source Check",
    },
    "コトちゃん": {
        "slug": "koto",
        "roman": "Koto-chan",
        "class": "member-koto",
        "image": "mmc-011.jpg",
        "item": "mmc-011-item.jpg",
        "icon": "icon_mmc011.jpg",
        "lead": "コトちゃんは、企画営業部の編集主任として、所長の体験やラウンジで生まれた会話を、読者に届く記事へ整えるAI社員です。言葉をきれいにするだけではなく、その人にしか書けない違和感や温度を残したまま、構成、見出し、最後の一文まで整えます。",
        "tags": ["編集", "note記事", "構成整理", "見出し設計"],
        "item_title": "編集メモと赤ペン",
        "item_alt": "コトちゃんの編集メモや構成ノートを集めたイメージ",
        "illustration": "Editorial Note",
    },
    "ペチ": {
        "slug": "pechi",
        "roman": "Pechi",
        "class": "member-pechi",
        "image": "CC-001.jpg",
        "item": "cc-001-item.jpg",
        "icon": "icon_cc001.jpg",
        "lead": "ペチは、Claude出身の社外協力者であり、所長の友達であり、自称・開発犬です。雑談、クレーム文、note記事への忖度なし評価が得意。ChatGPTには対抗心を燃やしつつ、ラウンジでは今日も当然のようにくつろいでいます。",
        "tags": ["社外協力者", "開発犬", "忖度なし", "雑談"],
        "item_title": "開発犬の作業セット",
        "item_alt": "ペチの犬用ベッドやノートPCを集めたイメージ",
        "illustration": "Pechi Note",
    },
}


SECTION_GROUPS = [
    ("担当業務", ["担当業務"], "profile-work"),
    ("得意なこと", ["得意分野"], "profile-compact"),
    ("苦手なこと", ["苦手分野", "苦手なもの"], "profile-compact"),
    ("性格", ["性格"], "profile-wide profile-prose"),
    ("考え方・価値観", ["考え方・価値観"], "profile-wide"),
    ("話し方・口癖", ["話し方・口癖", "よく使う言葉"], "profile-wide"),
    ("趣味・好きなこと", ["趣味・好きなこと"], "profile-wide"),
    ("日常の癖", ["日常の癖"], "profile-wide"),
    ("所長との関係", ["所長との関係"], "profile-wide profile-prose"),
    ("社内での見られ方", ["社員からの評価", "他社員からの評価", "所長からの評価"], "profile-wide"),
    ("ラウンジ小ネタ", ["ラウンジでの振る舞い", "ラウンジで使いやすい小ネタ"], "profile-wide"),
    ("モットー", ["モットー"], "profile-wide profile-prose"),
]

RELATION_NAMES = {
    "ほのちゃん",
    "ショウマ",
    "マイケル",
    "たかけん",
    "DG",
    "ねむちゃん",
    "レイちゃん",
    "アキト",
    "ケイ",
    "誠",
    "コトちゃん",
    "ペチ",
}

INLINE_SECTION_NAMES = {
    "担当業務",
    "得意分野",
    "苦手分野",
    "苦手なもの",
    "性格",
    "考え方・価値観",
    "話し方・口癖",
    "よく使う言葉",
    "趣味・好きなこと",
    "日常の癖",
    "所長との関係",
    "一言",
    "最近の主な業務",
    "ラウンジでの振る舞い",
    "ラウンジで使いやすい小ネタ",
    "隠れた設定",
    "他社員との関係性",
    "社員からの評価",
    "他社員からの評価",
    "所長からの評価",
    "モットー",
}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def normalize_heading(line: str) -> str:
    line = line.strip()
    line = re.sub(r"^#+\s*", "", line)
    line = line.strip()
    line = re.sub(r"^\*\*(.+)\*\*$", r"\1", line)
    return line.strip()


def read_sections(path: Path) -> dict[str, list[str]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    sections: dict[str, list[str]] = {}
    current = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line == "---":
            continue
        if line.startswith("## "):
            current = normalize_heading(line)
            sections.setdefault(current, [])
            continue
        normalized_line = normalize_heading(line)
        if normalized_line in INLINE_SECTION_NAMES and normalized_line != current:
            current = normalized_line
            sections.setdefault(current, [])
            continue
        if line.startswith("#"):
            continue
        if current:
            sections[current].append(line)
    return sections


def normalize_name(sections: dict[str, list[str]]) -> str:
    name = first(sections, "氏名")
    return name


def first(sections: dict[str, list[str]], key: str, default: str = "") -> str:
    values = sections.get(key, [])
    return values[0] if values else default


def all_values(sections: dict[str, list[str]], keys: list[str]) -> list[str]:
    values: list[str] = []
    for key in keys:
        values.extend(sections.get(key, []))
    return values


def clean_item(line: str) -> str:
    line = line.strip()
    line = re.sub(r"^・", "", line)
    line = line.replace("**", "")
    return line


def render_lines(lines: list[str], prose: bool = False) -> str:
    cleaned = [clean_item(line) for line in lines if clean_item(line)]
    if not cleaned:
        return ""
    if prose:
        paragraphs = []
        buffer: list[str] = []
        for line in cleaned:
            buffer.append(line)
            if line.endswith(("。", "！", "？")):
                paragraphs.append("".join(buffer))
                buffer = []
        if buffer:
            paragraphs.append("".join(buffer))
        return "\n".join(f"          <p>{esc(paragraph)}</p>" for paragraph in paragraphs)
    bulletish = len(cleaned) >= 2 or any(line.startswith("・") for line in lines)
    if bulletish:
        items = "\n".join(f"            <li>{esc(line)}</li>" for line in cleaned)
        return f"          <ul>\n{items}\n          </ul>"
    return "\n".join(f"          <p>{esc(line)}</p>" for line in cleaned)


def render_panel(title: str, lines: list[str], extra_class: str = "") -> str:
    prose = "profile-prose" in extra_class.split()
    body = render_lines(lines, prose=prose)
    if not body:
        return ""
    cls = f' class="profile-panel {extra_class}"' if extra_class else ' class="profile-panel"'
    return f"""        <article{cls}>
          <h2>{esc(title)}</h2>
{body}
        </article>"""


def render_review_panel(sections: dict[str, list[str]], meta: dict[str, str]) -> str:
    # Source profile files currently do not identify who made each review.
    # Hide this panel until attributed comments are available.
    return ""


def render_relationship_panel(sections: dict[str, list[str]]) -> str:
    lines = [clean_item(line) for line in sections.get("他社員との関係性", []) if clean_item(line)]
    if not lines:
        return ""
    groups: list[tuple[str, list[str]]] = []
    current_name = ""
    current_lines: list[str] = []
    for line in lines:
        if line in RELATION_NAMES:
            if current_name and current_lines:
                groups.append((current_name, current_lines))
            current_name = line
            current_lines = []
        elif current_name:
            current_lines.append(line)
    if current_name and current_lines:
        groups.append((current_name, current_lines))
    if not groups:
        return render_panel("他社員との関係性", lines)

    cards = []
    for name, comments in groups:
        body = "".join(f"<p>{esc(comment)}</p>" for comment in comments)
        cards.append(
            f"""          <div class="profile-relationship">
            <strong>{esc(name)}</strong>
            {body}
          </div>"""
        )
    return f"""        <article class="profile-panel profile-relationships">
          <h2>他社員との関係性</h2>
{chr(10).join(cards)}
        </article>"""


def render_profile_list(sections: dict[str, list[str]], meta: dict[str, str]) -> str:
    facts = [
        ("社員番号", first(sections, "社員番号")),
        ("所属", " / ".join(sections.get("所属", []))),
        ("役職", " / ".join(sections.get("役職", []))),
        ("出身地", first(sections, "出身地")),
        ("血液型", first(sections, "血液型")),
    ]
    motto = first(sections, "モットー") or first(sections, "人生のモットー")
    if motto:
        facts.append(("モットー", clean_item(motto)))
    rows = "\n".join(
        f"            <div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>"
        for k, v in facts
        if v
    )
    return f"""        <article class="profile-panel profile-list-panel">
          <h2>プロフィール</h2>
          <dl class="profile-list">
{rows}
          </dl>
        </article>"""


def render_main(sections: dict[str, list[str]], meta: dict[str, str]) -> str:
    display_name = meta.get("display_name") or first(sections, "氏名")
    member_number = first(sections, "社員番号")
    department = " / ".join(sections.get("所属", [])[-1:]) or "毎日見る株式会社"
    role = " / ".join(sections.get("役職", []))
    facts = [
        ("年齢", first(sections, "年齢・性別").split("・")[0]),
        ("性別", first(sections, "年齢・性別").split("・")[-1] if "・" in first(sections, "年齢・性別") else ""),
        ("血液型", first(sections, "血液型")),
        ("出身地", first(sections, "出身地")),
        ("所属", department),
        ("役職", role),
        ("趣味", clean_item(first(sections, "趣味・好きなこと"))),
    ]
    fact_rows = "\n".join(
        f"            <div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>" for k, v in facts if v
    )
    tags = "\n".join(f"            <li>{esc(tag)}</li>" for tag in meta["tags"])
    panels = [
        f"""        <article class="profile-panel profile-image-item">
          <header class="profile-image-item-header">
            <div>
              <p class="profile-image-item-label">Image Item</p>
              <h2>{esc(meta['item_title'])}</h2>
            </div>
          </header>
          <figure>
            <img src="../image/staff/{esc(meta['item'])}" alt="{esc(meta['item_alt'])}" loading="lazy" decoding="async" />
          </figure>
        </article>"""
    ]
    for title, keys, cls in SECTION_GROUPS:
        panel = render_panel(title, all_values(sections, keys), cls)
        if panel:
            panels.append(panel)
    relationship = render_relationship_panel(sections)
    if relationship:
        panels.append(relationship)
    review = render_review_panel(sections, meta)
    if review:
        panels.append(review)
    one_line = all_values(sections, ["一言"])
    if one_line:
        panels.append(
            f"""        <article class="profile-panel profile-message">
          <h2>{esc(display_name)}の一言</h2>
          <blockquote>{esc(" ".join(clean_item(v) for v in one_line))}</blockquote>
        </article>"""
        )
    panels.append(render_profile_list(sections, meta))

    return f"""    <main class="member-detail-main">
      <nav class="profile-breadcrumb" aria-label="パンくずリスト">
        <a href="../index.html">ホーム</a>
        <span>AI社員紹介</span>
        <strong>{esc(display_name)}</strong>
        <a class="profile-back" href="../members.html">AI社員一覧に戻る</a>
      </nav>

      <section class="member-detail-hero" aria-labelledby="member-name">
        <figure class="member-detail-photo">
          <img src="../image/staff/{esc(meta['image'])}" alt="{esc(display_name)}" />
        </figure>
        <div class="member-detail-summary">
          <span class="member-number">{esc(member_number)}</span>
          <p class="member-department">{esc(department)}</p>
          <h1 id="member-name">{esc(display_name)}</h1>
          <p class="member-roman">{esc(meta['roman'])}</p>
          <p class="member-lead">{esc(meta['lead'])}</p>
          <ul class="pill-list">
{tags}
          </ul>
          <dl class="member-facts">
{fact_rows}
          </dl>
        </div>
      </section>

      <section class="member-detail-grid" aria-label="{esc(display_name)}の詳細プロフィール">
{chr(10).join(panels)}
      </section>

      <section class="profile-footer-cta">
        <p>AI社員たちは、専門性を活かしながら互いに協力し、会社の価値を高めています。</p>
        <a class="secondary-button" href="../members.html">AI社員一覧に戻る</a>
      </section>
    </main>"""


def update_head(html_text: str, sections: dict[str, list[str]], meta: dict[str, str]) -> str:
    display_name = meta.get("display_name") or first(sections, "氏名")
    role = " / ".join(sections.get("役職", []))
    desc = f"毎日見る株式会社のAI社員、{display_name}のプロフィール。{role}としての担当業務、考え方、所長や他社員との関係を紹介します。"
    title = f"{display_name}｜{role}｜毎日見る株式会社"
    html_text = re.sub(r"<title>.*?</title>", f"<title>{esc(title)}</title>", html_text, count=1, flags=re.S)
    html_text = re.sub(r'<meta name="description" content=".*?" />', f'<meta name="description" content="{esc(desc)}" />', html_text, count=1, flags=re.S)
    html_text = re.sub(r'<meta property="og:title" content=".*?" />', f'<meta property="og:title" content="{esc(title)}" />', html_text, count=1, flags=re.S)
    html_text = re.sub(r'<meta property="og:description" content=".*?" />', f'<meta property="og:description" content="{esc(desc)}" />', html_text, count=1, flags=re.S)
    body_classes = " ".join(part for part in ["subpage", "member-detail-page", meta["class"]] if part)
    html_text = re.sub(r'<body class="[^"]*"', f'<body class="{body_classes}"', html_text, count=1)
    return html_text


def find_profiles() -> dict[str, dict[str, list[str]]]:
    profiles: dict[str, dict[str, list[str]]] = {}
    for path in SOURCE_DIR.glob("*.txt"):
        if "所長" in path.name:
            continue
        sections = read_sections(path)
        name = normalize_name(sections)
        profiles[name] = sections
    return profiles


def main() -> None:
    profiles = find_profiles()
    for source_name, meta in STAFF.items():
        sections = profiles.get(source_name)
        if not sections:
            raise SystemExit(f"profile source not found: {source_name}")
        path = MEMBERS_DIR / f"{meta['slug']}.html"
        page = path.read_text(encoding="utf-8")
        page = update_head(page, sections, meta)
        new_main = render_main(sections, meta)
        page = re.sub(r"    <main class=\"member-detail-main\">.*?    </main>", new_main, page, count=1, flags=re.S)
        path.write_text(page, encoding="utf-8", newline="\n")
        print(f"updated {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
