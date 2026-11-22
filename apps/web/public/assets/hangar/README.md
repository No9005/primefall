# The hangar of the Hero Select

The pictures of `HeroSelectScreen.tsx` (design: `docs/design/hero-select/README.md`, the section "the Hero Select in the hangar"). The hangar is
drawn at 1280 pixels wide and shown at 960 design pixels; the Heroes are strips of frames drawn larger (Max 190, Tilly 136 and Kit 136 pixels
a frame, shown at 482, 345 and 345 design pixels).

| File | What |
|---|---|
| `hangar.png` | the floor, the walls, the crates and the open bay door (1280 x 732; the upper 104 design px lie above the frame, the lower edge is the frame's) |
| `hangar-wide.png` | the same picture continued on all four sides (2080 x 1052: 400 px to each side, 120 above, 200 below) so that a window of another shape (4:3 to about 3:1) has no bars; the continuation fades into the dark of the page. Made by `docs/design/hero-select/tools/make_hangar_wide.py` (the screen's shade layers are taken into account); the screen uses this file instead of `hangar.png` |
| `lights-a.png` … `lights-d.png`, `lights-flicker.png` | the lamps and beacons that blink, added with `screen` |
| `fire.png`, `spark.png`, `guide.png`, `flap.png` | a burning crystal past the door, the strip of a spark, the strip of the amber guide lights, the wall part that flaps (kept for the throw of Max) |
| `shade-back.png`, `shade-front.png`, `glow.png` | the dark shade behind and in front of the Heroes (it flickers), and the glow of the lamps |
| `name-<hero>.png`, `name-<hero>-selected.png`, `kit-ring.png` | the name plates on the floor, plain and chosen |
| `back.png`, `back-on.png`, `next.png`, `next-on.png` | BACK and NEXT in the menu style |
| `clips/<hero>-<clip>.png` | a strip of frames: `idle`, `tolift`, `act`, `toidle` (the action), `selecti` (from idle into the chosen pose), `select`, `hold` (the chosen pose, looped), `desel`; `<hero>-bridge*.png` has two frames for each moment of the action |

The frame counts and times of the clips are in `apps/web/src/hangar-select.ts`; a test checks that every strip has the size its table says.
They were made on the design canvas; the sources are not in this repository yet.
