---
name: isometric-grid-math
description: Use when converting between grid coordinates and screen pixels in 2:1 isometric projection.
license: MIT
---

# Isometric Grid Math

## Formulas

```js
const screenX = (col - row) * (W / 2);
const screenY = (col + row) * (H / 2);

const col = ((screenX / (W / 2)) + (screenY / (H / 2))) / 2;
const row = ((screenY / (H / 2)) - (screenX / (W / 2))) / 2;
```

## Process

1. Fix W and H with W = 2 * H.
2. Add world origin offset.
3. Invert for picking.
4. Round to integer tiles.
5. Validate round-trip.

## Verification

- [ ] Both conversions implemented.
- [ ] Round-trip exact.
- [ ] Anchor convention documented.
