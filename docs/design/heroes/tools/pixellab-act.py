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
import math
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
BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
PAGE_WIDTH = 1024
PADDING = 1
PALETTE_MIN_COUNT = 300
PALETTE_MERGE_DISTANCE = 10
# Rows and columns of the hangar frame (136 x 116) where Tilly's head and third arm are (checked against the rig's idle and the act).
HEAD = (50, 72, 68, 84)  # x0, y0, x1, y1 of the part of the head the frames are matched on
HEAD_TOP_ROW = 72
ARM_TOP, ARM_LEFT = 40, 40
ARM_LAG = 3  # idle frames the arm is behind the head (follow-through)
ARM_SWAY = (1.2, 0.8)  # px the arm sways on its own over one idle loop, in x and in y
ODD_HAND = (31, (60, 98, 70, 109), {(201, 210, 217): (143, 154, 163), (143, 154, 163): (75, 84, 92)})  # act frame, hangar-frame box and colour map: Pixellab drew the hand of the right arm in light greys there, in the frames around it it is dark
ARM_PIVOT = (52.5, 65.5)  # the elbow of the arched arm (the teal joint in the corner of the arch); the forearm and the claw turn about it
ARM_SPLIT_X = 53  # columns up to this are the stem and the elbow, the rest is the forearm
DESEL_SWING = (0.85, 0.65, 0.45, 0.28, 0.15, 0.05, -0.08, -0.10, -0.05, 0, 0, 0, 0)  # how far the forearm is still raised in desel frames 1 to 13 (of the angle of the ready pose); the dip below 0 is a small follow-through
ARM_BASE_ROWS = (60, 81)  # the arm's rows: from the top of the arch down past the first joint, where the stem meets the back pack


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


def whole_frame(sheet: Image.Image, data: dict, name: str) -> Image.Image:
    """The frame as the whole 136 x 116 picture (the atlas stores it trimmed)."""
    entry = data["frames"][name]
    whole = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    whole.paste(untrimmed(sheet, entry), (entry["spriteSourceSize"]["x"], entry["spriteSourceSize"]["y"]))
    return whole


def mix(first: Image.Image, second: Image.Image, weight: float) -> Image.Image:
    """A pixel-art in-between of two poses: each pixel is the second pose's where the 4 x 4 Bayer matrix is under `weight`, else the first's."""
    result = first.copy()
    a, b, out = first.load(), second.load(), result.load()
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            if (BAYER[y % 4][x % 4] + 0.5) / 16 <= weight:
                out[x, y] = b[x, y]
    return result


def is_metal(pixel) -> bool:
    """The outline, the teal lights and the greys: what the third arm is drawn with (the goggles share them, so they are only cleared where the arm is)."""
    r, g, b, a = pixel
    if a < 128:
        return False
    if (r, g, b) == (23, 17, 13):
        return True
    if g > 200 and b > 180 and r < 150:
        return True
    return abs(r - g) < 30 and abs(g - b) < 30


def head_offset(idle: Image.Image, act: Image.Image) -> tuple:
    """How far the head of the idle frame sits from the head of the first act frame (the body bobs a little in the idle)."""
    a, p = act.load(), idle.load()
    best = None
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            same = sum(
                1
                for y in range(HEAD[1], HEAD[3])
                for x in range(HEAD[0], HEAD[2])
                if p[x, y][3] > 0 and p[x, y] == a[x - dx, y - dy]
            )
            if best is None or same > best[0]:
                best = (same, dx, dy)
    return best[1], best[2]


def arm_offsets(heads: list) -> list:
    """Where the arm of each idle frame sits: where the head was a few frames ago plus a slow sway of its own, so that it trails the body and settles late.
    Both fade to nothing towards the first frame (the loop is periodic), where the arm sits exactly as in the act: tolift, toidle and desel meet it there."""
    count = len(heads)
    offsets = []
    for index in range(count):
        behind = heads[(index - ARM_LAG) % count]
        phase = 2 * math.pi * (index - 2 * ARM_LAG) / count
        free = (behind[0] + round(ARM_SWAY[0] * math.sin(phase)), behind[1] + round(ARM_SWAY[1] * math.sin(phase - 1.2)))
        strength = (1 - math.cos(2 * math.pi * index / count)) / 2
        offsets.append((round(heads[index][0] + (free[0] - heads[index][0]) * strength), round(heads[index][1] + (free[1] - heads[index][1]) * strength)))
    return offsets


def clear_pole(frame: Image.Image) -> None:
    """Removes the rig's straight third arm from a frame (it stands behind the hair and the goggles, which stay)."""
    px = frame.load()
    for y in range(ARM_TOP, 77):
        limit = 99 if y < HEAD_TOP_ROW else (56 if y <= 74 else 49)
        for x in range(ARM_LEFT, limit + 1):
            if is_metal(px[x, y]):
                px[x, y] = (0, 0, 0, 0)


def arm_layer(act: Image.Image) -> Image.Image:
    """The arched arm of the first act frame on a picture of its own: the arch, the stem and the first joint, without the head."""
    arm = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    ap, source = arm.load(), act.load()
    for y in range(ARM_BASE_ROWS[0], ARM_BASE_ROWS[1] + 1):
        for x in range(36, 100):
            keep = y < HEAD_TOP_ROW or (y == HEAD_TOP_ROW and x <= 52) or (HEAD_TOP_ROW < y <= 76 and x <= 50) or (y > 76 and x <= 47)
            if keep and source[x, y][3] > 0:
                ap[x, y] = source[x, y]
    return arm


