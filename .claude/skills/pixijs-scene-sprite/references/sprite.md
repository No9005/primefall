# Sprite

## Quick start

```ts
const texture = await Assets.load("bunny.png");

const sprite = new Sprite({
  texture,
  anchor: 0.5,
  tint: 0xff8888,
});

app.stage.addChild(sprite);
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `texture` | Texture | Texture.EMPTY | Texture to draw. |
| `anchor` | PointData or number | 0 | Normalized draw origin. |
| `roundPixels` | boolean | false | Snap to whole pixels. |

## Anchor

```ts
sprite.anchor.set(0.5); // center
```

## Common mistakes

- Use `Assets.load()` before creating a Sprite from a URL.
- Use `anchor` to center, not `pivot`.
- Do not add children to a Sprite.
