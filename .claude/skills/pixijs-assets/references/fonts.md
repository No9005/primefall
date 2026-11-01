# Fonts

## Web fonts

```ts
await Assets.load("fonts/titan-one.woff2");

const text = new Text({
  text: "Hello world",
  style: { fontFamily: "Titan One", fontSize: 48 },
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

- Import `pixi.js/text-bitmap` before BitmapText.
- Load fonts before creating Text.
