#!/usr/bin/env python3
"""Does a generated layer play the agreed key, chords and tempo? Free to run (numpy only, ffmpeg to decode).

  fit.py FILE --bpm 72 --bars-per-chord 2 --chords "Fm,E-,Db,C" [--key F] [--start-bar 0]

Chords: a note name (C, Db, F#, E-) and "m" for minor, "5" for a power chord; no suffix = major ("Fm,Eb,Db,C").
Reports, per chord window: how much of the energy lies on the chord's tones (chord fit), the strongest bass
note (below 200 Hz) against the expected root, and for the whole file the tempo (autocorrelation of the onsets)
and how much of the energy lies in the minor scale of the key. Fit above about 60 % and a bass root that
matches in most windows mean the layer follows the plan; a layer made without the plan scores near chance (25 to 30 %).
"""
import argparse, subprocess, sys
import numpy as np

SR = 22050
NAMES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E-": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B-": 10, "B": 11}
PC = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def chroma(x, lo, hi, n=8192):
    """Energy per pitch class between lo and hi Hz, summed over the file."""
    win = np.hanning(n)
    out = np.zeros(12)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    sel = (freqs >= lo) & (freqs <= hi)
    pcs = (np.round(12 * np.log2(freqs[sel] / 440.0)) + 9).astype(int) % 12
    for s in range(0, len(x) - n, n // 2):
        mag = np.abs(np.fft.rfft(x[s:s + n] * win)) ** 2
        np.add.at(out, pcs, mag[sel])
    return out


def chord_tones(spec):
    spec = spec.strip()
    minor = spec.endswith("m")
    power = spec.endswith("5")
    name = spec[:-1] if minor or power else spec
    root = NAMES[name]
    iv = [0, 7] if power else ([0, 3, 7] if minor else [0, 4, 7])
    return root, {(root + i) % 12 for i in iv}


def tempo(x):
    hop = 512
    n = 2048
    win = np.hanning(n)
    prev = None
    flux = []
    for s in range(0, len(x) - n, hop):
        mag = np.abs(np.fft.rfft(x[s:s + n] * win))
        flux.append(0 if prev is None else np.sum(np.maximum(mag - prev, 0)))
        prev = mag
    f = np.array(flux)
    f = f - np.convolve(f, np.ones(20) / 20, "same")
    ac = np.correlate(f, f, "full")[len(f) - 1:]
    fps = SR / hop
    best = max(range(int(fps * 60 / 100), int(fps * 60 / 56)), key=lambda l: ac[l])
    return 60 * fps / best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--bpm", type=float, default=72)
    ap.add_argument("--bars-per-chord", type=int, default=2)
    ap.add_argument("--chords", required=True)
    ap.add_argument("--key", default=None)
    ap.add_argument("--start-bar", type=float, default=0)
    a = ap.parse_args()
    x = load(a.file)
    bar = 4 * 60 / a.bpm
    chords = [chord_tones(c) for c in a.chords.split(",")]
    key = NAMES[a.key] if a.key else chords[0][0]
    print(f"{a.file}: {len(x) / SR:.1f} s")
    minor_scale = {(key + i) % 12 for i in (0, 2, 3, 5, 7, 8, 10)}
    allc = chroma(x, 55, 2000)
    allc /= allc.sum() + 1e-12
    print("pitch classes by energy:", " ".join(f"{PC[i]} {allc[i]*100:.0f}%" for i in np.argsort(-allc)[:6]))
    print(f"energy in the minor scale of {PC[key]}: {sum(allc[i] for i in minor_scale)*100:.0f}% (chance about 58%)")
    n_win = int((len(x) / SR - a.start_bar * bar) // (a.bars_per_chord * bar))
    fits, hits = [], 0
    for w in range(n_win):
        t0 = a.start_bar * bar + w * a.bars_per_chord * bar
        seg = x[int(t0 * SR):int((t0 + a.bars_per_chord * bar) * SR)]
        root, tones = chords[w % len(chords)]
        c = chroma(seg, 55, 2000)
        fit = sum(c[i] for i in tones) / (c.sum() + 1e-12)
        b = chroma(seg, 35, 200)
        bass = int(np.argmax(b))
        ok = bass == root
        hits += ok
        fits.append(fit)
        print(f"  window {w+1:2d} (bar {w*a.bars_per_chord+1:2d}): expected {PC[root]:<3} fit {fit*100:3.0f}%  bass {PC[bass]:<3} {'ok' if ok else 'x'}")
    if n_win:
        print(f"mean chord fit {np.mean(fits)*100:.0f}% (chance about 25%), bass root right in {hits}/{n_win} windows")
    print(f"tempo about {tempo(x):.1f} BPM (planned {a.bpm:g})")


if __name__ == "__main__":
    sys.exit(main())
