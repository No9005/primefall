---
name: pixijs-performance
description: Use when profiling or optimizing a PixiJS v8 app.
license: MIT
---

# PixiJS Performance

## Key patterns

- Use sprite sheets and atlases.
- Group similar object types.
- Recycle objects with pools.
- Use `cacheAsTexture(true)` for static subtrees.
- Enable culling.
- Use `BitmapText` for dynamic text.

## Destroy safely

```ts
app.destroy({ releaseGlobalResources: true });
```

## Culling

```ts
import { CullerPlugin, extensions } from "pixi.js";
extensions.add(CullerPlugin);
sprite.cullable = true;
```
