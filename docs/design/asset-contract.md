# Asset Contract

How art reaches the game. A final asset replaces an older one by using the **same file name, frame size and pivot**; nothing in the game code may depend on which version of an asset it loads.

## Conventions

- Format: transparent PNG, 32-bit alpha, no baked background.
- Projection: 2:1 isometric. One tile diamond of the board's world is **128 x 64 px** (`gridToWorld`); the tileset of the Notstrom Map draws 32 x 16 px tiles scaled by 4.
- Light comes from the top left; contact shadows are subtle and part of the sprite.
- Heroes face right; the other direction is a mirror (`scale.x = -1`). There is one view only.
- Squad colour is not baked into sprites. The renderer draws a ring under each Hero (own and allied Squad teal, enemy Squad red).
- Hidden, Marked, Slow and Shield are drawn by the game, not baked into the sprites.
- Art that only a tool or a test reads belongs in `archive/` (`archive/README.md`), not in `apps/web/public/assets`.

## Terrain

The Notstrom Map is drawn from a tileset. There is no other look: the Original style (shapes computed from the grid, chosen by a setting) was removed.

The game still draws some things itself, with shapes computed from the grid and the view angle (`apps/web/src/terrain.ts`, `apps/web/src/board-drawing.ts`, colours in `apps/web/src/terrain-style.ts`): Placed Cover, wrecks, destroyed Cover outlines, the Prime Zone tint, the Scout Drone areas and the Fog.

The Notstrom Map is built from the tileset "Notstrom": `public/assets/notstrom-map/notstrom.png` and `notstrom.json` (the atlas, PixiJS sprite sheet format) and `tileset.json` (variants, glows, wall texts, light). Its tiles are 32 x 16 px, one fixed view; the board's world is four times that, so a sprite of the tileset is scaled by 4 and anchored on `gridToWorld` of its tile (`PIXEL_SCALE` in `apps/web/src/pixel-terrain.ts`) and Heroes and VFX keep their size. Which frame goes on which tile is `pixelLayout` in that file, after `docs/design/notstrom-map/tools/assemble.js`. The floor, its decals and the light map are baked into one texture, again when the map's Cover changes; Walls, Cover, plants and the core are sprites sorted with the Heroes by depth. What the tileset has no frame for stays drawn by the game in both styles: Cover a Hero placed, destroyed Cover, the wreck of an Exhausted Hero, the ownership look of the Prime Zone, the Scout Drone area and the Fog of War.

## Heroes: sprite sheets

The Heroes are the sprite sheets of `apps/web/public/assets/heroes/<class>/` (format and clips: `docs/design/heroes/README.md`; they are loaded by `apps/web/src/heroes.ts`, not through the manifest). The game draws no shape rig any more.

- **Frame** 136 x 104 px, feet at (58, 86), 20 frames per second, facing right and mirrored (`scale.x = -1`) for the left. Scaled by the whole number `PIXEL_SCALE` (2) with nearest-neighbour filtering, so a Hero is about 90 px tall at game size.
- **Which clip is which sheet** is `pixelSheetOf` in `heroes.ts`; a test checks that every game clip of every class has a sheet. Fallbacks: a clip a class lacks plays its basic attack (a Long Shot of a Bruiser is `slam`), and the Controller and the Assassin, which have no clip for a hit the Shield absorbs, stand in `idle` (the Shield mark of the game carries the hit). `inCover` and `inCoverFull` are the loop of `half` and `full` after the taking. Which clip plays when, and for how long, stays with `playback.ts` and `hero-clips.ts`: the sheet is played at the progress of the rig clip it stands for.
- **Layers.** On the board only the `figure` layer is drawn: the game draws the Shield bubble, the damage numbers, the Wait mark, the Cover, the Scout Drone and the shots itself (`effects-layer.ts`, `board-drawing.ts`). The Hero Select draws all three layers (muzzle flash, tracer and the Hidden label are baked in there).
- **From `clips.json`:** `ringRedFrames` flashes the Squad ring red, `ringAlpha` fades the Squad ring, `shake` offsets the sprite. The Squad colour is the ring the renderer draws; the sprites carry no team colour. The Hidden look of the Assassin is the figure fading to the translucent look it keeps.

## Effects

Muzzle flashes, projectiles, rings, numbers and the Scout Drone are drawn by the game from shapes (`apps/web/src/effects-layer.ts`, timing in `docs/design/animation/README.md`).

## Rendering notes (from the 45 x 25 Grid)

- A full Grid is 4480 px wide at 128 px tiles ((45 + 25) x 64). On a phone the board is therefore scaled down; ADR 0021 defines the camera behaviour.
- Depth sorting by the rotated depth of the anchor tile (`row + column` at the 45 degree view; skill `depth-sorting-occlusion`).
- Tile centre for grid cell `(col, row)`: `x = (col - row) * 64`, `y = (col + row) * 32` (skill `isometric-grid-math`).
