"""Main theme candidates, v5: a clean restart. Five directions, each with a hook in the first seconds.

    python3 tools/audio/main_themes_v5.py              # everything not yet rendered
    python3 tools/audio/main_themes_v5.py metal        # only names containing "metal"

Pieces (about one minute each, no fade-in, hard cold open):
    metal_ironclad    Metal: double-kick gallop, drop-D chugs, harmony-free lead hook, half-time breakdown
    bass_drive        Cool, driving bass: a 2-bar bass riff is the hook
    electro_voltage   Drum and bass at 172 BPM: Reese bass, 2-step drums, staccato lead
    epic_aether       Epic and dreamy: horn and choir theme over a string ostinato
    hybrid_salvage    Tactical noir: artifact motif on glass and horn over a ticking sub pulse, trailer hits

Never overwrites existing files (see generate_audio.save).
"""
import functools
import sys

import numpy as np

import generate_audio as g
from generate_audio import (SR, bp, boom, chord, clap, crack, drive, echo, env, hat, hp, kick, lp, midi, n_of, noise, osc,
                            reverb, riser, snare, stack, tom, tt)
from main_themes import Arr, bass_pulse, choir, duck_env, epic_hit, gated_supersaw, glass, horn, mod_lp, ss_lead, stacc, strings

VERSION = "v5"


# ------------------------------------------------------------------ shared helpers
def drums(metal=False):
    n = n_of(2.8)
    t = tt(n)
    return {
        "kick": kick(1.0, 0.2, 115, 48, 0.07, 2.4) if metal else kick(1.0, 0.45, 150, 40, 0.14, 1.8),
        "snare": snare(1.0), "clap": clap(0.9), "hat": hat(0.7, 0.025), "ohat": hat(0.9, 0.1),
        "crash": hp(noise(n), 3500) * np.exp(-t / 0.8) * 0.8,
    }


def pat(a, stem, snd, sec, bar, pattern, vol=1.0, soft=0.55):
    """Place snd on a 16-step style pattern: 'x' full, 'o' soft, anything else rests."""
    sb, t0 = a.sec[sec]["bar"], a.t(sec, bar)
    for j, c in enumerate(pattern):
        if c in "xo":
            a.put(stem, snd, t0 + j * sb / len(pattern), vol * (1.0 if c == "x" else soft))


def melody(a, stem, voice, sec, notes, start_bar=0, reps=1, vol=1.0, span=4):
    beat = a.sec[sec]["beat"]
    for rep in range(reps):
        for mb, mbeat, m, d in notes:
            a.put(stem, voice(m, d * beat * 0.97), a.t(sec, start_bar + rep * span + mb, mbeat), vol)


def tom_fill(a, sec, bar, f0=150, vol=0.9):
    for j in range(4):
        a.put("drum", tom(f0 - 18 * j, 0.9, 0.35, 0.1), a.t(sec, bar, 3 + j * 0.25), vol)


def snare_roll(a, sec, bar, snare_s):
    steps = [j * 0.25 for j in range(8)] + [2 + j * 0.125 for j in range(16)]
    for j, bt in enumerate(steps):
        a.put("drum", snare_s, a.t(sec, bar, bt), 0.25 + 0.75 * j / (len(steps) - 1))


def finish(a, levels, rt, wet, rms_db=-14.0, side=None, ceiling=0.78):
    """Mix stems, add stereo reverb, add side-panned stems dry, set loudness, limit, fade the tail."""
    dry = sum(a.stems[k] * gain for k, gain in levels.items() if k in a.stems)
    st = g.stereo_reverb(dry, rt, wet)
    for k, (gl, gr, gain) in (side or {}).items():
        if k in a.stems:
            st[:, 0] += a.stems[k] * gain * gl
            st[:, 1] += a.stems[k] * gain * gr
    st *= 10 ** (rms_db / 20) / np.sqrt(np.mean(st ** 2))
    st = np.tanh(st / 0.9) * ceiling
    k = n_of(1.5)
    st[-k:] *= np.linspace(1, 0, k)[:, None]
    return st


