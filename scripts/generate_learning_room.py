#!/usr/bin/env python3
"""Generate the five AI learning room pages without changing the question bank."""
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
import generate_daily_quiz as old
import generate_ai_forensics as forensics

ROOT = Path(__file__).resolve().parents[1]
INFO = {
    'g-kentei': ('G検定（ジェネラリスト検定）', 'AI・ディープラーニングの活用に必要な知識を学ぶ、JDLAの検定です。AIの活用を考える方に向いています。', 'AIの仕組み、活用、倫理など', [('JDLA G検定公式', 'https://www.jdla.org/certificate/general/', '試験概要、シラバスと例題を確認できます。')]),
    'it-passport': ('ITパスポート試験', 'ITを利活用するすべての社会人や学生に向けた、IPAの国家試験です。', 'IT、経営、セキュリティなど', [('IPA 試験情報', 'https://www.ipa.go.jp/shiken/kubun/ip.html', '試験の概要、シラバスや過去問題を確認できます。'), ('ITパスポート試験 出題範囲', 'https://www3.jitec.ipa.go.jp/JitesCbt/html/about/range.html', '試験範囲やシラバスを確認できます。')]),
    'generative-ai-passport': ('生成AIパスポート試験', '生成AIを安全に活用するための知識を学ぶ、生成AI活用普及協会の試験です。', '生成AIの基礎、活用、リスクなど', [('生成AIパスポート公式', 'https://guga.or.jp/outline/', '試験概要と出題範囲を確認できます。')]),
    'ds-kentei': ('データサイエンティスト検定 リテラシーレベル', 'データサイエンス、データエンジニアリング、ビジネスの基礎を学ぶ方に向けた検定です。', 'データ分析、統計、データ活用など', [('DS検定公式', 'https://www.datascientist.or.jp/dscertification/', '試験概要と関連資料を確認できます。'), ('DS検定とは', 'https://www.datascientist.or.jp/dscertification/what/', '出題範囲と求められる知識を確認できます。')]),
}
e = old.escape

def hub(data):
    cards = ''.join(f'<article class="quiz-qualification-card"><h3><a href="/quiz/{e(q["id"])}/">{e(INFO[q["id"]][0])}</a></h3><p>{e(INFO[q["id"]][1])}</p><p>学べる内容：{e(INFO[q["id"]][2])}</p><a href="/quiz/{e(q["id"])}/">クイズへ →</a></article>' for q in data['qualifications'])
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    published = {node.text for node in ET.parse(ROOT / 'sitemap.xml').findall('s:url/s:loc', ns)}
    articles = [a for a in forensics.load_articles() if a['id'] not in forensics.RETIRED_CASE_REDIRECTS and re.fullmatch(r'case-[a-z0-9-]+', a['id']) and (ROOT / 'ai-forensics' / (a['id'] + '.html')).is_file() and f'https://mainichi-miru.com/ai-forensics/{a["id"]}' in published]
    articles.sort(key=lambda a: (a['publishedAt'], a['id']), reverse=True)
    def article_card(a):
        img = a.get('caseImage', {})
        src = img.get('src', '') if isinstance(img, dict) else ''
        image = f'<img src="/{e(src.lstrip("/"))}" alt="" loading="lazy">' if src and (ROOT / src.lstrip('/')).is_file() else ''
        return f'<article class="learning-article">{image}<time datetime="{e(a["publishedAt"])}">{e(a["publishedAt"])}</time><h3><a href="/ai-forensics/{e(a["id"])}">{e(a["title"])}</a></h3><p>{e(a["summary"])}</p></article>'
    latest = ''.join(map(article_card, articles[:4])) or '<p>記事を準備中です。</p>'
    note_path = ROOT / 'src/data/learningRoomArticles.json'
    notes = json.loads(note_path.read_text(encoding='utf-8'))
    def note_card(a):
        img = a.get('thumbnail', '')
        image = f'<img src="{e(img)}" alt="" loading="lazy">' if img else ''
        date = f'<time datetime="{e(a["date"])}">{e(a["date"])}</time>' if a.get('date') else ''
        return f'<article class="learning-article">{image}{date}<h3><a href="{e(a["url"])}" target="_blank" rel="noopener noreferrer">{e(a["title"])}</a></h3><p>{e(a["summary"])}</p><small>{e(a.get("category", ""))}</small></article>'
    notes_html = ''.join(note_card(a) for a in sorted(notes, key=lambda a: (a.get('order', 999), a['title'])) if a.get('title') and a.get('summary') and re.match(r'^https://note\.com/', a.get('url', ''))) or '<p>記事を準備中です。</p>'
    resources = ''.join(f'<li><strong>{e(q["name"])}</strong>：{e(INFO[q["id"]][2])}を学ぶ方へ。<a href="/quiz/{e(q["id"])}/#official-heading">公式資料を探す →</a></li>' for q in data['qualifications'])
    body = f'''<main class="page-main quiz-main"><div class="page-width">
    {old.breadcrumb([('ホーム', '/'), ('AI学習室', None)])}
    <section class="quiz-hero" aria-labelledby="learning-title"><img class="quiz-hero-art" src="../image/quiz/daily-quiz-hero.webp" alt="" width="1536" height="1024" fetchpriority="high"><div class="quiz-hero-copy"><p class="section-kicker">AI LEARNING ROOM</p><h1 id="learning-title" class="quiz-hero-logo">AI学習室</h1><p class="quiz-hero-catch">AIを知る。困りごとを解決する。知識を試す。</p><p class="quiz-hero-description">AIやデジタル技術の検証記事や資格の基礎知識クイズから、気になるテーマを少しずつ学べます。</p><a class="quiz-hero-action" href="#investigation">学びの入口へ <span aria-hidden="true">↘</span></a></div></section>
    <section class="quiz-section" id="investigation"><p class="section-kicker">AI FORENSICS</p><h2>AIの困りごと・検証</h2><p>AIやデジタル技術に関するニュース、不安、トラブルについて、公開情報や根拠をもとに確認したAI鑑識室の記事を紹介します。</p><div class="learning-article-grid">{latest}</div><p><a href="/ai-forensics/">AI鑑識室の記事をもっと見る →</a></p></section>
    <section class="quiz-section learning-note"><p class="section-kicker">EXPERIENCES</p><h2>AIを知る・使う</h2><p>AIを使って困ったこと、便利だった使い方、試行錯誤から分かったことなど、実際の経験をもとにした読み物を紹介します。</p><div class="learning-article-grid">{notes_html}</div></section>
    <section class="quiz-section" id="qualifications"><p class="section-kicker">QUIZ</p><h2>資格の基礎知識クイズ</h2><p>G検定、ITパスポート、生成AIパスポート、DS検定の基礎用語や概念を四択クイズで確認し、答え合わせで解説を読めます。</p><div class="quiz-card-grid">{cards}</div><p class="quiz-note">この教材は公式教材や本番試験問題ではありません。公式シラバスや教材と併用してください。</p></section>
    <section class="quiz-section learning-resources"><p class="section-kicker">RESOURCES</p><h2>おすすめ学習資料</h2><p>AI・機械学習の基礎、生成AIの活用や安全性、関連資格について、各資格ページから公式資料を確認できます。</p><ul>{resources}</ul></section></div></main>'''
    title = 'AI学習室｜AIの困りごと・検証・資格クイズ'
    description = 'AI学習室では、AIやデジタル技術に関する検証記事、4資格の基礎知識クイズ、公式の学習資料を紹介しています。'
    page = old.document(title, description, body, structured_data=old.breadcrumb_schema([('ホーム', '/'), ('AI学習室', '/quiz/')]))
    meta = f'<meta property="og:title" content="{e(title)}｜毎日見るコワークス"><meta property="og:description" content="{e(description)}"><meta property="og:type" content="website"><meta property="og:url" content="https://mainichi-miru.com/quiz/"><meta property="og:image" content="https://mainichi-miru.com/image/quiz/daily-quiz-hero.webp"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="../styles/learning-portal.css">'
    return page.replace('</head>', meta + '\n</head>')