def posed_arm(arm: Image.Image, angle: float) -> Image.Image:
    """The arm with its forearm and claw turned up by `angle` degrees about the elbow (0 is the arch of the act and the idle)."""
    stem, forearm = arm.copy(), arm.copy()
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            (stem if x > ARM_SPLIT_X else forearm).putpixel((x, y), (0, 0, 0, 0))
    if angle:
        forearm = forearm.rotate(angle, resample=Image.NEAREST, center=ARM_PIVOT)
    stem.alpha_composite(forearm)
    return stem


def ready_angle(hold: Image.Image, act: Image.Image) -> float:
    """The angle of the forearm in the hold pose of the rig: the one at which the turned arm covers most of the arm drawn in that frame."""
    mask = {(x, y) for y in range(ARM_TOP, HEAD_TOP_ROW) for x in range(ARM_LEFT, 100) if is_metal(hold.getpixel((x, y)))}
    shift = head_offset(hold, act)
    arm = arm_layer(act)
    best = None
    for angle in range(0, 95, 5):
        posed = posed_arm(arm, angle)
        cells = {(x + shift[0], y + shift[1]) for y in range(ARM_TOP, HEAD_TOP_ROW) for x in range(ARM_LEFT, 100) if posed.getpixel((x, y))[3] > 0}
        score = len(cells & mask) - 0.3 * len(cells - mask)
        if best is None or score > best[0]:
            best = (score, angle)
    return best[1]


def swung_desel(frames: list, act: Image.Image) -> list:
    """The frames of desel with the arm swinging from the pose of the hold down into the arch of the idle (the rig's frames carry a straight pole)."""
    arm = arm_layer(act)
    angle = ready_angle(frames[0], act)
    result = [frames[0]]
    for index in range(1, len(frames) - 1):
        frame = frames[index].copy()
        clear_pole(frame)
        frame.alpha_composite(posed_arm(arm, angle * DESEL_SWING[index - 1]), head_offset(frame, act))
        result.append(frame)
    result.append(frames[-1])
    return result


def arch_arm(idle: Image.Image, act: Image.Image, offset: tuple) -> Image.Image:
    """The idle frame with its straight third arm replaced by the arched one of the first act frame, put at `offset`."""
    result = idle.copy()
    clear_pole(result)
    result.alpha_composite(arm_layer(act), offset)
    return result


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
    odd_frame, box, recolour = ODD_HAND
    hand = new_images[act[odd_frame]].load()
    for y in range(box[1], box[3]):
        for x in range(box[0], box[2]):
            if hand[x, y][3] and hand[x, y][:3] in recolour:
                hand[x, y] = (*recolour[hand[x, y][:3]], 255)
    # The idle gets the arched third arm of the act (the rig's idle has it as a straight pole). Every animation that uses an idle frame
    # (tolift, toidle, the end of desel) gets the arched version of it too.
    arched = {}
    idle_names = list(dict.fromkeys(animations["tilly.idle"]))
    pictures = [whole_frame(sheet, data, name) for name in idle_names]
    offsets = arm_offsets([head_offset(picture, new_images[act[0]]) for picture in pictures])
    for index, name in enumerate(idle_names):
        arched_name = name if name.startswith("tilly.arch.") else f"tilly.arch.{name.removeprefix('tilly.')}"
        arched[name] = arched_name
        picture = pictures[index]
        new_images[arched_name] = picture if name == arched_name else arch_arm(picture, new_images[act[0]], offsets[index])  # a second run leaves the arched frames as they are
    for key, names in animations.items():
        animations[key] = [arched.get(name, name) for name in names]
    # desel: the arm swings from the hold pose into the arched idle (frame 0 is the hold's own, the last one is the arched idle frame)
    desel = animations["tilly.desel"]
    if not any(name.startswith("tilly.desel.arm.") for name in desel):
        pictures = [new_images[name] if name in new_images else whole_frame(sheet, data, name) for name in desel]
        swung = swung_desel(pictures, new_images[act[0]])
        animations["tilly.desel"] = [name if index in (0, len(desel) - 1) else f"tilly.desel.arm.{index:02d}" for index, name in enumerate(desel)]
        for index, name in enumerate(animations["tilly.desel"]):
            if name.startswith("tilly.desel.arm."):
                new_images[name] = swung[index]
    else:
        for name in desel:
            if name.startswith("tilly.desel.arm."):
                new_images[name] = whole_frame(sheet, data, name)
    ready = animations["tilly.select"][0]  # the first frame of the ready pose: where the bridge leads to
    animations["tilly.act"] = act
    idle_first = animations["tilly.idle"][0]
    ready_picture = whole_frame(sheet, data, ready)

    bridge = []
    for index, moment in enumerate(act):  # the bridge: the pose of the act, then half way into the ready pose, then the ready pose begins
        half = f"tilly.mix.bridge.{index:03d}"
        new_images[half] = mix(new_images[moment], ready_picture, 0.5)
        bridge += [moment, half]
    animations["tilly.bridge.act"] = bridge
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
