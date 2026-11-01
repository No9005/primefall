---
name: isometric-object-sprites
description: Use when generating isolated isometric props with correct scale and transparent background.
license: MIT
---

# Isometric Object Sprites

## Process

1. Confirm art direction is locked.
2. Prompt ONE object per image.
3. Keep the surface phrase short.
4. Use a fixed seed.
5. Clean alpha.
6. Define the ground-anchor.
7. Test 3 objects on a tile.

## Prompt template

```text
single isometric [object], 2:1 isometric view, soft painterly shading,
simple clean composition, isolated on plain flat background, soft contact shadow,
game asset, high quality
```

## Verification

- [ ] Each prop is isolated with transparent background.
- [ ] All props share one scale and style.
- [ ] Each sprite has a ground-anchor.
