"""Procedural sound generator for Primefall.

Renders OGG files to apps/web/public/audio. Deterministic: every asset is seeded from its
name, so re-running produces the same files. From the repository root:

    python3 tools/audio/generate_audio.py            # everything
    python3 tools/audio/generate_audio.py plan_      # only assets whose path contains "plan_"

Versioning: finished files are never overwritten. Each release lives in audio/<version>/ and the
generator refuses to replace an existing file. v1 is the first draft (restored from git history),
v2 is generated here, v3 (main themes) comes from main_themes.py.

Output (inside audio/v2/):
    sfx/                      one-shot effects (mono)
    music/plan_{a..d}.ogg     planning loops, calm and dark
    music/resolution_{a..d}   Resolution loops, bass-driven, fuller spectrum than their plan twin
    notstrom/music/           music for the Notstrom (Reactor Deck) board
    notstrom/ambient/         seamless ambience loops for the Notstrom board

Needs numpy and ffmpeg (libvorbis). Music and ambience are stereo; effects are mono.
"""
import subprocess
import sys
import wave
import zlib
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parents[2] / "apps/web/public/audio"
RNG = np.random.default_rng(0)


def reseed(name):
    global RNG
    RNG = np.random.default_rng(zlib.crc32(name.encode()))


# ------------------------------------------------------------------ DSP basics
def n_of(dur):
    return int(round(SR * dur))


def tt(n):
    return np.arange(n) / SR


def midi(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)


def noise(n):
    return RNG.uniform(-1, 1, n)


def expd(n, tau):
    return np.exp(-tt(n) / tau)


def env(n, a=0.005, r=0.1):
    e = np.ones(n)
    a, r = max(1, min(n, n_of(a))), max(1, min(n, n_of(r)))
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r) ** 2
    return e


def osc(freq, n, shape="sine"):
    f = np.full(n, float(freq)) if np.isscalar(freq) else np.asarray(freq, float)
    ph = np.cumsum(f) / SR
    if shape == "sine":
        return np.sin(2 * np.pi * ph)
    fr = ph % 1
    if shape == "saw":
        return 2 * fr - 1
    if shape == "square":
        return np.where(fr < 0.5, 1.0, -1.0)
    if shape == "tri":
        return 4 * np.abs(fr - 0.5) - 1
    raise ValueError(shape)


def stack(m, n, shape="saw", cents=(-10, 0, 10)):
    return sum(osc(midi(m + c / 100), n, shape) for c in cents) / len(cents)


def spec_filter(x, gain):
    X = np.fft.rfft(x)
    return np.fft.irfft(X * gain(np.fft.rfftfreq(len(x), 1 / SR)), len(x))


def lp(x, fc, order=2):
    return spec_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def hp(x, fc, order=2):
    return spec_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bp(x, lo, hi):
    return hp(lp(x, hi), lo)


def sweep_lp(x, f0, f1, steps=10):
    """Low-pass whose cutoff glides from f0 to f1 over the length of x."""
    outs = [lp(x, fc) for fc in np.geomspace(f0, f1, steps)]
    pos = np.linspace(0, steps - 1, len(x))
    return sum(np.clip(1 - np.abs(pos - k), 0, 1) * o for k, o in enumerate(outs))


def drive(x, g):
    return np.tanh(x * g) / np.tanh(g)


def pad_to(x, n):
    return np.pad(x, (0, max(0, n - len(x))))


def mix(*parts):
    n = max(len(p) for p in parts)
    return sum(pad_to(p, n) for p in parts)


def put(buf, snd, t, g=1.0, wrap=True):
    """Add snd into buf at time t; with wrap=True the tail wraps to the start (seamless loops)."""
    i, n = n_of(t), len(buf)
    for k in range(0, len(snd), n):
        seg = snd[k:k + n] * g
        pos = (i + k) % n if wrap else i + k
        if pos >= n:
            return
        first = min(len(seg), n - pos)
        buf[pos:pos + first] += seg[:first]
        if wrap and first < len(seg):
            buf[:len(seg) - first] += seg[first:]


def _ir(rt, n=None):
    L = n_of(rt)
    ir = RNG.standard_normal(L) * np.exp(-6.9 * tt(L) / rt)
    ir = lp(ir, 3500)
    ir[0] = 0
    return ir / np.sqrt(np.sum(ir ** 2))


def reverb(x, rt=1.5, wet=0.3, circular=False):
    """Mono in, mono out. circular=True wraps the tail (for loops)."""
    ir = _ir(rt)
    if circular:
        w = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(ir[:len(x)], len(x)), len(x))
        return (1 - wet) * x + wet * w
    L = len(x) + len(ir)
    w = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)
    return (1 - wet) * pad_to(x, L) + wet * w


def stereo_reverb(x, rt=2.0, wet=0.3):
    """Circular stereo reverb: dry centre plus decorrelated wet L/R."""
    out = []
    for _ in range(2):
        ir = _ir(rt)[:len(x)]
        w = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(ir, len(x)), len(x))
        out.append((1 - wet) * x + wet * w * 1.4)
    return np.stack(out, axis=1)


def echo(x, delay, fb=0.5, taps=4, tone=3000, circular=True):
    d = n_of(delay)
    src = lp(x, tone)
    out = x.copy() if circular else pad_to(x, len(x) + d * taps)
    for k in range(1, taps + 1):
        if circular:
            out += fb ** k * np.roll(src, k * d)
        else:
            out[k * d:k * d + len(src)] += fb ** k * src
    return out


def fade_out(x, dur=0.03):
    k = min(len(x), n_of(dur))
    x = x.copy()
    x[-k:] *= np.linspace(1, 0, k)
    return x


