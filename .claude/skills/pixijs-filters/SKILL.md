---
name: pixijs-filters
description: Use when applying visual effects to PixiJS v8 containers.
license: MIT
---

# PixiJS Filters

## Built-in filters

- `AlphaFilter`
- `BlurFilter`
- `ColorMatrixFilter`
- `DisplacementFilter`
- `NoiseFilter`

```ts
sprite.filters = [new BlurFilter({ strength: 4 })];
```

## Filter area

```ts
container.filterArea = new Rectangle(0, 0, 800, 600);
```

## Performance

- Apply filters to a parent Container.
- Disable unused filters.
- Set `filters = null` to release memory.
