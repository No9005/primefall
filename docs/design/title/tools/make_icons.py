"""The app icons (apps/web/public/icons/): the crystal of the logo on the dark of space, with a stepped blue glow behind it.

python3 docs/design/title/tools/make_icons.py [output folder]

apple-touch-icon.png (180), icon-192.png, icon-512.png (the two icons of the manifest, safe for a round mask: the crystal stays within
the middle 64 %), favicon-32.png. The crystal is drawn in whole pixels (a crystal of 44 x 66 pixels scaled by 2 or 5; for 32 pixels a small
one of 16 x 24) so that it stays pixel art.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from crystal import draw_crystal  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "apps", "web", "public", "icons")
os.makedirs(OUT, exist_ok=True)
SPACE = (8, 11, 26)
GLOW = np.array((90, 120, 230), dtype=np.float32)


def background(size: int) -> Image.Image:
    yy, xx = np.mgrid[0:size, 0:size]
    centre = size / 2
    m = np.exp(-(((xx - centre) ** 2 + (yy - centre) ** 2) / (2 * (size * 0.24) ** 2)))
    steps = np.floor(np.clip(m, 0, 1) * 8) / 8  # the glow in steps, like the haze of the logo
    pixels = np.array(SPACE, dtype=np.float32) + steps[..., None] * GLOW * 0.55
    return Image.fromarray(pixels.clip(0, 255).astype("uint8"), "RGB")


def icon(size: int, width: int, height: int, mid: int, scale: int) -> Image.Image:
    """The crystal of `width` x `height` pixels (the widest line at `mid`), made `scale` times as large, in the middle of `size` pixels."""
    crystal = Image.new("RGBA", (width + 2, height + 2), (0, 0, 0, 0))
    draw_crystal(ImageDraw.Draw(crystal), (width + 2) // 2, 1, mid + 1, height + 1, width // 2)
    crystal = crystal.resize((crystal.width * scale, crystal.height * scale), Image.NEAREST)
    image = background(size).convert("RGBA")
    image.alpha_composite(crystal, ((size - crystal.width) // 2, (size - crystal.height) // 2))
    return image.convert("RGB")


icon(180, 44, 66, 30, 2).save(os.path.join(OUT, "apple-touch-icon.png"))
icon(192, 44, 66, 30, 2).save(os.path.join(OUT, "icon-192.png"))
icon(512, 44, 66, 30, 5).save(os.path.join(OUT, "icon-512.png"))
icon(32, 16, 24, 11, 1).save(os.path.join(OUT, "favicon-32.png"))
print("icons in", os.path.abspath(OUT))
