# SVG Loading

PixiJS loads SVG files either as a rasterized texture or as a `GraphicsContext`.

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
graphic.scale.set(3);
```

## Sharper texture mode

```ts
const icon = await Assets.load({
  src: "icon.svg",
  data: { resolution: 2 },
});
```

## When to use which

| Mode | Best for |
|---|---|
| Texture | Icons at a known size, backgrounds, complex SVGs |
| Graphics | Scalable icons, UI elements, runtime modification |

## Common mistakes

- Texture mode pixelates when scaled; use Graphics mode or higher resolution for scaling.
- Graphics mode does not read `<style>` blocks or class selectors.
- External image references in SVG may fail without CORS.
