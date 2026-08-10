#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "music-room-tracks.json"
SET_ID = "default-31day-v1"
ROUTES = ("YYY", "YYN", "YNY", "YNN", "NYY", "NYN", "NNY", "NNN")


def build_tracks() -> list[dict[str, object]]:
    return [
        {
            "id": f"d{day:02d}-{route}",
            "setId": SET_ID,
            "day": day,
            "route": route,
            "title": "",
            "artist": "",
            "staffId": "",
            "message": "",
            "reason": "",
            "tags": [],
            "youtubeUrl": "",
            "spotifyUrl": "",
            "directorNote": "",
            "linkCheckedAt": "",
            "published": False,
        }
        for day in range(1, 32)
        for route in ROUTES
    ]


def main() -> None:
    tracks = build_tracks()
    OUTPUT.write_text(json.dumps(tracks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(tracks)} music-room track slots: {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

