# 06 — Tile Set Spec

## Core set

| Tile | Surface phrase | Base color |
|---|---|---|
| Grass | full grass land | green |
| Water | full water, calm flat blue water surface on top | blue |
| Dirt | full dirt ground | brown |
| Road | full dirt path, light tan packed dirt path surface on top | brown |
| Field | full plowed farm field, even rows of tilled soil furrows on top | brown |

All tiles use the same fixed seed and base prompt; only the surface phrase and per-tile negative change.

## Bonus materials

| Tile | Surface phrase | Base color |
|---|---|---|
| Sand | full sand ground | tan |
| Stone | full stone ground, flat rocky surface on top | gray |
| Snow | full snow ground, smooth white snow surface on top | white |
| Forest floor | full mossy forest floor | dark green |

Trees, mountains, rocks, and houses are objects, not tiles. Generate them as separate transparent sprites and let the engine depth-sort them above the terrain.

## Naming

```text
tile_grass_01.png
tile_water_01.png
tile_dirt_01.png
tile_road_01.png
tile_field_01.png
tile_grass_spring_01.png
```

## QA checklist

- [ ] All tiles use the same fixed seed.
- [ ] Same diamond angle and base thickness across the set.
- [ ] No stray rims, props, or mixed colors.
- [ ] All exported as transparent PNG.
- [ ] Test grid has no seams or gaps.
- [ ] File naming is consistent.
