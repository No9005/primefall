---
name: pixijs-ticker
description: Use when running per-frame logic or controlling the PixiJS v8 render loop.
license: MIT
---

# PixiJS Ticker

## Quick start

```ts
app.ticker.add((ticker) => {
  sprite.rotation += 0.01 * ticker.deltaTime;
  sprite.x += (200 / 1000) * ticker.deltaMS;
});
```

## Time values

- `deltaTime`: dimensionless multiplier.
- `deltaMS`: milliseconds.
- `elapsedMS`: raw milliseconds.

## Priorities

```ts
app.ticker.add(
  (ticker) => updatePhysics(ticker.deltaMS),
  undefined,
  UPDATE_PRIORITY.HIGH,
);
```

## Common mistakes

- Callback receives Ticker instance, not a delta number.
- Use `deltaMS` for time-based movement.
- Use `onRender` for per-object updates.
