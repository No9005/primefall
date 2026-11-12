"""Main theme (main menu) candidates for Primefall: v3 (cinematic) and v4 (faster, trance-driven).

Four directions that share one arrangement shape: a bass that waves in softly and becomes the pulse,
strings and orchestra on top, a dreamy slow centre, and a return to a hard, kicking finale.

    python3 tools/audio/main_themes.py            # everything not yet rendered
    python3 tools/audio/main_themes.py rush       # only names containing "rush"

Never overwrites: existing files are skipped (see generate_audio.save).
"""
import sys

import numpy as np

import generate_audio as g
from generate_audio import (SR, Song, bp, boom, chord, clang, clap, crack, echo, env, expd, hat, hp, kick, lp, midi,
                            mix, n_of, noise, osc, pluck, reverb, riser, snare, stack, tom, tt)



# ------------------------------------------------------------------ voices (clean: no distortion on bass)
def mod_lp(x, f0, f1, lfo, steps=6):
    """Low-pass whose cutoff follows lfo (array in 0..1) between f0 and f1."""
    outs = [lp(x, fc) for fc in np.geomspace(f0, f1, steps)]
    pos = lfo * (steps - 1)
    return sum(np.clip(1 - np.abs(pos - k), 0, 1) * o for k, o in enumerate(outs))


def wobble(m, dur, rate=0.2, bright=500):
    """Waving sub bass: pitch, level and filter all breathe slowly."""
    n = n_of(dur)
    t = tt(n)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * rate * t)
    f = midi(m)
    sub = np.sin(2 * np.pi * f * t + 0.7 * np.sin(2 * np.pi * rate * 0.5 * t))
    saw = mod_lp(osc(f, n, "saw") + osc(f * 1.006, n, "saw"), 110, bright, lfo)
    a = min(dur * 0.35, 2.5)
    return (sub * 0.9 + saw * 0.3) * (0.65 + 0.35 * lfo) * env(n, a, a)


def bass_pulse(m, dur):
    n = n_of(dur)
    f = midi(m)
    x = np.sin(2 * np.pi * f * tt(n)) + 0.25 * np.sin(4 * np.pi * f * tt(n)) + 0.35 * lp(osc(f, n, "saw"), 260)
    return x * env(n, 0.004, min(0.15, dur * 0.7))


def strings(notes, dur, a=1.0, r=1.2):
    n = n_of(dur)
    x = sum(stack(m, n, "saw", (-14, -5, 5, 14)) for m in notes) / len(notes)
    return lp(x, 2400) * env(n, a, r)


def stacc(m, dur):
    n = n_of(dur)
    return lp(stack(m, n, "saw", (-8, 0, 8)), 2600) * env(n, 0.004, dur * 0.7)


def horn(m, dur):
    n = n_of(dur)
    x = stack(m, n, "saw", (-6, 0, 6)) * 0.7 + osc(midi(m), n, "sine") * 0.4
    return lp(x, 1500) * env(n, 0.07, min(0.3, dur * 0.5)) * np.linspace(0.75, 1, n)


def choir(m, dur):
    n = n_of(dur)
    x = stack(m, n, "saw", (-15, 0, 15))
    y = bp(x, 600, 900) + 0.6 * bp(x, 1000, 1500) + 0.4 * lp(x, 250)
    a = min(1.2, dur * 0.4)
    return y * env(n, a, a)


def lead(m, dur):
    n = n_of(dur)
    t = tt(n)
    f = midi(m) * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.4))
    x = osc(f, n, "tri") * 0.7 + osc(f * 1.003, n, "saw") * 0.25
    return lp(x, 2200) * env(n, 0.01, min(0.3, dur * 0.4))


def glass(m, dur):
    n = n_of(dur)
    t = tt(n)
    return sum(gain * np.sin(2 * np.pi * midi(m) * r * t) * np.exp(-t / (dur * d))
               for r, gain, d in ((1, 1, .5), (2.41, .35, .3), (3.97, .2, .2), (5.6, .1, .12)))


def epic_hit():
    return mix(boom(3.0, 90, 26, 0.7, 1.0, 1.2), tom(52, 1.0, 1.2, 0.4), crack(0.6, 1200, 0.07, 0.7), clang(61, 3.0, 0.3))


def supersaw(m, n):
    return stack(m, n, "saw", (-24, -14, -6, 0, 6, 14, 24))


def gated_supersaw(notes, dur, pattern, cutoff=5500):
    """Trance chord: supersaw chopped by a 16-step gate pattern ('x' = open)."""
    n = n_of(dur)
    sig = lp(sum(supersaw(m, n) for m in notes) / len(notes), cutoff)
    gate = np.zeros(n)
    step = n // 16
    for j, c in enumerate(pattern):
        if c == "x":
            a, b = j * step, min(n, (j + 1) * step)
            gate[a:b] = env(b - a, 0.003, 0.05)
    return sig * gate


