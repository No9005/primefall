# Reactor Deck: the pixel-art tileset "Notstrom"

A proposal for the final look of the map, worked out with the product owner in a chat session: a crashed space glider that lies almost in the dark. Both Squads enter through breaches in the hull, guide lights in the floor lead to the core, the core is a plasma core that hangs from the ceiling in a claw over the Prime Zone, worn stencil texts stand on the walls, plants grow in at the breaches.

The tileset is **modular**: it holds single tiles, not a picture of the map. Any layout of walls, Cover, zones and Spawns can be built from it. `overview/other-layout.png` is a layout that does not exist in the game, built from the same files as `overview/reactor-deck.png`.

**Status: the app builds the Reactor Deck from these tiles** (`apps/web/src/pixel-terrain.ts`). The Original look (shapes) was removed.

## What is here

| Path | Content |
|---|---|
| `apps/web/public/assets/reactor-deck/notstrom.png`, `notstrom.json` | The atlas (512 x 425 px, 97 frames) in the PixiJS sprite sheet format |
| `apps/web/public/assets/reactor-deck/tileset.json` | What the sheet format cannot say: tile size, the variants of each tile, which sprite has a glow, the texts, the light |
| `overview/atlas.png` | The atlas, twice its size |
| `overview/reactor-deck.png`, `overview/other-layout.png` | Two maps built from the atlas by `tools/assemble.js`, twice their size |
| `reference/looks.html` | The page on which the look was chosen (five looks of the same map; "Notstrom" is look D). German, as written for the product owner |
| `tools/` | `tileset.js` draws and packs the tiles, `assemble.js` builds a map from the atlas, `export.mjs` runs both. The sprite, the packer and the light stage are shared with the snow map (`docs/design/ice-field/`): `docs/design/tools/pixel-atlas.js` |

## Geometry

- 2:1 isometric. A tile is a **32 x 16 px** diamond. The centre of tile `(col, row)` is at `x = (col - row) * 16`, `y = (col + row) * 8`.
- **Every sprite has its anchor on the centre of the tile it stands on**, whatever its size: a floor tile, a wall block (24 px high), a wall text that spans seven tiles, the claw that reaches 250 px up. Place a sprite at the tile centre and it sits right.
- Walls are whole blocks with their top and the two faces towards the viewer. Drawn back to front (ascending `col + row`), neighbours hide the faces that should not be seen, so one block fits every wall shape.
- Half Cover (10 px high) and Full Cover (22 px high) are thin plates on the two back edges of the tile, as the shield panels of the app are today; the tile stays free for a Hero.

## The frames

All frame names start with `deck.`. A name with a number has variants; the sheet lists them as an animation of the same name without the number (`sheet.animations["deck.floor_plate"]` is the array of the four plates), and `tileset.json` lists them under `groups`.

| Frames | Use |
|---|---|
| `floor_plate_0..3`, `floor_rust_0..1`, `floor_grate_0..1` | floor; pick a variant per tile from a hash of its position |
| `prime_floor`, `outpost_floor`, `spawn_floor_0..2` | the floor of the Prime Zone, of an Outpost and of a Spawn tile |
| `ground_0..3`, `ground_fade_0..3` | the ground outside a hull breach, dense and thinning out |
| `guide_col`, `guide_row` (+ `_dead`) | guide lights along a row of tiles in the direction of the columns or of the rows; `_dead` is the same strip switched off |
| `hazard_edge_n/e/s/w`, `hazard_corner_nw/ne/se/sw` | the warning band around a marked zone, on the side of the tile that faces the zone (`n` = towards smaller rows, `w` = towards smaller columns); a corner for a tile that touches the zone only diagonally |
| `outpost_corner_nw/ne/se/sw` | the brackets on the corner tiles of an Outpost |
| `prime_ring` | the glowing ring of a 3 by 3 Prime Zone, placed on its centre tile; leave it out for another size |
| `wall_0..3`, `wall_lamp`, `wall_cut_0..1`, `wall_broken_0..1` | wall blocks: plain, with an emergency lamp, cut low (for the walls nearest to the viewer, so they do not hide the deck), broken (the ends of a hull breach) |
| `rubble_0..2`, `fern_0..5` | debris in a breach, plants |
| `half_cover_0..1`, `full_cover` | Cover |
| `text_south_<id>`, `text_east_<id>` | stencil texts for a wall face. `south` runs along a row of wall blocks, starting on the tile it is placed on, towards larger columns; `east` runs along a column of wall blocks, starting on the tile it is placed on, towards smaller rows. `tileset.json` gives the wording and the number of tiles each text needs. Ids: `reactor_right`, `reactor_left`, `hangar_06`, `deck_c`, `cargo_02`, `coolant_2`, `caution_plasma`, `airlock`, `bay_03` |
| `core_claw_back`, `core_claw_front`, `core_orb`, `core_beam`, `core_pulse_0..7` | the core, placed on the centre tile of the Prime Zone: the claw behind the orb, the orb, the claw in front of it, the beam to the floor, and eight frames of a breathing halo (an animation) |
| `light` | one white light pool, 96 px radius, for the light map |
| `<name>_glow` | the glowing part of a sprite (`wall_lamp_glow`, `guide_col_glow`, `half_cover_0_glow` ...); `tileset.json` names it under `sprites.<name>.glow` |

