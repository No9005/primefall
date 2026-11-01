---
name: isometric
description: Isometric and 2.5D art and rendering guidance (art direction, terrain tiles, sprites, grid math, depth sorting, tile picking). Use for any isometric asset or projection task.
license: MIT
---

# Isometric and 2.5D

Lock the art direction first: every asset depends on one agreed style (angle, light, palette, scale). Then read only the reference file that matches the task, from this skill's `references/` directory. Order: art direction, asset generation, asset processing, engine and rendering.

| File | Use when |
|---|---|
| `references/depth-sorting-occlusion.md` | Use when sprites draw in the wrong order so characters appear in front of objects they should be behind in an isometric scene. |
| `references/isometric-art-direction.md` | Use when starting an isometric project to lock ONE consistent art style (angle, light, palette, scale) before generating any asset. |
| `references/isometric-character-sprites.md` | Use when generating isometric characters in consistent 8 directions with a fixed feet-anchor for movement and depth sorting. |
| `references/isometric-grid-math.md` | Use when converting between grid coordinates and screen pixels in a 2:1 isometric projection, including screen-to-grid for mouse picking. |
| `references/isometric-object-sprites.md` | Use when generating isolated isometric props (trees, rocks, bushes, stumps) that drop cleanly onto tiles with correct scale and a transparent background. |
| `references/seamless-isometric-terrain.md` | Generate seamless, tileable isometric terrain tiles with consistent diamond shape, fixed seed, and transparent PNG export. |
| `references/spritesheet-atlas-packing.md` | Use when packing many isometric sprites into a texture atlas with a JSON map so the engine draws from one image with correct frame coordinates. |
| `references/tile-picking-interaction.md` | Use when converting a mouse/touch position into the correct isometric tile for selection, highlighting, and placement. |
| `references/transparent-cutout-cleanup.md` | Use when removing backgrounds from generated sprites to get clean alpha edges with no halo, fringe, or leftover background pixels. |
