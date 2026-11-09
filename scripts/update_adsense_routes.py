#!/usr/bin/env python3
"""Build an exact AdSense allowlist from the site's existing content records."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src/data/adsense-routes.json'
BASE = 'https://mainichi-miru.com'


def canonical(file: Path, expected: str) -> str:
    text = file.read_text(encoding='utf-8')
    match = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', text)
    if not match or match.group(1) != BASE + expected:
        raise ValueError(f'Unexpected canonical for {file}: expected {expected}')
    if re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex', text, re.I):
        raise ValueError(f'Noindex page cannot be included: {file}')
    return expected


def routes():
    result = {'/': 'home', '/quiz/': 'learning'}
    works = json.loads((ROOT / 'src/data/workStories.json').read_text(encoding='utf-8'))
    for work in works:
        slug = work['slug']
        file = ROOT / 'works' / f'{slug}.html'
        if file.exists():
            result[canonical(file, f'/works/{slug}')] = 'work'
    for source in sorted((ROOT / 'src/data/ai-forensics').glob('*.json')):
        article = json.loads(source.read_text(encoding='utf-8'))
        slug = article['id']
        file = ROOT / 'ai-forensics' / f'{slug}.html'
        if file.exists():
            result[canonical(file, f'/ai-forensics/{slug}')] = 'forensics'
    return dict(sorted(result.items()))


def main():
    content = json.dumps(routes(), ensure_ascii=False, indent=2) + '\n'
    if '--check' in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != content:
            raise SystemExit('AdSense route list is stale; run python -B scripts/update_adsense_routes.py')
    else:
        OUT.write_text(content, encoding='utf-8')
    print(f'{len(routes())} exact routes')


if __name__ == '__main__':
    main()
