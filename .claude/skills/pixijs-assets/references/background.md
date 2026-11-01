# Background Loading

## Quick start

```ts
await Assets.loadBundle("menu");
showMenu();

Assets.backgroundLoadBundle("level1");

playerClicksStart(() => {
  Assets.loadBundle("level1").then(() => startLevel());
});
```

## Single asset

```ts
Assets.backgroundLoad("images/level2-assets.png");

const texture = await Assets.load("images/level2-assets.png");
```

## Common mistakes

- Background loading has no progress callback.
- Always await the real load before using assets.
