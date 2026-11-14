# Pixel-art Heroes: sprite sheets for PixiJS

A proposal for the final look of the three Heroes, worked out with the product owner in a chat session: the designs, their animation clips and the poses of the Hero Select screen, rendered into sprite sheets that PixiJS v8 loads directly.

**Status: assets and reference only. Nothing in the app uses them yet.** The game still draws the Heroes with the shape rig of `docs/design/animation/`. Wiring the sheets into `apps/web` needs a ticket; the open points at the end of this file belong in it.

## What is here

| Path | Content |
|---|---|
| `apps/web/public/assets/pixel-heroes/<class>/` | The sheets, one per clip: `<clip>.png` and `<clip>.json` (PixiJS sprite sheet format), plus `clips.json` (the list of clips with their timing), `figure.png` (the standing figure of the design sheet) `portrait.png` (36 x 36; also the close-up of the BIO sheet of the Hero Select, shown at 6 x) |
| `overview/<class>.png` | One still per clip, with tile and Squad ring, to look at |
| `reference/*.html` | The live pages. Open them in a browser to see the motion: the designs to choose from (`concepts-*`), the clips (`animation-*`) and the Hero Select screen (`hero-select`). Their texts are German, as written for the product owner |
| `tools/` | The source of the sheets: the rigs (`rigs/<class>.js`) and the export (`export.mjs`) |

`<class>` is `bruiser`, `controller` or `assassin`. The chosen designs had working names in the session: Bulkhead (Bruiser), Tinker (Controller) and Revenant (Assassin). These names are not in `GLOSSARY.md`.

## The designs

- **Bruiser**: a heavy exo suit with broad, layered shoulder plates in dark blue, a sawn-off shotgun, no helmet, short white hair, a scar from top to bottom over the right eye, a cigar.
- **Controller**: a woman whose only armour is a chest plate with a glowing reactor core in its middle; her right arm is a robot arm, her clothes are torn; a third, augmented gripper arm rises from her back (where the shape rig has the antenna). It always stays behind her and never crosses her face.
- **Assassin**: a full exoskeleton with a closed helmet, so no gender can be read; bone-white plates, a fin from the forehead over the helmet, a high armoured collar, backward-bent legs with a spur, a violet sash at the belt, a dark, frayed cape with a hood. The hood lies in the neck and is pulled up in two clips (`hidden`, `long`). The cape never covers the face.

## Format

- Every frame is **136 x 104 px** with the **centre of the feet at (58, 86)**. The frames are trimmed in the sheet; the JSON carries `spriteSourceSize`, `sourceSize` and an `anchor`, so a sprite made from any frame has its origin at the feet.
- The figures **face right**. An enemy, or a Hero facing left, is the same sprite mirrored (`scale.x = -1`), as with the shape rig.
- **20 frames per second** (50 ms per frame). A loop whose length is not a multiple of 50 ms is sampled evenly; its `frameMs` in `clips.json` says how long a frame lasts (Bruiser `walk` 49.231, Controller `walk` 48.333).
- Each clip has up to three layers, each its own animation in the sheet, all with the same number of frames:
  - `<class>.<clip>.figure`: the Hero alone, with a dark outline.
  - `<class>.<clip>.fx_back`: effects behind the Hero (dust, the back of the Shield bubble, afterimages, the tall wall of Full Cover).
  - `<class>.<clip>.fx_front`: effects in front of the Hero (muzzle flash, projectiles, numbers, the low wall of Half Cover, the Scout Drone, the slab left after Exhaustion).
  A layer that is empty in every frame is left out; `layers` in `clips.json` lists the ones a clip has.
- The tile and the Squad ring are **not** in the sheets. Where a clip changes the ring, `clips.json` says so: `ringRedFrames` (the frames in which the ring flashes red on a hit) and `ringAlpha` (per frame; the Hidden look and the fading after Exhaustion).
- `shake` in `clips.json` is a per-frame offset `[x, y]` in px for the whole view of that Hero (shots and impacts). It is not baked into the frames.
- Repeated frames are stored once; an animation may name the same frame several times. A fully transparent frame is `<class>.<clip>.empty`.

Loading a clip in PixiJS v8:

```ts
import { AnimatedSprite, Assets, Container } from "pixi.js";

const sheet = await Assets.load("assets/pixel-heroes/bruiser/slam.json");
const hero = new Container();
for (const layer of ["fx_back", "figure", "fx_front"]) {
  const frames = sheet.animations[`bruiser.slam.${layer}`];
  if (!frames) continue;
  const sprite = new AnimatedSprite(frames);
  sprite.animationSpeed = 20 / 60; // 20 frames per second on a 60 Hz ticker
  sprite.loop = false;
  sprite.play();
  hero.addChild(sprite);
}
```

