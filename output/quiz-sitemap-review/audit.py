from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET
import json
import re
import subprocess

ROOT = Path(r'C:\Users\user\Documents\GitHub\mmc')
OLD = Path(r'C:\Users\user\Documents\GitHub\mmc-quiz-seo-audit')

def git(*args, cwd=OLD):
    return subprocess.run(['git', *args], cwd=cwd, capture_output=True, check=True).stdout.decode('utf-8', 'replace')

status = git('status', '--porcelain=v1').splitlines()
counts = Counter('quiz HTML' if s[3:].startswith('quiz/') and s.endswith('/index.html') else s[3:] for s in status)
patch = git('-c', 'core.quotePath=false', 'diff', '--no-ext-diff', '--unified=0', '--', 'quiz')
categories = Counter()
unknown = defaultdict(set)
file = ''
for line in patch.splitlines():
    if line.startswith('diff --git '):
        file = line.split(' b/', 1)[-1]
    elif line.startswith(('+', '-')) and not line.startswith(('+++', '---')):
        sign, text = line[0], line[1:]
        if file.endswith('daily-rotation.json'): kind = 'rotation data'
        elif '<meta name="description"' in text: kind = 'description'
        elif 'application/ld+json' in text: kind = 'structured data'
        elif '正解：' in text: kind = 'answer heading'
        elif 'ADSENSE' in text or 'adsbygoogle' in text or 'crossorigin="anonymous"' in text: kind = 'ad markup'
        elif 'canonical' in text: kind = 'canonical'
        else:
            kind = 'other'
            if len(unknown[file]) < 3: unknown[file].add(text[:180])
        categories[(kind, sign)] += 1

ns={'x':'http://www.sitemaps.org/schemas/sitemap/0.9'}
root=ET.parse(ROOT / 'sitemap.xml').getroot()
urls=[x.findtext('x:loc',namespaces=ns) for x in root.findall('x:url',ns)]
canonical_re=re.compile(r'<link\b[^>]*\brel\s*=\s*["\']canonical["\'][^>]*>',re.I)
href_re=re.compile(r'\bhref\s*=\s*["\']([^"\']+)',re.I)
noindex_re=re.compile(r'<meta\b(?=[^>]*\bname\s*=\s*["\']robots["\'])(?=[^>]*\bcontent\s*=\s*["\'][^"\']*noindex)[^>]*>',re.I)
def check(url):
    parsed=urlsplit(url); path=unquote(parsed.path).lstrip('/')
    if not path: candidates=[ROOT/'index.html']
    elif parsed.path.endswith('/'): candidates=[ROOT/path/'index.html']
    else: candidates=[ROOT/(path+'.html'),ROOT/path/'index.html',ROOT/path]
    file=next((p for p in candidates if p.is_file()),None)
    if file is None:return (url,'missing',None)
    try: html=file.read_text(encoding='utf-8')
    except UnicodeDecodeError:return (url,'not-html',str(file.relative_to(ROOT)))
    match=canonical_re.search(html)
    canonical=href_re.search(match.group()).group(1) if match and href_re.search(match.group()) else None
    if noindex_re.search(html):return (url,'noindex',str(file.relative_to(ROOT)))
    if canonical!=url:return (url,'canonical',canonical)
    return (url,'ok',str(file.relative_to(ROOT)))
with ThreadPoolExecutor(max_workers=12) as pool: checks=list(pool.map(check,urls))
problems=[x for x in checks if x[1]!='ok']
report={'changed_files':dict(counts),'diff_line_categories':{f'{k[0]} {k[1]}':v for k,v in categories.items()},'unknown_files':len(unknown),'unknown_examples':{k:sorted(v) for k,v in list(unknown.items())[:8]},'sitemap_urls':len(urls),'duplicates':[(u,n) for u,n in Counter(urls).items() if n>1],'sitemap_checks':dict(Counter(x[1] for x in checks)),'problems':problems}
(ROOT/'output/quiz-sitemap-review/audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({**report,'problems':problems[:25]},ensure_ascii=False,indent=2))