# ------------------------------------------------------------------ 1. metal
@functools.lru_cache(None)
def gtr(m, dur, mute, variant, kind):
    """Distorted rhythm guitar through a cabinet-like filter. variant 0/1 are two different 'takes' for L/R."""
    n = n_of(dur)
    cents = (-9, 0, 9) if variant == 0 else (-4, 5, 12)
    tones = {"dy": (m, m + 7), "pw": (m, m + 7, m + 12)}[kind]
    x = sum(stack(t, n, "saw", cents) for t in tones) / len(tones)
    x = drive(lp(x, 7000), 12)
    x = hp(lp(x, 4200), 85) + 0.4 * bp(x, 1200, 2600)
    return x * env(n, 0.002, 0.05 if mute else 0.18)


@functools.lru_cache(None)
def bass_gtr(m, dur):
    n = n_of(dur)
    f = midi(m)
    return (lp(drive(osc(f, n, "saw"), 2.0), 650) + 0.8 * osc(f, n, "sine")) * env(n, 0.003, 0.05)


def lead_gtr(m, dur):
    n = n_of(dur)
    t = tt(n)
    f = midi(m) * (1 + 0.005 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.25))
    x = drive(lp(osc(f, n, "saw") * 0.6 + osc(f * 1.004, n, "square") * 0.25, 5000), 5)
    return hp(lp(x, 4800), 180) * env(n, 0.01, min(0.2, dur * 0.4))


def riff(a, sec, i, r, offsets, vol=1.0):
    t0, s16 = a.t(sec, i), a.sec[sec]["bar"] / 16
    for j, off in enumerate(offsets):
        if off is None:
            continue
        acc = vol * (1.0 if j % 4 == 0 else 0.75)
        m, t = r + off, t0 + j * s16
        a.put("gl", gtr(m, 0.11, True, 0, "dy"), t, acc)
        a.put("gr", gtr(m, 0.11, True, 1, "dy"), t + 0.004, acc)
        a.put("bass", bass_gtr(m, 0.12), t, acc)


def power(a, sec, i, r, beat_pos, dur_beats, vol=1.0):
    t, d = a.t(sec, i, beat_pos), dur_beats * a.sec[sec]["beat"]
    a.put("gl", gtr(r, d, False, 0, "pw"), t, vol)
    a.put("gr", gtr(r, d, False, 1, "pw"), t + 0.004, vol)


