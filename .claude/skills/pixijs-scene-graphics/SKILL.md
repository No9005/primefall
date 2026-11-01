---
name: pixijs-scene-graphics
description: Use when drawing vector shapes and paths in PixiJS v8.
license: MIT
---

# PixiJS Graphics

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
```

## Holes

```ts
g.rect(0, 0, 200, 200)
  .fill(0x00ff00)
  .circle(100, 100, 50)
  .cut();
```

## Common mistakes

- Use `rect()`, `circle()`, `stroke()`.
- Use `cut()` for holes.
- Do not clear and redraw complex Graphics every frame.
