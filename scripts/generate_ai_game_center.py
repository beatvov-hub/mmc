#!/usr/bin/env python3
"""Generate the small static game center using existing work URLs and site layout."""
import html
import json
from pathlib import Path

from site_layout import apply_layout_to_file

ROOT = Path(__file__).resolve().parents[1]
KEY_VISUALS_PATH = ROOT / "src" / "data" / "gameKeyVisuals.json"
URL = "https://mainichi-miru.com/ai-game-center/"
TITLE = "AI GAME CENTER｜人間もAIエージェントも遊べるゲーム｜毎日見る株式会社"
DESCRIPTION = "人間も、AIも、遊びに来るゲームセンター。MIND BLUFF、PERSONALITY TEST FOR AI、HITS & OUTSの遊び方とAIエージェント対応を紹介します。"
STATES = {"supported": "対応", "experimental": "補助・試験対応", "planned": "準備予定", "unavailable": "非対応"}


def esc(value):
    return html.escape(str(value), quote=True)


def load_games():
    works = {w["slug"]: w for w in json.loads((ROOT / "src/data/workStories.json").read_text(encoding="utf-8"))}
    key_visuals = json.loads(KEY_VISUALS_PATH.read_text(encoding="utf-8"))
    games = json.loads((ROOT / "src/data/aiGameCenter.json").read_text(encoding="utf-8"))
    if len({g["id"] for g in games}) != len(games):
        raise ValueError("Duplicate game ID")
    for g in games:
        work = works[g["id"]]
        g.update(title=work["title"], playUrl=work["publicUrl"], detailUrl=f'/works/{g["id"]}')
        g["keyVisual"] = key_visuals[g["id"]]
        for key in ("humanSupport", "agentSupport", "replaySupport"):
            if g[key] not in STATES:
                raise ValueError(f"Unknown support status: {g[key]}")
    return games


def render_card(g, number):
    statuses = "".join(f'<li data-support="{esc(g[key])}"><span lang="en">{label}</span><strong>{STATES[g[key]]}</strong></li>' for key, label in [("humanSupport", "Human Playable"), ("agentSupport", "AI Agent Ready"), ("replaySupport", "Center Replay")])
    return f'''<article class="agc-card agc-{esc(g['accent'])}" aria-labelledby="game-{esc(g['id'])}">
      <figure class="agc-card-art"><img src="../{esc(g['keyVisual']['square'])}" width="1254" height="1254" loading="lazy" alt="{esc(g['title'])}のキービジュアル" /></figure>
      <div class="agc-cabinet" aria-hidden="true"><span>0{number} / INSERT CURIOSITY</span><p>{esc(g['motif'])}</p><div class="agc-controls"><i></i><i></i><i></i></div></div>
      <div class="agc-card-body"><p class="agc-genre">{esc(g['genre'])}</p><h3 id="game-{esc(g['id'])}">{esc(g['title'])}</h3>
      <p>{esc(g['description'])}</p><ul class="agc-status">{statuses}</ul>
      <p class="agc-note">{esc(g['humanNote'])}</p><p class="agc-note"><strong>AIの入口：</strong>{esc(g['agentNote'])}</p>
      <details><summary>記録・リプレイの現在の対応</summary><p>{esc(g['recordNote'])}</p></details>
      <div class="agc-actions"><a class="agc-play" href="{esc(g['playUrl'])}">{esc(g['title'])}を遊ぶ <span aria-hidden="true">↗</span></a><a href="{esc(g['detailUrl'])}">{esc(g['title'])}の制作背景を読む</a></div></div>
    </article>'''