def piece_metal():
    secs = [("hook1", 168, 4), ("verse", 168, 8), ("hook2", 168, 8), ("break", 168, 4), ("solo", 168, 8),
            ("final", 168, 8), ("outro", 168, 1)]
    a, D = Arr(secs, tail=4.0), drums(True)
    roots = [38, 34, 36, 38]  # Dm Bb C Dm
    RIFF = [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 5, 0, 3, 0]
    RIFF2 = [0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 5, 3]
    CHUG = [0, None, None, 0, None, None, 0, None, 0, None, None, 0, None, None, 0, None]
    HOOK = [(0, 0, 69, 1), (0, 1, 74, .5), (0, 1.5, 77, .5), (0, 2, 76, 1), (0, 3, 74, 1),
            (1, 0, 74, 1), (1, 1, 77, 1), (1, 2, 74, 1), (1, 3, 70, 1),
            (2, 0, 76, 1.5), (2, 1.5, 72, .5), (2, 2, 76, 1), (2, 3, 79, 1),
            (3, 0, 77, 1), (3, 1, 76, 1), (3, 2, 74, 2)]
    SOLO = [(0, 0, 74, 2), (0, 2, 77, 1), (0, 3, 79, 1), (1, 0, 77, 2), (1, 2, 74, 1), (1, 3, 70, 1),
            (2, 0, 72, 2), (2, 2, 76, 1), (2, 3, 79, 1), (3, 0, 77, 3), (3, 3, 76, 1)]
    KG, SB, HH = "xoxxxoxxxoxxxoxx", "....x.......x...", "x.x.x.x.x.x.x.x."
    for name, _, nb in secs:
        beat = a.sec[name]["beat"]
        for i in range(nb):
            r = roots[i % 4]
            last = i == nb - 1
            if name in ("hook1", "hook2", "final"):
                riff(a, name, i, r, RIFF)
                power(a, name, i, r, 0, 1.2)
                pat(a, "drum", D["kick"], name, i, KG, 0.9)
                pat(a, "drum", D["snare"], name, i, SB, 0.9)
                pat(a, "hat", D["hat"], name, i, HH, 0.5)
                if i % 2 == 0:
                    a.put("drum", D["crash"], a.t(name, i), 0.6)
            elif name == "verse":
                riff(a, name, i, r, RIFF2, 0.95)
                pat(a, "drum", D["kick"], name, i, "x.xxx.xxx.xxx.xx", 0.9)
                pat(a, "drum", D["snare"], name, i, SB, 0.9)
                pat(a, "hat", D["hat"], name, i, HH, 0.45)
            elif name == "break":
                riff(a, name, i, 38, CHUG, 1.1)
                power(a, name, i, 38, 0, 3.5, 0.8) if i % 2 == 0 else None
                pat(a, "drum", D["kick"], name, i, "x..x..x.x..x..x.", 1.0)
                pat(a, "drum", D["snare"], name, i, "........x.......", 1.0)
                a.put("pad", sum(choir(m, a.sec[name]["bar"] + 1.0) for m in chord(r + 24, "m")) / 3, a.t(name, i), 0.9)
            elif name == "solo":
                riff(a, name, i, r, RIFF, 0.9)
                pat(a, "drum", D["kick"], name, i, "xxxxxxxxxxxxxxxx", 0.7, 0.8)
                pat(a, "drum", D["snare"], name, i, SB, 0.9)
                pat(a, "hat", D["hat"], name, i, HH, 0.4)
                a.put("pad", strings(chord(r + 12, "m") + [r + 24], a.sec[name]["bar"] + 1.0, 0.5, 0.8), a.t(name, i), 0.7)
            elif name == "outro":
                power(a, name, i, 38, 0, 3.0, 1.2)
                a.put("drum", D["crash"], a.t(name, i), 0.9)
                a.put("fx", epic_hit(), a.t(name, i), 0.9)
            if last and name in ("hook1", "verse", "hook2", "solo", "final"):
                tom_fill(a, name, i)
            if last and name == "break":
                a.put("fx", riser(a.sec[name]["bar"], 150, 8000), a.t(name, i), 0.9)
        if name == "break":
            a.put("fx", epic_hit(), a.t(name), 0.9)
    melody(a, "lead", lead_gtr, "hook1", HOOK, vol=0.8)
    melody(a, "lead", lead_gtr, "hook2", HOOK, reps=2, vol=0.8)
    melody(a, "lead", lambda m, d: lead_gtr(m, d) + 0.6 * lead_gtr(m - 12, d), "final", HOOK, reps=2, vol=0.85)
    melody(a, "lead", lead_gtr, "solo", SOLO, reps=2, vol=0.8)
    a.stems["lead"] = echo(a.stems["lead"], 60 / 168 * 0.75, 0.4, 3, 2500)
    return finish(a, {"bass": 0.75, "drum": 0.85, "hat": 0.35, "lead": 0.55, "pad": 0.5, "fx": 0.7}, 1.6, 0.18, -13.0,
                  side={"gl": (1.0, 0.2, 0.7), "gr": (0.2, 1.0, 0.7)})


# ------------------------------------------------------------------ 2. cool, driving bass
@functools.lru_cache(None)
def pluck_bass(m, dur):
    """Bass with a filter that snaps shut on every note: the groove is in the filter."""
    n = n_of(dur)
    t = tt(n)
    f = midi(m)
    x = osc(f, n, "saw") * 0.6 + osc(f * 1.005, n, "saw") * 0.4
    x = mod_lp(x, 180, 2400, np.exp(-t / 0.14), 7) + 0.9 * np.sin(2 * np.pi * f * t)
    return x * env(n, 0.003, 0.04)


