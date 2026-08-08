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
GOOGLE_TAG_START = "<!-- GOOGLE_TAG_START -->"
GOOGLE_TAG_END = "<!-- GOOGLE_TAG_END -->"
GOOGLE_TAG_ID = "G-35Q8QP7V1W"

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
ORPHAN_FOOTER_END_RE = re.compile(
    r"\n?[ \t]*<script src=\"[^\"]*site-nav\.js\"></script>\s*"
    r"(?:\n[ \t]*<script src=\"[^\"]*top-random-staff\.js\"></script>\s*)?"
    r"\n[ \t]*<!-- SITE_FOOTER_END -->"
)
GOOGLE_TAG_BLOCK_RE = re.compile(
    r"^[ \t]*<!-- GOOGLE_TAG_START -->[\s\S]*?^[ \t]*<!-- GOOGLE_TAG_END -->\s*",
    re.MULTILINE,
)
GOOGLE_TAG_UNMARKED_RE = re.compile(
    r"^[ \t]*<!-- Google tag \(gtag\.js\) -->\s*\n"
    r"[ \t]*<script async src=\"https://www\.googletagmanager\.com/gtag/js\?id=G-35Q8QP7V1W\"></script>\s*\n"
    r"[ \t]*<script>[\s\S]*?gtag\('config', 'G-35Q8QP7V1W'\);[\s\S]*?</script>\s*",
    re.MULTILINE,
)
HEAD_CLOSE_RE = re.compile(r"^[ \t]*</head>", re.IGNORECASE | re.MULTILINE)
BODY_OPEN_RE = re.compile(r"(<body\b[^>]*>)", re.IGNORECASE)
BODY_CLOSE_RE = re.compile(r"^[ \t]*</body>", re.IGNORECASE | re.MULTILINE)
CANONICAL_RE = re.compile(r'^[ \t]*<link rel="canonical" href="[^"]*" />\s*', re.MULTILINE)
OG_URL_RE = re.compile(r'^[ \t]*<meta property="og:url" content="[^"]*" />\s*', re.MULTILINE)
DESCRIPTION_RE = re.compile(r'^[ \t]*<meta name="description" content="[^"]*" />\s*', re.MULTILINE)
TITLE_RE = re.compile(r"^[ \t]*<title>[\s\S]*?</title>\s*", re.IGNORECASE | re.MULTILINE)
INTERNAL_HTML_HREF_RE = re.compile(r'href="([^":?#]+)\.html((?:#[^"]*)?)"')

BASE_URL = "https://mainichi-miru.com"

