# Bundles

## Quick start

```ts
Assets.addBundle("level1", [
  { alias: "bg", src: "level1/background.png" },
  { alias: "tileset", src: "level1/tiles.json" },
]);

const resources = await Assets.loadBundle("level1");
const bg = Sprite.from("bg");
```

## Multiple bundles

```ts
await Assets.loadBundle(["ui", "level1"]);
```

## Progress

```ts
await Assets.loadBundle("level1", (progress) => {
  loadingBar.width = progress * maxBarWidth;
});
```

## Unloading

```ts
await Assets.unloadBundle("level1");
```

## Common mistakes

- Destroy scene objects before unloading.
- Prefer manifests for known bundles.
