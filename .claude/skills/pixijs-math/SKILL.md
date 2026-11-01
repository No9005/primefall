---
name: pixijs-math
description: Use when working with coordinates, vectors, matrices, shapes, hit testing, or layout rectangles in PixiJS v8.
license: MIT
---

# PixiJS Math

PixiJS provides `Point`, `ObservablePoint`, `Matrix`, and shape classes for transforms, hit testing, and coordinate conversion.

## Point

```ts
const point = new Point(10, 20);
point.set(30, 40);
```

Container properties such as `position`, `scale`, `pivot`, and `skew` are ObservablePoints. Mutate them in place:

```ts
container.position.set(100, 200);
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

## Shapes and hit testing

```ts
const rect = new Rectangle(0, 0, 200, 100);
rect.contains(50, 50);

button.hitArea = new Rectangle(0, 0, 200, 50);
button.eventMode = "static";
```

## Math extras

Import `pixi.js/math-extras` for vector operations, rectangle intersection, and union helpers.

```ts
import "pixi.js/math-extras";
```

## Common mistakes

- Import from `pixi.js`, not removed `@pixi/math` packages.
- Mutate ObservablePoints in place; replacing the reference does not update the container.
- Do not store references to `Point.shared` or `Matrix.shared`.
