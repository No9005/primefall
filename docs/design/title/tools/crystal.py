"""The crystal of the logo (the Prime), drawn with polygons on an ImageDraw: used by make_title.py (the logo) and make_icons.py (the app icons)."""

LIGHT = (232, 250, 255)
LEFT = (150, 215, 240)
RIGHT = (70, 120, 200)
DARK = (46, 82, 170)
EDGE = (14, 10, 28)


def draw_crystal(d, cx, top, mid, bot, half_width, outline=True):
    """A diamond: the tip at (cx, top), the widest line at `mid`, the foot at (cx, bot); lit from the upper left, in four faces."""
    d.polygon([(cx, top), (cx - half_width, mid), (cx, bot)], fill=LEFT)
    d.polygon([(cx, top), (cx + half_width, mid), (cx, bot)], fill=RIGHT)
    d.polygon([(cx, top), (cx - half_width, mid), (cx, mid)], fill=LIGHT)
    d.polygon([(cx, mid), (cx + half_width, mid), (cx, bot)], fill=DARK)
    d.line([(cx, top), (cx, bot)], fill=(240, 252, 255))
    d.line([(cx - half_width, mid), (cx + half_width, mid)], fill=(255, 255, 255))
    if outline:
        for p, q in [((cx, top), (cx - half_width, mid)), ((cx - half_width, mid), (cx, bot)), ((cx, top), (cx + half_width, mid)), ((cx + half_width, mid), (cx, bot))]:
            d.line([p, q], fill=EDGE)
