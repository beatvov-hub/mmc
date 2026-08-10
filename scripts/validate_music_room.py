#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "src" / "data" / "music-room-config.json"
TRACKS_PATH = ROOT / "src" / "data" / "music-room-tracks.json"
EMPLOYEES_PATH = ROOT / "tools" / "mmc-cms" / "data" / "workline-employees.json"
ROUTES = ("YYY", "YYN", "YNY", "YNN", "NYY", "NYN", "NNY", "NNN")


def is_https(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    tracks = json.loads(TRACKS_PATH.read_text(encoding="utf-8"))
    employees = json.loads(EMPLOYEES_PATH.read_text(encoding="utf-8"))
    active_set = config.get("activeSetId")
    active = [item for item in tracks if item.get("setId") == active_set]
    staff_ids = {item.get("id") for item in employees}
    errors: list[str] = []
    warnings: list[str] = []

    if len(active) != 248:
        errors.append(f"activeSetId={active_set} は {len(active)} 件です（必要: 248件）。")

    ids = [item.get("id") for item in tracks]
    for value, count in Counter(ids).items():
        if count > 1:
            errors.append(f"IDが重複しています: {value}")

    combinations = Counter((item.get("day"), item.get("route")) for item in active)
    for day in range(1, 32):
        for route in ROUTES:
            count = combinations[(day, route)]
            if count != 1:
                errors.append(f"day={day}, route={route} は {count} 件です。")

    for index, item in enumerate(tracks):
        label = item.get("id") or f"index {index}"
        day = item.get("day")
        route = item.get("route")
        tags = item.get("tags")
        if not isinstance(day, int) or not 1 <= day <= 31:
            errors.append(f"{label}: dayは1〜31の整数にしてください。")
        if route not in ROUTES:
            errors.append(f"{label}: routeが不正です。")
        if not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags):
            errors.append(f"{label}: tagsは文字列配列にしてください。")
        if item.get("staffId") and item.get("staffId") not in staff_ids:
            errors.append(f"{label}: staffId={item.get('staffId')} は社員データに存在しません。")
        for key in ("youtubeUrl", "spotifyUrl"):
            url = item.get(key, "")
            if url and not is_https(url):
                errors.append(f"{label}: {key} はhttps URLにしてください。")
        if item.get("published"):
            if not str(item.get("title", "")).strip() or not str(item.get("artist", "")).strip():
                errors.append(f"{label}: 公開データには曲名とアーティスト名が必要です。")
            if not item.get("youtubeUrl") and not item.get("spotifyUrl"):
                errors.append(f"{label}: 公開データには公式リンクが1件以上必要です。")
            if not item.get("staffId"):
                errors.append(f"{label}: 公開データにはstaffIdが必要です。")

    published = [item for item in active if item.get("published")]
    print("毎日聴く音楽室 データ検証")
    for route in ROUTES:
        count = sum(1 for item in published if item.get("route") == route)
        print(f"{route}：{count} / 31")
    print(f"合計：{len(published)} / 248")

    if config.get("isPublic") and len(published) != 248:
        warnings.append("公開状態ですが、248件すべてが公開可能になっていません。")

    for warning in warnings:
        print(f"警告: {warning}")
    for error in errors:
        print(f"エラー: {error}", file=sys.stderr)
    print("検証OK" if not errors else f"検証NG: {len(errors)}件")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