def piece_bass():
    secs = [("hook", 124, 4), ("groove", 124, 8), ("break", 124, 4), ("drop2", 124, 8), ("bridge", 124, 2),
            ("final", 124, 8), ("outro", 124, 2)]
    a, D = Arr(secs, tail=4.0), drums()
    prog = [(40, "m"), (36, "M"), (38, "M"), (40, "m")]
    RA = [0, None, 0, 12, None, 0, 3, None, 0, None, 0, 12, 10, None, 7, None]
    RB = [0, None, 0, 12, None, 0, 3, None, 5, None, 5, 17, 15, None, 12, None]
    HOOKM = [(0, 0, 71, .75), (0, .75, 74, .75), (0, 1.5, 76, .5), (0, 2, 74, 1), (0, 3, 71, 1),
             (1, 0, 72, .75), (1, .75, 76, .75), (1, 1.5, 79, .5), (1, 2, 76, 2),
             (2, 0, 74, .75), (2, .75, 78, .75), (2, 1.5, 78, .5), (2, 2, 76, 1), (2, 3, 74, 1),
             (3, 0, 71, 3), (3, 3, 74, 1)]
    kicks = []
    for name, _, nb in secs:
        sb, beat = a.sec[name]["bar"], a.sec[name]["beat"]
        for i in range(nb):
            t0, (r, k) = a.t(name, i), prog[i % 4]
            riff_on = name in ("hook", "groove", "drop2", "final", "outro")
            if riff_on:
                steps = RA if i % 2 == 0 or name in ("hook", "groove") else RB
                idx = [j for j, o in enumerate(steps) if o is not None]
                for n_i, j in enumerate(idx):
                    end = idx[n_i + 1] if n_i + 1 < len(idx) else 16
                    a.put("bass", pluck_bass(40 + steps[j], (end - j) * sb / 16 * 0.95), t0 + j * sb / 16)
            if name != "break" and name != "bridge":
                for b in range(4):
                    a.put("drum", D["kick"], t0 + b * beat, 1.0)
                    kicks.append(t0 + b * beat)
                    a.put("hat", D["ohat"], t0 + (b + .5) * beat, 0.5)
                pat(a, "drum", D["clap"], name, i, "....x.......x...", 0.8)
                pat(a, "hat", D["hat"], name, i, "x.x.x.x.x.x.x.x.", 0.35)
            if name in ("groove", "drop2", "final"):
                a.put("pad", gated_supersaw(chord(r + 24, k), sb, "x.xx.xx.x.xx.xx.", 3200), t0, 0.7)
            if name == "break":
                a.put("pad", strings(chord(r + 12, k) + [r + 24], sb + 1.0, 0.6, 1.0), t0, 0.9)
                if i == nb - 1:
                    snare_roll(a, name, i, D["snare"])
                    a.put("fx", riser(sb, 150, 8000), t0, 0.9)
            if name == "bridge":
                pat(a, "drum", D["kick"], name, i, "x...x...x..x....", 1.0)
                a.put("fx", riser(sb, 150, 8000), t0, 0.7)
        if name in ("groove", "break", "drop2", "final"):
            a.put("fx", epic_hit(), a.t(name), 0.55)
    melody(a, "lead", lambda m, d: ss_lead(m, d, 3400), "groove", HOOKM, start_bar=4, reps=1, vol=0.8)
    melody(a, "lead", lambda m, d: ss_lead(m, d, 3400), "break", HOOKM, vol=0.7)
    melody(a, "lead", lambda m, d: ss_lead(m, d, 3400), "drop2", HOOKM, reps=2, vol=0.85)
    melody(a, "lead", lambda m, d: ss_lead(m, d, 3800) + 0.5 * ss_lead(m - 12, d, 3000), "final", HOOKM, reps=2, vol=0.9)
    a.stems["pad"] = a.stems["pad"] * duck_env(a.n, kicks, 0.6)
    a.stems["lead"] = echo(a.stems["lead"], 60 / 124 * 0.75, 0.4, 3, 2200)
    return finish(a, {"bass": 1.0, "drum": 1.0, "hat": 0.35, "pad": 0.55, "lead": 0.6, "fx": 0.6}, 2.0, 0.2, -13.5)


# ------------------------------------------------------------------ 3. electronic, 172 BPM drum and bass
@functools.lru_cache(None)
def reese(m, dur, wob):
    n = n_of(dur)
    t = tt(n)
    f = midi(m)
    x = sum(osc(f * 2 ** (c / 1200), n, "saw") for c in (-14, -5, 5, 14)) / 4
    x = mod_lp(x, 250, 1400, 0.5 + 0.5 * np.sin(2 * np.pi * wob * t), 6) + 0.9 * np.sin(2 * np.pi * f * t)
    return x * env(n, 0.01, 0.05)


