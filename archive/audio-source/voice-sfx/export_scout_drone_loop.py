"""Makes the loop of the quadcopter scout drone from the raw take of ElevenLabs (call 43 in PROMPTS.md).

    python3 archive/audio-source/voice-sfx/export_scout_drone_loop.py

The raw take (`sfx/tilly/scout_drone_loop_v1_raw.mp3`, 8 s, asked for as a loop) was not dark and not steady enough to loop as it came: a third of
its energy lay above 3 kHz and its level sank by about 5 dB over the 8 s, so the end did not match the start. This script
- cuts everything above 1.4 kHz and below 35 Hz (darker, no whine),
- flattens the slow level changes (the level over a 0.6 s window is pulled to a constant, at most 6 dB either way),
- bakes a 1.5 s equal-power cross-fade of the end into the start (as for `loops/laser-hum.wav`),
- sets the level to -28 LUFS (mono, 22.05 kHz, 16 bit WAV: an MP3 leaves a gap at the seam of a loop).
"""

import re
import subprocess
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
RAW = HERE / "sfx/tilly/scout_drone_loop_v1_raw.mp3"
OUT = HERE / "sfx/tilly/scout_drone_loop_v1_loop.wav"
SR = 22050
CROSSFADE_S = 1.5
LEVEL_WINDOW_S = 0.6
MAX_GAIN_DB = 6
TARGET_LUFS = -28


def load(path: Path, filters: str = "") -> np.ndarray:
    args = ["ffmpeg", "-v", "error", "-i", str(path), *(["-af", filters] if filters else []), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    return np.frombuffer(subprocess.run(args, capture_output=True, check=True).stdout, dtype=np.float32).copy()


def lufs(x: np.ndarray) -> float:
    report = subprocess.run(["ffmpeg", "-v", "info", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", "ebur128", "-f", "null", "-"], input=x.astype(np.float32).tobytes(), capture_output=True).stderr.decode()
    return float(re.findall(r"I:\s+(-?\d+\.\d+) LUFS", report)[-1])


def flatten(x: np.ndarray) -> np.ndarray:
    window = int(LEVEL_WINDOW_S * SR)
    kernel = np.ones(window) / window
    padded = np.concatenate([x[-window:], x, x[:window]])  # the level is measured around the seam as if the take already looped
    rms = np.sqrt(np.convolve(padded**2, kernel, mode="same"))[window:-window]
    gain = np.clip(rms.mean() / np.maximum(rms, 1e-6), 10 ** (-MAX_GAIN_DB / 20), 10 ** (MAX_GAIN_DB / 20))
    return x * gain


def main() -> None:
    x = load(RAW, "highpass=f=35,lowpass=f=1400,lowpass=f=1400")
    x = flatten(x)
    n = int(CROSSFADE_S * SR)
    t = np.linspace(0, 1, n)
    loop = x[:-n].copy()
    loop[:n] = loop[:n] * np.sin(t * np.pi / 2) + x[-n:] * np.cos(t * np.pi / 2)
    loop = np.clip(loop * 10 ** ((TARGET_LUFS - lufs(loop)) / 20), -0.98, 0.98)
    with wave.open(str(OUT), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes((loop * 32767).astype(np.int16).tobytes())
    print(f"{OUT.name}: {len(loop) / SR:.2f} s, seam jump {abs(loop[0] - loop[-1]):.4f}, typical step {np.mean(np.abs(np.diff(loop))):.4f}")


if __name__ == "__main__":
    main()
