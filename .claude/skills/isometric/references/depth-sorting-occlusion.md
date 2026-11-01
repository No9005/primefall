# Depth Sorting & Occlusion

## Overview

In isometric rendering, draw order is depth. Sort drawables by the row and column of their anchor tile.

## Process

1. Give every drawable a depth key based on its anchor tile: depth = row + col.
2. Sort objects by depth ascending before drawing.
3. Break ties with a secondary key, such as y position or creation order.
4. For multi-tile objects, sort by the front-most occupied tile.
5. Re-sort when objects move.

```js
objects.sort((a, b) => (a.row + a.col) - (b.row + b.col));
```

## Verification

- [ ] Walking around all sides of an object sorts correctly.
- [ ] Multi-tile and tall objects occlude properly.
- [ ] Sorting updates when objects move.
