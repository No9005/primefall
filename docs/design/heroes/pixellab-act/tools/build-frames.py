"""Builds frames/act_00.png ... act_32.png from the raw Pixellab outputs (raw/pass1 and raw/pass2).

    python3 -I docs/design/heroes/pixellab-act/tools/build-frames.py            # writes frames/
    python3 -I docs/design/heroes/pixellab-act/tools/build-frames.py --check    # fails if frames/ differ from what the raw outputs give

Each pass is two Pixellab calls (A: tinker, rip, shock; B: pick up, put back), 17 frames each; B starts on the last frame of A, so the clip is
A (17 frames) and B without its first frame (16 frames): 33 frames. The steps, in this order (README.md, "How the frames were made"):

1. pass 1, the arm: skin-coloured pixels on the left of the body (the robot arm) are set to metal greys;
2. pass 2 has the better robot arm (its prompt names it): its strip x 0 to 28, y 32 to 54 is copied into the frames of pass 1, without the
   pale yellow pixels of the flash that reaches into the strip;
3. the skin-coloured pixels left in that arm (x under 30, y 31 to 57) are set to metal greys again;
4. the first frame is the reference on its grey background: the grey around the figure is made transparent.
"""

import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parents[1]
BACKGROUND = (83, 80, 98)
METAL_LIGHT, METAL_DARK = (150, 160, 166), (112, 120, 128)
STRIP = (0, 32, 28, 54)  # x0, y0, x1, y1 of the robot arm that is copied from pass 2


def clip(folder: Path) -> list:
    """The 33 frames of a pass: all of A, then B without its first frame (which is the last frame of A)."""
    a = [Image.open(folder / f"a_{i:02d}.png").convert("RGBA") for i in range(17)]
    b = [Image.open(folder / f"b_{i:02d}.png").convert("RGBA") for i in range(1, 17)]
    return a + b


def is_skin(pixel) -> bool:
    r, g, b, a = pixel
    return bool(a) and r > 180 and g > 130 and b > 85 and r - b > 40


def metal(image: Image.Image, x_range: range, y_range: range) -> None:
    pixels = image.load()
    for y in y_range:
        for x in x_range:
            if is_skin(pixels[x, y]):
                light = sum(pixels[x, y][:3]) / 3 > 190
                pixels[x, y] = (*(METAL_LIGHT if light else METAL_DARK), 255)


def clear_background(image: Image.Image) -> None:
    """Makes the exact background colour transparent where it is connected to the border."""
    pixels = image.load()
    stack = [(x, y) for x in range(64) for y in (0, 63)] + [(x, y) for y in range(64) for x in (0, 63)]
    seen = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < 64 and 0 <= y < 64):
            continue
        seen.add((x, y))
        if pixels[x, y][:3] != BACKGROUND:
            continue
        pixels[x, y] = (0, 0, 0, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]


def build() -> list:
    first, second = clip(HERE / "raw/pass1"), clip(HERE / "raw/pass2")
    frames = []
    for index, (one, two) in enumerate(zip(first, second)):
        frame = one.copy()
        metal(frame, range(0, 28), range(31, 64))  # step 1
        strip = two.crop(STRIP)
        pixels = strip.load()
        for y in range(strip.height):  # step 2
            for x in range(strip.width):
                r, g, b, a = pixels[x, y]
                if a and r > 200 and g > 200 and b < 215 and g - b > 25:
                    pixels[x, y] = (0, 0, 0, 0)
        frame.paste(Image.new("RGBA", strip.size, (0, 0, 0, 0)), STRIP[:2])
        frame.alpha_composite(strip, STRIP[:2])
        metal(frame, range(0, 30), range(31, 58))  # step 3
        if index == 0:
            clear_background(frame)  # step 4
        frames.append(frame)
    return frames


def main() -> None:
    frames = build()
    target = HERE / "frames"
    if "--check" in sys.argv:
        different = [i for i, frame in enumerate(frames) if Image.open(target / f"act_{i:02d}.png").convert("RGBA").tobytes() != frame.tobytes()]
        sys.exit(f"frames differ: {different}" if different else 0)
    target.mkdir(exist_ok=True)
    for index, frame in enumerate(frames):
        frame.save(target / f"act_{index:02d}.png")
    print(f"{len(frames)} frames written to {target}")


if __name__ == "__main__":
    main()
