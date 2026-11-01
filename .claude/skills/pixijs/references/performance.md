# PixiJS Performance

Profile before optimizing. Use browser DevTools and GPU profiling to find the bottleneck, then apply targeted patterns.

## Key patterns

- Use sprite sheets and texture atlases instead of many individual textures.
- Group similar object types together to reduce batch breaks.
- Recycle objects with pools instead of destroying and recreating them.
- Use `cacheAsTexture(true)` for large static subtrees.
- Enable culling for off-screen content with `CullerPlugin`.
- Use `BitmapText` for frequently changing text.
- Avoid high resolution and antialiasing on mobile unless profiling shows it is affordable.

## Destroy safely

```ts
app.destroy({ releaseGlobalResources: true });
```

Use `releaseGlobalResources: true` when recreating an Application to avoid stale pooled resources.

## Culling

```ts
import { CullerPlugin, extensions } from "pixi.js";

extensions.add(CullerPlugin);

sprite.cullable = true;
```

## Object pooling

Reuse Sprites by changing `texture`, `position`, `visible`, and other properties instead of destroying and recreating them.

## Filters

Apply filters to a parent Container rather than to every child. Set `filterArea` when the affected area is known.