def qualification(q):
    slug=q['id']; name, description, scope, links=INFO[slug]
    resources=''.join(f'<li><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(title)}（公式）</a>：{e(desc)}</li>' for title,url,desc in links)
    body=f'''<main class="page-main quiz-main"><div class="page-width">{old.breadcrumb([('AI学習室','/quiz/'),(name,None)])}<section class="quiz-intro"><p class="section-kicker">AI LEARNING ROOM</p><h1>{e(name)}</h1><p>{e(description)}</p><p>このクイズで学べる範囲：{e(scope)}。基礎知識を確認し、理解を深めるきっかけにできます。</p></section><section class="quiz-section"><h2>クイズに挑戦</h2><p>500問の中から出題します。公式教材・本番問題ではありません。</p><div data-learning-quiz data-qualification="{e(slug)}" data-source="/src/data/dailyQuiz.json">問題を読み込んでいます。</div></section><section class="quiz-section"><h2>学習の進め方</h2><ol><li>基礎知識をクイズで確認する</li><li>正解と選択肢の解説を読む</li><li>間違えた問題を復習する</li><li>公式シラバスや教材で理解を深める</li></ol></section><section class="quiz-section"><h2 id="official-heading">公式資料・参考情報</h2><p>日程や受験料、最新の試験範囲は実施団体の情報をご確認ください。</p><ul>{resources}</ul></section></div></main>'''
    page = old.document(f'{name}｜AI学習室', f'{name}の基礎知識を四択クイズと解説で確認。公式資料も紹介します。', body, '../../scripts/learning-room-quiz.js')
    return page.replace('</head>', '<link rel="stylesheet" href="../../styles/learning-room.css">\n</head>')

def main():
    data=json.loads(old.DATA_PATH.read_text(encoding='utf-8')); old.validate(data)
    old.write_page(ROOT/'quiz/index.html', hub(data), 1)
    for q in data['qualifications']:
        old.write_page(ROOT/'quiz'/q['id']/'index.html', qualification(q), 2)
    print('Generated five learning room pages.')

if __name__ == '__main__': main()