def loopify(x, n):
    """Cross-fade the overhang at the end of x onto its start so x[:n] loops without a click."""
    ov = len(x) - n
    y = x[:n].copy()
    ramp = np.linspace(0, 1, ov)
    y[:ov] = x[:ov] * ramp + x[n:] * (1 - ramp)
    return y


# ------------------------------------------------------------------ instruments
def kick(vol=1.0, dur=0.5, f0=160, f1=40, tau=0.14, drv=2.4):
    n = n_of(dur)
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)
    x += noise(n) * np.exp(-t / 0.004) * 0.35
    return drive(x, drv) * vol


def snare(vol=1.0):
    n = n_of(0.35)
    t = tt(n)
    body = np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.06)
    snap = bp(noise(n), 1500, 9000) * np.exp(-t / 0.1)
    return drive(0.7 * body + snap, 1.6) * vol


def clap(vol=1.0):
    n = n_of(0.35)
    t = tt(n)
    x = np.zeros(n)
    for off in (0, 0.011, 0.023):
        k = n_of(off)
        x[k:] += bp(noise(n - k), 900, 4000) * np.exp(-tt(n - k) / 0.012)
    x += bp(noise(n), 900, 3500) * np.exp(-t / 0.12) * 0.6
    return drive(x, 1.4) * vol


def hat(vol=1.0, tau=0.025):
    n = n_of(0.15)
    return hp(noise(n), 7000) * expd(n, tau) * vol


def tom(f, vol=1.0, dur=0.6, tau=0.2):
    n = n_of(dur)
    t = tt(n)
    fr = f + f * 0.7 * np.exp(-t / 0.04)
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / tau)
    x += lp(noise(n), 400) * np.exp(-t / 0.02) * 0.6
    return drive(x, 2.0) * vol


def clang(f, dur=1.6, vol=1.0):
    n = n_of(dur)
    t = tt(n)
    x = np.zeros(n)
    for r, g, d in zip((1, 2.756, 5.404, 8.933, 13.34), (1, .7, .5, .3, .2), (.9, .6, .4, .25, .15)):
        jitter = 1 + RNG.uniform(-0.01, 0.01)
        x += g * np.sin(2 * np.pi * f * r * jitter * t) * np.exp(-t / (d * dur / 1.6))
    x += hp(noise(n), 1800) * np.exp(-t / 0.012) * 0.8
    return x / np.max(np.abs(x)) * vol


def boom(dur=1.2, f0=85, f1=27, tau=0.35, vol=1.0, drv=1.8):
    n = n_of(dur)
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.12)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)
    x += lp(noise(n), 180) * np.exp(-t / (tau * 0.8)) * 0.6
    return drive(x, drv) * vol


def crack(dur=0.3, fc=1800, tau=0.03, vol=1.0):
    n = n_of(dur)
    return hp(noise(n), fc) * expd(n, tau) * vol


def riser(dur, f0=150, f1=7000, vol=1.0):
    n = n_of(dur)
    return sweep_lp(noise(n), f0, f1) * np.linspace(0.05, 1, n) ** 2 * vol


def subnote(m, dur, vol=1.0):
    n = n_of(dur)
    x = np.sin(2 * np.pi * midi(m) * tt(n)) + 0.3 * np.sin(4 * np.pi * midi(m) * tt(n))
    return drive(x, 1.8) * env(n, 0.04, 0.35) * vol


def growl(m, dur, vol=1.0):
    """Saturated saw bass; audible on small speakers because of the added harmonics."""
    n = n_of(dur)
    x = stack(m, n, "saw", (-8, 0, 8)) + 0.8 * osc(midi(m), n, "sine") + 0.4 * osc(midi(m - 12), n, "sine")
    return lp(drive(x, 3.0), 650) * env(n, 0.006, min(0.12, dur * 0.6)) * vol


def pluck(m, dur=0.5, vol=1.0, shape="saw"):
    n = n_of(dur)
    return lp(stack(m, n, shape, (-6, 6)) * expd(n, dur * 0.35), 1100) * vol


def chord_pad(notes, dur, a=1.0, r=1.2, shape="saw"):
    n = n_of(dur)
    return sum(stack(m, n, shape) for m in notes) / len(notes) * env(n, a, r)


CHORDS = {"m": (0, 7, 15), "M": (0, 7, 16), "m7": (0, 7, 15, 22), "m9": (0, 7, 15, 22, 26), "sus": (0, 7, 17),
          "M7": (0, 7, 16, 23)}


def chord(root, kind="m"):
    return [root + i for i in CHORDS[kind]]


# ------------------------------------------------------------------ song scaffolding
class Song:
    def __init__(self, bpm, bars):
        self.beat = 60 / bpm
        self.bar = 4 * self.beat
        self.bars = bars
        self.n = n_of(self.bar * bars)
        self.stems = {}

    def t(self, bar, beat=0.0):
        return bar * self.bar + beat * self.beat

    def put(self, name, snd, t, g=1.0):
        put(self.stems.setdefault(name, np.zeros(self.n)), snd, t, g)

    def fx(self, name, fn):
        self.stems[name] = fn(self.stems[name])

    def render(self, levels, rt, wet, rms_db):
        """Mix the stems, add stereo reverb, set loudness (RMS in dBFS) and soft-limit."""
        dry = sum(self.stems[k] * g for k, g in levels.items() if k in self.stems)
        st = stereo_reverb(dry, rt, wet)
        st *= 10 ** (rms_db / 20) / np.sqrt(np.mean(st ** 2))
        return np.tanh(st / 0.9) * 0.9


PLAN_RMS, RES_RMS = -21.0, -13.5