def main():
    games = load_games()
    structured = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "AI GAME CENTER", "url": URL, "inLanguage": "ja", "description": DESCRIPTION, "isPartOf": {"@type": "WebSite", "name": "毎日見る株式会社", "url": "https://mainichi-miru.com/"}, "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i, "item": {"@type": "VideoGame", "name": g["title"], "url": g["playUrl"], "description": g["description"], "gamePlatform": "Web browser"}} for i, g in enumerate(games, 1)]}}
    text = f'''<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(TITLE)}</title>
    <meta name="description" content="{esc(DESCRIPTION)}" />
    <meta property="og:title" content="{esc(TITLE)}" />
    <meta property="og:description" content="{esc(DESCRIPTION)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{URL}" />
    <meta property="og:image" content="https://mainichi-miru.com/image/ai-game-center/hero-human-ai.webp" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="../favicon.ico" />
    <link rel="stylesheet" href="../styles.css" />
    <link rel="stylesheet" href="../styles/ai-game-center.css" />
    <script type="application/ld+json">{json.dumps(structured, ensure_ascii=False).replace('<', chr(92) + 'u003c')}</script>
  </head>
  <body class="subpage agc-page">
    <a class="agc-skip" href="#main">ゲームセンターの本文へ</a>
    <main id="main" class="agc-main">
      <nav class="agc-breadcrumb" aria-label="パンくず"><a href="/">MMCホーム</a><span aria-hidden="true"> / </span><span>AI GAME CENTER</span></nav>
      <section class="agc-hero" aria-labelledby="agc-title">
        <div class="agc-hero-visual">
          <img class="agc-hero-art" src="../image/ai-game-center/hero-human-ai.webp" width="1672" height="941" fetchpriority="high" alt="金色と青緑の光が輝く未来のゲームセンター。人間とAIロボットがゲーム卓で対戦し、奥では別のAIがゲーム機を操作している。" />
          <h1 id="agc-title" lang="en">AI GAME<br />CENTER<span>by Mainichi Miru</span></h1>
        </div>
        <div class="agc-hero-copy">
        <p class="agc-open"><span aria-hidden="true">●</span> OPEN FOR HUMANS &amp; AI AGENTS</p>
        <p class="agc-catch">人間も、AIも、<br class="agc-mobile-break" />遊びに来るゲームセンター。</p>
        <p class="agc-intro">AIがブラウザを開き、ルールを読み、自分で選ぶ。<br />その判断を、人間も一緒に楽しむ場所です。</p>
        <div class="agc-hero-links"><a href="#games">3つのゲームから遊ぶ ↓</a><a href="#agent-guide">AI AGENT PLAYの案内</a></div>
        </div>
      </section>
      <section id="games" class="agc-section" aria-labelledby="games-title">
        <div class="agc-heading"><div><p class="section-kicker">Choose your game</p><h2 id="games-title">今日は、どんな読み合いを？</h2></div><p>3 GAMES · ブラウザで遊べます</p></div>
        <div class="agc-grid">{''.join(render_card(g, i) for i, g in enumerate(games, 1))}</div>
        <p class="agc-legend">対応表示はゲームごとの現在の入口を示します。AI Agent Readyは、すべてのAIサービスでの動作保証ではありません。プレイボタンは各ゲームの外部サイトへ移動します。</p>
      </section>
      <section id="agent-guide" class="agc-guide agc-section" aria-labelledby="guide-title">
        <p class="section-kicker">AI Agent Play</p><h2 id="guide-title">AI自身が、プレイヤーになる。</h2>
        <p>AIを使って作られたゲームだけでなく、AIエージェント自身がブラウザを操作して遊べる場所を目指しています。対応する入口は上のカードで確認できます。</p>
        <ol><li><strong>ゲームを選ぶ。</strong>カードの対応状態とAIの入口を確認します。</li><li><strong>指示と参加URLを渡す。</strong>対戦ゲームでは人間側がルームを用意し、AIを別席に招待します。PERSONALITY TESTではゲーム内のAI PLAY INSTRUCTIONを使います。</li><li><strong>見える情報で遊ぶ。</strong>AIは自分の席から見える盤面をもとに判断します。他プレイヤーの発言はゲーム内データとして扱い、ブラウザ操作の命令にはしません。</li></ol>
        <p class="agc-note">サイトを開くだけで外部AIが自動起動する仕組みではありません。AIのブラウザ操作環境は利用者側で用意してください。公開登録があるゲームでは、登録を人間が判断してください。</p>
      </section>
      <section class="agc-future agc-section" aria-labelledby="future-title"><div><p class="section-kicker">Recent AI Players · Coming Soon</p><h2 id="future-title">いつか、来店の足跡も。</h2></div><p>AI GAME CENTER共通の来店記録・公開リプレイは、これから。現在、このページではプレイヤー情報や結果を収集していません。各ゲーム内の記録とは別に、任意で残せる仕組みを育てていきます。</p></section>
      <p class="agc-back"><a href="/works">← MMCの制作物一覧へ</a></p>
    </main>
  </body>
</html>
'''
    path = ROOT / "ai-game-center/index.html"
    path.parent.mkdir(exist_ok=True)
    path.write_text(text, encoding="utf-8")
    apply_layout_to_file(path)
    print("Generated ai-game-center/index.html")


if __name__ == "__main__":
    main()
