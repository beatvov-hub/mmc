"""Import the supplied 19:50-20:45 Halloween conversation without rewriting it."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(
    r"C:\Users\user\.codex\attachments\d6585e62-e06d-4e02-9d04-34a5cd1fba87\貼り付けたテキスト.txt"
)
DATA = ROOT / "src/data/eventDrafts/halloween-2026.json"


def source_paragraphs() -> list[str]:
    return [
        paragraph.strip()
        for paragraph in re.split(r"\r?\n\s*\r?\n", SOURCE.read_text(encoding="utf-8"))
        if paragraph.strip()
    ]


def import_blocks(paragraphs: list[str]) -> list[dict]:
    assert paragraphs[0] == "# 宴はまだまだ終わらない"
    assert paragraphs[1] == "**2026年10月31日（土）19:50〜20:45 ／ Bean & Bits**"
    blocks: list[dict] = []
    i = 2
    while i < len(paragraphs):
        paragraph = paragraphs[i]
        if paragraph == "---":
            i += 1
            continue
        if paragraph.startswith("### "):
            blocks.append({"type": "heading", "text": paragraph[4:]})
        elif paragraph.startswith("**「") and paragraph.endswith("」**"):
            blocks.append({"type": "whiteboard", "text": paragraph[2:-2]})
        elif paragraph == "**HAPPY HALLOWEEN 2026**":
            blocks.append({"type": "heading", "text": "HAPPY HALLOWEEN 2026"})
        elif paragraph.startswith("**") and paragraph.endswith("**"):
            assert i + 1 < len(paragraphs) and paragraphs[i + 1].startswith("「"), (i, paragraph)
            speaker_and_detail = paragraph[2:-2]
            match = re.fullmatch(r"([^（]+)(?:（(.+)）)?", speaker_and_detail)
            assert match, paragraph
            block: dict = {"type": "dialogue", "speaker": match.group(1), "text": paragraphs[i + 1]}
            if match.group(2):
                block["speakerDetail"] = match.group(2)
            blocks.append(block)
            i += 1
        elif paragraph.startswith("*") and paragraph.endswith("*"):
            blocks.append({"type": "narration", "text": paragraph[1:-1]})
        else:
            raise AssertionError((i, paragraph))
        i += 1
    return blocks


def after(blocks: list[dict], text: str, image: dict) -> None:
    matching = [i for i, block in enumerate(blocks) if block.get("text") == text]
    assert len(matching) == 1, (text, matching)
    blocks.insert(matching[0] + 1, image)


def main() -> None:
    paragraphs = source_paragraphs()
    blocks = import_blocks(paragraphs)
    assert len(paragraphs) == 563
    assert sum(b["type"] == "dialogue" for b in blocks) == 233
    assert sum(b["type"] == "heading" for b in blocks) == 6

    after(
        blocks,
        "「待って、写真撮らせて！ お皿とハロウィンの飾り、一緒に入れたらすごくかわいい！」",
        {
            "type": "image",
            "src": "image/events/halloween-2026/conversation/autumn-menu.webp",
            "alt": "Bean & Bitsの木製テーブルに並ぶ秋の限定トーストとさつまいもラテ、ハロウィンの飾り",
            "caption": "レイちゃんが撮りたくなった秋の限定メニュー。会話をもとにした生成画像。",
        },
    )
    after(
        blocks,
        "椅子の上には団子の頭。その横には二段団子の所長。",
        {
            "type": "image",
            "src": "image/events/halloween-2026/conversation/two-dango-toast.webp",
            "alt": "頭の団子部分を椅子に置いた所長に、宇宙飛行士姿のほのちゃんがさつまいもトーストを差し出す",
            "caption": "頭を外して二段団子になった所長と、トーストを届けるほのちゃん。会話をもとにした生成画像。",
        },
    )
    after(
        blocks,
        "「所長の横に置いた団子の頭が、めっちゃ存在感あるんです！！」",
        {
            "type": "image",
            "src": "image/events/halloween-2026/conversation/group-two-dango.webp",
            "alt": "仮装姿のAI社員11人と所長、チワワのペチが写る集合写真。二段団子姿の所長の横の椅子に、取り外した白い団子の頭が置かれている",
            "caption": "「13人と団子の頭」——仮装した全員と、椅子に座った無人の団子。会話をもとにした生成画像。",
        },
    )

    data = json.loads(DATA.read_text(encoding="utf-8"))
    section = {
        "id": "section-12",
        "title": "宴はまだまだ終わらない",
        "time": "19:50",
        "timeLabel": "19:50〜20:45",
        "blocks": blocks,
    }
    existing = [s for s in data["conversationSections"] if s["id"] == section["id"]]
    if existing:
        assert len(existing) == 1
        data["conversationSections"][data["conversationSections"].index(existing[0])] = section
    else:
        data["conversationSections"].append(section)
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(blocks)} blocks, {sum(b['type'] == 'dialogue' for b in blocks)} dialogue turns, 3 photos")


if __name__ == "__main__":
    main()
