# Resolution and Format Detection

PixiJS can pick the best asset variant based on pixel density and supported image formats.

## Quick start

```ts
await Assets.init({
  texturePreference: {
    resolution: window.devicePixelRatio,
    format: ["avif", "webp", "png"],
  },
});

Assets.add({ alias: "hero", src: "hero@{0.5,1,2}x.{webp,png}" });

const texture = await Assets.load("hero");
```

## Resolution patterns

```ts
Assets.add({ alias: "bg", src: "bg@{0.5,1,2}x.png" });
```

## Format patterns

```ts
Assets.add({ alias: "icon", src: "icon.{avif,webp,png}" });
```

## Combined patterns

```ts
Assets.add({ alias: "hero", src: "hero@{0.5,1,2}x.{avif,webp,png}" });
```

## Manual resolution override

```ts
Assets.add({
  alias: "sharp",
  src: "sharp.png",
  data: { resolution: 2 },
});
```

## Common mistakes

- Use `{}` for pattern expansion, not `[]`.
- Always provide at least one fallback format.
- Ensure spritesheet `meta.scale` matches the actual image resolution.
