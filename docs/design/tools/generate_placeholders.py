#!/usr/bin/env python3
"""Generate Primefall placeholder assets that follow docs/design/asset-contract.md.

Run from the repository root:  python3 docs/design/tools/generate_placeholders.py
Requires Pillow. Real assets replace these files one-to-one (same names, canvas sizes and pivots).
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[3] / "apps" / "web" / "public" / "assets"
TW, TH = 128, 64            # tile diamond
PROP = (128, 128)           # props: footprint sits in the bottom 128x64
HERO = (128, 192)           # heroes: feet anchor at bottom centre
VFX = (128, 128)

GRAPH = (28, 34, 43); STEEL = (61, 90, 115); TEAL = (46, 196, 182)
ORANGE = (255, 138, 61); RED = (229, 72, 77); LIGHT = (200, 214, 226)
FONT = ImageFont.load_default()

def shade(c, f): return tuple(max(0, min(255, int(v * f))) for v in c)

def diamond(cx, cy, w, h):
    return [(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)]

def new(size): return Image.new("RGBA", size, (0, 0, 0, 0))

def tile(color, outline, extra=None):
    im = new((TW, TH)); d = ImageDraw.Draw(im)
    d.polygon(diamond(64, 32, TW - 1, TH - 1), fill=color + (255,), outline=outline + (255,))
    if extra: extra(d)
    return im

def box(top, height, inset, extra=None, canvas=PROP):
    """Isometric box standing on the footprint diamond (bottom vertex at canvas bottom centre)."""
    im = new(canvas); d = ImageDraw.Draw(im)
    w, h = TW * inset, TH * inset
    cy = canvas[1] - TH / 2           # footprint centre
    base = diamond(64, cy, w, h)
    lift = [(x, y - height) for x, y in base]
    d.polygon([lift[3], lift[2], base[2], base[3]], fill=shade(top, 0.75) + (255,))   # left face
    d.polygon([lift[2], lift[1], base[1], base[2]], fill=shade(top, 0.55) + (255,))   # right face
    d.polygon(lift, fill=top + (255,), outline=shade(top, 1.25) + (255,))              # top face
    if extra: extra(d, lift, base)
    return im

def hero(letter, color, pose, label):
    im = new(HERO); d = ImageDraw.Draw(im)
    d.ellipse((34, 168, 94, 188), fill=(0, 0, 0, 90))
    low = pose in ("exhausted", "hidden_crouch")
    top = 118 if low else 74
    tilt = {"move": 10, "hit": -12}.get(pose, 0)
    col = (110, 120, 130) if pose == "exhausted" else color
    body = (44 + tilt, top, 84 + tilt, 176)
    d.rounded_rectangle(body, 12, fill=col + (255,), outline=shade(col, 1.3) + (255,), width=2)
    d.ellipse((48 + tilt, top - 30, 80 + tilt, top + 2), fill=shade(col, 1.15) + (255,), outline=LIGHT + (255,), width=2)
    d.text((58 + tilt, top + 14), letter, fill=GRAPH + (255,), font=FONT)
    arm_y = top + 18
    if pose in ("attack_ranged", "heavy_attack", "precision_aim", "breach_charge_throw"):
        d.line((84 + tilt, arm_y, 120, arm_y - (6 if pose == "breach_charge_throw" else 0)), fill=LIGHT + (255,), width=5)
    elif pose in ("utility_cast", "drone_deploy", "cover_deploy"):
        d.line((84 + tilt, arm_y, 104, arm_y - 30), fill=LIGHT + (255,), width=5)
        d.ellipse((98, arm_y - 44, 112, arm_y - 30), fill=TEAL + (255,))
    elif pose == "block_shield":
        d.arc((70, top - 4, 118, top + 74), 270, 90, fill=TEAL + (255,), width=6)
    else:
        d.line((84 + tilt, arm_y, 98 + tilt, arm_y + 22), fill=LIGHT + (255,), width=5)
    if pose == "move":
        for i in range(3): d.line((14, 120 + i * 12, 34, 120 + i * 12), fill=LIGHT + (140,), width=2)
    if pose == "hit":
        d.rounded_rectangle(body, 12, outline=RED + (255,), width=4)
    if pose == "hidden_crouch":
        im.putalpha(im.getchannel("A").point(lambda v: int(v * 0.6)))
        d = ImageDraw.Draw(im)
    d.text((6, 4), f"{letter}:{label}", fill=LIGHT + (255,), font=FONT)
    return im

def vfx(kind):
    im = new(VFX); d = ImageDraw.Draw(im); c = 64
    if kind == "muzzle_flash":
        d.polygon([(c - 40, c), (c, c - 14), (c + 40, c), (c, c + 14)], fill=ORANGE + (255,))
        d.ellipse((c - 12, c - 12, c + 12, c + 12), fill=(255, 235, 200, 255))
    elif kind == "energy_projectile":
        d.ellipse((c - 16, c - 16, c + 16, c + 16), fill=TEAL + (255,))
        d.ellipse((c - 7, c - 7, c + 7, c + 7), fill=(220, 255, 250, 255))
    elif kind == "shotgun_blast":
        for a in range(-30, 31, 15):
            d.line((c - 40, c, c + 40, c + a), fill=ORANGE + (255,), width=5)
    elif kind == "shield_ring":
        d.ellipse((14, 38, 114, 90), outline=TEAL + (255,), width=5, fill=TEAL + (50,))
    elif kind == "cover_deploy_effect":
        d.polygon(diamond(c, 80, 100, 50), outline=TEAL + (255,), fill=TEAL + (60,))
        d.line((c, 80, c, 20), fill=TEAL + (255,), width=3)
    elif kind == "drone":
        d.ellipse((c - 18, c - 10, c + 18, c + 10), fill=STEEL + (255,), outline=TEAL + (255,), width=3)
        d.line((c - 30, c - 14, c + 30, c - 14), fill=LIGHT + (255,), width=3)
    elif kind == "mark_reticle":
        d.ellipse((24, 24, 104, 104), outline=RED + (255,), width=4)
        d.line((c, 8, c, 40), fill=RED + (255,), width=4); d.line((c, 88, c, 120), fill=RED + (255,), width=4)
        d.line((8, c, 40, c), fill=RED + (255,), width=4); d.line((88, c, 120, c), fill=RED + (255,), width=4)
    elif kind == "slow_indicator":
        for i in range(3): d.arc((24 + i * 10, 24 + i * 10, 104 - i * 10, 104 - i * 10), 200, 340, fill=STEEL + (255,), width=5)
        d.polygon([(c - 10, 98), (c + 10, 98), (c, 112)], fill=STEEL + (255,))
    elif kind == "reactor_pulse":
        for r in (20, 38, 56):
            d.ellipse((c - r, c - r * 0.5, c + r, c + r * 0.5), outline=TEAL + (255 - r * 3,), width=4)
    elif kind == "explosion":
        d.polygon([(c, 6), (80, 40), (122, c), (80, 88), (c, 122), (48, 88), (6, c), (48, 40)], fill=ORANGE + (255,))
        d.ellipse((38, 38, 90, 90), fill=(255, 235, 200, 255))
    return im

def main():
    assets = {}
    def save(group, name, im, anchor):
        path = OUT / group.replace(".", "/") / f"{name}.png"; path.parent.mkdir(parents=True, exist_ok=True); im.save(path)
        assets.setdefault(group, []).append({"alias": f"{group}.{name}", "src": f"{group.replace('.', '/')}/{name}.png", "data": {"anchor": anchor}})

    F = (44, 52, 64); L = (70, 82, 98)
    save("tiles", "floor_01", tile(F, L), [0.5, 1])
    save("tiles", "floor_02", tile(shade(F, 1.08), L, lambda d: d.line((34, 32, 94, 32), fill=L + (255,))), [0.5, 1])
    save("tiles", "floor_damaged_01", tile(F, L, lambda d: d.line((44, 26, 70, 36, 88, 30), fill=ORANGE + (255,), width=2)), [0.5, 1])
    save("tiles", "reactor_floor_01", tile((24, 70, 72), TEAL, lambda d: d.ellipse((40, 22, 88, 42), outline=TEAL + (255,), width=3)), [0.5, 1])
    save("tiles", "reactor_edge_01", tile((30, 52, 64), TEAL, lambda d: d.line((20, 32, 108, 32), fill=TEAL + (255,), width=1)), [0.5, 1])
    save("tiles", "spawn_marker_01", tile(F, TEAL, lambda d: d.polygon([(64, 18), (82, 32), (64, 46), (46, 32)], outline=TEAL + (255,))), [0.5, 1])
    save("props", "wall_01", box((52, 62, 76), 64, 1.0), [0.5, 1])
    save("props", "cover_full_01", box(STEEL, 44, 0.62, lambda d, t, b: d.line((t[3][0] + 6, t[3][1] + 8, t[1][0] - 6, t[1][1] + 8), fill=TEAL + (255,), width=2)), [0.5, 1])
    save("props", "cover_half_01", box(shade(STEEL, 1.2), 20, 0.62, lambda d, t, b: d.line((t[3][0] + 6, t[3][1] + 4, t[1][0] - 6, t[1][1] + 4), fill=ORANGE + (255,), width=2)), [0.5, 1])
    save("props", "overwatch_nest_01", box((70, 84, 104), 72, 0.8, lambda d, t, b: d.rectangle((t[2][0] - 12, t[2][1] - 6, t[2][0] + 12, t[2][1] + 4), fill=ORANGE + (255,))), [0.5, 1])

    classes = {"bruiser": ("B", ORANGE), "controller": ("C", TEAL), "assassin": ("A", (120, 160, 200))}
    shared = ["idle", "move", "attack_ranged", "block_shield", "utility_cast", "hit", "exhausted"]
    extra = {"bruiser": ["heavy_attack", "breach_charge_throw"], "controller": ["drone_deploy", "cover_deploy"], "assassin": ["precision_aim", "hidden_crouch"]}
    for cls, (letter, col) in classes.items():
        for pose in shared + extra[cls]:
            save(f"heroes.{cls}", pose, hero(letter, col, pose, pose[:7].upper()), [0.5, 1])
    for k in ["muzzle_flash", "energy_projectile", "shotgun_blast", "shield_ring", "cover_deploy_effect", "drone", "mark_reticle", "slow_indicator", "reactor_pulse", "explosion"]:
        save("vfx", k, vfx(k), [0.5, 0.5])

    manifest = {"bundles": [{"name": g, "assets": a} for g, a in assets.items()]}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(sum(len(a) for a in assets.values()), "assets written to", OUT)

if __name__ == "__main__":
    main()
