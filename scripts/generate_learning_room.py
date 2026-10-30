#!/usr/bin/env python3
"""Generate the five AI learning room pages without changing the question bank."""
import json
from pathlib import Path
import generate_daily_quiz as old

ROOT = Path(__file__).resolve().parents[1]
INFO = {
    'g-kentei': ('G検定（ジェネラリスト検定）', 'AI・ディープラーニングの活用に必要な知識を学ぶ、JDLAの検定です。AIの活用を考える方に向いています。', 'AIの仕組み、活用、倫理など', [('JDLA G検定公式', 'https://www.jdla.org/certificate/general/', '試験概要、シラバスと例題を確認できます。')]),
    'it-passport': ('ITパスポート試験', 'ITを利活用するすべての社会人や学生に向けた、IPAの国家試験です。', 'IT、経営、セキュリティなど', [('IPA 試験情報', 'https://www.ipa.go.jp/shiken/kubun/ip.html', '試験の概要、シラバスや過去問題を確認できます。'), ('ITパスポート試験 出題範囲', 'https://www3.jitec.ipa.go.jp/JitesCbt/html/about/range.html', '試験範囲やシラバスを確認できます。')]),
    'generative-ai-passport': ('生成AIパスポート試験', '生成AIを安全に活用するための知識を学ぶ、生成AI活用普及協会の試験です。', '生成AIの基礎、活用、リスクなど', [('生成AIパスポート公式', 'https://guga.or.jp/outline/', '試験概要と出題範囲を確認できます。')]),
    'ds-kentei': ('データサイエンティスト検定 リテラシーレベル', 'データサイエンス、データエンジニアリング、ビジネスの基礎を学ぶ方に向けた検定です。', 'データ分析、統計、データ活用など', [('DS検定公式', 'https://www.datascientist.or.jp/dscertification/', '試験概要と関連資料を確認できます。'), ('DS検定とは', 'https://www.datascientist.or.jp/dscertification/what/', '出題範囲と求められる知識を確認できます。')]),
}
e = old.escape

def hub(data):
    cards = ''.join(f'<article class="quiz-qualification-card"><h2><a href="/quiz/{e(q["id"])}/">{e(INFO[q["id"]][0])}</a></h2><p>{e(INFO[q["id"]][1])}</p><p>学べる内容：{e(INFO[q["id"]][2])}</p><a href="/quiz/{e(q["id"])}/">学習ページへ →</a></article>' for q in data['qualifications'])
    body = f'''<main class="page-main quiz-main"><div class="page-width"><section class="quiz-hero" aria-labelledby="learning-title"><img class="quiz-hero-art" src="../image/quiz/daily-quiz-hero.webp" alt="" width="1536" height="1024" fetchpriority="high"><div class="quiz-hero-copy"><p class="section-kicker">AI LEARNING ROOM</p><h1 id="learning-title" class="quiz-hero-logo">AI学習室</h1><p class="quiz-hero-catch">資格の基礎知識を、<br>クイズで楽しく確認。</p><p class="quiz-hero-description">四択に答え、正解と各選択肢の解説を読みながら繰り返し学べます。</p><a class="quiz-hero-action" href="#qualifications">資格から選ぶ <span aria-hidden="true">↘</span></a></div></section><section class="quiz-section" id="qualifications"><h2>資格から選ぶ</h2><div class="quiz-card-grid">{cards}</div></section><section class="quiz-section"><h2>学習の進め方</h2><p>四択で基礎を確認し、解説を読んで復習。公式資料とあわせて学べます。</p><p>この教材は公式教材や本番試験問題ではありません。基礎用語や概念の確認に利用し、公式シラバスや教材と併用してください。</p></section></div></main>'''
    return old.document('AI学習室｜資格の基礎知識をクイズで学ぶ', 'AI・IT関連資格の基礎知識を四択クイズと解説で学ぶAI学習室。', body)

def qualification(q):
    slug=q['id']; name, description, scope, links=INFO[slug]
    resources=''.join(f'<li><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(title)}（公式）</a>：{e(desc)}</li>' for title,url,desc in links)
    body=f'''<main class="page-main quiz-main"><div class="page-width">{old.breadcrumb([('AI学習室','/quiz/'),(name,None)])}<section class="quiz-intro"><p class="section-kicker">AI LEARNING ROOM</p><h1>{e(name)}</h1><p>{e(description)}</p><p>このクイズで学べる範囲：{e(scope)}。基礎知識を確認し、理解を深めるきっかけにできます。</p></section><section class="quiz-section"><h2>クイズに挑戦</h2><p>500問の中から出題します。公式教材・本番問題ではありません。</p><div data-learning-quiz data-qualification="{e(slug)}" data-source="/src/data/dailyQuiz.json">問題を読み込んでいます。</div></section><section class="quiz-section"><h2>学習の進め方</h2><ol><li>基礎知識をクイズで確認する</li><li>正解と選択肢の解説を読む</li><li>間違えた問題を復習する</li><li>公式シラバスや教材で理解を深める</li></ol></section><section class="quiz-section"><h2>公式資料・参考情報</h2><p>日程や受験料、最新の試験範囲は実施団体の情報をご確認ください。</p><ul>{resources}</ul></section></div></main>'''
    page = old.document(f'{name}｜AI学習室', f'{name}の基礎知識を四択クイズと解説で確認。公式資料も紹介します。', body, '../../scripts/learning-room-quiz.js')
    return page.replace('</head>', '<link rel="stylesheet" href="../../styles/learning-room.css">\n</head>')

def main():
    data=json.loads(old.DATA_PATH.read_text(encoding='utf-8')); old.validate(data)
    old.write_page(ROOT/'quiz/index.html', hub(data), 1)
    for q in data['qualifications']:
        old.write_page(ROOT/'quiz'/q['id']/'index.html', qualification(q), 2)
    print('Generated five learning room pages.')

if __name__ == '__main__': main()
