"""Packs the frames of render_frames.mjs into the sprite sheets of the intro film.

python3 docs/design/intro/tools/pack_sheets.py <frames-dir> <out-dir>

Every scene of the film has a palette of its own (median cut over the frames of the scene), and its frames are mapped to the nearest
colour with no dither: a dither pattern turned the dark, smooth parts of the film into grain. The palettes of the scenes follow one
another in the one palette of the sheets (at most 256 colours); the picture stays flat with clear edges, like the title screen.
The frames are laid out row by row in sheets of COLUMNS x ROWS frames, small enough for the texture limits of a phone.
"""
import glob
import json
import sys

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

COLUMNS, ROWS = 6, 10
# The scenes by the number of their first frame (frame 0 is the light ring at the end of the hyperspace): the planet and the far
# Notstrom, the astronaut's visor (the cross-fade into the hull belongs to the hull), the hull and the flash. The planet has the
# most colours: its fine steps band as soon as there are too few.
SCENES = [("planet and far Notstrom", 0, 112), ("visor", 31, 56), ("hull and flash", 68, 56)]

frames_dir, out_dir = sys.argv[1], sys.argv[2]
paths = sorted(glob.glob(f"{frames_dir}/f*.png"))
frames = [np.asarray(Image.open(path).convert("RGB")) for path in paths]
height, width, _ = frames[0].shape

palette_parts = []
indexed = [np.zeros((height, width), dtype=np.uint8)] * len(frames)
offset = 0
for number, (name, first, colors) in enumerate(SCENES):
    last = SCENES[number + 1][1] if number + 1 < len(SCENES) else len(frames)
    sample = np.concatenate([frame[::2, ::2] for frame in frames[first:last]], axis=0)
    quantized = Image.fromarray(sample).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    part = np.array(quantized.getpalette()[: colors * 3], dtype=np.float32).reshape(-1, 3)
    tree = cKDTree(part)
    for index in range(first, last):
        _, nearest = tree.query(frames[index].astype(np.float32).reshape(-1, 3))
        indexed[index] = (nearest.reshape(height, width) + offset).astype(np.uint8)
    palette_parts.append(part)
    offset += len(part)
    print(f"scene {name}: frames {first} to {last - 1}, {len(part)} colours", file=sys.stderr)
palette = np.concatenate(palette_parts)
assert len(palette) <= 256, "the scenes need more than 256 colours together"

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
