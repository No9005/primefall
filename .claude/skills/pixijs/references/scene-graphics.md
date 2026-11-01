# PixiJS Graphics

`Graphics` is the vector-drawing leaf of the PixiJS v8 scene graph. Draw a shape or path first, then apply `fill()` and/or `stroke()`.

## Quick start

```ts
const g = new Graphics();

g.rect(10, 10, 200, 100)
  .fill({ color: 0x3498db, alpha: 0.8 })
  .stroke({ width: 3, color: 0x2c3e50 });

app.stage.addChild(g);
```

## Shapes

```ts
g.circle(150, 200, 40).fill(0xe74c3c);
g.roundRect(300, 10, 150, 80, 12).fill(0x2ecc71);
g.poly([0, 0, 60, 0, 30, 50], true).fill(0x9b59b6);
```

## Paths

```ts
g.moveTo(50, 50)
  .lineTo(200, 50)
  .bezierCurveTo(250, 100, 250, 150, 200, 200)
  .closePath()
  .fill(0x6c5ce7);
```

## Holes

```ts
g.rect(0, 0, 200, 200)
  .fill(0x00ff00)
  .circle(100, 100, 50)
  .cut();
```

## Gradients and patterns

```ts
const gradient = new FillGradient({
  end: { x: 1, y: 0 },
  colorStops: [
    { offset: 0, color: 0xff0000 },
    { offset: 1, color: 0x0000ff },
  ],
});

g.rect(0, 0, 200, 100).fill(gradient);
```

## Performance

- Do not clear and redraw complex Graphics every frame.
- Use Sprites with pre-rendered textures for dynamic visuals.
- Use `cacheAsTexture(true)` for complex static Graphics.
- Do not add children to Graphics; wrap it in a Container instead.

## Common mistakes

- Use `rect()`, `circle()`, and `stroke()`, not removed v7 methods such as `drawRect()`, `drawCircle()`, or `lineStyle()`.
- Use `cut()` instead of `beginHole()` / `endHole()`.
- Use `GraphicsContext`, not the removed `GraphicsGeometry`.
