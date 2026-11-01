# SVG Loading

## Texture mode

```ts
const icon = await Assets.load("close.svg");
const button = new Sprite(icon);
```

## Graphics mode

```ts
const context = await Assets.load({
  src: "logo.svg",
  data: { parseAsGraphicsContext: true },
});

const graphic = new Graphics(context);
```

## Common mistakes

- Texture mode pixelates when scaled.
- Graphics mode ignores `<style>` blocks.
