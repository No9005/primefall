# PixiJS Color

The `Color` class creates and converts colors for tints, fills, strokes, and other `ColorSource` inputs.

## Quick start

```ts
import { Color } from "pixi.js";

const color = new Color("#ff6600");

sprite.tint = color.toNumber();
```

## Accepted inputs

```ts
new Color(0xff0000);
new Color("#ff0000");
new Color("red");
new Color({ r: 255, g: 0, b: 0 });
new Color([1, 0, 0]);
```

## Conversion

```ts
color.toHex();
color.toNumber();
color.toArray();
color.toRgbaString();
color.toUint8RgbArray();
```

## Manipulation

```ts
color.setAlpha(0.5);
color.multiply(0x808080);
color.premultiply(0.8);
```

## Shared color

Use `Color.shared` for temporary conversions in hot paths. Do not store a reference to it.

```ts
sprite.tint = Color.shared.setValue("#ff6600").toNumber();
```

## Common mistakes

- RGB object inputs use 0–255 values.
- Array inputs use normalized 0–1 values.
- Use `toUint8RgbArray()` when you need 0–255 output.
- Use the `Color` class, not the removed `utils` namespace.
