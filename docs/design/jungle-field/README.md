# Jungle map: the pixel-art tileset "Fiebermoor" (working name)

The look of a third map, a dirty jungle swamp: small pools, mammoth trees with hanging lianas, reeds, a mossy ruin with an artefact, fireflies and frogs that pop out of the grass and hide again. It was proposed in the artifact "Swamp Map Proposals" (2026-11-14, `reference/looks.html`, a copy of the page; the German texts are written for the product owner) and is cut here into single sprites, as for the snow map (`docs/design/ice-field/`) and the Notstrom Map (`docs/design/notstrom-map/`).

**Status: assets and reference only. Nothing in the app uses them, and the map itself does not exist yet.** There is no layout for it in `packages/game-core`. The four layouts of the proposal (Hollow of the Mammoths, Black Channel, Root Maze, Canopy Village) are pictures in the artifact, not data. `overview/hollow.png` and `overview/village.png` are layouts A and D built from the atlas as a check.

**The name is open.** "Fiebermoor" (fever bog) is a working name in one place: `TILESET` in `tools/tileset.js` (it names the files and the frames' prefix `jungle.` stays). The folder and the asset folder are called `jungle-field` like `ice-field`. A map has its own name, like Notstrom (`docs/design/world-and-style.md`).

## What is here

| Path | Content |
|---|---|
| `apps/web/public/assets/jungle-field/fiebermoor.png`, `fiebermoor.json` | The atlas (512 x 352 px, 66 frames) in the PixiJS sprite sheet format |
| `apps/web/public/assets/jungle-field/tileset.json` | Tile size, the variants of each tile, which sprite has a glow, the light, the mist, the height of the platforms |
| `apps/web/public/assets/jungle-field/mist.png` | A tiling layer of mist (256 x 256 px, repeats in both directions) |
| `overview/` | The atlas (2 x), and layouts A and D built from it |
| `reference/looks.html` | The artifact page with the probe and the four layouts |
| `tools/` | `tileset.js` draws and packs the sprites, `assemble.js` builds a map from the atlas (with the two layouts), `export.mjs` runs both. The sprite, the packer and the light stage are shared with the other tilesets: `docs/design/tools/pixel-atlas.js` |

Geometry, anchors, the layers of light and the PixiJS code are the same as for the Notstrom Map; read its README. Tiles are 32 x 16 px, every sprite has its anchor on the centre of the tile it stands on, all frame names start with `jungle.`. `tileset.json` lists every sprite with its layer (`floor`, `decal`, `object`, `top`, `glow`).

## The frames

| Frames | Use |
|---|---|
| `mud_0..3`, `grass_0..3` | the ground |
| `water_0..3`, `water_bank_n/e/s/w`, `ford_0..1` | shallow pools; the mud rim goes on a water tile on the side that faces land; a ford is stepping stones in dark water |
| `prime_floor`, `prime_edge_n/e/s/w` | the stone floor of the Prime Zone; the amber band goes on the Prime Zone tile on the side that faces outwards |
| `outpost_floor_0..1`, `drop_floor` | the Outposts (stone) and the Drop Points (metal with a teal rim) |
| `reeds_0..3`, `tuft_0..2` | reeds on a bank (a Half Cover candidate) and loose grass |
| `root_wall_0..3` | a low wall of roots (a Full Cover candidate) |
| `tree_trunk_0..1`, `tree_canopy_0..1` | a mammoth tree: the trunk stands on the middle tile of a 3 by 3 group (the layer `object`), the crown and lianas go over everything (the layer `top`; both frames are anchored at the foot of the trunk). The trunk blocks like a wall |
| `artefact`, `pillar_0..2`, `lamp` | the find in the middle of the Prime Zone, the ruin pillars at its corners, the lamps of the Outposts. The artefact and the lamp glow |
| `platform_top`, `platform_face_l/r`, `platform_post_0..2`, `ladder`, `basket` | the canopy village (layout D): a platform 44 px above the floor, its plank faces (`l` towards the rows, `r` towards the columns) where there is no neighbouring platform, posts at the free corners, a ladder and a lift basket |
| `frog_0..4` | a frog rising out of the grass and sinking back (five frames, about three per second) |
| `firefly_0..3` | a firefly's glow (glow layer only), four brightnesses; move a few of them slowly on sine paths and let them fade |
| `light` | the light pool for the light map |

## Light

The colours are final: the ambient is neutral (`#ffffff` in the light map), so the picture is not darker than the sprites. The lights in `tileset.json` (`artefact`, `centre`, `lamp`, `firefly`) only show if a game picks a darker ambient for a night version. Glowing pixels (artefact, lamp, fireflies) are drawn again unlit on the glow layer.

## Regenerating

```
node docs/design/jungle-field/tools/export.mjs
```

It needs a Chromium that Playwright can start (set `PLAYWRIGHT_CHROMIUM_PATH` to use another).

## Open points

- **The name** (see above).
- **No rules.** Water (look only, Slow, Hidden, or blocking), reeds (Half Cover or Hidden like tall grass), the canopy (fades where a Hero stands under it) and the high ground of layout D are open; high ground is not in the rules (ADR 0020). The tree trunk and the root walls are meant as a wall and as Full Cover.
- **Trees are big.** A trunk is about 124 px high on a 16 px tile row, taller than the Notstrom Map's walls; check it against the board scale and the Heroes (about 45 px).
- **Fit with the story.** The swamp has no tie to the world notes yet (`docs/design/world/README.md`).
- **Not drawn from the artifact:** the diorama probe's soil block, and the moving fireflies and frogs as animations in code: here they are frames.
