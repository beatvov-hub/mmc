#!/usr/bin/env python3
"""Build the MMC Journal from locally curated article metadata."""
import html
import json
from pathlib import Path
from urllib.parse import urlparse
from site_layout import apply_layout_to_file

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'src/data/journalItems.json'
OUTPUT = ROOT / 'about/journal/index.html'
URL = 'https://mainichi-miru.com/about/journal/'
TITLE = 'MMCジャーナル｜月報・活動記録｜毎日見るコワークス'
DESCRIPTION = '毎日見るコワークスの月報や活動記録を紹介。AI社員と所長による制作、実験、海外発信、日々の試行錯誤をnote記事とともに振り返ります。'
def e(value): return html.escape(str(value), quote=True)

def load():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    ids = set()
    for item in data:
        if item['id'] in ids or item['type'] not in ('monthly', 'essay') or urlparse(item['url']).netloc != 'note.com':
            raise ValueError('Invalid or duplicate journal entry')
        ids.add(item['id'])
    return data

def card(item):
    month = item.get('targetMonth', '')
    label = f'{month[:4]}年{int(month[5:])}月' if month else item.get('category', '')
    highlights = ''.join(f'<li>{e(h)}</li>' for h in item.get('highlights', []))
    paid = '有料記事' if item.get('isPaid') else '無料記事'
    img = item.get('imageUrl')
    image = f'<img src="{e(img)}" alt="" loading="lazy">' if img else ''
    return f'''<article class="journal-card">{image}<span class="{'journal-month' if month else 'journal-meta'}">{e(label)}</span><h3>{e(item['title'])}</h3><p class="journal-meta">note · {paid} · <time datetime="{e(item['publishedAt'])}">{e(item['publishedAt'])}</time></p><p>{e(item['summary'])}</p>{'<ul>'+highlights+'</ul>' if highlights else ''}<a href="{e(item['url'])}" target="_blank" rel="noopener noreferrer">noteで記事を読む ↗</a></article>'''

def main():
    data = load()
    monthly = sorted((x for x in data if x['type'] == 'monthly'), key=lambda x: x['targetMonth'], reverse=True)
    essays = sorted((x for x in data if x['type'] == 'essay'), key=lambda x: x.get('displayOrder', 999))
    schema = {'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'ホーム','item':'https://mainichi-miru.com/'},{'@type':'ListItem','position':2,'name':'会社概要','item':'https://mainichi-miru.com/about'},{'@type':'ListItem','position':3,'name':'MMCジャーナル','item':URL}]}
    source = f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(TITLE)}</title>
<meta name="description" content="{e(DESCRIPTION)}">
<meta property="og:title" content="{e(TITLE)}"><meta property="og:description" content="{e(DESCRIPTION)}"><meta property="og:type" content="website"><meta property="og:url" content="{URL}"><meta property="og:image" content="https://mainichi-miru.com/image/about003.webp"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../favicon.ico"><link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../../styles/journal.css"><script type="application/ld+json">{json.dumps(schema, ensure_ascii=False).replace('<', chr(92)+'u003c')}</script>
</head>
<body class="subpage"><main class="journal-main"><nav class="journal-breadcrumb" aria-label="パンくずリスト"><a href="/">ホーム</a> / <a href="/about">会社概要</a> / <span aria-current="page">MMCジャーナル</span></nav>
<section class="journal-hero"><p class="section-kicker">ABOUT / MMC JOURNAL</p><h1>MMCジャーナル</h1><p class="journal-catch">AI社員と所長が試して、作って、考えたこと。</p><p>MMCジャーナルは、毎日見るコワークスの活動記録をまとめた場所です。月ごとの振り返りや、AI社員との共同作業で生まれた出来事、制作の裏側、失敗から学んだことを紹介しています。</p></section>
<section class="journal-section"><p class="section-kicker">MONTHLY REPORT</p><h2>MMC月報</h2><p>毎日見るコワークスで、その月に何が起きたのか。制作物や実験、AI社員との出来事を月ごとに振り返ります。</p><div class="journal-grid">{''.join(map(card, monthly))}</div></section>
<section class="journal-section"><p class="section-kicker">STORIES</p><h2>MMCの読みもの</h2><p>AI社員との活動や、日々の試行錯誤から生まれた体験談・エッセイを紹介します。</p><div class="journal-grid journal-essays">{''.join(map(card, essays))}</div></section>
<section class="journal-section journal-about"><h2>MMCについて</h2><p>毎日見るコワークスは、人間の所長とAI社員たちが創作や実験を行うプロジェクトです。MMCの成り立ちや活動については会社概要でも紹介しています。</p><a href="/about">会社概要を見る →</a><a href="/about#history-title">会社沿革を見る →</a></section></main>
</body>
</html>'''
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(source, encoding='utf-8')
    apply_layout_to_file(OUTPUT)
    print(f'Generated {OUTPUT.relative_to(ROOT)} with {len(data)} entries.')

if __name__ == '__main__': main()
