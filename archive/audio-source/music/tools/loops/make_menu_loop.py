"""Makes the seamless loop of the main-menu theme.

python3 archive/audio-source/music/tools/loops/make_menu_loop.py <theme.mp3> <out.m4a> [crossfade-seconds]

The piece fades in at its start and fades out at its end. The last `crossfade` seconds are blended (equal power) with the first
`crossfade` seconds and the loop starts after them, so the end runs into the start without a dip and without a click. The loop is
2 x crossfade shorter than the piece (177 s of 180 s). It is stored 6 dB down like the layers (the manifest gain brings it back)
and encoded as AAC, which loops without a gap (an MP3 would leave one).
"""
import subprocess
import sys

import numpy as np

SR = 44100
src, dst = sys.argv[1], sys.argv[2]
crossfade = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
y = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
n, x = len(y), int(crossfade * SR)
ramp = np.arange(x)[:, None] / x
blend = y[n - x :] * np.cos(np.pi / 2 * ramp) + y[:x] * np.sin(np.pi / 2 * ramp)
loop = np.concatenate([y[x : n - x], blend]) * 0.5
print(f"loop {len(loop) / SR:.3f} s, peak {np.abs(loop).max():.2f}")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "aac", "-b:a", "128k", dst], input=loop.astype(np.float32).tobytes(), check=True)
