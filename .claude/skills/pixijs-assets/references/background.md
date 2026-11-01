# Background Loading

Background loading prepares assets passively while other work happens. `backgroundLoad` and `backgroundLoadBundle` are non-blocking.

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

## Multiple assets

```ts
Assets.backgroundLoad([
  "images/sprite1.png",
  "images/sprite2.png",
  "images/background.png",
]);
```

## Bundle

```ts
Assets.backgroundLoadBundle("level-1");

onPlayClicked(async () => {
  await Assets.loadBundle("level-1");
  startLevel();
});
```

## Common mistakes

- Background loading has no progress callback.
- Always await the real `Assets.loadBundle()` before using the assets.
- Background-load only assets you expect to need soon.
