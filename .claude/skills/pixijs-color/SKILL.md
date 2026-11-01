---
name: pixijs-color
description: Use when creating, converting, or manipulating colors in PixiJS v8.
license: MIT
---

# PixiJS Color

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
color.toUint8RgbArray();
```

## Common mistakes

- RGB object inputs use 0-255.
- Array inputs use 0-1.
- Use `toUint8RgbArray()` for 0-255 output.
