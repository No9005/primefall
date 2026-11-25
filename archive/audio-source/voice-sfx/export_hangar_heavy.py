"""Makes the barbell takes heavier (call 46 in PROMPTS.md): the second takes of the floor, the whoosh and the locker had little low end.

    python3 archive/audio-source/voice-sfx/export_hangar_heavy.py

For each cut take in `sfx/hangar/cut/`: the pitch is lowered (the file is played slower: a heavier object), the low end is lifted, and an
impact (the floor and the locker) gets a short sub-bass thump of its own at its loudest moment. Written next to the cut takes as `<take>_heavy.mp3`
(mono, 96 kbit/s, levelled to -14 LUFS, peak-limited). The numbers of before and after are printed.
"""

import re
import subprocess
from pathlib import Path

import numpy as np

CUT = Path(__file__).resolve().parent / "sfx/hangar/cut"
SR = 44100
# take: (rate of the pitch change, thump gain against the loudest sample; 0: no thump)
TAKES = {"floor_a": (0.78, 0.9), "floor_b": (0.78, 0.9), "locker_a": (0.8, 0.8), "locker_b": (0.8, 0.8), "heavy_whoosh_a": (0.85, 0.0), "heavy_whoosh_b": (0.85, 0.0)}


def decode(path: Path, filters: str) -> np.ndarray:
    args = ["ffmpeg", "-v", "error", "-i", str(path), "-af", filters, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    return np.frombuffer(subprocess.run(args, capture_output=True, check=True).stdout, dtype=np.float32).copy()


def lufs(x: np.ndarray) -> float:
    report = subprocess.run(["ffmpeg", "-v", "info", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", "ebur128", "-f", "null", "-"], input=x.astype(np.float32).tobytes(), capture_output=True).stderr.decode()
    return float(re.findall(r"I:\s+(-?\d+\.\d+) LUFS", report)[-1])


def weight(x: np.ndarray) -> str:
    power = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    freq = np.fft.rfftfreq(len(x), 1 / SR)
    return f"centroid {(freq * power).sum() / power.sum():.0f} Hz, {power[freq < 150].sum() / power.sum() * 100:.1f} % under 150 Hz"


def main() -> None:
    for name, (rate, thump) in TAKES.items():
        before = decode(CUT / f"{name}.mp3", "anull")
        x = decode(CUT / f"{name}.mp3", f"asetrate={int(SR * rate)},aresample={SR},bass=g=8:f=110:w=0.7")
        if thump:
            window = int(0.01 * SR)
            envelope = np.array([np.abs(x[i : i + window]).max() for i in range(0, len(x) - window, window)])
            at = int(envelope.argmax()) * window
            t = np.arange(min(len(x) - at, int(0.6 * SR))) / SR
            x[at : at + len(t)] += thump * np.abs(x).max() * np.sin(2 * np.pi * 48 * t) * np.exp(-t / 0.16)
        x = x * 10 ** ((-14 - lufs(x)) / 20)
        out = CUT / f"{name}_heavy.mp3"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", "alimiter=limit=0.66:attack=2:release=40:level=disabled", "-ar", str(SR), "-b:a", "96k", str(out)], input=x.astype(np.float32).tobytes(), check=True)
        after = decode(out, "anull")
        print(f"{name}: {len(before) / SR:.2f} s -> {len(after) / SR:.2f} s | before {weight(before)} | after {weight(after)}")


if __name__ == "__main__":
    main()
