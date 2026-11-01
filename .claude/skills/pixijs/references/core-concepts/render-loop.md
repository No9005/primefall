# Render Loop

Every PixiJS frame runs ticker callbacks in priority order, with `app.render()` registered at `UPDATE_PRIORITY.LOW`.

## Frame lifecycle

```text
requestAnimationFrame
  -> Ticker tick
    -> compute elapsed time
    -> call listeners in priority order
      -> INTERACTION / HIGH / NORMAL listeners
      -> LOW: app.render()
        -> traverse display list
        -> update transforms
        -> cull if enabled
        -> upload to GPU
        -> draw
      -> UTILITY listeners
```

## Priority order

```text
INTERACTION = 50
HIGH = 25
NORMAL = 0
LOW = -25
UTILITY = -50
```

`app.render()` is registered at LOW, so NORMAL and HIGH callbacks run before the draw.

## Time units

| Property | Type | Use |
|---|---|---|
| `deltaTime` | dimensionless | Frame-rate-independent multiplier |
| `deltaMS` | milliseconds | Time-based calculations |
| `elapsedMS` | milliseconds | Raw profiling value |

## Manual rendering

```ts
await app.init({ autoStart: false });

function frame() {
  updateGameState();
  app.renderer.render(app.stage);
  requestAnimationFrame(frame);
}
```

## Per-object updates

```ts
sprite.onRender = () => {
  sprite.rotation += 0.01;
};
```

## Common mistakes

- The ticker callback receives the Ticker instance, not a delta number.
- Use `onRender` for per-object frame logic.
- Use `UTILITY` priority for post-render work such as pixel readbacks.
