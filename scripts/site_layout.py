#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARTIALS_DIR = ROOT / "src" / "partials"

HEADER_START = "<!-- SITE_HEADER_START -->"
HEADER_END = "<!-- SITE_HEADER_END -->"
FOOTER_START = "<!-- SITE_FOOTER_START -->"
FOOTER_END = "<!-- SITE_FOOTER_END -->"

HEADER_BLOCK_RE = re.compile(
    r"^[ \t]*<!-- SITE_HEADER_START -->[\s\S]*?^[ \t]*<!-- SITE_HEADER_END -->",
    re.MULTILINE,
)
FOOTER_BLOCK_RE = re.compile(
    r"^[ \t]*<!-- SITE_FOOTER_START -->[\s\S]*?^[ \t]*<!-- SITE_FOOTER_END -->",
    re.MULTILINE,
)
HEADER_TAG_RE = re.compile(
    r'^[ \t]*<header class="site-header"[\s\S]*?</header>',
    re.MULTILINE,
)
FOOTER_TAG_RE = re.compile(
    r'^[ \t]*<footer class="site-footer"[\s\S]*?</footer>',
    re.MULTILINE,
)

CURRENT_KEYS = [
    "home",
    "about",
    "members",
    "services",
    "works",
    "gallery",
    "lounge",
    "news",
    "contact",
]


def render_partial(name: str, *, prefix: str, current: str) -> str:
    text = (PARTIALS_DIR / name).read_text(encoding="utf-8")
    replacements = {"{{ prefix }}": prefix}
    for key in CURRENT_KEYS:
        replacements[f"{{{{ current_{key} }}}}"] = (
            ' aria-current="page"' if key == current else ""
        )
    for marker, value in replacements.items():
        text = text.replace(marker, value)
    return text.strip()


def indent_block(text: str, spaces: int = 4) -> str:
    prefix = " " * spaces
    return "\n".join(f"{prefix}{line}" if line else "" for line in text.splitlines())


def render_header(prefix: str, current: str) -> str:
    return render_partial("header.html", prefix=prefix, current=current)


def render_footer(prefix: str) -> str:
    return render_partial("footer.html", prefix=prefix, current="")


def marked_block(start: str, body: str, end: str) -> str:
    return f"    {start}\n{indent_block(body)}\n    {end}"


def replace_block(
    html_text: str,
    *,
    marked_re: re.Pattern[str],
    tag_re: re.Pattern[str],
    replacement: str,
    label: str,
) -> str:
    if marked_re.search(html_text):
        return marked_re.sub(replacement, html_text, count=1)
    if tag_re.search(html_text):
        return tag_re.sub(replacement, html_text, count=1)
    raise ValueError(f"Could not find {label} block.")


def page_context(path: Path) -> tuple[str, str]:
    rel = path.resolve().relative_to(ROOT).as_posix()
    parts = rel.split("/")
    prefix = "../" * (len(parts) - 1)
    first = parts[0]
    name = parts[-1]

    if rel == "index.html":
        current = "home"
    elif name == "about.html":
        current = "about"
    elif first == "members" or name == "members.html":
        current = "members"
    elif name == "services.html":
        current = "services"
    elif first == "works" or name == "works.html":
        current = "works"
    elif name.startswith("gallery"):
        current = "gallery"
    elif first == "lounge-archive" or name == "lounge.html":
        current = "lounge"
    elif name == "news.html":
        current = "news"
    elif name == "contact.html":
        current = "contact"
    else:
        current = ""

    return prefix, current


def apply_layout_to_html(html_text: str, *, prefix: str, current: str) -> str:
    html_text = replace_block(
        html_text,
        marked_re=HEADER_BLOCK_RE,
        tag_re=HEADER_TAG_RE,
        replacement=marked_block(HEADER_START, render_header(prefix, current), HEADER_END),
        label="site header",
    )
    return replace_block(
        html_text,
        marked_re=FOOTER_BLOCK_RE,
        tag_re=FOOTER_TAG_RE,
        replacement=marked_block(FOOTER_START, render_footer(prefix), FOOTER_END),
        label="site footer",
    )


def apply_layout_to_file(path: Path) -> bool:
    prefix, current = page_context(path)
    original = path.read_text(encoding="utf-8")
    updated = apply_layout_to_html(original, prefix=prefix, current=current)
    if updated == original:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def iter_site_html_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT)
        if rel.parts[0] in {".git", ".codex", ".agents"}:
            continue
        if len(rel.parts) >= 2 and rel.parts[:2] == ("src", "partials"):
            continue
        if rel.parent == Path(".") and rel.name.startswith("google"):
            continue
        if rel.parts[:1] == ("gallery",):
            continue
        files.append(path)
    return sorted(files)
