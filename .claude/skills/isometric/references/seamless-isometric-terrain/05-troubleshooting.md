# 05 — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Visible seams or edges | Seed not fixed | Lock one fixed seed and regenerate the set |
| Gaps between tiles | Tile is not a clean 2:1 diamond | Raise isometric_tilemap_xl to about 0.8 |
| Stray grass on non-grass tiles | Grassy rim wording | Add grass and grassy edges to the negative prompt |
| Mixed or blotchy colors | Prompt too long | Shorten the surface phrase |
| Random props on tiles | Style term pulling in clutter | Add props, house, building, plants to the negative prompt |
| Halo or white fringe | Background not flat enough | Keep white_background_sdxl at 0.7 and use a plain flat background |
| Tile thickness varies | Base phrase omitted | Keep the soil-base phrase identical on every tile |
| Water looks like a pond | Pond shape wording | Use calm flat blue water surface on top |
| Result looks like a gemstone | Model latching onto diamond | Keep diamond gemstone, crystal, jewel, gem in the negative prompt |
| Tiles look photographic | Missing style guard | Keep realistic photo and 3d render in the negative prompt |
| Top-down instead of isometric | Iso LoRA too weak | Raise isometric_tilemap_xl strength |
| Inconsistent batch | Batch greater than 1 | Use batch 1 with a fixed seed |

## Recovery

If in doubt, regenerate the whole set from the known-good grass tile: same seed, same settings, only the surface phrase changes.