def ss_lead(m, dur, cutoff=4200):
    n = n_of(dur)
    t = tt(n)
    f = midi(m) * (1 + 0.003 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.3))
    x = sum(osc(f * 2 ** (c / 1200), n, "saw") for c in (-18, -8, 0, 8, 18)) / 5
    return lp(x, cutoff) * env(n, 0.008, min(0.25, dur * 0.4))


def duck_env(n, times, depth, rel=0.3):
    e = np.ones(n)
    seg_len = n_of(rel)
    shape = 1 - depth * np.exp(-np.arange(seg_len) / (seg_len / 4))
    for t in times:
        i = n_of(t)
        if i >= n:
            continue
        k = min(seg_len, n - i)
        e[i:i + k] = np.minimum(e[i:i + k], shape[:k])
    return e


# ------------------------------------------------------------------ arrangement engine
class Arr(Song):
    """Song with a tempo map: a list of sections, each with its own bpm and bar count."""

    def __init__(self, sections, tail=7.0):
        self.sec = {}
        t = 0.0
        for name, bpm, bars in sections:
            beat = 60 / bpm
            self.sec[name] = dict(t0=t, beat=beat, bar=4 * beat, bars=bars)
            t += 4 * beat * bars
        self.total = t
        self.n = n_of(t + tail)
        self.stems = {}

    def t(self, sec, bar=0, beat=0.0):
        s = self.sec[sec]
        return s["t0"] + bar * s["bar"] + beat * s["beat"]

    def put(self, name, snd, t, g_=1.0):
        g.put(self.stems.setdefault(name, np.zeros(self.n)), snd, t, g_, wrap=False)

    def render(self, levels, rt, wet, rms_db, ceiling=0.9):
        st = super().render(levels, rt, wet, rms_db) * (ceiling / 0.9)  # headroom for the lossy encoder
        k = n_of(3.0)
        st[-k:] *= np.linspace(1, 0, k)[:, None]
        return st


PULSE_Q = [0, 0, 0, 0]
GATE = "x.xx.xx.x.xx.xx."
KICKS = {"k1": (0,), "k2": (0, 2), "k4": (0, 1, 2, 3), "kx": (0, 1.5, 2, 3.5)}


