# Progress Tracking

`Assets.load` and `Assets.loadBundle` accept a progress callback that fires as each asset completes. The value is normalized from 0 to 1.

## Quick start

```ts
await Assets.load(
  ["hero.png", "enemy.png", "map.json"],
  (progress) => {
    loadingBar.clear();
    loadingBar.rect(0, 0, progress * 400, 20).fill(0x66ccff);
  },
);
```

## Bundle progress

```ts
await Assets.loadBundle("level1", (progress) => {
  loadingText.text = `Loading… ${Math.round(progress * 100)}%`;
});
```

## LoadOptions

```ts
await Assets.load("game.json", {
  onProgress: (progress) => updateBar(progress),
  onError: (err, asset) => {
    const src = typeof asset === "string" ? asset : asset.src;
    console.warn("failed:", src, err);
  },
});
```

## Common mistakes

- Use `await` or `.then()` to detect completion; `progress === 1` can fire slightly before the promise resolves.
- Progress updates in discrete steps per asset.
- Background loading has no progress callback.