# ------------------------------------------------------------------ Primefall music
# Style A: sub pulse. Dark electronic; D minor.
def plan_a():
    s = Song(68, 8)
    roots = [38, 34, 31, 33] * 2
    for b, r in enumerate(roots):
        s.put("sub", subnote(r, s.bar + 0.3), s.t(b))
        s.put("pad", chord_pad(chord(r + 12, "m"), s.bar * 1.3, 1.2, 1.4), s.t(b))
        s.put("kick", kick(0.7), s.t(b))
        s.put("kick", kick(0.4), s.t(b, 2.5))
    for b, beat, m in [(0, 2, 62), (1, 0.5, 65), (2, 2.5, 67), (3, 1, 64), (4, 2, 62), (5, 3, 69), (6, 0.5, 67), (7, 2, 64)]:
        s.put("pluck", pluck(m, 0.9, 0.5, "tri"), s.t(b, beat))
    s.put("rumble", lp(noise(s.n), 130) * 0.5, 0)
    s.fx("pad", lambda x: lp(x, 600))
    s.fx("pluck", lambda x: echo(x, s.beat * 0.75, 0.55, 5, 1800))
    return s.render({"sub": 1.0, "pad": 0.55, "kick": 0.8, "pluck": 0.35, "rumble": 0.4}, 2.6, 0.3, PLAN_RMS)


def resolution_a():
    s = Song(108, 8)
    roots = [38, 34, 31, 33] * 2
    hat_s, clap_s = hat(0.5), clap(0.8)
    for b, r in enumerate(roots):
        for beat in range(4):
            s.put("kick", kick(1.0), s.t(b, beat))
            s.put("hat", hat_s, s.t(b, beat + 0.5), 1.0)
            if beat % 2 == 1:
                s.put("clap", clap_s, s.t(b, beat))
        for e in range(16):
            s.put("hat", hat_s, s.t(b, e / 4), 0.3)
        for e in range(8):
            m = r + (12 if e in (3, 7) else 0)
            s.put("bass", growl(m, s.beat * 0.45), s.t(b, e / 2))
        s.put("sub", subnote(r, s.bar), s.t(b), 0.9)
        s.put("stab", chord_pad(chord(r + 24, "m7"), s.beat * 0.6, 0.005, 0.3), s.t(b, 1.5))
        s.put("stab", chord_pad(chord(r + 24, "m7"), s.beat * 0.6, 0.005, 0.3), s.t(b, 3.5))
    s.put("impact", boom(2.0), s.t(0))
    s.put("impact", boom(2.0), s.t(4))
    s.put("riser", riser(s.bar, vol=0.7), s.t(7))
    for k, beat in enumerate((2, 2.5, 3, 3.25, 3.5, 3.75)):
        s.put("clap", tom(110 - 6 * k, 0.8), s.t(7, beat))
    s.fx("stab", lambda x: echo(sweep_lp(x, 700, 2200), s.beat * 0.75, 0.5, 4, 2000))
    s.fx("hat", lambda x: hp(x, 5000))
    return s.render({"kick": 1.0, "clap": 0.7, "hat": 0.4, "bass": 0.9, "sub": 0.9, "stab": 0.35, "impact": 0.9, "riser": 0.5}, 1.4, 0.18, RES_RMS)


# Style B: reactor industrial. Metallic, slow, heavy; D minor.
def plan_b():
    s = Song(60, 8)
    for b in range(8):
        r = 38 if b % 4 < 2 else 33
        s.put("drone", stack(r, n_of(s.bar + 2), "saw", (-14, 0, 14)) * env(n_of(s.bar + 2), 1.5, 2.0), s.t(b))
        s.put("drone", stack(r + 7, n_of(s.bar + 2), "saw", (-9, 0, 9)) * env(n_of(s.bar + 2), 2.0, 2.0), s.t(b), 0.5)
        s.put("sub", subnote(r - 12, s.bar + 0.5), s.t(b))
    for b, beat, f in [(0, 0, 110), (1, 2.5, 146), (2, 3, 98), (3, 1, 123), (4, 0, 110), (5, 2, 87), (6, 3.5, 146), (7, 1.5, 98)]:
        s.put("clang", clang(f, 2.2, 0.6), s.t(b, beat))
    s.put("rumble", lp(noise(s.n), 160) * (0.6 + 0.4 * np.sin(2 * np.pi * tt(s.n) / (s.bar * 2))), 0)
    s.fx("drone", lambda x: lp(x, 420))
    s.fx("clang", lambda x: lp(x, 5000))
    return s.render({"drone": 0.7, "sub": 1.0, "clang": 0.5, "rumble": 0.5}, 3.6, 0.4, PLAN_RMS)


def resolution_b():
    s = Song(96, 8)
    hat_s, clang_s = hat(0.5, 0.02), clang(210, 0.6, 0.7)
    for b in range(8):
        r = 38 if b % 4 < 2 else (37 if b % 4 == 2 else 33)
        for beat in (0, 1.0, 2.5):
            s.put("kick", kick(1.0, 0.6, 150, 38, 0.18), s.t(b, beat))
        for beat in (1, 3):
            s.put("clang", clang_s, s.t(b, beat))
        for e in range(16):
            s.put("hat", hat_s, s.t(b, e / 4), 0.6 if e % 2 else 0.25)
        for e in range(8):
            s.put("bass", growl(r + (1 if e == 5 else 0), s.beat * 0.4), s.t(b, e / 2))
        s.put("sub", subnote(r, s.bar), s.t(b), 1.0)
        s.put("scrape", lp(sweep_lp(noise(n_of(s.bar)), 300, 4000), 6000) * env(n_of(s.bar), s.bar * 0.7, 0.2), s.t(b), 0.3)
        s.put("drone", stack(r + 12, n_of(s.bar), "saw", (-14, 0, 14)) * env(n_of(s.bar), 0.5, 0.5), s.t(b), 0.6)
    s.put("impact", boom(2.2), s.t(0))
    s.put("impact", boom(2.2), s.t(4))
    for k, f in enumerate((130, 110, 98, 82)):
        s.put("tom", tom(f, 0.9), s.t(7, 2 + k * 0.5))
    s.fx("drone", lambda x: lp(x, 800))
    s.fx("hat", lambda x: hp(x, 5000))
    return s.render({"kick": 1.0, "clang": 0.55, "hat": 0.35, "bass": 0.9, "sub": 0.9, "scrape": 0.4,
                     "drone": 0.4, "impact": 0.8, "tom": 0.8}, 1.8, 0.22, RES_RMS)


