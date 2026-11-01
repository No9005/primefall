# PixiJS Filters

Attach filters to a Container or Sprite through `filters`.

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

Set `filterArea` when the affected bounds are known:

```ts
container.filterArea = new Rectangle(0, 0, 800, 600);
```

## Performance

- Apply one filter to a parent Container instead of one filter per child.
- Disable filters with `filter.enabled = false` when unused.
- Set `filters = null` to release filter memory.
- Use lower `resolution` for faster, blurrier effects.

## Custom filters

Use `Filter.from()` with a GLSL or WGSL fragment shader. In v8, use an options object and wrap shaders in `GlProgram.from()` or `GpuProgram.from()`.
