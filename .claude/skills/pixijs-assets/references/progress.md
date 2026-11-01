# Progress Tracking

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

## Common mistakes

- Use `await` to detect completion.
- Background loading has no progress callback.
