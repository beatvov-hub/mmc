#!/usr/bin/env python3
from __future__ import annotations

import math
import random
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "audio" / "music-room"
SAMPLE_RATE = 22050


def envelope(position: float, duration: float, attack: float = 0.02) -> float:
    if position < 0 or position >= duration:
        return 0.0
    if position < attack:
        return position / attack
    return max(0.0, 1.0 - (position - attack) / max(0.001, duration - attack))


def add_tone(samples: list[float], start: float, duration: float, start_hz: float, end_hz: float, amplitude: float, wave_type: str = "sine") -> None:
    first = int(start * SAMPLE_RATE)
    count = int(duration * SAMPLE_RATE)
    phase = 0.0
    for offset in range(count):
        ratio = offset / max(1, count - 1)
        frequency = start_hz + (end_hz - start_hz) * ratio
        phase += 2 * math.pi * frequency / SAMPLE_RATE
        raw = math.sin(phase)
        if wave_type == "square":
            raw = 1.0 if raw >= 0 else -1.0
        elif wave_type == "triangle":
            raw = 2 / math.pi * math.asin(raw)
        index = first + offset
        if index < len(samples):
            samples[index] += raw * amplitude * envelope(offset / SAMPLE_RATE, duration)


def add_click(samples: list[float], start: float, duration: float, amplitude: float, seed: int) -> None:
    rng = random.Random(seed)
    first = int(start * SAMPLE_RATE)
    count = int(duration * SAMPLE_RATE)
    previous = 0.0
    for offset in range(count):
        noise = rng.uniform(-1.0, 1.0)
        previous = previous * 0.72 + noise * 0.28
        index = first + offset
        if index < len(samples):
            samples[index] += previous * amplitude * envelope(offset / SAMPLE_RATE, duration, 0.004)


def write_wav(name: str, duration: float, builder) -> None:
    samples = [0.0] * int(duration * SAMPLE_RATE)
    builder(samples)
    peak = max(1.0, max(abs(sample) for sample in samples) / 0.86)
    pcm = bytearray()
    for sample in samples:
        value = int(max(-1.0, min(1.0, sample / peak)) * 32767)
        pcm.extend(value.to_bytes(2, "little", signed=True))
    path = OUTPUT_DIR / name
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(SAMPLE_RATE)
        target.writeframes(pcm)
    print(f"generated {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")


def build_startup(samples: list[float]) -> None:
    add_click(samples, 0.00, 0.10, 0.56, 11)
    add_tone(samples, 0.00, 0.18, 88, 48, 0.34, "square")
    add_click(samples, 0.20, 0.055, 0.32, 23)
    add_click(samples, 0.34, 0.045, 0.26, 31)
    add_tone(samples, 0.43, 0.31, 440, 660, 0.25)
    add_tone(samples, 0.49, 0.27, 660, 660, 0.13)


def build_tick(samples: list[float]) -> None:
    add_click(samples, 0.00, 0.04, 0.42, 47)
    add_tone(samples, 0.00, 0.065, 720, 560, 0.22, "square")


def build_select(samples: list[float]) -> None:
    for index, delay in enumerate((0.0, 0.12, 0.24)):
        add_click(samples, delay, 0.035, 0.22, 60 + index)
        add_tone(samples, delay, 0.075, 260 + index * 80, 260 + index * 80, 0.17, "triangle")


def build_complete(samples: list[float]) -> None:
    add_click(samples, 0.00, 0.10, 0.48, 83)
    add_tone(samples, 0.00, 0.14, 76, 52, 0.28, "square")
    add_tone(samples, 0.11, 0.31, 659, 659, 0.21)
    add_tone(samples, 0.19, 0.32, 880, 880, 0.16)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_wav("jukebox-start.wav", 0.82, build_startup)
    write_wav("jukebox-tick.wav", 0.10, build_tick)
    write_wav("jukebox-select.wav", 0.38, build_select)
    write_wav("jukebox-complete.wav", 0.58, build_complete)


if __name__ == "__main__":
    main()

