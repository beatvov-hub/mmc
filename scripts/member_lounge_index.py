"""Build the small public index used by member conversation histories."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "lounge" / "member-conversations.json"
MEMBER_NAMES = {
    "hono": ("ほのちゃん",), "shoma": ("ショウマ",), "takaken": ("たかけん",),
    "michael": ("マイケル",), "dg": ("DG",), "nemu": ("ねむちゃん",),
    "rei": ("レイちゃん",), "akito": ("アキト",), "kei": ("ケイ",),
    "makoto": ("誠", "誠さん"), "koto": ("コトちゃん",),
    "sota": ("颯太",), "pechi": ("ペチ",),
}


def build_index(logs: list[dict]) -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = {slug: [] for slug in MEMBER_NAMES}
    seen: dict[str, set[str]] = {slug: set() for slug in MEMBER_NAMES}
    for log in logs:
        participants = set(log.get("participants", []))
        for slug, names in MEMBER_NAMES.items():
            if participants.isdisjoint(names) or log["id"] in seen[slug]:
                continue
            seen[slug].add(log["id"])
            result[slug].append({key: log.get(key, "") for key in ("id", "date", "time", "title", "description")})
    return result


def write_index(logs: list[dict], path: Path = INDEX_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build_index(logs), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
