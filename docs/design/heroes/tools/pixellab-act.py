"""Puts Tilly's Pixellab `act` clip into the hangar atlas (apps/web/public/assets/hangar/atlas/tilly.png and .json).

Run it from the repository root, after `export-hangar.mjs controller` if that was run (the rig export renders its own `act`, this replaces it):

    python3 -I docs/design/heroes/tools/pixellab-act.py

What it does (see docs/design/heroes/pixellab-act/README.md for how the frames were made):
- reads the 33 frames of docs/design/heroes/pixellab-act/frames (64 x 64 px, the scale of the map Hero),
- snaps every pixel to the palette of the rig's Tilly (the most used colours of the atlas) and makes the alpha binary,
- sets them into the 136 x 116 px hangar frame with the feet at (58, 112),
- replaces the animations `tilly.act` (the effect layers of the old act are dropped; the sparks are in the figure) and `tilly.bridge.act`,
  and points `tilly.tolift` and `tilly.toidle` at the first frame of the new act,
- packs the used frames again, deterministically.
"""

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
ATLAS = ROOT / "apps/web/public/assets/hangar/atlas"
FRAMES = ROOT / "docs/design/heroes/pixellab-act/frames"

FRAME_W, FRAME_H = 136, 116
FEET = (58, 112)
SOURCE_FEET = (32, 58)  # the feet in the 64 x 64 source frames
ACT_MS = 3300
BRIDGE_FRAME_MS = 85  # BRIDGE_FRAME_MS of apps/web/src/hangar-select.ts
PAGE_WIDTH = 1024
PADDING = 1
PALETTE_MIN_COUNT = 300
PALETTE_MERGE_DISTANCE = 10


def distance(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def untrimmed(sheet: Image.Image, entry: dict) -> Image.Image:
    f = entry["frame"]
    return sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))


def palette_of(sheet: Image.Image, data: dict, used: set) -> list:
    counts = {}
    for name in used:
        image = untrimmed(sheet, data["frames"][name]).convert("RGBA")
        for r, g, b, a in image.get_flattened_data():
            if a == 255:
                counts[(r, g, b)] = counts.get((r, g, b), 0) + 1
    palette = []
    for colour, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        if count < PALETTE_MIN_COUNT:
            break
        if all(distance(colour, other) >= PALETTE_MERGE_DISTANCE for other in palette):
            palette.append(colour)
    return palette


def snap(image: Image.Image, palette: list) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    cache = {}
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a < 128:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            if (r, g, b) not in cache:
                cache[(r, g, b)] = min(palette, key=lambda other: (distance((r, g, b), other), other))
            pixels[x, y] = (*cache[(r, g, b)], 255)
    return image


def main() -> None:
    data = json.loads((ATLAS / "tilly.json").read_text())
    sheet = Image.open(ATLAS / "tilly.png").convert("RGBA")
    animations = {name: list(frames) for name, frames in data["animations"].items()}
    clips = dict(data["meta"]["clips"])

    # The animations of the old act and its bridge go; the rest stays. The palette comes from the frames that stay.
    for name in ("tilly.act", "tilly.act.fx_back", "tilly.act.fx_front", "tilly.bridge.act"):
        animations.pop(name, None)
        clips.pop(name, None)
    kept = {frame for names in animations.values() for frame in names}
    palette = palette_of(sheet, data, kept)

    files = sorted(FRAMES.glob("act_*.png"))
    if not files:
        sys.exit(f"no frames in {FRAMES}")
    new_images = {}
    for index, file in enumerate(files):
        source = snap(Image.open(file), palette)
        whole = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        whole.alpha_composite(source, (FEET[0] - SOURCE_FEET[0], FEET[1] - SOURCE_FEET[1]))
        new_images[f"tilly.pxl.{index:03d}"] = whole

    act = list(new_images)
    ready = animations["tilly.select"][0]  # the first frame of the ready pose: where the bridge leads to
    animations["tilly.act"] = act
    animations["tilly.tolift"] = [animations["tilly.idle"][0], act[0]]
    animations["tilly.toidle"] = [act[0], animations["tilly.idle"][0]]
    animations["tilly.bridge.act"] = [name for moment in act for name in (moment, ready)]
    clips["tilly.act"] = {"frames": len(act), "durationMs": ACT_MS}
    clips["tilly.bridge.act"] = {"frames": len(animations["tilly.bridge.act"]), "durationMs": len(animations["tilly.bridge.act"]) * BRIDGE_FRAME_MS}

    used = [name for names in animations.values() for name in names]
    pieces = {}
    for name in dict.fromkeys(used):
        if name in new_images:
            whole = new_images[name]
            box = whole.getbbox()
            pieces[name] = (whole.crop(box), {"x": box[0], "y": box[1]}, {"w": FRAME_W, "h": FRAME_H})
        else:
            entry = data["frames"][name]
            pieces[name] = (untrimmed(sheet, entry), {"x": entry["spriteSourceSize"]["x"], "y": entry["spriteSourceSize"]["y"]}, entry["sourceSize"])

    # Shelf packing, tallest first, as the packer of apps/web/scripts does.
    order = sorted(pieces, key=lambda name: (-pieces[name][0].height, name))
    x = y = row = 0
    placed = {}
    for name in order:
        image = pieces[name][0]
        if x + image.width > PAGE_WIDTH:
            x, y, row = 0, y + row + PADDING, 0
        placed[name] = (x, y)
        x += image.width + PADDING
        row = max(row, image.height)
    height = y + row
    page = Image.new("RGBA", (PAGE_WIDTH, height), (0, 0, 0, 0))
    frames = {}
    for name in order:
        image, offset, size = pieces[name]
        px, py = placed[name]
        page.paste(image, (px, py))
        old = data["frames"].get(name)
        frames[name] = {
            "frame": {"x": px, "y": py, "w": image.width, "h": image.height},
            "rotated": False,
            "trimmed": True,
            "spriteSourceSize": {"x": offset["x"], "y": offset["y"], "w": image.width, "h": image.height},
            "sourceSize": size,
            "anchor": old["anchor"] if old else {"x": 0.5, "y": 1},
        }
    meta = dict(data["meta"])
    meta["size"] = {"w": PAGE_WIDTH, "h": height}
    meta["clips"] = clips
    (ATLAS / "tilly.json").write_text(json.dumps({"frames": frames, "animations": animations, "meta": meta}, separators=(",", ":")) + "\n")
    page.save(ATLAS / "tilly.png", optimize=True)
    print(f"palette {len(palette)} colours, act {len(act)} frames, bridge {len(animations['tilly.bridge.act'])} frames, page {PAGE_WIDTH} x {height}")


if __name__ == "__main__":
    main()
