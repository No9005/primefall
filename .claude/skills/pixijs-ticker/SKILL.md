---
name: pixijs-ticker
description: Use when running per-frame logic or controlling the PixiJS v8 render loop.
license: MIT
---

# PixiJS Ticker

`app.ticker` runs callbacks every frame and drives `app.render()` at `UPDATE_PRIORITY.LOW`.

## Quick start

```ts
app.ticker.add((ticker) => {
  sprite.rotation += 0.01 * ticker.deltaTime;
  sprite.x += (200 / 1000) * ticker.deltaMS;
});
```

## Time values

- `deltaTime`: dimensionless multiplier, about 1.0 at 60 FPS.
- `deltaMS`: real milliseconds, scaled by ticker speed and FPS caps.
- `elapsedMS`: raw milliseconds without scaling or capping.

## Priorities

```ts
app.ticker.add(
  (ticker) => updatePhysics(ticker.deltaMS),
  undefined,
  UPDATE_PRIORITY.HIGH,
);
```

Priority order: `INTERACTION` > `HIGH` > `NORMAL` > `LOW` > `UTILITY`.

## Frame-rate control

```ts
app.ticker.maxFPS = 30;
app.ticker.minFPS = 10;
app.ticker.speed = 0.5;
```

## Per-object updates

```ts
sprite.onRender = () => {
  sprite.rotation += 0.01;
};
```

## Common mistakes

- The ticker callback receives the Ticker instance, not a delta number.
- Use `deltaMS` for time-based movement; `deltaTime` is not milliseconds.
- Use `onRender` for per-object frame logic; `updateTransform` was removed in v8.
