"""Procedural sound generator for Primefall.

Writes OGG files to apps/web/public/audio/{sfx,music}. Deterministic (fixed seed),
so re-running produces the same files. Run from the repository root:

    python3 tools/audio/generate_audio.py

Needs numpy and ffmpeg (libvorbis).
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100
RNG = np.random.default_rng(9005)
OUT = Path(__file__).resolve().parents[2] / "apps/web/public/audio"


# ---------------------------------------------------------------- helpers
def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env(n, attack=0.005, release=0.1):
    a, r = max(1, int(SR * attack)), max(1, int(SR * release))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    r = min(r, n)
    e[-r:] *= np.linspace(1, 0, r) ** 2
    return e


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (SR * tau))


def osc(freq, dur, shape="sine"):
    t = t_axis(dur)
    f = np.broadcast_to(freq, t.shape) if np.ndim(freq) else freq
    phase = 2 * np.pi * np.cumsum(f * np.ones_like(t)) / SR
    if shape == "sine":
        return np.sin(phase)
    if shape == "saw":
        return 2 * ((phase / (2 * np.pi)) % 1) - 1
    if shape == "square":
        return np.sign(np.sin(phase))
    if shape == "tri":
        return 2 * np.abs(2 * ((phase / (2 * np.pi)) % 1) - 1) - 1
    raise ValueError(shape)


def noise(dur):
    return RNG.uniform(-1, 1, int(SR * dur))


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be a scalar or per-sample array."""
    c = np.broadcast_to(cutoff, x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def echo(x, delay, feedback, mix, taps=4):
    d = int(SR * delay)
    out = np.concatenate([x, np.zeros(d * taps)])
    for k in range(1, taps + 1):
        out[k * d:k * d + len(x)] += x * mix * feedback ** (k - 1)
    return out


def mix_at(buf, snd, start):
    i = int(start * SR)
    end = min(len(buf), i + len(snd))
    buf[i:end] += snd[: end - i]


def mix_wrap(buf, snd, start):
    """Add snd at start; whatever runs past the end wraps to the start (seamless loops)."""
    i = int(start * SR)
    n = len(buf)
    for k in range(0, len(snd), n):
        seg = snd[k:k + n]
        pos = (i + k) % n
        first = min(len(seg), n - pos)
        buf[pos:pos + first] += seg[:first]
        if first < len(seg):
            buf[:len(seg) - first] += seg[first:]


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def save(name, x, folder, peak=0.85):
    x = np.asarray(x, dtype=float)
    x = x / max(1e-9, np.max(np.abs(x))) * peak
    path = OUT / folder
    path.mkdir(parents=True, exist_ok=True)
    wav = path / f"{name}.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    q = "4" if folder == "music" else "3"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", q,
         str(path / f"{name}.ogg")],
        check=True,
    )
    wav.unlink()


# -------------------------------------------------------------------- SFX
def tone(freq, dur, shape="sine", attack=0.003, release=None, gain=1.0):
    n = int(SR * dur)
    return osc(freq, dur, shape) * env(n, attack, release if release else dur * 0.6) * gain


def sfx_ui_tap():
    return tone(1800, 0.05, "sine", release=0.04) + 0.4 * tone(900, 0.05, "tri", release=0.04)


def sfx_card_select():
    return np.concatenate([tone(660, 0.05, "tri"), tone(990, 0.08, "tri")])


def sfx_card_deselect():
    return np.concatenate([tone(990, 0.04, "tri"), tone(520, 0.07, "tri")])


def sfx_pitch():
    """Pitching a card for Energy: bright coin-like rise."""
    f = np.linspace(500, 1500, int(SR * 0.18))
    return osc(f, 0.18, "square") * 0.35 * env(len(f), 0.002, 0.12) + tone(2200, 0.18, "sine", release=0.16) * 0.5


def sfx_commit():
    """Commit plan: confirming two-step chord."""
    a = tone(midi(57), 0.35, "saw", release=0.3, gain=0.4) + tone(midi(64), 0.35, "saw", release=0.3, gain=0.4)
    b = tone(midi(60), 0.5, "saw", release=0.45, gain=0.4) + tone(midi(67), 0.5, "saw", release=0.45, gain=0.4)
    out = np.zeros(int(SR * 0.7))
    mix_at(out, lowpass(a, 3000), 0)
    mix_at(out, lowpass(b, 3500), 0.12)
    return out


def sfx_resolution_start():
    """Riser into the Resolution."""
    dur = 1.1
    n = int(SR * dur)
    f = np.linspace(120, 900, n) ** 1.0
    sweep = osc(f, dur, "saw") * np.linspace(0.1, 1, n) ** 2
    wind = lowpass(noise(dur), np.linspace(300, 5000, n)) * np.linspace(0.1, 1, n)
    out = (0.5 * sweep + 0.7 * wind) * env(n, 0.05, 0.08)
    hit = tone(60, 0.4, "sine", release=0.35) * 1.5
    full = np.zeros(n + len(hit))
    full[:n] += out
    mix_at(full, hit, dur - 0.05)
    return full