def piece_electro():
    secs = [("hook", 172, 4), ("dropA", 172, 12), ("break", 172, 4), ("dropB", 172, 16), ("bridge", 172, 4),
            ("dropC", 172, 8), ("outro", 172, 2)]
    a, D = Arr(secs, tail=3.0), drums()
    prog = [(31, "m"), (27, "M"), (34, "M"), (29, "M")]
    MEL = [(0, 0, 70, .5), (0, .5, 74, .5), (0, 1, 77, 1), (0, 2, 74, .5), (0, 2.5, 70, .5), (0, 3, 72, 1),
           (1, 0, 75, .5), (1, .5, 79, .5), (1, 1, 75, 1), (1, 2, 72, 1), (1, 3, 70, 1),
           (2, 0, 70, .5), (2, .5, 74, .5), (2, 1, 77, 1), (2, 2, 79, 1), (2, 3, 77, 1),
           (3, 0, 76, 2), (3, 2, 72, 1), (3, 3, 74, 1)]
    for name, _, nb in secs:
        sb, beat = a.sec[name]["bar"], a.sec[name]["beat"]
        for i in range(nb):
            t0, (r, k) = a.t(name, i), prog[i % 4]
            full = name in ("dropA", "dropB", "dropC", "outro")
            if name in ("hook", "dropA", "dropB", "dropC"):
                kp = "x.........x....." if name != "hook" or i >= 2 else "x.......x......."
                pat(a, "drum", D["kick"], name, i, kp, 1.0)
                pat(a, "drum", D["snare"], name, i, "....x.......x...", 0.95)
                if full:
                    pat(a, "drum", D["snare"], name, i, "......o.......o.", 0.4)
                pat(a, "hat", D["hat"], name, i, "xoxoxoxoxoxoxoxo", 0.5, 0.5)
                if i % 4 == 3 and full:
                    tom_fill(a, name, i, 170, 0.8)
            if name == "bridge":
                pat(a, "drum", D["kick"], name, i, "x.......", 1.0)
                pat(a, "drum", D["snare"], name, i, "....x...", 0.9)
            if full and name != "outro":
                a.put("bass", reese(r, sb * 0.5, 0.7 / sb), t0)
                a.put("bass", reese(r + (12 if i % 2 else 7), sb * 0.5, 0.7 / sb), t0 + sb * 0.5)
            if name in ("hook", "dropA", "dropB", "dropC"):
                tones = chord(r + 24, k) + [r + 36]
                for j, idx in enumerate([0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1]):
                    if name == "hook" or j % 2 == 0 or name == "dropC":
                        a.put("arp", ss_lead(tones[idx], sb / 16 * 0.85, 4500), t0 + j * sb / 16, 0.5)
            if name in ("dropB", "dropC"):
                a.put("pad", gated_supersaw(chord(r + 24, k), sb, "x.xx.xx.x.xx.xx.", 4200), t0, 0.5)
            if name in ("break", "bridge"):
                a.put("pad", sum(choir(m, sb + 1.0) for m in chord(r + 24, k)) / 3, t0, 0.9)
                if i == nb - 1:
                    snare_roll(a, name, i, D["snare"])
                    a.put("fx", riser(sb, 150, 9000), t0, 0.9)
        if name != "hook":
            a.put("fx", epic_hit(), a.t(name), 0.5)
    for sec, bar0, reps in (("dropA", 4, 2), ("break", 0, 1), ("dropB", 0, 4), ("dropC", 0, 2)):
        melody(a, "lead", lambda m, d: ss_lead(m, d, 4800), sec, MEL, start_bar=bar0, reps=reps, vol=0.8)
    a.stems["lead"] = echo(a.stems["lead"], 60 / 172 * 0.75, 0.35, 3, 2500)
    return finish(a, {"bass": 0.95, "drum": 0.95, "hat": 0.35, "arp": 0.5, "pad": 0.5, "lead": 0.6, "fx": 0.6}, 1.6, 0.16, -13.0)


