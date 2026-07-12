#!/usr/bin/env python3
from __future__ import annotations

from site_layout import apply_layout_to_file, iter_site_html_files


def main() -> None:
    changed = 0
    files = iter_site_html_files()
    for path in files:
        if apply_layout_to_file(path):
            changed += 1
    print(f"Applied shared header/footer to {len(files)} HTML files ({changed} changed).")


if __name__ == "__main__":
    main()
