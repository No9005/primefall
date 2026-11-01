---
name: seamless-isometric-terrain
description: Generate seamless, tileable isometric terrain tiles with consistent diamond shape, fixed seed, and transparent PNG export.
license: MIT
---

# Seamless Isometric Terrain

## Golden rule

> Fix the seed. Keep the prompt short. Same shape for every tile.

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

## References

- `references/01-overview.md`
- `references/02-production-guide.md`
- `references/03-prompts.md`
- `references/04-rules.md`
- `references/05-troubleshooting.md`
- `references/06-tileset-spec.md`

## Verification

- [ ] Each tile fills its full 2:1 footprint.
- [ ] Tiles connect without seams or gaps.
- [ ] Seed was fixed across the set.
- [ ] Background removed to clean transparent alpha.
