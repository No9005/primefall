# Seamless Isometric Terrain

## What this skill does

This skill produces **isometric ground tiles** that snap together into a clean map with **no seams, no gaps, and no color chaos**. The single most important idea: **a map looks seamless when every tile shares the exact same diamond shape and thickness.**

## When to use this skill

- The user wants to make terrain / ground tiles for an isometric game or map.
- Tiles don't line up: visible edges, seams, gaps, or mismatched sizes/angles.
- Tiles have mixed/irregular colors, stray edges, or random props.

## The golden rule

> **Fix the seed. Keep the prompt short. Same shape for every tile.**

## Quick reference

| Setting | Value |
|---|---|
| Resolution | 1024 x 1024 |
| Seed | Fixed for the whole tile set |
| Export | Transparent PNG |

## Positive template

```text
single isometric full [SURFACE] block tile, 2:1 isometric view,
thick solid [COLOR] soil base underneath, soft painterly shading,
simple clean composition, isolated on plain flat background,
game asset, high quality
```

## Verification

- [ ] Each tile fills its full 2:1 isometric footprint.
- [ ] Placed in a grid, tiles connect without visible seams or gaps.
- [ ] The seed was fixed across the whole set.
- [ ] No stray props or objects are baked into ground tiles.
- [ ] Background removed to clean transparent alpha.