def build_theme(spec):
    """spec: prog, melody, levels, rt/wet, voices, and a list of section dicts (see THEMES)."""
    arr = Arr([(s["name"], s["bpm"], s["bars"]) for s in spec["sections"]])
    prog, mel, bpat = spec["prog"], spec["melody"], spec["bass_pattern"]
    kick_times = []
    rng = np.random.default_rng(7)
    shaker, clap_s, snare_s, open_hat = hat(0.6, 0.03), clap(0.8), snare(0.9), hat(0.9, 0.09)

    for s in spec["sections"]:
        name, nb, cb = s["name"], s["bars"], s.get("cb", 1)
        sec = arr.sec[name]
        beat, bar = sec["beat"], sec["bar"]

        def ramp(key, i):
            v = s.get(key, 0)
            return v if np.isscalar(v) else v[0] + (v[1] - v[0]) * i / max(1, nb - 1)

        for i in range(nb):
            r, k = prog[(i // cb) % len(prog)]
            t0 = arr.t(name, i)
            if ramp("sub", i) > 0 and i % cb == 0:
                arr.put("sub", wobble(r - 12, bar * cb + 0.8, s.get("wob", 0.2), spec.get("bright", 500)), t0, ramp("sub", i))
            if ramp("pad", i) > 0 and i % cb == 0:
                inst = s.get("pad_inst", spec["pad_inst"])
                dur = bar * cb + 1.5
                if inst == "choir":
                    snd = sum(choir(m, dur) for m in chord(r + 24, k)) / 3
                elif inst == "horn":
                    snd = sum(horn(m, dur) for m in chord(r + 12, k)) / 3
                else:
                    snd = strings(chord(r + 12, k) + [r + 24], dur, 1.0, 1.5)
                arr.put("pad", snd, t0, ramp("pad", i))
            for key, steps, dur_b, note_fn in (("pq", 4, 0.9, lambda e: PULSE_Q[e % 4]),
                                               ("pe", 8, 0.45, lambda e: bpat[e % 8]),
                                               ("ps", 16, 0.22, lambda e: bpat[(e // 2) % 8])):
                v = ramp(key, i)
                if v > 0:
                    for e in range(steps):
                        accent = 1.0 if (steps < 16 or e % 2 == 0) else 0.55
                        arr.put("pulse", bass_pulse(r + note_fn(e), beat * dur_b), t0 + e * 4 * beat / steps, v * accent)
            for key, times in KICKS.items():
                v = ramp(key, i)
                if v > 0:
                    for b in times:
                        arr.put("kick", kick(1.0, 0.45, 150, 40, 0.14, spec.get("kick_drv", 1.5)), t0 + b * beat, v)
                        kick_times.append(t0 + b * beat)
            if ramp("clap", i) > 0:
                for b in (1, 3):
                    arr.put("perc", clap_s, t0 + b * beat, ramp("clap", i))
            if ramp("snare", i) > 0:
                arr.put("perc", snare_s, t0 + 2 * beat, ramp("snare", i))
            for key, steps in (("hh8", 8), ("hh16", 16)):
                v = ramp(key, i)
                if v > 0:
                    for e in range(steps):
                        arr.put("hat", shaker, t0 + e * 4 * beat / steps + (beat / 4 if steps == 8 else 0), v * (1.0 if e % 2 else 0.6))
            v = ramp("po", i)  # trance offbeat bass
            if v > 0:
                for b in range(4):
                    arr.put("pulse", bass_pulse(r + (12 if (b == 3 and i % 2) else 0), beat * 0.42), t0 + (b + 0.5) * beat, v)
            v = ramp("pr", i)  # rolling 16th bass, silent on the beat so the kick keeps its space
            if v > 0:
                for e in range(16):
                    if e % 4:
                        arr.put("pulse", bass_pulse(r + (12 if e % 8 == 7 else 0), beat * 0.2), t0 + e * beat / 4,
                                v * (1.0 if e % 4 == 2 else 0.75))
            v = ramp("sg", i)
            if v > 0:
                arr.put("ss", gated_supersaw(chord(r + 12, k) + [r + 24], bar, spec.get("gate", GATE), spec.get("ss_lp", 5500)), t0, v)
            v = ramp("oh", i)
            if v > 0:
                for b in range(4):
                    arr.put("hat", open_hat, t0 + (b + 0.5) * beat, v)
            if s.get("roll") and i == nb - 1:  # snare roll: 16ths, then 32nds, crescendo
                steps = [j * 0.25 for j in range(8)] + [2 + j * 0.125 for j in range(16)]
                for j, bt in enumerate(steps):
                    arr.put("perc", snare_s, t0 + bt * beat, 0.25 + 0.75 * j / (len(steps) - 1))
            for key, steps in (("ost8", 8), ("ost16", 16)):
                v = ramp(key, i)
                if v > 0:
                    tones = chord(r + 12, k) + [r + 24]
                    order = [0, 1, 2, 3, 2, 1, 2, 1]
                    for e in range(steps):
                        arr.put("ost", stacc(tones[order[e % 8] % len(tones)], beat * (0.4 if steps == 8 else 0.2)),
                                t0 + e * 4 * beat / steps, v * (1.0 if e % 4 == 0 else 0.7))
            if ramp("arp", i) > 0:
                tones = chord(r + 24, k) + [r + 36]
                for e, idx in enumerate([0, 1, 2, 3, 2, 1, 2, 1]):
                    arr.put("arp", pluck(tones[idx % len(tones)], 0.7, 1.0, "tri"), t0 + e * beat / 2, ramp("arp", i))
            if ramp("glass", i) > 0 and rng.uniform() < s.get("density", 0.5):
                tones = chord(r + 24, k) + [r + 36]
                arr.put("glass", glass(int(rng.choice(tones)), 3.0), t0 + rng.uniform(0, bar * 0.8), ramp("glass", i))
            if ramp("taiko", i) > 0:
                for b, f, v in spec["taiko_pat"]:
                    arr.put("perc", tom(f, 1.0, 0.8, 0.28), t0 + b * beat, ramp("taiko", i) * v)
            if ramp("bed", i) > 0 and i % cb == 0:
                n = n_of(bar * cb + 1)
                bed = lp(noise(n), 160) * 0.8 + bp(noise(n), 700, 3200) * 0.12 * (0.5 + 0.5 * np.sin(np.arange(n) / SR * 0.7))
                arr.put("bed", bed * env(n, 1, 1), t0, ramp("bed", i))
            if s.get("fill") and i == nb - 1:
                for j in range(8):
                    arr.put("perc", tom(140 - 10 * j, 0.8, 0.4, 0.12), t0 + (2 + j * 0.25) * beat, 0.9)
            if s.get("riser") and i == nb - 1:
                arr.put("fx", riser(bar, 150, 8000, 1.0), t0, s["riser"])
        if s.get("hit"):
            arr.put("fx", epic_hit(), arr.t(name), s["hit"])
        if ramp("mel", 0) > 0 or s.get("mel"):
            scale = s.get("mel_scale", 1)
            inst = s.get("mel_inst", spec["mel_inst"])
            span = 4 * scale
            for rep in range(nb // span):
                for mb, mbeat, m, d in mel:
                    ts = arr.t(name, rep * span + mb * scale, mbeat * scale)
                    dur = d * scale * beat * 0.97
                    snd = {"lead": lambda: lead(m, dur), "horn": lambda: horn(m, dur) + 0.5 * horn(m - 12, dur),
                           "strings": lambda: strings([m, m - 12], dur, 0.12, 0.4), "choir": lambda: choir(m, dur),
                           "ss": lambda: ss_lead(m, dur) + 0.4 * ss_lead(m - 12, dur)}[inst]()
                    arr.put("mel", snd, ts, ramp("mel", rep * span))

    n = arr.n
    if spec.get("duck"):
        for stem in ("pad", "ost", "arp", "ss"):
            if stem in arr.stems:
                arr.stems[stem] = arr.stems[stem] * duck_env(n, kick_times, spec["duck"])
    if "arp" in arr.stems:
        arr.stems["arp"] = echo(arr.stems["arp"], spec["arp_delay"], 0.55, 5, 1800)
    if "ost" in arr.stems:
        arr.stems["ost"] = reverb(arr.stems["ost"], 1.2, 0.2, True)
    return arr.render(spec["levels"], spec["rt"], spec["wet"], spec.get("rms", -17.0), spec.get("ceiling", 0.9))


# ------------------------------------------------------------------ the four directions
S = lambda name, bpm, bars, **kw: dict(name=name, bpm=bpm, bars=bars, **kw)  # noqa: E731

LEVELS = {"sub": 1.0, "pad": 0.55, "pulse": 0.9, "kick": 0.9, "perc": 0.7, "hat": 0.22, "ost": 0.5, "arp": 0.4, "mel": 0.55,
          "glass": 0.35, "bed": 0.4, "fx": 0.6}

# A. Drift: spacey and cool. Delayed arpeggios over a pulse that grows out of the sub (Closer, Battlefield menu). E minor.
DRIFT = dict(
    prog=[(40, "m"), (36, "M"), (43, "M"), (38, "M")],
    melody=[(0, 0, 71, 2), (0, 2, 67, 1), (0, 3, 69, 1), (1, 0, 67, 3), (1, 3, 64, 1), (2, 0, 74, 2), (2, 2, 71, 1),
            (2, 3, 67, 1), (3, 0, 69, 4)],
    bass_pattern=[0, 0, 12, 0, 0, 0, 7, 0], pad_inst="strings", mel_inst="lead", arp_delay=60 / 96 * 0.75, duck=0.5,
    levels=dict(LEVELS, arp=0.55, hat=0.28), rt=3.6, wet=0.38, bright=600,
    taiko_pat=[(0, 55, 1.0), (2.5, 62, 0.6)],
    sections=[
        S("intro", 80, 6, sub=(0.4, 1.0), wob=0.15, pad=(0, 0.35), arp=(0, 0.2)),
        S("build1", 80, 4, sub=1.0, wob=0.2, pq=(0.2, 0.8), k1=(0, 0.5), pad=0.4, arp=0.3),
        S("build2", 80, 4, sub=1.0, pe=(0.6, 1.0), k2=(0.5, 0.8), hh8=(0.2, 0.4), pad=(0.5, 0.7), arp=0.45, riser=0.6),
        S("main", 96, 12, sub=0.8, pe=1.0, k4=0.9, clap=0.5, hh16=0.3, pad=0.7, arp=0.6, mel=(0.35, 0.7), wob=0.25),
        S("bridge", 64, 2, sub=1.0, wob=0.1, pad=0.8, riser=0.5),
        S("dream", 72, 10, cb=2, sub=0.9, wob=0.1, pad=0.9, pad_inst="choir", arp=0.25, glass=0.5, density=0.6, mel=0.6,
          mel_scale=2, mel_inst="strings"),
        S("rise", 84, 4, sub=1.0, pe=(0.4, 0.9), k2=(0.3, 0.9), ost8=(0.3, 0.8), pad=0.7, fill=True, riser=0.8, hit=0.0),
        S("kick", 108, 12, sub=1.0, wob=0.3, ps=1.0, k4=1.0, clap=0.7, snare=0.0, hh16=0.4, ost8=0.7, pad=0.8, arp=0.5,
          mel=0.7, mel_inst="horn", hit=1.0, taiko=0.5),
        S("outro", 76, 4, sub=(1.0, 0.3), wob=0.15, pad=(0.7, 0.2), glass=0.6, density=1.0, hit=0.8),
    ])

# B. Artifact: mysterious, dirty sci-fi with fantasy: choir, glass, taiko, rustling noise. C minor, Phrygian colour.
ARTIFACT = dict(
    prog=[(36, "m"), (37, "M"), (32, "M"), (31, "sus")],
    melody=[(0, 0, 67, 3), (0, 3, 68, 1), (1, 0, 67, 2), (1, 2, 63, 2), (2, 0, 65, 3), (2, 3, 67, 1), (3, 0, 61, 4)],
    bass_pattern=[0, 0, 0, 12, 0, 0, 1, 0], pad_inst="choir", mel_inst="choir", arp_delay=60 / 72 * 0.75, duck=0.0,
    levels=dict(LEVELS, bed=0.6, glass=0.5, perc=0.85, pad=0.65), rt=4.6, wet=0.45, bright=700,
    taiko_pat=[(0, 52, 1.0), (1.5, 62, 0.5), (2.5, 55, 0.8), (3.25, 70, 0.4)],
    sections=[
        S("intro", 66, 8, sub=(0.3, 1.0), wob=0.1, bed=(0.2, 0.8), glass=0.5, density=0.35, pad=(0, 0.4), hit=0.7),
        S("build1", 66, 4, sub=1.0, wob=0.12, bed=0.8, pq=(0.2, 0.8), k1=(0, 0.6), pad=0.5, glass=0.5, density=0.5),
        S("build2", 66, 4, sub=1.0, bed=0.8, pe=(0.5, 1.0), k2=(0.4, 0.8), taiko=(0, 0.5), pad=(0.5, 0.8), arp=0.3, riser=0.6),
        S("main", 72, 12, sub=0.9, wob=0.15, bed=0.6, pe=1.0, k2=0.8, taiko=0.7, ost8=0.4, pad=0.8, mel=(0.4, 0.8),
          mel_inst="horn", glass=0.4, density=0.5, arp=0.35),
        S("bridge", 50, 2, sub=1.0, wob=0.08, pad=0.9, riser=0.5),
        S("dream", 50, 10, cb=2, sub=0.8, wob=0.07, bed=0.5, pad=0.9, glass=0.7, density=0.9, mel=0.7, mel_scale=2,
          mel_inst="choir", arp=0.2),
        S("rise", 80, 4, sub=1.0, pe=(0.4, 1.0), k2=(0.3, 0.9), taiko=(0.4, 1.0), ost8=(0.3, 0.8), pad=0.7, fill=True, riser=0.9),
        S("kick", 100, 12, sub=1.0, wob=0.2, bed=0.5, ps=1.0, kx=1.0, snare=0.8, taiko=0.9, ost16=0.7, pad=0.9, mel=0.8,
          mel_inst="horn", glass=0.3, density=0.5, hit=1.0, hh8=0.3),
        S("outro", 60, 4, sub=(1.0, 0.2), wob=0.1, bed=0.5, pad=(0.8, 0.1), glass=0.8, density=1.0, hit=0.8),
    ])

# C. Blood: dramatic orchestral, string ostinato, taiko, horns, a long emotional centre (BG3, Witcher). D minor.
BLOOD = dict(
    prog=[(38, "m"), (34, "M"), (41, "M"), (36, "M")],
    melody=[(0, 0, 69, 2), (0, 2, 65, 1), (0, 3, 62, 1), (1, 0, 70, 3), (1, 3, 69, 1), (2, 0, 72, 2), (2, 2, 69, 1),
            (2, 3, 65, 1), (3, 0, 67, 2), (3, 2, 69, 2)],
    bass_pattern=[0, 0, 0, 0, 0, 7, 0, 0], pad_inst="strings", mel_inst="horn", arp_delay=60 / 80 * 0.75, duck=0.0,
    levels=dict(LEVELS, ost=0.7, perc=0.9, pad=0.7, mel=0.65, kick=0.75), rt=3.4, wet=0.36, bright=450,
    taiko_pat=[(0, 55, 1.0), (1, 62, 0.5), (1.5, 70, 0.6), (2.5, 55, 0.9), (3, 75, 0.5)],
    sections=[
        S("intro", 84, 6, sub=(0.4, 1.0), wob=0.14, pad=(0.1, 0.6), mel=0.0, hit=0.6),
        S("build1", 84, 4, sub=1.0, pq=(0.3, 0.9), ost8=(0, 0.5), pad=0.7, taiko=(0, 0.4)),
        S("build2", 84, 4, sub=1.0, pe=(0.6, 1.0), ost8=(0.5, 0.9), taiko=(0.4, 0.8), k1=(0, 0.6), pad=0.8, mel=0.5, mel_inst="horn",
          riser=0.6),
        S("main", 100, 12, sub=0.9, pe=1.0, k2=0.7, taiko=0.8, ost8=0.9, pad=0.8, mel=0.8, clap=0.4, hit=0.9),
        S("bridge", 56, 2, sub=1.0, wob=0.1, pad=0.9, riser=0.5),
        S("dream", 60, 10, cb=2, sub=0.8, wob=0.08, pad=0.9, pad_inst="choir", mel=0.9, mel_scale=2, mel_inst="strings",
          arp=0.3, glass=0.3, density=0.4),
        S("rise", 100, 4, sub=1.0, pe=(0.5, 1.0), ost8=(0.4, 1.0), taiko=(0.5, 1.0), k2=(0.4, 0.9), pad=0.8, fill=True, riser=0.9),
        S("kick", 120, 12, sub=1.0, ps=1.0, k4=0.9, snare=0.7, taiko=1.0, ost16=1.0, pad=0.9, mel=0.9, mel_inst="horn",
          hit=1.0, hh8=0.25),
        S("outro", 66, 4, sub=(1.0, 0.3), pad=(0.8, 0.2), mel=0.6, mel_scale=1, mel_inst="strings", hit=0.8),
    ])

# D. Cold Open: electronic and tense, tight drums, sidechained pads, synth lead, orchestra only in the finale (Paragon, BF3). F minor.
COLD = dict(
    prog=[(41, "m"), (37, "M"), (44, "M"), (39, "M")],
    melody=[(0, 0, 68, 1.5), (0, 1.5, 65, 0.5), (0, 2, 68, 2), (1, 0, 72, 1.5), (1, 1.5, 70, 0.5), (1, 2, 68, 2),
            (2, 0, 67, 1), (2, 1, 68, 1), (2, 2, 72, 2), (3, 0, 70, 4)],
    bass_pattern=[0, 0, 0, 12, 0, 0, 0, 7], pad_inst="strings", mel_inst="lead", arp_delay=60 / 108 * 0.75, duck=0.55,
    levels=dict(LEVELS, arp=0.5, hat=0.3, pulse=1.0, kick=1.0, perc=0.75, pad=0.55), rt=2.8, wet=0.3, bright=800,
    taiko_pat=[(0, 55, 1.0), (2.5, 62, 0.6)],
    sections=[
        S("intro", 108, 6, sub=(0.5, 1.0), wob=0.25, pq=(0, 0.6), arp=(0, 0.35), pad=(0, 0.3)),
        S("build1", 108, 4, sub=1.0, wob=0.25, pe=(0.4, 0.8), k1=(0.2, 0.6), hh8=(0, 0.3), arp=0.45, pad=0.4),
        S("build2", 108, 4, sub=1.0, pe=1.0, k2=(0.6, 0.9), clap=(0, 0.5), hh16=(0.2, 0.4), arp=0.55, pad=0.55, riser=0.6),
        S("main", 108, 12, sub=0.8, wob=0.3, ps=1.0, k4=1.0, clap=0.7, hh16=0.4, arp=0.6, pad=0.7, mel=(0.4, 0.7)),
        S("bridge", 54, 2, sub=1.0, wob=0.1, pad=0.8, riser=0.5),
        S("dream", 54, 10, cb=2, sub=0.8, wob=0.1, pad=0.9, pad_inst="choir", glass=0.6, density=0.6, arp=0.3, mel=0.6,
          mel_scale=2, mel_inst="strings"),
        S("rise", 108, 4, sub=1.0, ps=(0.4, 1.0), k2=(0.4, 1.0), hh16=(0.2, 0.5), pad=0.7, fill=True, riser=0.9),
        S("kick", 112, 12, sub=1.0, ps=1.0, kx=1.0, clap=0.8, snare=0.6, hh16=0.45, ost16=0.7, arp=0.5, pad=0.9, mel=0.8,
          mel_inst="horn", hit=1.0, taiko=0.6),
        S("outro", 56, 4, sub=(1.0, 0.3), pad=(0.7, 0.2), glass=0.7, density=1.0, hit=0.8),
    ])

THEMES = {"theme_a_drift": DRIFT, "theme_b_artifact": ARTIFACT, "theme_c_blood": BLOOD, "theme_d_cold_open": COLD}

# ------------------------------------------------------------------ v4: faster, shorter, trance-driven (~1:30 to 1:45)
# Shape: waving bass intro, build with snare roll, drop, short dreamy break at a slower tempo, rise, bigger drop, outro.
# Trance ingredients: 4-on-the-floor, off-beat or rolling bass, gated supersaw chords, snare rolls, open hats, risers.
LEVELS4 = {"sub": 0.9, "pad": 0.5, "pulse": 1.0, "kick": 1.0, "perc": 0.85, "hat": 0.3, "ost": 0.55, "arp": 0.45, "mel": 0.7,
           "glass": 0.3, "bed": 0.35, "fx": 0.75, "ss": 0.5}
RUSH_MEL = [(0, 0, 71, 1.5), (0, 1.5, 69, .5), (0, 2, 67, 1), (0, 3, 69, 1), (1, 0, 67, 1.5), (1, 1.5, 66, .5), (1, 2, 64, 2),
            (2, 0, 69, 1.5), (2, 1.5, 67, .5), (2, 2, 62, 1), (2, 3, 66, 1), (3, 0, 64, 3), (3, 3, 66, 1)]

# A. Rush: closest to uplifting trance. Gated supersaws, emotive lead, big roll into the drop. E minor.
RUSH = dict(
    prog=[(40, "m"), (36, "M"), (43, "M"), (38, "M")], melody=RUSH_MEL, bass_pattern=[0, 0, 12, 0, 0, 0, 7, 0],
    pad_inst="strings", mel_inst="ss", arp_delay=60 / 138 * 0.75, duck=0.55, kick_drv=2.0, rt=2.2, wet=0.24, bright=700,
    levels=LEVELS4, rms=-14.5, ceiling=0.78, taiko_pat=[(0, 55, 1.0), (2.5, 62, 0.6)],
    sections=[
        S("intro", 138, 4, sub=(0.5, 1.0), wob=0.5, arp=(0.2, 0.5), pad=(0.1, 0.5), hh8=(0, 0.35), hit=0.6),
        S("build", 138, 4, sub=1.0, wob=0.5, po=(0.5, 1.0), k4=(0.5, 1.0), hh16=(0.2, 0.4), arp=0.5, sg=(0.2, 0.7), roll=True, riser=0.8),
        S("drop1", 138, 12, sub=0.6, pr=1.0, k4=1.0, clap=0.85, oh=0.6, hh16=0.35, sg=0.85, arp=0.5, mel=(0.6, 0.85), hit=1.0),
        S("break", 92, 8, cb=2, sub=0.9, wob=0.2, pad=0.9, pad_inst="choir", glass=0.5, density=0.6, arp=0.3, mel=0.75,
          mel_scale=2, mel_inst="strings", riser=0.0),
        S("rise", 138, 4, sub=0.8, pr=(0.5, 1.0), k4=(0.3, 1.0), sg=(0.4, 1.0), clap=(0, 0.7), hh16=(0.2, 0.5), roll=True, riser=0.9),
        S("drop2", 138, 16, sub=0.6, pr=1.0, k4=1.0, clap=0.9, oh=0.7, hh16=0.4, sg=1.0, ost16=0.5, arp=0.55, mel=(0.8, 1.0), taiko=0.3, hit=1.0),
        S("outro", 138, 2, sub=(1.0, 0.3), pad=(0.7, 0.2), glass=0.6, density=1.0, hit=0.8),
    ])

# B. Artifact Trance: dark, mysterious, psy-leaning. Choir and glass over a rolling bass and taiko. C minor, Phrygian colour.
ARTIFACT4 = dict(
    prog=[(36, "m"), (37, "M"), (32, "M"), (31, "sus")], melody=ARTIFACT["melody"], bass_pattern=[0, 0, 0, 12, 0, 0, 1, 0],
    pad_inst="choir", mel_inst="horn", arp_delay=60 / 132 * 0.75, duck=0.45, kick_drv=2.0, rt=3.0, wet=0.32, bright=700,
    ss_lp=3200, levels=dict(LEVELS4, bed=0.5, glass=0.45, perc=0.9), rms=-14.5, ceiling=0.78,
    taiko_pat=[(0, 52, 1.0), (1.5, 62, 0.5), (2.5, 55, 0.8), (3.25, 70, 0.4)],
    sections=[
        S("intro", 132, 4, sub=(0.5, 1.0), wob=0.4, bed=(0.3, 0.9), glass=0.6, density=0.6, pad=(0.1, 0.5), taiko=(0, 0.6), hit=0.8),
        S("build", 132, 4, sub=1.0, wob=0.4, bed=0.7, po=(0.5, 1.0), k4=(0.5, 1.0), taiko=0.7, hh16=(0.2, 0.4), sg=(0.2, 0.6),
          roll=True, riser=0.8),
        S("drop1", 132, 12, sub=0.6, bed=0.5, pr=1.0, k4=1.0, taiko=0.6, clap=0.7, oh=0.6, hh16=0.35, sg=0.75, pad=0.5,
          mel=(0.6, 0.9), glass=0.4, density=0.5, hit=1.0),
        S("break", 80, 6, cb=2, sub=0.9, wob=0.12, bed=0.5, pad=0.9, glass=0.8, density=0.9, mel=0.8, mel_scale=2,
          mel_inst="choir", arp=0.25),
        S("rise", 132, 4, sub=0.8, pr=(0.5, 1.0), k4=(0.3, 1.0), taiko=(0.4, 1.0), sg=(0.4, 1.0), hh16=(0.2, 0.5), roll=True, riser=0.9),
        S("drop2", 136, 16, sub=0.6, bed=0.4, pr=1.0, k4=1.0, taiko=0.9, snare=0.6, oh=0.7, hh16=0.4, sg=1.0, ost16=0.6,
          pad=0.6, mel=(0.8, 1.0), glass=0.3, density=0.5, hit=1.0),
        S("outro", 132, 2, sub=(1.0, 0.3), bed=0.5, pad=(0.8, 0.2), glass=0.8, density=1.0, hit=0.8),
    ])

# C. Blood Rush: a battle march that turns into trance. Orchestral ostinato, horns and taiko over 4-on-the-floor. D minor.
BLOOD4 = dict(
    prog=[(38, "m"), (34, "M"), (41, "M"), (36, "M")], melody=BLOOD["melody"], bass_pattern=[0, 0, 0, 0, 0, 7, 0, 0],
    pad_inst="strings", mel_inst="horn", arp_delay=60 / 150 * 0.75, duck=0.35, kick_drv=1.9, rt=2.6, wet=0.28, bright=500,
    levels=dict(LEVELS4, ost=0.75, perc=0.95, pad=0.6, mel=0.75, ss=0.4), rms=-14.5, ceiling=0.78,
    taiko_pat=[(0, 55, 1.0), (1, 62, 0.5), (1.5, 70, 0.6), (2.5, 55, 0.9), (3, 75, 0.5)],
    sections=[
        S("intro", 100, 4, sub=(0.5, 1.0), wob=0.3, pad=(0.3, 0.8), taiko=(0, 0.7), ost8=(0, 0.6), hit=0.8),
        S("build", 150, 4, sub=1.0, po=(0.5, 1.0), k4=(0.5, 1.0), ost8=(0.5, 1.0), taiko=0.8, pad=0.7, roll=True, riser=0.8),
        S("drop1", 150, 12, sub=0.6, pr=1.0, k4=1.0, ost16=0.9, taiko=0.8, snare=0.6, oh=0.5, pad=0.7, mel=(0.6, 0.9), hit=1.0),
        S("break", 84, 6, cb=2, sub=0.8, wob=0.1, pad=0.9, pad_inst="choir", mel=0.85, mel_scale=2, mel_inst="strings",
          arp=0.3, glass=0.3, density=0.4),
        S("rise", 150, 4, sub=0.8, pr=(0.5, 1.0), k4=(0.3, 1.0), ost16=(0.4, 1.0), taiko=(0.5, 1.0), roll=True, riser=0.9),
        S("drop2", 150, 16, sub=0.6, pr=1.0, k4=1.0, ost16=1.0, taiko=1.0, snare=0.7, oh=0.6, sg=0.4, pad=0.8, mel=(0.8, 1.0),
          hh16=0.3, hit=1.0),
        S("outro", 100, 2, sub=(1.0, 0.3), pad=(0.8, 0.2), mel=0.6, mel_inst="strings", hit=0.8),
    ])

# D. Cold Drive: progressive and cool. Sidechained pads, tight drums, synth lead, orchestra only in the second drop. F minor.
COLD4 = dict(
    prog=[(41, "m"), (37, "M"), (44, "M"), (39, "M")], melody=COLD["melody"], bass_pattern=[0, 0, 0, 12, 0, 0, 0, 7],
    pad_inst="strings", mel_inst="lead", arp_delay=60 / 128 * 0.75, duck=0.65, kick_drv=2.0, rt=2.0, wet=0.22, bright=800,
    levels=dict(LEVELS4, arp=0.55, hat=0.35, pulse=1.05), rms=-14.5, ceiling=0.78, taiko_pat=[(0, 55, 1.0), (2.5, 62, 0.6)],
    sections=[
        S("intro", 128, 4, sub=(0.5, 1.0), wob=0.5, pq=(0, 0.7), arp=(0.2, 0.6), pad=(0.1, 0.4), hit=0.5),
        S("build", 128, 4, sub=1.0, po=(0.5, 1.0), k4=(0.5, 1.0), clap=(0, 0.6), hh16=(0.2, 0.4), arp=0.55, sg=(0.2, 0.6),
          roll=True, riser=0.8),
        S("drop1", 128, 12, sub=0.6, po=1.0, k4=1.0, clap=0.8, oh=0.6, hh16=0.4, sg=0.7, arp=0.6, pad=0.5, mel=(0.6, 0.85), hit=1.0),
        S("break", 64, 8, cb=2, sub=0.9, wob=0.15, pad=0.9, pad_inst="choir", glass=0.6, density=0.6, arp=0.3, mel=0.75,
          mel_scale=2, mel_inst="strings"),
        S("rise", 128, 4, sub=0.8, pr=(0.5, 1.0), k4=(0.3, 1.0), clap=(0, 0.8), hh16=(0.3, 0.5), sg=(0.4, 1.0), roll=True, riser=0.9),
        S("drop2", 128, 16, sub=0.6, pr=1.0, k4=1.0, clap=0.9, snare=0.4, oh=0.7, hh16=0.45, sg=1.0, ost16=0.6, arp=0.55,
          pad=0.6, mel=(0.8, 1.0), mel_inst="horn", taiko=0.4, hit=1.0),
        S("outro", 128, 2, sub=(1.0, 0.3), pad=(0.7, 0.2), glass=0.7, density=1.0, hit=0.8),
    ])

THEMES_V4 = {"theme_a_rush": RUSH, "theme_b_artifact_trance": ARTIFACT4, "theme_c_blood_rush": BLOOD4, "theme_d_cold_drive": COLD4}


def main(flt=""):
    for version, themes in (("v3", THEMES), ("v4", THEMES_V4)):
        for name, spec in themes.items():
            if flt not in name or g.exists(version, "main_theme", name):
                continue
            g.reseed(name)
            x = build_theme(spec)
            g.save(version, "main_theme", name, x, 4)
            print(version, name, "%.1fs  rms %.1f dB  centroid %.0f Hz" % g.stats(x))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