Set the texture source to nearest-neighbour scaling (`sheet.textureSource.scaleMode = "nearest"`) and scale by whole numbers only, or the pixels blur.

## The clips

Durations and beats are the ones of `docs/design/animation/README.md`; only the motion is new and deliberately exaggerated. A clip that plays once ends on its rest pose (one extra frame at the end).

| Clip | Class | Length | Played for |
|---|---|---|---|
| `idle` | all | loop 2.0 s | a Hero that does nothing |
| `walk` | all | loop 0.64 s (Controller 0.58, Assassin 0.5) | `Step`; two steps per loop |
| `wait` | all | loop 3.2 s | `Wait` |
| `slam` | Bruiser | once 2.4 s, fire at 620 ms | Slam Shot, Concussion Round |
| `pulse` | Controller | once 2.4 s, fire at 620 ms | Pulse Bolt |
| `tag` | Controller | once 2.8 s, fire at 730 ms | Tag Round |
| `slow` | Controller | once 2.6 s, fire at 680 ms | Shock Pulse, Slow applied |
| `drone` | Controller | once 3.6 s, release at 800 ms | Scout Drone |
| `aegis` | Controller | once 3.2 s, beam at 900 ms | Aegis Protocol |
| `deploy` | Controller | once 3.4 s, impact at 850 ms | Deploy Cover, Fortify |
| `precision` | Assassin | once 2.2 s, fire at 570 ms | Precision Shot and its family |
| `long` | Assassin | once 3.6 s, fire at 1650 ms | Long Shot |
| `hidden` | Assassin | once 4.2 s, Hidden from 1260 ms | `HiddenGained` |
| `block` | all | once 3.2 s, bubble at 900 ms | `ShieldGained` from a Block |
| `hit` | all | once 2.6 s, impact at 310 ms | the target of an attack with Deck Damage |
| `shield` | Bruiser | once 2.6 s, impact at 310 ms | a hit the Shield absorbs |
| `half`, `full` | all | loop 4.4 s and 4.8 s | taking and holding Half or Full Cover |
| `exhausted` | all | once 5.4 s, hit at 650 ms | `Exhausted` |
| `select_idle` | all | loop | Hero Select, not selected |
| `select_ready` | all | once | Hero Select, on select |
| `select_hold` | all | loop | Hero Select, selected, after `select_ready` |

## Regenerating the sheets

```
node docs/design/pixel-heroes/tools/export.mjs
```

The export starts a Chromium through Playwright (the one of the e2e tests), runs the three rigs in a page and writes the sheets, `clips.json`, the figures and the overview images. The rigs in `tools/rigs/` are the source; the pages in `reference/` are copies for looking at and are not read by the export, except the three `concepts-*` pages, from which the standing figure and the portrait are taken.

## Open points for the ticket that wires this in

- **Asset contract.** `docs/design/asset-contract.md` describes single pose images on a 128 x 192 canvas, facing south-east, loaded through `assets/manifest.json`. These sheets are animated clips on a 136 x 104 frame, facing right, and are not in the manifest. The contract has to be changed or these assets fitted to it.
- **Size.** The figures are about 45 px tall (Controller and Bruiser) to 50 px (Assassin with fin); the shape rig is about 36 px tall on the 46 x 24 tile. Pixel art must be scaled by whole numbers, so either the board scale or the art has to move.
- **View angles.** There is one view only. How pre-drawn pixel art works for eight view angles is the open question of ADR 0021.
- **Baked effects.** The `fx` layers hold effects that the game already draws itself (Shield bubble, damage numbers, the Wait mark, Cover walls, the Scout Drone, projectiles). Use the `figure` layer alone where the game keeps its own effect.
- **Differences to the reference**, decided in the session: the Bruiser carries the shotgun in one hand; the Controller's Aegis beam comes from the reactor core in her chest, her core turns violet for Shock Pulse, and the third arm throws the Scout Drone and slams the Cover deployer; the Assassin's shimmer is violet. Controller and Assassin have no clip for a hit the Shield absorbs.
- **Quality.** The parts are rotated per frame, so edges show steps, and the Assassin's cape is one stiff part. These are sketches to judge the direction; final art would redraw the key frames by hand.