# Style C: dub techno. Chord stabs through long echoes; D minor.
def plan_c():
    s = Song(74, 8)
    roots = [38, 38, 34, 33] * 2
    kinds = ["m9", "m9", "M7", "m7"] * 2
    for b, (r, k) in enumerate(zip(roots, kinds)):
        s.put("sub", subnote(r - 12, s.bar + 0.2), s.t(b))
        s.put("stab", chord_pad(chord(r + 12, k), s.beat * 0.9, 0.01, 0.6), s.t(b, 0.5))
        if b % 2 == 1:
            s.put("stab", chord_pad(chord(r + 12, k), s.beat * 0.9, 0.01, 0.6), s.t(b, 2.5), 0.7)
        s.put("kick", kick(0.5), s.t(b))
        s.put("rumble", lp(noise(n_of(s.bar)), 220) * env(n_of(s.bar), 1, 1), s.t(b), 0.4)
    h = hat(0.4)
    for b in range(8):
        for beat in range(4):
            s.put("hat", h, s.t(b, beat + 0.5), 0.5)
    s.fx("stab", lambda x: echo(lp(x, 900), s.beat * 0.75, 0.68, 7, 1500))
    s.fx("hat", lambda x: hp(x, 6000))
    return s.render({"sub": 1.0, "stab": 0.6, "kick": 0.6, "rumble": 0.5, "hat": 0.1}, 4.0, 0.42, PLAN_RMS)


def resolution_c():
    s = Song(122, 8)
    roots = [38, 38, 34, 33] * 2
    kinds = ["m9", "m9", "M7", "m7"] * 2
    h, oh, cl = hat(0.5), hat(0.8, 0.08), clap(0.8)
    for b, (r, k) in enumerate(zip(roots, kinds)):
        for beat in range(4):
            s.put("kick", kick(1.0), s.t(b, beat))
            s.put("oh", oh, s.t(b, beat + 0.5))
            if beat % 2 == 1:
                s.put("clap", cl, s.t(b, beat))
        for e in range(16):
            s.put("hat", h, s.t(b, e / 4), 0.25)
        for beat in range(4):
            s.put("bass", growl(r + 12 * (beat == 3), s.beat * 0.4), s.t(b, beat + 0.5))
        s.put("sub", subnote(r, s.beat * 0.45), s.t(b, 0.5), 0.8)
        s.put("stab", chord_pad(chord(r + 12, k), s.beat * 0.7, 0.01, 0.4), s.t(b, 1.5))
        s.put("stab", chord_pad(chord(r + 12, k), s.beat * 0.7, 0.01, 0.4), s.t(b, 3.0), 0.8)
        s.put("rumble", lp(noise(n_of(s.bar)), 400) * env(n_of(s.bar), 0.5, 0.5), s.t(b), 0.5)
    s.put("riser", riser(s.bar * 2, vol=0.6), s.t(6))
    s.put("impact", boom(2.0), s.t(0))
    s.put("impact", boom(2.0), s.t(4))
    s.fx("stab", lambda x: echo(sweep_lp(x, 800, 2500), s.beat * 0.75, 0.6, 6, 1800))
    s.fx("hat", lambda x: hp(x, 6000))
    s.fx("oh", lambda x: hp(x, 6000))
    return s.render({"kick": 1.0, "clap": 0.6, "hat": 0.2, "oh": 0.2, "bass": 1.0, "sub": 1.0, "stab": 0.45,
                     "rumble": 0.4, "riser": 0.5, "impact": 0.8}, 2.2, 0.25, RES_RMS)


# Style D: cinematic. Low strings and timpani, then taiko-driven; D minor.
def plan_d():
    s = Song(56, 8)
    prog = [(38, "m"), (34, "M"), (31, "m"), (33, "sus")] * 2
    for b, (r, k) in enumerate(prog):
        if b % 2 == 0:
            d = s.bar * 2 + 1.5
            sw = chord_pad(chord(r + 12, k) + [r + 24], d, d * 0.45, d * 0.4)
            s.put("strings", sw, s.t(b))
        s.put("sub", subnote(r - 12, s.bar + 0.4), s.t(b))
    for b in range(0, 8, 2):
        s.put("timp", tom(62, 0.8, 1.2, 0.5), s.t(b))
    s.put("timp", tom(55, 0.6, 1.2, 0.5), s.t(3, 2))
    s.put("timp", tom(55, 0.6, 1.2, 0.5), s.t(7, 2))
    s.fx("strings", lambda x: sweep_lp(x, 350, 1100))
    return s.render({"strings": 0.8, "sub": 1.0, "timp": 0.55}, 4.6, 0.45, PLAN_RMS)


