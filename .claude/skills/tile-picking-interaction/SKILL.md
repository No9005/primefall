---
name: tile-picking-interaction
description: Use when converting a mouse/touch position into the correct isometric tile for selection, highlighting, and placement.
license: MIT
---

# Tile Picking & Interaction

## Overview

Picking is screen-to-grid with the camera inverse applied first. This skill turns a pointer position into the tile under it, with highlight and hit-testing that respects camera pan and zoom.

## Process

1. Take the pointer position in screen space.
2. Apply the inverse camera transform.
3. Apply screen-to-grid conversion and round to a tile.
4. Clamp the result to map bounds and check walkability if needed.
5. Draw a highlight on the picked tile.
6. On click, dispatch the tile coordinate to the gameplay handler.
7. Test picking at multiple zoom levels and pan offsets.

```js
const world = screenToWorld(pointer, cam);
const tile = worldToGrid(world, W, H);
```

## Verification

- [ ] The picked tile is correct at any pan and zoom.
- [ ] Hover highlight matches the selected tile.
- [ ] Clicks dispatch the correct grid coordinate.
