# Resolution and Format Detection

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

## Patterns

```ts
Assets.add({ alias: "bg", src: "bg@{0.5,1,2}x.png" });
Assets.add({ alias: "icon", src: "icon.{avif,webp,png}" });
```

## Common mistakes

- Use `{}` for expansion, not `[]`.
- Provide fallback formats.
- Match spritesheet `meta.scale` to image resolution.