def resolution_d():
    s = Song(84, 8)
    prog = [(38, "m"), (34, "M"), (31, "m"), (33, "sus")] * 2
    sn = snare(1.0)
    for b, (r, k) in enumerate(prog):
        for e in range(16):
            s.put("bass", growl(r + (12 if e in (6, 14) else 0), s.beat * 0.2), s.t(b, e / 4), 1.0 if e % 4 == 0 else 0.55)
        for beat, f in ((0, 62), (1.5, 73), (2.5, 55), (3, 82)):
            s.put("taiko", tom(f, 1.0, 0.8, 0.25), s.t(b, beat))
        s.put("snare", sn, s.t(b, 2), 0.9)
        s.put("sub", subnote(r - 12, s.bar), s.t(b), 1.0)
        if b % 2 == 0:
            d = s.bar * 2
            s.put("brass", chord_pad(chord(r + 12, k) + [r + 24], d, d * 0.4, d * 0.3), s.t(b))
            s.put("impact", boom(2.4), s.t(b))
    s.put("riser", riser(s.bar * 2, vol=0.8), s.t(6))
    s.fx("brass", lambda x: sweep_lp(x, 500, 1800))
    s.fx("snare", lambda x: reverb(x, 1.5, 0.45, True))
    return s.render({"bass": 0.8, "taiko": 0.9, "snare": 0.6, "sub": 0.9, "brass": 0.55, "impact": 0.8, "riser": 0.5},
                    3.0, 0.3, RES_RMS)


# ------------------------------------------------------------------ Notstrom music (Reactor Deck, C minor)
def notstrom_theme():
    s = Song(78, 16)
    prog = [(36, "m"), (32, "M"), (29, "m"), (31, "sus")] * 4
    arp_shape = [0, 1, 2, 1, 2, 1, 0, 2]
    for b, (r, k) in enumerate(prog):
        s.put("hum", subnote(r, s.bar + 0.3), s.t(b))
        if b >= 2:
            s.put("pad", chord_pad(chord(r + 12, k), s.bar * 1.4, 1.4, 1.6), s.t(b))
        if b >= 4:
            tones = chord(r + 24, k)
            for e in range(8):
                s.put("arp", pluck(tones[arp_shape[e] % len(tones)], 0.55, 0.6, "tri"), s.t(b, e / 2))
        if b >= 8:
            s.put("kick", kick(0.6), s.t(b))
            s.put("kick", kick(0.45), s.t(b, 2))
        if b >= 12:
            s.put("kick", kick(0.45), s.t(b, 3.5))
            for e in range(8):
                s.put("tick", hat(0.5, 0.012), s.t(b, e / 2 + 0.25))
    s.put("clang", clang(98, 3.0, 0.8), s.t(0))
    s.put("clang", clang(98, 3.0, 0.8), s.t(8))
    s.put("clang", clang(73, 3.0, 0.7), s.t(14, 2))
    s.put("rumble", lp(noise(s.n), 140) * 0.5, 0)
    s.fx("pad", lambda x: lp(x, 650))
    s.fx("arp", lambda x: echo(x, s.beat * 0.75, 0.55, 6, 1800))
    s.fx("tick", lambda x: hp(x, 6000))
    return s.render({"hum": 1.0, "pad": 0.6, "arp": 0.4, "kick": 0.8, "tick": 0.12, "clang": 0.4, "rumble": 0.45},
                    3.4, 0.38, -18.0)


def notstrom_alarm():
    s = Song(104, 16)
    cl, hat_s = clap(0.8), hat(0.5, 0.02)
    for b in range(16):
        r = 36 if b % 4 != 3 else 37
        if b >= 2:
            for beat in range(4):
                s.put("kick", kick(1.0), s.t(b, beat))
        if b >= 4:
            for beat in (1, 3):
                s.put("clap", cl, s.t(b, beat))
            for e in range(8):
                s.put("hat", hat_s, s.t(b, e / 2 + 0.25), 0.5)
        for e in range(8):
            s.put("bass", growl(r + (6 if e == 6 else 0), s.beat * 0.4), s.t(b, e / 2))
        s.put("sub", subnote(r, s.bar), s.t(b), 0.9)
        if b >= 8:
            for beat, m in ((0, 48), (2, 54)):
                n = n_of(s.beat * 1.8)
                s.put("klaxon", stack(m, n, "saw", (-12, 0, 12)) * env(n, 0.04, 0.4), s.t(b, beat))
    for b in (7, 15):
        s.put("riser", riser(s.bar, vol=0.8), s.t(b))
        for k, f in enumerate((120, 105, 92, 80)):
            s.put("tom", tom(f, 0.9), s.t(b, 2.5 + k * 0.375))
    for b in (0, 8):
        s.put("impact", boom(2.2), s.t(b))
    s.fx("klaxon", lambda x: reverb(lp(x, 900), 1.6, 0.3, True))
    s.fx("hat", lambda x: hp(x, 5500))
    return s.render({"kick": 1.0, "clap": 0.6, "hat": 0.3, "bass": 0.9, "sub": 0.9, "klaxon": 0.5, "riser": 0.5,
                     "tom": 0.8, "impact": 0.8}, 2.0, 0.22, -14.5)


# ------------------------------------------------------------------ Notstrom ambience (seamless loops)
OV = n_of(1.5)


def ambient(dur, fn, rt=None, wet=0.3):
    n = n_of(dur)
    x = loopify(fn(n + OV), n)
    x = reverb(x, rt, wet, True) if rt else x
    st = np.stack([x, np.roll(x, n_of(0.013))], axis=1)  # slight Haas offset for width
    st *= 10 ** (-20 / 20) / np.sqrt(np.mean(st ** 2))
    return np.tanh(st / 0.9) * 0.9


