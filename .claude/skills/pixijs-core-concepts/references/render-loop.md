# Render Loop

## Frame lifecycle

```text
requestAnimationFrame
  -> Ticker tick
    -> compute elapsed time
    -> call listeners in priority order
      -> INTERACTION / HIGH / NORMAL
      -> LOW: app.render()
      -> UTILITY
```

## Priority order

```text
INTERACTION = 50
HIGH = 25
NORMAL = 0
LOW = -25
UTILITY = -50
```

## Time units

| Property | Type | Use |
|---|---|---|
| `deltaTime` | dimensionless | Frame-rate-independent multiplier |
| `deltaMS` | milliseconds | Time-based calculations |
| `elapsedMS` | milliseconds | Raw profiling |

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
