"""Draws apps/web/public/assets/hangar/hangar-wide.png: the picture of the hangar continued on all four sides.

python3 archive/hangar/tools/make_hangar_wide.py

The hangar is drawn at 1280 x 732 pixels (960 x 549 design pixels) and fitted to the window; a window of another shape shows more
than the picture. So the picture is continued: the dark ceiling upwards, the floor with its tile lines downwards, the walls to the
sides, and every continuation fades into the dark of the page (`BACKGROUND`), so that no edge shows. The screen draws dark shade
layers over the picture (`shade-back.png`, the glow, `shade-front.png`, darkest at the edges), which do not reach the continuation;
so the continuation is made from the edges of the picture *as the screen shows it*, with the layers laid over it. The continuation is 120 pixels on
top, 200 below and 400 at each side, enough for windows from 4:3 to about 3:1 (the picture's own shape is 2.16:1).
"""
import numpy as np
from PIL import Image

SOURCE = "archive/hangar/pictures/hangar.png"
TARGET = "apps/web/public/assets/hangar/hangar-wide.png"
TOP, BOTTOM, SIDE = 120, 200, 400
BACKGROUND = np.array([8, 10, 18], dtype=np.float32)  # the colour of the page behind the hangar
FLOOR_PERIOD = 48  # the last rows of the floor are repeated, so that its tile lines go on


def fade(edge: np.ndarray, length: int, axis: int) -> np.ndarray:
    """The edge colours of a strip, `length` pixels deep, turning into the dark of the page the farther they lie from the picture."""
    depth = (np.arange(length, dtype=np.float32) + 1) / length
    weight = np.clip(depth, 0, 1) ** 0.8
    shape = [1, 1, 1]
    shape[axis] = length
    return edge * (1 - weight.reshape(shape)) + BACKGROUND * weight.reshape(shape)


def layer(name: str) -> np.ndarray:
    return np.asarray(Image.open(f"apps/web/public/assets/hangar/{name}.png").convert("RGBA")).astype(np.float32)


def over(base: np.ndarray, top: np.ndarray) -> np.ndarray:
    alpha = top[..., 3:] / 255
    return base * (1 - alpha) + top[..., :3] * alpha


def screen(base: np.ndarray, top: np.ndarray) -> np.ndarray:
    lit = top[..., :3] * (top[..., 3:] / 255)
    return 255 - (255 - base) * (255 - lit) / 255


picture = np.asarray(Image.open(SOURCE).convert("RGB")).astype(np.float32)
height, width, _ = picture.shape
# the picture as the screen shows it, from the layers in the order of the screen (the Heroes and the names are not part of it)
shown = over(screen(over(picture, layer("shade-back")), layer("glow")), layer("shade-front"))

# up: the ceiling goes on as its top row; down: the last rows of the floor repeat
EDGE = 8  # the outermost pixels are a thin bright line of the walls; the continuation takes the mean of the outer EDGE pixels instead
up = fade(np.repeat(shown[:EDGE].mean(axis=0, keepdims=True), TOP, axis=0), TOP, 0)[::-1]
floor = shown[-FLOOR_PERIOD:]
down_raw = np.tile(floor, (BOTTOM // FLOOR_PERIOD + 1, 1, 1))[:BOTTOM]
down = fade(down_raw, BOTTOM, 0)
# the picture's own outermost pixels are a thin bright line; it would stand as a seam between the picture and its continuation
inner = picture.copy()
inner[:, :2] = picture[:, 2:8].mean(axis=1, keepdims=True)
inner[:, -2:] = picture[:, -8:-2].mean(axis=1, keepdims=True)
inner[:2] = inner[2:8].mean(axis=0, keepdims=True)
tall = np.concatenate([up, inner, down], axis=0)
tall_shown = np.concatenate([up, shown, down], axis=0)

# sideways: the outermost column of the picture as shown goes on
left = fade(np.repeat(tall_shown[:, :EDGE].mean(axis=1, keepdims=True), SIDE, axis=1), SIDE, 1)[:, ::-1]
right = fade(np.repeat(tall_shown[:, -EDGE:].mean(axis=1, keepdims=True), SIDE, axis=1), SIDE, 1)
wide = np.concatenate([left, tall, right], axis=1)
Image.fromarray(wide.clip(0, 255).astype("uint8")).save(TARGET, optimize=True)
print(wide.shape[1], "x", wide.shape[0])