def sfx_tick():
    return tone(1200, 0.03, "square", release=0.025, gain=0.5) * 0.6


def sfx_move():
    """Soft footstep/slide."""
    n = int(SR * 0.16)
    s = lowpass(noise(0.16), 900) * expdecay(n, 0.04)
    return s + 0.5 * tone(110, 0.16, "sine", release=0.14)


def sfx_attack_hit():
    n = int(SR * 0.4)
    crack = highpass(noise(0.4), 1500) * expdecay(n, 0.02)
    body = lowpass(noise(0.4), 700) * expdecay(n, 0.09)
    thump = osc(np.linspace(150, 45, n), 0.4, "sine") * expdecay(n, 0.12)
    return crack * 0.8 + body * 0.6 + thump * 1.2


def sfx_attack_shot():
    """Ranged shot: sharp zap."""
    n = int(SR * 0.28)
    zap = osc(np.linspace(2400, 220, n), 0.28, "saw") * expdecay(n, 0.07)
    snap = highpass(noise(0.28), 2500) * expdecay(n, 0.015)
    return lowpass(zap, 5000) * 0.7 + snap * 0.6


def sfx_miss():
    n = int(SR * 0.3)
    return lowpass(noise(0.3), np.linspace(4000, 600, n)) * env(n, 0.05, 0.2) * 0.7


def sfx_shield_block():
    n = int(SR * 0.6)
    ring = sum(tone(f, 0.6, "sine", release=0.55) * expdecay(n, 0.2) * g
               for f, g in [(1320, 1.0), (1980, 0.5), (2790, 0.3)])
    clack = highpass(noise(0.6), 3000) * expdecay(n, 0.01)
    return ring + 0.5 * clack


def sfx_shield_gain():
    f = np.linspace(400, 800, int(SR * 0.3))
    return lowpass(osc(f, 0.3, "tri"), 2500) * env(len(f), 0.01, 0.2) + 0.3 * tone(1600, 0.3, release=0.25)


def sfx_deck_damage():
    """Cards ripped from the Deck: papery crunch + low drop."""
    n = int(SR * 0.5)
    pap = highpass(noise(0.5), 2000) * (RNG.uniform(0, 1, n) > 0.6) * expdecay(n, 0.15)
    drop = osc(np.linspace(200, 50, n), 0.5, "sine") * expdecay(n, 0.2)
    return pap * 0.7 + drop


def sfx_exhaustion():
    n = int(SR * 0.9)
    f = np.linspace(440, 90, n)
    return lowpass(osc(f, 0.9, "saw"), 1200) * env(n, 0.01, 0.6) * 0.8


def sfx_knockback():
    n = int(SR * 0.3)
    return lowpass(noise(0.3), np.linspace(3000, 300, n)) * env(n, 0.005, 0.2) + osc(np.linspace(120, 60, n), 0.3) * expdecay(n, 0.1)


def sfx_overwatch_alert():
    out = np.zeros(int(SR * 0.45))
    for i in range(2):
        mix_at(out, tone(1500, 0.1, "square", release=0.08, gain=0.4), i * 0.18)
    return out


def sfx_prime_capture():
    """Prime Zone controlled: rising arpeggio."""
    out = np.zeros(int(SR * 0.9))
    for i, n in enumerate([57, 64, 69, 76]):
        mix_at(out, lowpass(tone(midi(n), 0.4, "saw", release=0.35, gain=0.45), 4000), i * 0.1)
    return out


def sfx_prime_contested():
    return lowpass(tone(110, 0.5, "saw", release=0.4), 600) + lowpass(tone(116.5, 0.5, "saw", release=0.4), 600)


def sfx_prime_tick():
    """Prime Zone held another Resolution (1/3, 2/3 ...)."""
    return tone(midi(69), 0.25, "sine", release=0.2) + 0.5 * tone(midi(81), 0.25, "sine", release=0.2)


def _jingle(notes, step, shape="saw", dur=0.5):
    out = np.zeros(int(SR * (step * len(notes) + dur + 0.5)))
    for i, group in enumerate(notes):
        for n in group:
            mix_at(out, lowpass(tone(midi(n), dur, shape, release=dur * 0.8, gain=0.4), 4500), i * step)
    return echo(out, 0.18, 0.4, 0.35)


def sfx_victory():
    return _jingle([[57, 64], [60, 67], [64, 71], [69, 76, 81]], 0.16, dur=0.9)


def sfx_defeat():
    return _jingle([[64, 67], [62, 65], [59, 62], [57, 60]], 0.3, shape="tri", dur=1.0)


