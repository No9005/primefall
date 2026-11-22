---
name: pixel-artist
description: Pixel art and animation for Primefall. Use when making, changing or reviewing a picture, sprite, Hero clip, scene film or icon the player sees.
---

Everything the player sees follows one look. Make it consistent with what exists, show it before it is built, and look at the result.

## 1. Ground

Read the _World_ and _Look_ parts of `docs/design/world-and-style.md` and `docs/design/decisions.md`. Then find the agreed design for what you change (the Hero's design in `docs/design/pixel-heroes/README.md`, the board or reference page in `docs/design/<area>/`) and **name it first**; the finished change is checked against it element by element. Done when you can say which reference you follow, or that none exists and the owner has to decide.

## 2. Pick the kind

| You make | Read and run |
|---|---|
| Hero clip or pose | `docs/design/pixel-heroes/README.md` (rigs in `tools/rigs/`, `node docs/design/pixel-heroes/tools/export.mjs`), timing and beats in `docs/design/animation/README.md` |
| Scene film (Notstrom Intro) | `docs/design/notstrom-intro/README.md` and `tools/` (`render_frames.mjs`, then `pack_sheets.py`) |
| Title screen, icons, crystal | `docs/design/title/tools/` |
| Hangar (Hero Select) | `docs/design/hero-select/README.md` and `tools/` |
| Map tiles and props | `docs/design/notstrom-map/`, `docs/design/asset-contract.md` |

The source of a picture (script, rig, page) is committed under `docs/design/<area>/tools/`; a PNG without its source cannot be changed later.

## 3. Rules of the look

- Pixel art, nearest-neighbour scaling, whole-number scale only.
- A Hero frame is 136 x 104 px with the feet at (58, 86), 20 fps, facing right (mirror for the other side). Scenes carry their own size and rate (the Notstrom Intro: 640 x 296, 12 fps). Hero sprites carry no tile and no Squad ring.
- A scene film gets one palette per scene and no dithering.
- Motion is deterministic (no randomness) and has a still version for reduced motion.
- No blur, drop-shadow or brightness filters (slow on phones); use a tint or a white overlay for a flash.
- New clips are **texture atlases** (PNG + JSON, trimmed frames, at most 4096 px per side), the target of ADR 0026 and issue #462. No new CSS strips.
- Anything the player reads or presses is UI (HTML and CSS), not part of the picture.

## 4. Show, then build

For a new animation, card face or screen, show the owner a preview (an artifact or a screenshot) and build after the owner picks. Done when the owner chose a variant.

## 5. Look at it

If the change is visible in `apps/web`, run the screenshot tool (`npm run screenshots -w apps/web`, plus the scenario it offers for your screen) at 844 x 390, open the images with the Read tool and compare with the reference: proportions, feet on the tile, alignment, colours, timing. Fix every deviation and shoot again. Done when each state you changed was looked at; name in the pull request the states you could not stage.
