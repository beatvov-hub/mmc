from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import html
import json
import re
import subprocess

main = Path(r'C:\Users\user\Documents\GitHub\mmc')
old = Path(r'C:\Users\user\Documents\GitHub\mmc-quiz-seo-audit')
files = subprocess.run(['git','diff','--name-only','--','quiz'],cwd=old,capture_output=True,check=True).stdout.decode().splitlines()
pages = [p for p in files if p.endswith('/index.html')]

def features(text):
    desc = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', text)
    schema = re.search(r'<script type="application/ld\+json">(.*?)</script>',text,re.S)
    raw = json.loads(schema.group(1)) if schema else []
    nodes = raw if isinstance(raw,list) else [raw]
    quizzes = [node for node in nodes if isinstance(node,dict) and node.get('@type') == 'Quiz']
    answers = [html.unescape(x) for x in re.findall(r'<h[234][^>]*>正解：([^<]+)</h[234]>',text)]
    return html.unescape(desc.group(1)) if desc else None, quizzes, answers

def compare(p):
    a=features((old/p).read_text(encoding='utf-8'))
    b=features((main/p).read_text(encoding='utf-8'))
    return p, tuple(a[i]==b[i] for i in range(3)), len(a[1]),len(a[2])

with ThreadPoolExecutor(max_workers=12) as pool: results=list(pool.map(compare,pages))
summary=Counter(result[1] for result in results)
diff=[p for p,match,_,_ in results if not all(match)]
print('pages compared',len(results),'description/schema/answers equality',dict(summary))
print('Quiz schema pages',sum(q>0 for _,_,q,_ in results),'answer headings',sum(a for _,_,_,a in results))
print('different pages',len(diff)); print(*diff[:12],sep='\n')
old_rotation=json.loads((old/'quiz/daily-rotation.json').read_text(encoding='utf-8'))
new_rotation=json.loads((main/'quiz/daily-rotation.json').read_text(encoding='utf-8'))
print('rotation days old/main',len(old_rotation.get('days',{})),len(new_rotation.get('days',{})))
