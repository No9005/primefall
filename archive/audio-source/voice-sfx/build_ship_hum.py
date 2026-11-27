"""Extends the ship sound of the Notstrom Intro (issue #482) from 5.8 s to 7.9 s, so that it is there during the camera ride along the hull to the airlock.

    python3 archive/audio-source/voice-sfx/build_ship_hum.py

The take `sfx/notstrom-intro/ship_a.wav` (6 s) is a rocket passing: loud from 1 s to 3 s, then it fades away by itself, so the game file `music/notstrom-intro-ship.mp3`
(its first 5.8 s, cut by the owner's rules in PROMPTS.md) was silent from about 4 s of the file (4.25 s of the film), and the film goes on to 7.9 s.
No new take (no credits): the whole first version (5.8 s) is kept as it is (decoded from the game file of the first version, `ship_game_first_version.mp3`), and under its end a hum
of the hull comes in from 3.0 s to 4.2 s, holds a level 2 dB above the one the pass has at 4 s (-23.5 dB RMS, see HUM_LEVEL_DB) and goes out from 7.0 s to 7.9 s. The hum is noise that is shaped to the average
spectrum of the take at 1.6 s to 2.6 s (the take is a low rumble: 60 to 250 Hz, nothing above 500 Hz) with a slow irregular swell of about +-2 dB, like the churn
of the take. It is made from a fixed seed, so the file comes out the same every time. Needs numpy and ffmpeg on the PATH.
"""

import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
TAKE = HERE / "sfx/notstrom-intro/ship_a.wav"
GAME_FILE = HERE.parents[2] / "apps/web/public/assets/audio/music/notstrom-intro-ship.mp3"
FIRST_VERSION = HERE / "sfx/notstrom-intro/ship_game_first_version.mp3"  # the game file before the hum (5.8 s), kept so that the script runs again
SR = 44100
LENGTH_S = 7.9
SEED = 482
HUM_LEVEL_DB = -23.5  # RMS of the hum: 2 dB above the level the pass has at 3.8 s to 4.0 s in the game file (-25.5), so that it is heard under the camera ride; the knob to turn by ear
FADE_IN = (3.0, 4.2)
FADE_OUT = (7.0, 7.9)


def decode(path: Path, *filters: str) -> np.ndarray:
    args = ["ffmpeg", "-v", "error", "-i", str(path), *(["-af", ",".join(filters)] if filters else []), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    return np.frombuffer(subprocess.run(args, capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)


def smoothed_spectrum(signal: np.ndarray, size: int) -> np.ndarray:
    """The average power spectrum (Welch, Hann) of `signal`, smoothed over a third of an octave, at the `size`-point FFT of a longer signal."""
    window = np.hanning(8192)
    power = np.mean([np.abs(np.fft.rfft(signal[i : i + 8192] * window)) ** 2 for i in range(0, len(signal) - 8192, 2048)], axis=0)
    freqs = np.fft.rfftfreq(8192, 1 / SR)
    target = np.fft.rfftfreq(size, 1 / SR)
    log_power = np.log(power + 1e-18)
    smooth = np.empty_like(log_power)
    for i, f in enumerate(freqs):
        near = (freqs > f / 1.12) & (freqs < f * 1.12) if f > 0 else freqs < 1
        smooth[i] = log_power[near].mean()
    return np.exp(np.interp(target, freqs, smooth))


def smoothstep(t: np.ndarray) -> np.ndarray:
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def build_hum(count: int) -> np.ndarray:
    rng = np.random.default_rng(SEED)
    take = decode(TAKE, "pan=mono|c0=0.7071*c0+0.7071*c1")
    spectrum = smoothed_spectrum(take[int(1.6 * SR) : int(2.6 * SR)], count)
    hum = np.fft.irfft(np.fft.rfft(rng.standard_normal(count)) * np.sqrt(spectrum), count)
    # A slow irregular swell (a few hertz, about +-2 dB): noise through a long moving average.
    swell = np.convolve(rng.standard_normal(count), np.hanning(int(SR / 3)) / np.hanning(int(SR / 3)).sum(), mode="same")
    hum *= 10 ** (2.0 * swell / swell.std() / 20)
    hum *= 10 ** (HUM_LEVEL_DB / 20) / np.sqrt(np.mean(hum[int(4.2 * SR) : int(7.0 * SR)] ** 2))
    t = np.arange(count) / SR
    envelope = smoothstep((t - FADE_IN[0]) / (FADE_IN[1] - FADE_IN[0])) * (0.5 + 0.5 * np.cos(np.pi * np.clip((t - FADE_OUT[0]) / (FADE_OUT[1] - FADE_OUT[0]), 0, 1)))
    return hum * envelope


def main() -> None:
    count = int(LENGTH_S * SR)
    if not FIRST_VERSION.exists():
        FIRST_VERSION.write_bytes(GAME_FILE.read_bytes())
    base = np.zeros(count)
    first = decode(FIRST_VERSION)
    base[: len(first)] = first
    mixed = base + build_hum(count)
    peak = np.abs(mixed).max()
    print(f"peak {20 * np.log10(peak):.1f} dBFS")
    if peak > 0.89:
        sys.exit("the mix is too loud (peak above -1 dBFS)")
    pcm = (mixed * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-", "-codec:a", "libmp3lame", "-b:a", "128k", str(GAME_FILE)], input=pcm, check=True)
    print("wrote", GAME_FILE)


if __name__ == "__main__":
    main()
