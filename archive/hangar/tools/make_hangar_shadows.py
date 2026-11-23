"""Draws the contact shadows of the Heroes of the hangar: apps/web/public/assets/hangar/shadow.png and, from the strips of the clips,
apps/web/src/hangar-shadows.css (one set of keyframes per clip, played with the clip) and apps/web/src/hangar-shadows.ts (the spots
of the bridge frames).

python3 archive/hangar/tools/make_hangar_shadows.py [--debug <out.png>]

A shadow is a dark flat ellipse under the lowest solid part of a Hero (the feet; the rows at least 5 pixels wide, so a thin rifle tip
does not count). It goes where the feet are, as wide as the feet are (plus a margin), and it is gone while the Hero is off the ground
(a jump, a lift): for Max and Tilly when the feet are more than 5 pixels above their usual level.

Kit is special. On the crate he sits (the shadow lies on the crate under him, where he sits, not under his hanging feet); when he is chosen
he jumps down: the shadow is gone from the first frame of the jump until his feet are on the floor again, and then it lies under his feet on the
floor; when he is taken back he jumps up and it is gone again until he sits.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
CLIPS = ROOT / "archive/hangar/strips"
FRAME_ART = {"max": (190, 112), "tilly": (136, 116), "kit": (136, 118)}  # frame width and height of the strips, in art pixels
FRAME_DESIGN_WIDTH = {"max": 482.3, "tilly": 345.2, "kit": 345.2}
MARGIN, MIN_ART, MAX_ART = 1.35, 30, 70
FLAT = 0.26  # the height of a shadow against its width

# the strips of each Hero by clip, and the bridges
FILES = {
    "max": {"idle": "max-idle", "tolift": "max-tolift", "act": "max-act", "toidle": "max-toidle", "selecti": "max-selecti", "select": "max-select", "hold": "max-hold", "desel": "max-desel"},
    "tilly": {"idle": "tilly-idle", "tolift": "tilly-tolift", "act": "tilly-act", "toidle": "tilly-toidle", "select": "tilly-select", "selecti": "tilly-selecti", "hold": "tilly-hold", "desel": "tilly-desel"},
    "kit": {"idle": "kit-idle", "act": "kit-act", "select": "kit-select", "hold": "kit-hold", "desel": "kit-desel"},
}
BRIDGES = {"max": {"act": "max-bridge-act"}, "tilly": {"act": "tilly-bridge-act"}, "kit": {"act": "kit-bridge", "idle": "kit-bridge"}}

# Kit
SEAT = {"y": 67, "x": None}  # filled from the idle strip: the middle of his body where he sits
FLOOR_FEET_MIN = 99  # his feet are on the floor from this row on (the floor is at about 101)
KIT_SELECT = {"seated": range(0, 2), "air": range(2, 16)}  # the frames of the jump down; from 16 on the feet are on the floor
KIT_DESEL = {"floor": range(0, 7), "air": range(7, 10)}  # the frames of the jump up; from 10 on he sits


def frames_of(name: str, hero: str) -> list[np.ndarray]:
    image = Image.open(CLIPS / f"{name}.png").convert("RGBA")
    width = FRAME_ART[hero][0]
    alpha = np.asarray(image)[..., 3]
    return [alpha[:, i * width : (i + 1) * width] for i in range(image.width // width)]


def feet(frame: np.ndarray):
    """The row of the feet (the lowest row at least 5 solid pixels wide) and the columns of the rows just above it."""
    solid = frame > 60
    rows = np.nonzero(solid.sum(axis=1) >= 5)[0]
    if len(rows) == 0:
        return None
    y = int(rows.max())
    columns = np.nonzero(solid[max(0, y - 3) : y + 1].any(axis=0))[0]
    return y, int(columns.min()), int(columns.max())


def body_centre(frame: np.ndarray, top: int, bottom: int) -> float:
    columns = np.nonzero((frame[top : bottom + 1] > 60).any(axis=0))[0]
    return float(columns.mean())


def spot(hero: str, x_art: float, y_art: float, width_art: float) -> list[float]:
    scale = FRAME_DESIGN_WIDTH[hero] / FRAME_ART[hero][0]
    width = min(max(width_art * MARGIN, MIN_ART), MAX_ART) * scale
    return [round(x_art * scale, 1), round(y_art * scale, 1), round(width, 1)]


def track(hero: str, clip: str, frames: list[np.ndarray], floor_y: float, kit: dict | None):
    result: list[list[float] | None] = []
    for index, frame in enumerate(frames):
        found = feet(frame)
        if hero == "kit":
            assert kit is not None
            if clip in ("idle", "act"):
                result.append(spot(hero, kit["seat_x"], SEAT["y"], 34))
            elif clip == "select":
                if index in KIT_SELECT["seated"]:
                    result.append(spot(hero, kit["seat_x"], SEAT["y"], 34))
                elif index in KIT_SELECT["air"]:
                    result.append(None)
                else:
                    result.append(spot(hero, kit["floor_x"], kit["floor_y"], 22))
            elif clip == "hold":
                result.append(spot(hero, kit["floor_x"], kit["floor_y"], 22))
            elif clip == "desel":
                if index in KIT_DESEL["floor"]:
                    result.append(spot(hero, kit["floor_x"], kit["floor_y"], 22))
                elif index in KIT_DESEL["air"]:
                    result.append(None)
                else:
                    result.append(spot(hero, kit["seat_x"], SEAT["y"], 34))
            continue
        if found is None or found[0] < floor_y - 5:
            result.append(None)
        else:
            y, left, right = found
            result.append(spot(hero, (left + right) / 2, y, right - left + 1))
    return result


def main() -> None:
    tracks: dict[str, list[list[float] | None]] = {}
    bridge_spots: dict[str, list[list[float] | None]] = {}
    kit_info = None
    for hero, clips in FILES.items():
        idle = frames_of(clips["idle"], hero)
        floors = [f[0] for f in map(feet, idle) if f]
        floor_y = float(np.median(floors))
        if hero == "kit":
            seat_x = float(np.mean([body_centre(f, 52, 66) for f in idle]))
            hold = [feet(f) for f in frames_of(clips["hold"], hero)]
            hold = [h for h in hold if h and h[0] >= FLOOR_FEET_MIN]
            kit_info = {"seat_x": seat_x, "floor_x": float(np.mean([(h[1] + h[2]) / 2 for h in hold])), "floor_y": float(np.median([h[0] for h in hold]))}
        for clip, name in clips.items():
            tracks[f"{hero}-{clip}"] = track(hero, clip, frames_of(name, hero), floor_y, kit_info)
        for source, name in BRIDGES[hero].items():
            fr = frames_of(name, hero)
            if hero == "kit":
                bridge = [spot(hero, kit_info["seat_x"], SEAT["y"], 34) for _ in fr]
            else:
                bridge = track(hero, source, fr, floor_y, None)
            bridge_spots[f"{hero}-{source}"] = bridge

    # the keyframes of the clips: a keyframe where the spot changes, held until the next one (steps), the last one kept
    css = ["/* Generated by archive/hangar/tools/make_hangar_shadows.py: the contact shadow of each Hero follows the frames of its clip. */"]
    for key, spots in tracks.items():
        count = len(spots)
        css.append(f"@keyframes hg-shadow-{key} {{")
        previous = "start"
        for index, current in enumerate(spots):
            if current == previous:
                continue
            previous = current
            percent = f"{index / count * 100:.3f}".rstrip("0").rstrip(".")
            if current is None:
                css.append(f"  {percent}% {{ opacity: 0; }}")
            else:
                x, y, width = current
                height = round(width * FLAT, 1)
                css.append(f"  {percent}% {{ opacity: 1; left: {round(x - width / 2, 1)}px; top: {round(y - height * 0.45, 1)}px; width: {width}px; height: {height}px; }}")
        css.append("  100% { " + ("opacity: 0;" if spots[-1] is None else f"opacity: 1; left: {round(spots[-1][0] - spots[-1][2] / 2, 1)}px; top: {round(spots[-1][1] - spots[-1][2] * FLAT * 0.45, 1)}px; width: {spots[-1][2]}px; height: {round(spots[-1][2] * FLAT, 1)}px;") + " }")
        css.append("}")
    (ROOT / "apps/web/src/hangar-shadows.css").write_text("\n".join(css) + "\n")

    ts = [
        "// Generated by archive/hangar/tools/make_hangar_shadows.py: the spot of the contact shadow in each frame of the bridges, in design pixels",
        "// inside the box of the Hero: [x of the middle, y of the contact, width], or null where the Hero is off the ground.",
        "export type ShadowSpot = readonly [number, number, number] | null;",
        "",
        f"export const BRIDGE_SHADOWS: Record<string, readonly ShadowSpot[]> = {json.dumps(bridge_spots)};",
        "",
        "// The shadow of a still Hero (reduced motion): the first frame of its idle and of its ready pose.",
        f"export const STILL_SHADOWS: Record<string, ShadowSpot> = {json.dumps({k: v[0] for k, v in tracks.items() if k.endswith(('-idle', '-hold'))})};",
        "",
        "/** The height of a shadow against its width, and how far above the contact its middle lies (in heights): the numbers of the keyframes. */",
        f"export const SHADOW_FLAT = {FLAT};",
        "export const SHADOW_LIFT = 0.45;",
        "",
    ]
    (ROOT / "apps/web/src/hangar-shadows.ts").write_text("\n".join(ts))

    # the picture of the shadow: a flat ellipse in three rings, dark at the middle
    image = Image.new("RGBA", (64, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for inset, alpha in ((0, 90), (4, 90), (9, 100)):
        draw.ellipse([inset, inset // 2, 63 - inset, 15 - inset // 2], fill=(2, 3, 8, alpha))
    image.save(ROOT / "apps/web/public/assets/hangar/shadow.png")

    if "--debug" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--debug") + 1])
        rows = []
        for key in ("max-idle", "max-act", "max-select", "tilly-idle", "tilly-act", "tilly-select", "kit-idle", "kit-select", "kit-hold", "kit-desel"):
            hero, clip = key.split("-")
            frames = frames_of(FILES[hero][clip], hero)
            spots = tracks[key]
            picks = np.linspace(0, len(frames) - 1, min(10, len(frames))).astype(int)
            strip = Image.new("RGBA", (FRAME_ART[hero][0] * 10, FRAME_ART[hero][1]), (50, 60, 90, 255))
            sheet = Image.open(CLIPS / f"{FILES[hero][clip]}.png").convert("RGBA")
            scale = FRAME_DESIGN_WIDTH[hero] / FRAME_ART[hero][0]
            for column, index in enumerate(picks):
                crop = sheet.crop((index * FRAME_ART[hero][0], 0, (index + 1) * FRAME_ART[hero][0], sheet.height))
                strip.alpha_composite(crop, (column * FRAME_ART[hero][0], 0))
                sp = spots[index]
                draw = ImageDraw.Draw(strip)
                if sp:
                    x, y, w = sp[0] / scale, sp[1] / scale, sp[2] / scale
                    draw.ellipse([column * FRAME_ART[hero][0] + x - w / 2, y - w * FLAT * 0.45, column * FRAME_ART[hero][0] + x + w / 2, y + w * FLAT * 0.55], outline=(255, 60, 60, 255))
                else:
                    draw.text((column * FRAME_ART[hero][0] + 4, 4), "no", fill=(255, 255, 0, 255))
            rows.append((key, strip))
        height = sum(strip.height + 12 for _, strip in rows)
        sheet = Image.new("RGBA", (max(s.width for _, s in rows), height), (0, 0, 0, 255))
        y = 0
        for key, strip in rows:
            ImageDraw.Draw(sheet).text((4, y), key, fill=(255, 255, 255, 255))
            sheet.alpha_composite(strip, (0, y + 12))
            y += strip.height + 12
        sheet.convert("RGB").save(out)


main()
