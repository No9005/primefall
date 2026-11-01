---
name: pixijs-math
description: Use when working with coordinates, vectors, matrices, shapes, hit testing in PixiJS v8.
license: MIT
---

# PixiJS Math

## Point

```ts
const point = new Point(10, 20);
point.set(30, 40);
```

## Matrix

```ts
const matrix = new Matrix()
  .translate(100, 50)
  .rotate(Math.PI / 4)
  .scale(2, 2);

const world = matrix.apply(new Point(10, 20));
const local = matrix.applyInverse(world);
```

## Coordinate conversion

```ts
const global = child.toGlobal(new Point(0, 0));
const local = child.toLocal(global);
```

## Hit testing

```ts
button.hitArea = new Rectangle(0, 0, 200, 50);
button.eventMode = "static";
```

## Common mistakes

- Import from `pixi.js`, not `@pixi/math`.
- Mutate ObservablePoints in place.
- Do not store references to shared temp objects.
