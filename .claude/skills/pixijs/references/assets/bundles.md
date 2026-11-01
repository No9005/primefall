# Bundles

A bundle is a named group of assets that can be loaded or unloaded as a unit. Use bundles per game level, UI screen, or feature.

## Quick start

```ts
Assets.addBundle("level1", [
  { alias: "bg", src: "level1/background.png" },
  { alias: "tileset", src: "level1/tiles.json" },
]);

const resources = await Assets.loadBundle("level1");
const bg = Sprite.from("bg");
```

`loadBundle(name)` returns a record keyed by alias. Each alias is also available through `Assets.get(alias)`.

## Multiple bundles

```ts
await Assets.loadBundle(["ui", "level1", "sounds"]);
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

Destroy or detach display objects that reference the bundle textures before unloading.

## Shared assets

If two bundles declare the same alias with the same `src`, the underlying texture is loaded once and shared. Unloading either bundle destroys the shared texture.

## Common mistakes

- Do not unload a bundle while its textures are still used on the stage.
- Prefer manifests when all bundles are known upfront; use `addBundle` for runtime-discovered bundles.
