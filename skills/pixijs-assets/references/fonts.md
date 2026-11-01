# Fonts

PixiJS loads web fonts through `Assets` for `Text` and `HTMLText`, and bitmap fonts for `BitmapText`.

## Web fonts

```ts
await Assets.load("fonts/titan-one.woff2");

const text = new Text({
  text: "Hello world",
  style: { fontFamily: "Titan One", fontSize: 48 },
});
```

## Family name

By default, the family name is derived from the filename. Override it with `data.family`.

```ts
await Assets.load({
  alias: "hero-font",
  src: "fonts/hero.woff2",
  data: {
    family: "HeroFont",
    weights: ["normal", "bold"],
    style: "italic",
  },
});
```

## Bitmap fonts

```ts
import "pixi.js/text-bitmap";

await Assets.load("fonts/arial.fnt");

const text = new BitmapText({
  text: "Score: 9999",
  style: { fontFamily: "Arial", fontSize: 32 },
});
```

## Common mistakes

- Import `pixi.js/text-bitmap` before rendering `BitmapText`.
- Load the font before creating `Text` that uses it.
- Use the exact derived family name or set `data.family` explicitly.
