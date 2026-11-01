# Sprite

`Sprite` displays a single Texture at a transform.

## Quick start

```ts
const texture = await Assets.load("bunny.png");

const sprite = new Sprite({
  texture,
  anchor: 0.5,
  tint: 0xff8888,
});

sprite.x = app.screen.width / 2;
sprite.y = app.screen.height / 2;
app.stage.addChild(sprite);
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `texture` | Texture | Texture.EMPTY | Texture to draw. |
| `anchor` | PointData or number | 0 | Normalized draw origin. |
| `roundPixels` | boolean | false | Snap rendering to whole pixels. |

## Sizing

```ts
sprite.setSize(200);
sprite.setSize(200, 120);
const size = sprite.getSize();
```

## Anchor

```ts
sprite.anchor.set(0.5); // center
sprite.anchor.set(0, 0); // top-left
sprite.anchor.set(1, 0); // top-right
```

## Tint and alpha

```ts
sprite.tint = 0xff0000;
sprite.alpha = 0.5;
```

## Common mistakes

- Use `Assets.load()` before creating a Sprite from a URL.
- Use `anchor` to center a sprite, not `pivot`.
- Do not add children to a Sprite; wrap it in a Container.
