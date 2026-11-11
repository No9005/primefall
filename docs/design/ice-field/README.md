# Snow map: the pixel-art tileset "Polarnacht"

A proposal for the look of a second map, worked out with the product owner in a chat session: an outdoor field in snow and ice under a polar night. An expedition has set up barricades and beacons with orange lights; glowing alien artifacts stand in the snow; a ring gate, half dug out of the ice, stands in the Prime Zone. A rescue capsule has crashed on the field, with a flight recorder to salvage.

The tileset is **modular** like the one of the Reactor Deck (`docs/design/reactor-deck/`): single tiles, no picture of a map. `overview/other-layout.png` is a second layout built from the same files as `overview/field.png`.

**Status: assets and reference only. Nothing in the app uses them, and the map itself does not exist yet.** There is no layout for it in `packages/game-core`, and the secondary objectives it is meant for (fetch and bring, escort) are not in the specs. Both layouts here are placeholders that show the tiles.

## What is here

| Path | Content |
|---|---|
| `apps/web/public/assets/ice-field/polarnacht.png`, `polarnacht.json` | The atlas (512 x 252 px, 121 frames) in the PixiJS sprite sheet format |
| `apps/web/public/assets/ice-field/tileset.json` | Tile size, the variants of each tile, which sprite has a glow, the light, the snow layers |
| `apps/web/public/assets/ice-field/snow-near.png`, `snow-far.png` | Two tiling layers of snowflakes (128 x 128 px each) |
| `apps/web/public/assets/ice-field/aurora.png` | The aurora (256 x 112 px, repeats horizontally) |
| `overview/` | The atlas, the two maps built from it, and a close-up of the capsule |
| `reference/looks.html` | The page on which the look was chosen (four looks of the same placeholder map; "Polarnacht" is look D). German, as written for the product owner |
| `tools/` | `tileset.js` draws and packs the tiles, `assemble.js` builds a map from the atlas, `export.mjs` runs both. The sprite, the packer and the light stage are shared with the Reactor Deck: `docs/design/tools/pixel-atlas.js` |

Geometry, anchors, the three layers of light and the PixiJS code are the same as for the Reactor Deck; read its README for them. All frame names here start with `ice.`.

## The frames

| Frames | Use |
|---|---|
| `snow_0..5`, `camp_floor_0..1`, `prime_floor` | the ground of the field, of a Spawn tile and of the Prime Zone |
| `outside_0..3`, `outside_fade_0..3` | snow beyond the cliffs, dense and thinning out |
| `ice_patch_0..2`, `ice_pool_0..2` | frozen water as decals: a puddle inside one tile, a pool about two tiles wide. They are not bound to the grid; place a pool on any tile |
| `prime_edge_n/e/s/w`, `prime_corner_nw/ne/se/sw`, `prime_ring` | the carved band around the Prime Zone (on the side of the tile that faces it) and the glowing rings of a 3 by 3 zone |
| `relic_floor`, `relic` | fetch and bring: the plate and the floating relic |
| `pad_floor`, `beacon` | fetch and bring: the landing pad to bring it to, and its light mast |
| `track_col`, `track_row`, `sled` | escort: the route along the columns or the rows, and the cargo sled |
| `cliff_0..5`, `cliff_glyph`, `cliff_low_0..1` | cliff blocks of six heights with snow caps and icicles, one with a glowing glyph band, and low snow banks for the edges nearest to the viewer |
| `half_cover_0..1`, `full_cover` | barricades of the expedition, thin plates on the two back edges of the tile |
| `shrub_0..5`, `stele_0..2` | frost plants with glowing blossoms, small alien stelae |
| `gate`, `gate_membrane_0..5`, `generator` | the ring gate for the centre of the Prime Zone, six frames of its flickering membrane (an animation), and the generator wired to it (its cable points towards smaller columns) |
| `capsule`, `capsule_beacon_0..3`, `capsule_steam_0..5`, `capsule_trench` | the crashed rescue capsule, see below |
| `salvage_case`, `debris_0..2` | what is to be salvaged, and wreckage to scatter |
| `flake_0..3` | single snowflakes, for a particle system |
| `light` | the light pool for the light map |

## The rescue capsule

The capsule came in along the columns and lies with its nose in the snow towards larger columns: a hull with an orange band and a porthole, the hatch open with the cabin light on, the parachute frozen behind the tail, snow thrown up around the nose.

- `capsule` stands on one tile and hangs over its neighbours; keep the eight tiles around it free of Cover.
- `capsule_trench` is the furrow it ploughed. Put it on the capsule's tile as a floor decal; it reaches three tiles towards smaller columns.
- `capsule_beacon_0..3` is the blinking light on its antenna (four frames, about four per second), `capsule_steam_0..5` the steam over the hot nose (six frames, about eight per second). Both are placed on the capsule's tile; the beacon belongs to the glow layer.
- `salvage_case` is the flight recorder in its case, the thing to carry away. In the overview it stands on the tile in front of the hatch.

## Falling snow

Two ways, both in `tileset.json` under `snow`:

- **Tiling layers** (the simple one): a `TilingSprite` over the whole view per layer, with `snow-far.png` behind and `snow-near.png` in front, each scrolled every frame by its `speed` (px per second at tile scale 1: near 50 across and 40 down, far 30 and 24) and drawn with its `alpha`. Both images repeat without a seam.
- **Particles**: the frames `flake_0..3` for a particle container, if the snow should react to something (wind, an explosion).

```ts
const near = new TilingSprite({ texture: await Assets.load("assets/ice-field/snow-near.png"), width: view.width, height: view.height });
app.ticker.add(t => { near.tilePosition.x += 50 * t.deltaMS / 1000; near.tilePosition.y += 40 * t.deltaMS / 1000; });
```

The aurora is a `TilingSprite` of `aurora.png` behind the map, drifting slowly sideways. It is a light of its own: draw it unlit.

## Regenerating

```
node docs/design/ice-field/tools/export.mjs
```

## Open points

- **The map and its objectives are not specified.** Fetch and bring, escort, and salvaging from the capsule are ideas of the session; `GLOSSARY.md`, the specs and the rules know none of them. The names used here (relic, landing pad, sled, capsule, salvage case) are working names.
- **Glow colours.** Alien things glow green and cold, expedition things orange. Green is close to the teal of the own Squad's ring; check it on the board.
- **Tile size, view angles, quality**: as for the Reactor Deck tileset.
