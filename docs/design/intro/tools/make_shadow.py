"""Draws source/shadow-astronaut.png: the dark silhouette of the second astronaut behind the main helmet (320 x 356 pixels).

python3 docs/design/intro/tools/make_shadow.py

The helmet is turned to the left with a rim light on its right edge, the pack stands behind it, the shoulders and the upper arms run
on straight down below the picture (the film lets the figure sway around the foot of the picture, so its body must never end in it).
"""
from PIL import Image, ImageDraw

BASE = (9, 13, 26, 255)
BASE2 = (14, 20, 38, 255)
RIM = (48, 90, 150, 255)
RIM2 = (30, 56, 100, 255)
ARM = (18, 26, 48, 255)
W, H0, CX, CY = 320, 296, 115, 196
H = H0 + 60  # the body continues 60 pixels below the picture

im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
rx, ry = 42, 44
d.rounded_rectangle([CX + 14, CY - 10, CX + 62, CY + 70], radius=6, fill=BASE)  # the pack behind
# the arms: a hint, a little lighter than the torso, an edge of light on the outer side; they hang from the shoulders, bent a little
d.polygon([(CX - 50, CY + 38), (CX - 76, CY + 52), (CX - 92, CY + 110), (CX - 90, H), (CX - 62, H), (CX - 60, CY + 104), (CX - 46, CY + 64)], fill=ARM)
d.line([(CX - 76, CY + 52), (CX - 92, CY + 110), (CX - 90, H)], fill=RIM2, width=1)
d.polygon([(CX + 70, CY + 40), (CX + 92, CY + 56), (CX + 104, CY + 110), (CX + 102, H), (CX + 76, H), (CX + 76, CY + 100), (CX + 66, CY + 64)], fill=ARM)
d.line([(CX + 92, CY + 56), (CX + 104, CY + 110), (CX + 102, H)], fill=RIM2, width=1)
# the shoulders and the torso run on below the picture
d.polygon([(CX - 70, H), (CX - 70, H0), (CX - 52, CY + 38), (CX - 10, CY + 32), (CX + 40, CY + 32), (CX + 74, CY + 40), (CX + 92, H0), (CX + 92, H)], fill=BASE)
d.rounded_rectangle([CX - 22, CY + 36, CX + 24, CY + 50], radius=4, fill=BASE2)  # the neck ring
# the helmet, turned to the left: the glass a little lighter than the shell, a rim light on the right edge, a small antenna
d.ellipse([CX - rx, CY - ry, CX + rx, CY + ry], fill=BASE2)
d.arc([CX - rx, CY - ry, CX + rx, CY + ry], -80, 60, fill=RIM, width=2)
d.ellipse([CX - rx + 3, CY - 34, CX + 20, CY + 32], fill=BASE)
d.arc([CX - rx + 6, CY - 30, CX + 16, CY + 28], 200, 260, fill=(40, 64, 104, 255), width=1)
d.line([(CX + 30, CY - ry - 6), (CX + 30, CY - ry + 4)], fill=RIM2, width=1)
im.save(__file__.replace("tools/make_shadow.py", "source/shadow-astronaut.png"))