def amb_reactor_hum(dur=16):
    def build(n):
        t = tt(n)
        x = sum(g * np.sin(2 * np.pi * 50 * h * t + 0.3 * h) for h, g in ((1, 1), (2, .55), (3, .25), (4, .15), (6, .07)))
        x = x * (0.8 + 0.2 * np.sin(2 * np.pi * 0.25 * t)) + 0.5 * np.sin(2 * np.pi * 50.5 * t)
        return x * 0.6 + lp(noise(n), 110) * 1.4
    return ambient(dur, build)


def amb_ventilation(dur=16):
    def build(n):
        t = tt(n)
        fan = 0.7 + 0.3 * np.sin(2 * np.pi * 4.5 * t)
        return bp(noise(n), 180, 1600) * fan * 0.8 + lp(noise(n), 90) * 1.2
    return ambient(dur, build, 1.2, 0.2)


def amb_electrical(dur=16):
    def build(n):
        t = tt(n)
        buzz = lp(osc(100, n, "saw"), 500) * 0.25 + 0.15 * np.sin(2 * np.pi * 50 * t)
        x = buzz.copy()
        for _ in range(16):
            k = RNG.integers(0, n - n_of(0.3))
            ln = n_of(RNG.uniform(0.02, 0.14))
            burst = hp(noise(ln), 2200) * (RNG.uniform(size=ln) > 0.55) * RNG.uniform(0.3, 1.0)
            x[k:k + ln] += burst * np.exp(-tt(ln) / 0.05)
            if RNG.uniform() > 0.5:
                x[k:k + n_of(0.2)] += boom(0.2, 70, 45, 0.08, 0.3)[:n_of(0.2)]
        return x
    return ambient(dur, build, 1.5, 0.25)


def amb_steam_vents(dur=16):
    def build(n):
        x = lp(noise(n), 700) * 0.12
        for pos in (1.0, 4.5, 8.0, 11.5, 14.0):
            ln = n_of(2.2)
            hiss = sweep_lp(noise(ln), 5500, 800) * env(ln, 0.08, 1.4) * 1.2
            put(x, hiss, pos, wrap=False)
            put(x, boom(0.5, 75, 45, 0.15, 0.5), pos, wrap=False)
            put(x, clang(155, 1.0, 0.25), pos + 0.1, wrap=False)
        return x
    return ambient(dur, build, 2.0, 0.3)


def amb_machinery(dur=20):
    def build(n):
        x = lp(noise(n), 120) * 0.8
        for pos in (1.5, 4.2, 7.9, 10.4, 13.8, 16.1, 18.3):
            put(x, clang(RNG.uniform(80, 240), 2.0, RNG.uniform(0.2, 0.5)), pos, wrap=False)
            if RNG.uniform() > 0.4:
                put(x, boom(0.8, 70, 32, 0.25, RNG.uniform(0.3, 0.7)), pos - 0.05, wrap=False)
        return x
    return ambient(dur, build, 3.2, 0.5)


def amb_klaxon(dur=8):
    def build(n):
        t = tt(n)
        gate = np.clip(np.sin(2 * np.pi * 0.5 * t) * 4 + 0.5, 0, 1)
        f = np.where(np.sin(2 * np.pi * 0.5 * t) > 0, 233.0, 175.0)
        x = lp(drive(osc(f, n, "saw") * 0.8, 1.4), 800) * gate
        return x + lp(noise(n), 90) * 0.4
    return ambient(dur, build, 2.2, 0.45)


def amb_coolant(dur=16):
    def build(n):
        x = lp(noise(n), 350) * 0.1
        for _ in range(12):
            ln = n_of(0.25)
            f = RNG.uniform(380, 700) * (1 - 0.35 * tt(ln) / 0.25)
            drip = np.sin(2 * np.pi * np.cumsum(f) / SR) * expd(ln, 0.04) * RNG.uniform(0.3, 0.9)
            put(x, drip, RNG.uniform(0, dur - 0.5), wrap=False)
        return x
    return ambient(dur, build, 2.8, 0.6)


# ------------------------------------------------------------------ sound effects (mono, heavy and dark)
def sfx(*parts, rt=0.0, wet=0.3, drv=1.3):
    x = mix(*parts)
    if rt:
        x = reverb(x, rt, wet)
    return fade_out(drive(x, drv))


def sfx_ui_tap():
    n = n_of(0.08)
    return sfx(np.sin(2 * np.pi * 420 * tt(n)) * expd(n, 0.02), osc(840, n, "tri") * expd(n, 0.012) * 0.5,
               boom(0.12, 120, 70, 0.04, 0.6))


def sfx_card_select():
    return sfx(np.concatenate([osc(165, n_of(.06), "tri") * expd(n_of(.06), .05), osc(247, n_of(.1), "tri") * expd(n_of(.1), .07)]),
               crack(0.15, 2500, 0.01, 0.4))


def sfx_card_deselect():
    return sfx(np.concatenate([osc(247, n_of(.05), "tri") * expd(n_of(.05), .04), osc(138, n_of(.1), "tri") * expd(n_of(.1), .07)]))


def sfx_pitch():
    n = n_of(0.5)
    sw = sweep_lp(noise(n), 4000, 300) * env(n, 0.01, 0.4)
    return sfx(sw * 0.6, clang(520, 0.9, 0.5), boom(0.5, 100, 45, 0.15, 0.9), rt=1.0, wet=0.25)


def sfx_commit():
    n = n_of(1.0)
    ch = lp(chord_pad([38, 45, 50, 53], 1.0, 0.01, 0.8), 1100) * 1.2
    return sfx(boom(1.2, 90, 30, 0.3, 1.2), ch, crack(0.2, 1800, 0.02, 0.6), clang(130, 1.0, 0.4), rt=1.8, wet=0.3, drv=1.5)


