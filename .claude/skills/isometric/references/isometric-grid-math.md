# Isometric Grid Math

## Overview

Every isometric bug often traces back to the coordinate transform. Use tested grid-to-screen and screen-to-grid formulas for a 2:1 projection.

## Formulas

```js
const screenX = (col - row) * (W / 2);
const screenY = (col + row) * (H / 2);

const col = ((screenX / (W / 2)) + (screenY / (H / 2))) / 2;
const row = ((screenY / (H / 2)) - (screenX / (W / 2))) / 2;
```

## Process

1. Fix tile width W and height H, where W = 2 * H.
2. Add a world origin offset.
3. Invert the transform for picking.
4. Round screen-to-grid results to integer tile coordinates.
5. Validate that grid -> screen -> grid returns the original tile.
6. Document whether the anchor is tile top or tile center.

## Verification

- [ ] Grid-to-screen and screen-to-grid are implemented.
- [ ] Round-trip conversion is exact for integer tiles.
- [ ] The anchor convention is documented and consistent.
