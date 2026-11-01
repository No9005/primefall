---
name: tile-picking-interaction
description: Use when converting pointer position into the correct isometric tile.
license: MIT
---

# Tile Picking & Interaction

## Process

1. Take pointer position.
2. Apply inverse camera transform.
3. Apply screen-to-grid and round.
4. Clamp to map bounds.
5. Draw highlight.
6. Dispatch tile coord on click.
7. Test at multiple zoom levels.

```js
const world = screenToWorld(pointer, cam);
const tile = worldToGrid(world, W, H);
```

## Verification

- [ ] Picked tile correct at any pan/zoom.
- [ ] Highlight matches selection.
- [ ] Clicks dispatch correct coord.