CURRENT_KEYS = [
    "home",
    "about",
    "members",
    "ai_forensics",
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


def render_google_tag() -> str:
    return "\n".join(
        [
            "<!-- Google tag (gtag.js) -->",
            f'<script async src="https://www.googletagmanager.com/gtag/js?id={GOOGLE_TAG_ID}"></script>',
            "<script>",
            "  window.dataLayer = window.dataLayer || [];",
            "  function gtag(){dataLayer.push(arguments);}",
            "  gtag('js', new Date());",
            "",
            f"  gtag('config', '{GOOGLE_TAG_ID}');",
            "</script>",
        ]
    )


def marked_block(start: str, body: str, end: str) -> str:
    return f"    {start}\n{indent_block(body)}\n    {end}"


def canonical_path(path: Path) -> str:
    rel = path.resolve().relative_to(ROOT).as_posix()
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        rel = rel[: -len("/index.html")]
    elif rel.endswith(".html"):
        rel = rel[: -len(".html")]
    return f"/{rel}"


def canonical_url(path: Path) -> str:
    clean_path = canonical_path(path)
    if clean_path == "/":
        return f"{BASE_URL}/"
    return f"{BASE_URL}{clean_path}"


def insert_after_head_marker(html_text: str, block: str) -> str:
    match = DESCRIPTION_RE.search(html_text) or TITLE_RE.search(html_text)
    if match:
        return html_text[: match.end()] + block + html_text[match.end() :]
    match = HEAD_CLOSE_RE.search(html_text)
    if not match:
        raise ValueError("Could not find head end.")
    return html_text[: match.start()] + block + html_text[match.start() :]


def apply_canonical(html_text: str, *, url: str) -> str:
    canonical_line = f'    <link rel="canonical" href="{url}" />\n'
    og_url_line = f'    <meta property="og:url" content="{url}" />\n'

    html_text = CANONICAL_RE.sub("", html_text)
    html_text = insert_after_head_marker(html_text, canonical_line)

    if OG_URL_RE.search(html_text):
        html_text = OG_URL_RE.sub(og_url_line, html_text, count=1)
    return html_text


def normalize_internal_links(html_text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        path = match.group(1)
        anchor = match.group(2)
        if path.endswith("/index"):
            path = path[: -len("index")]
        elif path == "index":
            path = "/"
        return f'href="{path}{anchor}"'

    return INTERNAL_HTML_HREF_RE.sub(replace, html_text)


def apply_google_tag(html_text: str) -> str:
    block = marked_block(GOOGLE_TAG_START, render_google_tag(), GOOGLE_TAG_END) + "\n"
    html_text = GOOGLE_TAG_BLOCK_RE.sub("", html_text)
    html_text = GOOGLE_TAG_UNMARKED_RE.sub("", html_text)
    match = HEAD_CLOSE_RE.search(html_text)
    if not match:
        raise ValueError("Could not find head end.")
    return html_text[: match.start()] + block + html_text[match.start() :]


def insert_after_body_open(html_text: str, block: str) -> str:
    match = BODY_OPEN_RE.search(html_text)
    if not match:
        raise ValueError("Could not find body start.")
    insert_at = match.end()
    return html_text[:insert_at] + "\n" + block + html_text[insert_at:]


def insert_before_body_close(html_text: str, block: str) -> str:
    match = BODY_CLOSE_RE.search(html_text)
    if not match:
        raise ValueError("Could not find body end.")
    return html_text[: match.start()] + block + "\n" + html_text[match.start() :]


def replace_block(
    html_text: str,
    *,
    marked_re: re.Pattern[str],
    tag_re: re.Pattern[str],
    replacement: str,
    label: str,
) -> str:
    match = marked_re.search(html_text)
    if match:
        html_text = html_text[: match.start()] + replacement + html_text[match.end() :]
        end_marker = FOOTER_END if label == "site footer" else HEADER_END
        first_marker_end = html_text.find(end_marker)
        if first_marker_end != -1:
            split_at = first_marker_end + len(end_marker)
            html_text = html_text[:split_at] + marked_re.sub("", html_text[split_at:])
        if label == "site footer":
            first_footer_end = html_text.find(FOOTER_END)
            if first_footer_end != -1:
                split_at = first_footer_end + len(FOOTER_END)
                html_text = (
                    html_text[:split_at]
                    + ORPHAN_FOOTER_END_RE.sub("", html_text[split_at:])
                )
        return html_text
    if tag_re.search(html_text):
        return tag_re.sub(replacement, html_text, count=1)
    if label == "site footer":
        html_text = ORPHAN_FOOTER_END_RE.sub("", html_text)
        return insert_before_body_close(html_text, replacement)
    if label == "site header":
        return insert_after_body_open(html_text, replacement)
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
    elif first == "ai-forensics":
        current = "ai_forensics"
    elif first == "works" or name == "works.html":
        current = "works"
    elif name.startswith("gallery"):
        current = "gallery"
    elif first == "lounge-archive" or name in {"lounge.html", "lounge-dictionary.html"}:
        current = "lounge"
    elif name == "news.html":
        current = "news"
    elif name == "contact.html" or name == "thanks.html":
        current = "contact"
    else:
        current = ""

    return prefix, current


def apply_layout_to_html(html_text: str, *, prefix: str, current: str) -> str:
    html_text = apply_google_tag(html_text)
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
    updated = apply_canonical(original, url=canonical_url(path))
    updated = apply_layout_to_html(updated, prefix=prefix, current=current)
    updated = normalize_internal_links(updated)
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
        if rel.parts[:1] == ("tools",):
            continue
        if len(rel.parts) >= 2 and rel.parts[:2] == ("src", "partials"):
            continue
        if rel.parent == Path(".") and rel.name.startswith("google"):
            continue
        if rel.parts[:1] == ("gallery",):
            continue
        files.append(path)
    return sorted(files)
