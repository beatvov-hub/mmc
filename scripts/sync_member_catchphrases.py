"""Synchronize the approved catchphrases without regenerating profile content."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/data/memberCatchphrases.json"
STYLE_VERSION = "20261117-member-catchphrase"
PHRASE_RE = re.compile(r'<p class="member-catchphrase">.*?</p>\s*')


def sync() -> None:
    phrases = json.loads(DATA.read_text(encoding="utf-8"))
    index_path = ROOT / "members.html"
    index = index_path.read_text(encoding="utf-8")
    updates: list[tuple[Path, str]] = []
    for slug, phrase in phrases.items():
        markup = f'<p class="member-catchphrase">{html.escape(phrase)}</p>'
        card_re = re.compile(r'<article class="member-card">(?:(?!</article>)[\s\S])*?href="members/' + re.escape(slug) + r'"(?:(?!</article>)[\s\S])*?</article>')
        matches = list(card_re.finditer(index))
        if len(matches) != 1:
            raise ValueError(f"Expected one member card for {slug}, found {len(matches)}")
        card = PHRASE_RE.sub('', matches[0].group())
        card, count = re.subn(r'(<span class="member-meta">[^<]*</span>)(<h2>)', lambda m: m.group(1) + markup + m.group(2), card, count=1)
        if count != 1:
            raise ValueError(f"Missing member card heading for {slug}")
        index = index[:matches[0].start()] + card + index[matches[0].end():]

        profile_path = ROOT / "members" / f"{slug}.html"
        profile = PHRASE_RE.sub('', profile_path.read_text(encoding="utf-8"))
        profile, count = re.subn(r'(<p class="member-department">[^<]*</p>\n)(\s*<h1 id="member-name">)', lambda m: m.group(1) + '          ' + markup + '\n' + m.group(2), profile, count=1)
        if count != 1:
            raise ValueError(f"Missing profile heading for {slug}")
        profile = re.sub(r'(href="../styles\.css\?v=)[^"]+', lambda m: m.group(1) + STYLE_VERSION, profile, count=1)
        updates.append((profile_path, profile))
    index = re.sub(r'(href="styles\.css\?v=)[^"]+', lambda m: m.group(1) + STYLE_VERSION, index, count=1)
    updates.append((index_path, index))
    for path, text in updates:
        path.write_text(text, encoding="utf-8", newline="\n")
    print(f"Synchronized {len(phrases)} member catchphrases.")


if __name__ == "__main__":
    sync()
