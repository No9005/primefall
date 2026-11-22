"""Makes the sound of the Notstrom Intro of Start from take A of the cue (`menu`-like game file `notstrom-intro.m4a`).

python3 audio-source/music/tools/loops/make_notstrom_intro_cue.py <take.mp3> <out.m4a>

The model's take is 19 s: the cue (to 9 s) and, kept unchanged behind it, the start of the Hero Select loop, whose first hit comes at
9.06 s. The cue is cut at 8.9 s, before that hit, and fades out over its last 0.4 s; it is brought to the level of the Hero Select loop in
the game (the model made it about 4.5 dB quieter): the mean level of its seconds 1 to 3.5 is set to 0.055, which is what the loop has
with its game gain of 0.5. The game gain of the file is 1.
"""
import subprocess
import sys

import numpy as np

SR = 44100
CUT_S, FADE_S, TARGET = 8.9, 0.4, 0.055
src, dst = sys.argv[1], sys.argv[2]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
y = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)[: int(CUT_S * SR)].copy()
mono = (y[:, 0] + y[:, 1]) * 0.7071  # the same downmix as the measurement of the loop (ffmpeg -ac 1)
loud = mono[SR : int(3.5 * SR)]
gain = TARGET / float(np.sqrt((loud**2).mean()))
y *= gain
y[-int(FADE_S * SR) :] *= np.cos(np.linspace(0, np.pi / 2, int(FADE_S * SR)))[:, None]
print(f"gain {gain:.2f} ({20 * np.log10(gain):+.1f} dB), peak {np.abs(y).max():.2f}, {len(y) / SR:.2f} s")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "aac", "-b:a", "96k", dst], input=y.astype(np.float32).tobytes(), check=True)