SFX = {
    "ui_tap": sfx_ui_tap, "card_select": sfx_card_select, "card_deselect": sfx_card_deselect,
    "card_pitch": sfx_pitch, "plan_commit": sfx_commit, "resolution_start": sfx_resolution_start,
    "tick": sfx_tick, "move": sfx_move, "attack_hit": sfx_attack_hit, "attack_shot": sfx_attack_shot,
    "miss": sfx_miss, "shield_block": sfx_shield_block, "shield_gain": sfx_shield_gain,
    "deck_damage": sfx_deck_damage, "exhaustion": sfx_exhaustion, "knockback": sfx_knockback,
    "overwatch_alert": sfx_overwatch_alert, "prime_capture": sfx_prime_capture,
    "prime_contested": sfx_prime_contested, "prime_tick": sfx_prime_tick,
    "victory": sfx_victory, "defeat": sfx_defeat,
}


# ------------------------------------------------------------------ music
def pad(notes, dur):
    """Detuned saw pad, low-passed, slow attack."""
    n = int(SR * dur)
    x = np.zeros(n)
    for m in notes:
        for det in (-0.12, 0.0, 0.12):
            x += osc(midi(m + det), dur, "saw")
    x = lowpass(x / (3 * len(notes)), 1100)
    return x * env(n, 0.8, 1.2)


def kick(vol=1.0):
    n = int(SR * 0.3)
    return osc(np.linspace(140, 42, n), 0.3) * expdecay(n, 0.09) * vol


def hat(vol=0.3, decay=0.03):
    n = int(SR * 0.12)
    return highpass(noise(0.12), 6000) * expdecay(n, decay) * vol


def snare(vol=0.5):
    n = int(SR * 0.25)
    return (highpass(noise(0.25), 1200) * expdecay(n, 0.06) + osc(190, 0.25) * expdecay(n, 0.05) * 0.5) * vol


def music_plan():
    """Calm planning loop: 72 BPM, Am - F - C - G, 8 bars."""
    bpm, bars = 72, 8
    beat = 60 / bpm
    bar = 4 * beat
    total = bar * bars
    buf = np.zeros(int(SR * total))
    chords = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]] * 2
    for i, c in enumerate(chords):
        mix_wrap(buf, pad(c, bar + 1.5) * 0.55, i * bar)
        mix_wrap(buf, lowpass(tone(midi(c[0] - 24), bar, "sine", attack=0.05, release=0.8), 300) * 0.5, i * bar)
    # soft heartbeat pulse on beats 1 and 3
    for b in range(bars * 4):
        if b % 2 == 0:
            mix_wrap(buf, kick(0.28), b * beat)
    # sparse bell melody
    melody = {0: 76, 3: 72, 4: 71, 7: 67, 8: 69, 11: 72, 12: 74, 15: 71, 16: 76, 19: 79, 20: 77, 23: 72, 24: 71, 27: 67, 28: 69, 31: 64}
    for step, m in melody.items():
        bell = (tone(midi(m), 1.6, "sine", release=1.5) + 0.3 * tone(midi(m + 12), 1.6, "sine", release=1.5)) * 0.22
        mix_wrap(buf, echo(bell, beat * 0.75, 0.5, 0.5, 3), step * beat)
    return buf


def music_resolution():
    """Driving Resolution loop: 118 BPM, Am - F - C - G, 8 bars, 16th arps."""
    bpm, bars = 118, 8
    beat = 60 / bpm
    bar = 4 * beat
    s16 = beat / 4
    buf = np.zeros(int(SR * bar * bars))
    roots = [45, 41, 36, 43] * 2
    triads = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]] * 2
    for i, (root, tri) in enumerate(zip(roots, triads)):
        start = i * bar
        mix_wrap(buf, pad(tri, bar + 0.5) * 0.3, start)
        for e in range(8):  # driving 8th bass
            b = lowpass(tone(midi(root), beat * 0.5, "saw", attack=0.004, release=0.2), 500 + 400 * (e % 2))
            mix_wrap(buf, b * 0.5, start + e * beat / 2)
        for s in range(16):  # arp
            note = tri[s % 3] + (12 if s % 6 < 3 else 24)
            a = lowpass(tone(midi(note), s16 * 1.6, "square", release=s16 * 1.4, gain=0.5), 2800)
            mix_wrap(buf, a * 0.16, start + s * s16)
        for b in range(4):
            mix_wrap(buf, kick(0.95), start + b * beat)
            mix_wrap(buf, hat(0.3), start + b * beat + beat / 2)
            if b % 2 == 1:
                mix_wrap(buf, snare(0.45), start + b * beat)
        for s in range(16):
            mix_wrap(buf, hat(0.12, 0.015), start + s * s16)
    return buf


MUSIC = {"music_plan": music_plan, "music_resolution": music_resolution}


if __name__ == "__main__":
    for name, fn in SFX.items():
        save(name, fn(), "sfx")
        print("sfx", name)
    for name, fn in MUSIC.items():
        x = fn()
        x = x / np.max(np.abs(x)) * 0.8
        save(name, x, "music", peak=0.8)
        print("music", name, f"{len(x) / SR:.1f}s")
