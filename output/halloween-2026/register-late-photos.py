"""Register selected 19:50-20:45 story photos for WebP import."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "output/halloween-2026/conversation-photos/production.json"
GENERATED = Path(r"C:\Users\user\.codex\generated_images\01a13e75-4a77-7973-916e-5c54da38cc4b")

PHOTO_DATA = [
    (
        "autumn-menu",
        "exec-590de428-7d7e-4606-b4b0-c079126cd6ac.png",
        "Rei's autumn-menu tabletop photo in the established Halloween Bean & Bits; seasonal toast, latte and peeled bite-size sweet potato, no people or text.",
        ["image/events/halloween-2026/lounge.webp", "lounge/market/assets/bean-bits-market-seasonal-combo.webp", "lounge/market/assets/bean-bits-market-seasonal-toast.webp"],
    ),
    (
        "two-dango-toast",
        "exec-99a652e6-4288-48c7-aebd-3520ee89e6d6.png",
        "Approved Yossy V2 face exposed above two remaining white dango tiers, removed top headpiece on a chair; Hono in astronaut costume offers sweet-potato toast in the familiar Halloween Bean & Bits.",
        ["image/events/halloween-2026/portraits/yossy.webp", "image/events/halloween-2026/portraits/hono.webp", "image/events/halloween-2026/lounge.webp"],
    ),
    (
        "group-two-dango",
        "exec-b1a76306-e63d-4387-825c-dee51e1a2a47.png",
        "Edit the approved full group photo, preserving eleven employees and Pechi, to show the approved director with only two body dango tiers and the removed empty headpiece on a chair at his side.",
        ["image/events/halloween-2026/all-hands.webp", "image/events/halloween-2026/portraits/yossy.webp"],
    ),
]


def main() -> None:
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    found = {p["id"] for p in plan["photos"]}
    for id_, generated_name, prompt, references in PHOTO_DATA:
        source = GENERATED / generated_name
        assert source.is_file(), source
        if id_ in found:
            continue
        plan["photos"].append(
            {
                "id": id_,
                "mode": "built-in image_gen",
                "source": str(source),
                "prompt": prompt,
                "references": [str(ROOT / r) for r in references],
                "png": f"conversation-photos/halloween-2026-{id_}.png",
                "webp": f"image/events/halloween-2026/conversation/{id_}.webp",
            }
        )
    PLAN.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Registered", len(PHOTO_DATA), "late-conversation photos")


if __name__ == "__main__":
    main()
