"""Stage only the office announcement history from a README with local draft work."""

from __future__ import annotations

import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
head = subprocess.run(["git", "show", "HEAD:README"], cwd=root, capture_output=True, check=True).stdout
working = (root / "README").read_bytes()
newline = b"\r\n" if b"\r\n" in head else b"\n"
office_header = "### 2026-10-26：MMC OFFICE TOURの公開をニュース・お知らせ・沿革に掲載".encode("utf-8")
halloween_header = "### 2026-10-26：ハロウィンイベントのローカル下書きを準備".encode("utf-8")
start = working.index(office_header)
end = working.index(halloween_header, start)
office_block = working[start:end].replace(b"\r\n", b"\n").replace(b"\n", newline)
marker = "更新履歴".encode("utf-8") + newline + b"--------" + newline + newline
assert head.count(marker) == 1
assert head.count(office_header) == 0
staged = head.replace(marker, marker + office_block)
result = subprocess.run(["git", "hash-object", "-w", "--stdin"], cwd=root, input=staged, capture_output=True, check=True)
oid = result.stdout.decode("ascii").strip()
subprocess.run(["git", "update-index", "--cacheinfo", "100644", oid, "README"], cwd=root, check=True)
print("Staged README office history only:", oid)