# ------------------------------------------------------------------ 4. epic, dreamy
def piece_epic():
    secs = [("theme1", 96, 4), ("lift", 96, 2), ("theme2", 96, 8), ("dream", 72, 4), ("finale", 96, 8), ("outro", 96, 2)]
    a, D = Arr(secs, tail=5.0), drums()
    prog = [(33, "m"), (29, "M"), (36, "M"), (31, "M")]  # Am F C G
    MEL = [(0, 0, 76, 3), (0, 3, 74, 1), (1, 0, 72, 2), (1, 2, 69, 1), (1, 3, 72, 1),
           (2, 0, 76, 2), (2, 2, 79, 1), (2, 3, 76, 1), (3, 0, 74, 2), (3, 2, 71, 2)]
    hornm = lambda m, d: horn(m, d) + 0.5 * horn(m - 12, d)  # noqa: E731
    for name, _, nb in secs:
        sb, beat = a.sec[name]["bar"], a.sec[name]["beat"]
        for i in range(nb):
            t0, (r, k) = a.t(name, i), prog[i % 4]
            a.put("sub", bass_pulse(r - 12, sb * 0.95) * 1.0, t0, 0.9)
            a.put("pad", sum(choir(m, sb + 1.2) for m in chord(r + 24, k)) / 3, t0, 0.8 if name != "dream" else 0.9)
            if name in ("theme1", "lift", "theme2", "finale"):
                tones = chord(r + 12, k) + [r + 24]
                steps = 16 if name in ("theme2", "finale") else 8
                for j in range(steps):
                    a.put("ost", stacc(tones[[0, 1, 2, 3, 2, 1, 2, 1][j % 8] % len(tones)], beat * (0.2 if steps == 16 else 0.4)),
                          t0 + j * 4 * beat / steps, 1.0 if j % 4 == 0 else 0.65)
            if name in ("theme1", "theme2", "finale", "lift"):
                pat(a, "drum", D["kick"] if False else tom(55, 1.0, 0.8, 0.28), name, i,
                    "x.......x.o.x..." if name != "theme1" else "x...............", 0.9)
            if name in ("theme2", "finale"):
                pat(a, "drum", D["snare"], name, i, "........x.......", 0.7)
                a.put("drum", D["crash"], t0, 0.5) if i % 4 == 0 else None
            if name == "lift" and i == nb - 1:
                snare_roll(a, name, i, D["snare"])
                a.put("fx", riser(sb, 150, 9000), t0, 0.9)
            if name == "dream" and i % 2 == 0:
                a.put("glass", glass(chord(r + 24, k)[(i // 2) % 3] + 12, 3.0), t0 + beat, 0.5)
        if name in ("theme1", "theme2", "finale"):
            a.put("fx", epic_hit(), a.t(name), 0.8 if name != "theme1" else 0.6)
    a.put("drum", D["crash"], 0, 0.7)
    melody(a, "mel", hornm, "theme1", MEL, vol=0.9)
    melody(a, "mel", hornm, "theme2", MEL, reps=2, vol=0.85)
    melody(a, "mel", lambda m, d: choir(m + 12, d) * 0.8, "theme2", MEL, reps=2, vol=0.5)
    melody(a, "mel", lambda m, d: strings([m, m - 12], d, 0.15, 0.5), "dream", MEL, vol=0.8)
    melody(a, "mel", lambda m, d: hornm(m, d) + 0.7 * choir(m + 12, d), "finale", MEL, reps=2, vol=0.9)
    a.put("fx", epic_hit(), a.t("outro"), 0.9)
    a.put("fx", sum(choir(m, 6.0) for m in chord(57, "m")) / 3, a.t("outro"), 0.7)
    return finish(a, {"sub": 0.9, "pad": 0.6, "ost": 0.55, "drum": 0.9, "mel": 0.8, "glass": 0.4, "fx": 0.7}, 3.2, 0.34, -15.0)


# ------------------------------------------------------------------ 5. hybrid tactical noir ("Salvage")
def piece_hybrid():
    secs = [("open", 110, 4), ("build", 110, 4), ("drop", 110, 8), ("break", 110, 4), ("final", 110, 8), ("outro", 110, 2)]
    a, D = Arr(secs, tail=4.5), drums()
    prog = [(36, "m"), (32, "M"), (34, "M"), (31, "sus")]  # Cm Ab Bb Gsus
    MOTIF = [(0, 0, 67, .75), (0, .75, 70, .75), (0, 1.5, 72, 1.5), (0, 3, 70, .5), (0, 3.5, 67, .5)]
    ANSWER = [(1, 0, 68, 1.5), (1, 1.5, 67, .5), (1, 2, 63, 2), (2, 0, 70, .75), (2, .75, 74, .75), (2, 1.5, 75, 1.5),
              (2, 3, 74, .5), (2, 3.5, 70, .5), (3, 0, 72, 2), (3, 2, 67, 2)]
    TH = MOTIF + ANSWER
    bell = lambda m, d: glass(m, max(d, 1.2)) * 1.0  # noqa: E731
    for name, _, nb in secs:
        sb, beat = a.sec[name]["bar"], a.sec[name]["beat"]
        for i in range(nb):
            t0, (r, k) = a.t(name, i), prog[i % 4]
            a.put("sub", bass_pulse(r - 12, sb * 0.95), t0, 0.9)
            ticking = name in ("open", "build", "drop", "final")
            if ticking:
                for j in range(16):
                    a.put("hat", D["hat"], t0 + j * sb / 16, 0.35 if name == "open" else 0.5 if j % 2 else 0.3)
                for j in range(16):  # ticking sub-pulse on the root: the tactical clock
                    off = [0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 7, 0, 12, 0][j]
                    a.put("pulse", bass_pulse(r + off, sb / 16 * 0.8), t0 + j * sb / 16, 0.9 if j % 4 == 0 else 0.6)
            if name in ("build", "drop", "final"):
                tones = chord(r + 12, k) + [r + 24]
                for j in range(16):
                    a.put("ost", stacc(tones[[0, 1, 2, 3, 2, 1, 2, 1][j % 8] % len(tones)], sb / 16 * 0.8), t0 + j * sb / 16,
                          (0.5 + 0.5 * i / max(1, nb - 1)) * (1.0 if j % 4 == 0 else 0.65) if name == "build" else 1.0 if j % 4 == 0 else 0.65)
                a.put("pad", strings(chord(r + 12, k) + [r + 24], sb + 1.0, 0.6, 0.8), t0, 0.7)
            if name in ("drop", "final"):
                pat(a, "drum", D["kick"], name, i, "x.....x...x.....", 1.0)
                pat(a, "drum", D["clap"], name, i, "....x.......x...", 0.9)
                pat(a, "drum", tom(55, 1.0, 0.9, 0.3), name, i, "x.......", 0.8)
                if i % 4 == 0:
                    a.put("drum", D["crash"], t0, 0.5)
            if name == "build":
                pat(a, "drum", D["kick"], name, i, "x...", 0.6 + 0.4 * i / 3)
                if i == nb - 1:
                    snare_roll(a, name, i, D["snare"])
                    a.put("fx", riser(sb, 150, 9000), t0, 0.9)
            if name == "break":
                a.put("pad", sum(choir(m, sb + 1.2) for m in chord(r + 24, k)) / 3, t0, 0.9)
                if i % 2 == 0:
                    a.put("glass", glass(chord(r + 24, k)[(i // 2) % 3] + 12, 3.0), t0 + beat, 0.5)
                if i == nb - 1:
                    a.put("fx", riser(sb, 150, 9000), t0, 0.8)
        if name in ("drop", "final"):
            a.put("fx", epic_hit(), a.t(name), 1.0)
    melody(a, "mel", bell, "open", MOTIF, reps=4, span=1, vol=0.9)
    melody(a, "mel", bell, "build", MOTIF, reps=4, span=1, vol=0.9)
    melody(a, "mel", lambda m, d: g.mix(bell(m, d), 0.8 * horn(m - 12, d), 0.5 * horn(m, d)), "drop", TH, reps=2, vol=1.0)
    melody(a, "mel", lambda m, d: choir(m, d), "break", TH, vol=0.7)
    melody(a, "mel", lambda m, d: g.mix(bell(m, d), 0.9 * horn(m - 12, d), 0.6 * horn(m, d), 0.4 * choir(m + 12, d)), "final", TH, reps=2, vol=1.0)
    a.put("mel", bell(67, 3.0), a.t("outro"), 0.9)
    a.put("fx", epic_hit(), a.t("outro"), 1.0)
    a.stems["mel"] = echo(a.stems["mel"], 60 / 110 * 0.75, 0.4, 3, 2500)
    return finish(a, {"sub": 0.9, "pulse": 0.8, "hat": 0.35, "ost": 0.5, "pad": 0.5, "drum": 0.95, "mel": 0.85, "glass": 0.4,
                      "fx": 0.8}, 2.6, 0.28, -14.0)


PIECES = {"metal_ironclad": piece_metal, "bass_drive": piece_bass, "electro_voltage": piece_electro,
          "epic_aether": piece_epic, "hybrid_salvage": piece_hybrid}


def main(flt=""):
    for name, fn in PIECES.items():
        if flt in name and not g.exists(VERSION, "main_theme", name):
            g.reseed(name)
            x = fn()
            g.save(VERSION, "main_theme", name, x, 4)
            print(VERSION, name, "%.1fs  rms %.1f dB  centroid %.0f Hz" % g.stats(x))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