def sfx_resolution_start():
    rs = riser(1.6, 120, 8000, 1.0)
    saw = lp(osc(np.linspace(40, 180, n_of(1.6)), n_of(1.6), "saw"), 900) * np.linspace(0.1, 1, n_of(1.6)) ** 2
    hit = mix(boom(2.0, 95, 26, 0.55, 1.6), crack(0.5, 1200, 0.05, 1.0), clang(70, 2.0, 0.5))
    x = np.zeros(n_of(1.6) + len(hit))
    put(x, rs + saw * 0.8, 0, wrap=False)
    put(x, hit, 1.55, wrap=False)
    return sfx(x, rt=2.6, wet=0.3, drv=1.5)


def sfx_tick():
    n = n_of(0.12)
    return sfx(np.sin(2 * np.pi * 150 * tt(n)) * expd(n, 0.03), crack(0.12, 2000, 0.006, 0.7), boom(0.15, 90, 50, 0.05, 0.7))


def sfx_move():
    n = n_of(0.32)
    step = lp(noise(n), 700) * expd(n, 0.06)
    return sfx(step, boom(0.3, 75, 42, 0.1, 1.0), clang(300, 0.4, 0.15), rt=0.5, wet=0.2, drv=1.4)


def sfx_attack_hit():
    return sfx(boom(0.9, 110, 28, 0.3, 1.4), crack(0.35, 1600, 0.03, 0.9), lp(noise(n_of(.4)), 600) * expd(n_of(.4), .1),
               rt=0.9, wet=0.25, drv=1.8)


def sfx_attack_shot():
    n = n_of(0.55)
    zap = lp(osc(60 + 1800 * np.exp(-tt(n) / 0.09), n, "saw"), 3000) * expd(n, 0.14)
    return sfx(zap, crack(0.3, 2500, 0.015, 0.7), boom(0.5, 100, 40, 0.15, 0.9), rt=1.1, wet=0.3, drv=1.8)


def sfx_miss():
    n = n_of(0.55)
    return sfx(sweep_lp(noise(n), 2200, 200) * env(n, 0.12, 0.35), boom(0.4, 60, 35, 0.12, 0.5), drv=1.2)


def sfx_shield_block():
    return sfx(clang(260, 1.5, 1.0), boom(0.6, 95, 38, 0.2, 1.0), crack(0.2, 2500, 0.008, 0.6), rt=1.6, wet=0.3, drv=1.6)


def sfx_shield_gain():
    n = n_of(0.8)
    rise = lp(osc(np.linspace(70, 210, n), n, "saw"), 1400) * env(n, 0.3, 0.4)
    shim = np.sin(2 * np.pi * np.cumsum(np.linspace(400, 800, n)) / SR) * env(n, 0.3, 0.4) * 0.25
    return sfx(rise, shim, boom(0.4, 80, 45, 0.1, 0.7), rt=1.4, wet=0.3, drv=1.4)


def sfx_deck_damage():
    n = n_of(0.9)
    crunch = hp(noise(n), 1500) * (RNG.uniform(size=n) > 0.7) * expd(n, 0.2)
    return sfx(crunch * 0.8, boom(0.9, 130, 26, 0.35, 1.2), clang(190, 0.8, 0.3), crack(0.15, 2200, 0.01, 0.6), rt=1.0, wet=0.25, drv=1.8)


def sfx_exhaustion():
    n = n_of(1.4)
    f = 220 * np.exp(-tt(n) / 0.55) + 36
    sag = sweep_lp(drive(osc(f, n, "saw") + osc(f * 1.01, n, "saw"), 1.5), 1500, 150) * env(n, 0.02, 0.9)
    return sfx(sag * 0.7, boom(1.2, 70, 24, 0.5, 1.0), rt=1.8, wet=0.3, drv=1.5)


def sfx_knockback():
    n = n_of(0.5)
    return sfx(sweep_lp(noise(n), 3000, 200) * env(n, 0.01, 0.3), boom(0.8, 105, 30, 0.25, 1.3), crack(0.2, 1500, 0.02, 0.7), rt=0.9, wet=0.2, drv=1.8)


def sfx_overwatch_alert():
    x = np.zeros(n_of(0.9))
    for i in range(2):
        n = n_of(0.16)
        put(x, drive(osc(330, n, "square") * 0.5 + osc(165, n, "saw") * 0.5, 1.5) * env(n, 0.005, 0.1), i * 0.22, wrap=False)
    x = lp(x, 1500)
    return sfx(echo(x, 0.2, 0.45, 3, 1500, False), boom(0.3, 60, 38, 0.1, 0.5), drv=1.3)


def sfx_prime_capture():
    ch = lp(chord_pad([38, 45, 50, 57, 62], 2.0, 0.5, 1.2), 1600) * 1.4
    return sfx(ch, boom(1.6, 95, 26, 0.5, 1.5), crack(0.4, 1400, 0.04, 0.7), clang(98, 2.0, 0.5), rt=2.6, wet=0.35, drv=1.6)


def sfx_prime_contested():
    n = n_of(1.0)
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * 6 * tt(n))
    d = lp(osc(73.4, n, "saw") + osc(77.8, n, "saw"), 600) * trem * env(n, 0.03, 0.5)
    return sfx(d * 0.8, boom(0.5, 70, 32, 0.15, 0.8), rt=1.2, wet=0.25, drv=1.6)


def sfx_prime_tick():
    return sfx(clang(110, 1.6, 0.8), boom(0.7, 80, 34, 0.2, 1.0), rt=2.0, wet=0.35, drv=1.4)


