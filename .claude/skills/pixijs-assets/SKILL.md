---
name: pixijs-assets
description: Use when loading and managing resources in PixiJS v8.
license: MIT
---

# PixiJS Assets

## Quick start

```ts
await Assets.init({ basePath: "/static/" });

const texture = await Assets.load("hero.png");
const hero = new Sprite(texture);
app.stage.addChild(hero);
```

## References

- `references/spritesheet.md`
- `references/bundles.md`
- `references/manifests.md`
- `references/caching.md`
- `references/background.md`
- `references/progress.md`
- `references/compressed-textures.md`
- `references/svg.md`
- `references/resolution.md`
- `references/fonts.md`
- `references/video.md`
- `references/gif.md`

## Common mistakes

- Use `Assets.load()` to fetch textures.
- Use `{ alias, src }` for `Assets.add`.
- Unload bundles between screens.
