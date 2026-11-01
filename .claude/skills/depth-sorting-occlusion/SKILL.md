---
name: depth-sorting-occlusion
description: Use when sprites draw in the wrong order in an isometric scene.
license: MIT
---

# Depth Sorting & Occlusion

## Process

1. Depth key = row + col of anchor tile.
2. Sort ascending before drawing.
3. Break ties with secondary key.
4. Multi-tile objects sort by front-most tile.
5. Re-sort when objects move.

```js
objects.sort((a, b) => (a.row + a.col) - (b.row + b.col));
```

## Verification

- [ ] Walking around objects sorts correctly.
- [ ] Multi-tile objects occlude properly.
- [ ] Sorting updates on movement.