def sfx_victory():
    x = np.zeros(n_of(4.2))
    for i, (root, k) in enumerate(((38, "m"), (34, "M"), (36, "M"), (38, "M"))):
        d = 1.4 if i < 3 else 2.6
        put(x, lp(chord_pad(chord(root + 12, k) + [root + 24], d, 0.03, d * 0.7), 2000) * 1.3, i * 0.55, wrap=False)
        put(x, tom(70 + 4 * i, 1.0, 0.8, 0.25), i * 0.55, wrap=False)
    put(x, boom(2.5, 95, 26, 0.6, 1.5), 1.65, wrap=False)
    put(x, riser(1.6, 400, 9000, 0.4), 0, wrap=False)
    return sfx(x, rt=3.2, wet=0.35, drv=1.5)


def sfx_defeat():
    x = np.zeros(n_of(4.2))
    for i, (root, k) in enumerate(((38, "m"), (37, "m"), (34, "m"), (31, "m"))):
        d = 1.6 if i < 3 else 2.4
        put(x, lp(chord_pad(chord(root + 12, k), d, 0.1, d * 0.7), 900) * 1.3, i * 0.7, wrap=False)
    put(x, boom(3.0, 70, 22, 0.9, 1.6), 2.1, wrap=False)
    put(x, clang(73, 3.0, 0.4), 2.1, wrap=False)
    return sfx(x, rt=3.6, wet=0.4, drv=1.5)


SFX = {
    "ui_tap": (sfx_ui_tap, .45), "card_select": (sfx_card_select, .55), "card_deselect": (sfx_card_deselect, .5),
    "card_pitch": (sfx_pitch, .8), "plan_commit": (sfx_commit, .9), "resolution_start": (sfx_resolution_start, .95),
    "tick": (sfx_tick, .5), "move": (sfx_move, .8), "attack_hit": (sfx_attack_hit, .95), "attack_shot": (sfx_attack_shot, .9),
    "miss": (sfx_miss, .7), "shield_block": (sfx_shield_block, .9), "shield_gain": (sfx_shield_gain, .8),
    "deck_damage": (sfx_deck_damage, .9), "exhaustion": (sfx_exhaustion, .85), "knockback": (sfx_knockback, .9),
    "overwatch_alert": (sfx_overwatch_alert, .75), "prime_capture": (sfx_prime_capture, .95),
    "prime_contested": (sfx_prime_contested, .8), "prime_tick": (sfx_prime_tick, .85),
    "victory": (sfx_victory, .95), "defeat": (sfx_defeat, .95),
}

# (folder, name) -> renderer
MUSIC = {
    ("music", "plan_a"): plan_a, ("music", "resolution_a"): resolution_a,
    ("music", "plan_b"): plan_b, ("music", "resolution_b"): resolution_b,
    ("music", "plan_c"): plan_c, ("music", "resolution_c"): resolution_c,
    ("music", "plan_d"): plan_d, ("music", "resolution_d"): resolution_d,
    ("notstrom/music", "notstrom_theme"): notstrom_theme, ("notstrom/music", "notstrom_alarm"): notstrom_alarm,
}
AMBIENT = {
    "reactor_hum": amb_reactor_hum, "ventilation": amb_ventilation, "electrical_crackle": amb_electrical,
    "steam_vents": amb_steam_vents, "machinery": amb_machinery, "klaxon": amb_klaxon, "coolant_drips": amb_coolant,
}


# ------------------------------------------------------------------ output
def exists(version, folder, name):
    return (OUT / version / folder / f"{name}.ogg").exists()


def save(version, folder, name, x, quality):
    """Never overwrites: a finished file is a released version. New work gets a new version folder."""
    path = OUT / version / folder
    if (path / f"{name}.ogg").exists():
        raise FileExistsError(path / f"{name}.ogg")
    path.mkdir(parents=True, exist_ok=True)
    pcm = np.atleast_2d(x.T if x.ndim == 2 else x).T if x.ndim == 1 else x
    wav = path / f"{name}.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(pcm, -1, 1) * 32767).astype("<i2").tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", str(quality),
                    str(path / f"{name}.ogg")], check=True)
    wav.unlink()


def stats(x):
    m = x.mean(axis=1) if x.ndim == 2 else x
    spec = np.abs(np.fft.rfft(m))
    centroid = float((spec * np.fft.rfftfreq(len(m), 1 / SR)).sum() / spec.sum())
    rms = 20 * np.log10(np.sqrt(np.mean(m ** 2)) + 1e-9)
    return len(m) / SR, rms, centroid


V2 = "v2"


def main(flt=""):
    report = {}
    for name, (fn, peak) in SFX.items():
        if flt in f"sfx/{name}" and not exists(V2, "sfx", name):
            reseed(name)
            x = fn()
            save(V2, "sfx", name, x / np.max(np.abs(x)) * peak * 0.92, 3)
            print("sfx", name)
    for (folder, name), fn in MUSIC.items():
        if flt in f"{folder}/{name}" and not exists(V2, folder, name):
            reseed(name)
            x = fn()
            save(V2, folder, name, x, 4)
            report[name] = stats(x)
            print(folder, name, "%.1fs  rms %.1f dB  centroid %.0f Hz" % report[name])
    for name, fn in AMBIENT.items():
        if flt in f"notstrom/ambient/{name}" and not exists(V2, "notstrom/ambient", name):
            reseed(name)
            x = fn()
            save(V2, "notstrom/ambient", name, x, 3)
            print("ambient", name, "%.1fs  rms %.1f dB  centroid %.0f Hz" % stats(x))
    for k in "abcd":
        p, r = report.get(f"plan_{k}"), report.get(f"resolution_{k}")
        if p and r:
            ok = r[1] > p[1] and r[2] > p[2]
            print(f"pair {k}: resolution louder and brighter than plan: {ok}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
