"""Packs the frames of render_frames.mjs into the sprite sheets of the intro film.

python3 docs/design/intro/tools/pack_sheets.py <frames-dir> <out-dir>

All frames share one palette of 64 colours (median cut over the whole film), and the colours are chosen with a 4 x 4 ordered
dither, so that a cross-fade or a glow turns into the regular pixel pattern of old games instead of a smear of new colours.
The frames are laid out row by row in sheets of COLUMNS x ROWS frames, small enough for the texture limits of a phone.
"""
import glob
import json
import sys

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

COLORS = 64
COLUMNS, ROWS = 6, 10
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16.0 - 0.5
DITHER = 20.0  # colour levels of the dither pattern; the palette steps are about this far apart

frames_dir, out_dir = sys.argv[1], sys.argv[2]
paths = sorted(glob.glob(f"{frames_dir}/f*.png"))
frames = [np.asarray(Image.open(path).convert("RGB")) for path in paths]
height, width, _ = frames[0].shape

sample = np.concatenate([frame[::2, ::2] for frame in frames[::2]], axis=0)
sample_image = Image.fromarray(sample)
quantized = sample_image.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
palette = np.array(quantized.getpalette()[: COLORS * 3], dtype=np.float32).reshape(-1, 3)
tree = cKDTree(palette)
pattern = np.tile(BAYER, (height // 4 + 1, width // 4 + 1))[:height, :width, None] * DITHER

indexed = []
for frame in frames:
    _, nearest = tree.query((frame.astype(np.float32) + pattern).reshape(-1, 3))
    indexed.append(nearest.reshape(height, width).astype(np.uint8))

per_sheet = COLUMNS * ROWS
sheets = []
for first in range(0, len(indexed), per_sheet):
    chunk = indexed[first : first + per_sheet]
    rows = (len(chunk) + COLUMNS - 1) // COLUMNS
    atlas = np.zeros((rows * height, COLUMNS * width), dtype=np.uint8)
    for number, frame in enumerate(chunk):
        row, column = divmod(number, COLUMNS)
        atlas[row * height : (row + 1) * height, column * width : (column + 1) * width] = frame
    image = Image.fromarray(atlas, mode="P")
    flat = [int(v) for v in palette.round().astype(np.uint8).reshape(-1)]
    image.putpalette(flat + [0] * (768 - len(flat)))
    name = f"notstrom-{len(sheets) + 1}.png"
    image.save(f"{out_dir}/{name}", optimize=True)
    sheets.append({"file": name, "frames": len(chunk), "rows": rows})
print(json.dumps({"frames": len(indexed), "width": width, "height": height, "columns": COLUMNS, "sheets": sheets}))