## Light

The look lives from its light, and the light is not baked into the tiles: a baked tile could not be used in another place. The tiles are stored brighter than they are seen, and three layers make the picture:

1. **The map**: floors, decals, then everything that stands, back to front.
2. **The light map**, multiplied over the map: a rectangle in the ambient colour, and on it every light as the `light` sprite, tinted, scaled and with additive blending. `tileset.json` gives the ambient colour and, for the four kinds of light (`core`, `breach`, `lamp`, `cover`), the tint, the alpha and the scale. Where a light stands: the core light on the centre of the Prime Zone, a breach light on the Spawn tiles, a lamp light on the open tile in front of a `wall_lamp`, a cover light on a Cover tile.
3. **The glow**, added on top: the `_glow` sprites and the core. So that a lamp behind a wall does not shine through it, draw the scene of layer 1 a second time with every sprite tinted black except the glow sprites, and add that picture.

In PixiJS v8, with nearest-neighbour scaling:

```ts
import { Assets, Container, Graphics, RenderTexture, Sprite } from "pixi.js";

const sheet = await Assets.load("assets/reactor-deck/notstrom.json");
sheet.textureSource.scaleMode = "nearest";
const tileset = await (await fetch("assets/reactor-deck/tileset.json")).json();
const centre = (col: number, row: number) => ({ x: (col - row) * 16, y: (col + row) * 8 });

const map = new Container(); // floors first, then walls, Cover and plants sorted by col + row
const wall = new Sprite(sheet.textures["deck.wall_0"]); // the anchor comes from the sheet
wall.position.copyFrom(centre(4, 2));
map.addChild(wall);

const lights = new Container();
lights.addChild(new Graphics().rect(-2000, -2000, 4000, 4000).fill(tileset.lighting.ambient));
const lamp = new Sprite(sheet.textures["deck.light"]);
const kind = tileset.lighting.lights.lamp;
lamp.tint = kind.color; lamp.alpha = kind.alpha; lamp.scale.set(kind.scale); lamp.blendMode = "add";
lamp.position.copyFrom(centre(4, 3));
lights.addChild(lamp);

// render `lights` into a RenderTexture of the size of the view and lay it over the map:
const lightMap = new Sprite(RenderTexture.create({ width: 1024, height: 768 }));
lightMap.blendMode = "multiply";
```

`tools/assemble.js` does the same on a 2D canvas (with `stage()` of `docs/design/tools/pixel-atlas.js`) and is the reference for the rules (which floor where, when a wall is cut low, where the warning band goes).

## Regenerating

```
node docs/design/reactor-deck/tools/export.mjs
```

It starts a Chromium through Playwright, draws and packs the tiles, writes the three asset files and builds the two maps in `overview/` from those files alone.

## Open points for the ticket that wires this in

- **Terrain is drawn, not loaded.** `docs/design/asset-contract.md` says terrain has no sprites and is drawn from the grid and a view angle; `docs/design/role-visuals/` fixes the look of Cover. This tileset replaces both for the final look, so the contract and the Cover decisions have to change with it.
- **Tile size.** The tiles are 32 x 16 px; the board uses a 46 x 24 diamond. Pixel art must be scaled by whole numbers. The Heroes of `docs/design/pixel-heroes/` are drawn for the same scale as these tiles.
- **View angles.** The tiles are drawn for one view. How pre-drawn pixel art works for eight view angles is the open question of ADR 0021.
- **Hull breach** is not a term of `GLOSSARY.md`; here it only names where the Spawn tiles meet the outer wall. The story (two teams after the resources of a crashed glider) is not in the specs either.
- **Fonts.** The stencil texts are rendered with the bold sans-serif font of the machine that runs the export; another machine may draw slightly different letters. A new text needs a new sprite (`TEXTS` in `tools/tileset.js`).
- **Quality.** The tiles are generated by code. They are meant to settle the direction and the structure of the atlas; final art can replace single frames under the same names.
