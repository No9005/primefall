# TilingSprite

`TilingSprite` repeats a texture across a given area. Use it for scrolling backgrounds, parallax layers, and repeating ground patterns.

## Quick start

```ts
const texture = await Assets.load("grass.png");

const bg = new TilingSprite({
  texture,
  width: app.screen.width,
  height: app.screen.height,
});

app.stage.addChild(bg);

app.ticker.add((ticker) => {
  bg.tilePosition.x -= 1 * ticker.deltaTime;
});
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `texture` | Texture | Texture.EMPTY | Texture repeated across the region. |
| `width` | number | 256 | Visible tiling width. |
| `height` | number | 256 | Visible tiling height. |
| `tilePosition` | PointData | 0,0 | Pattern offset; animate to scroll. |
| `tileScale` | PointData | 1,1 | Scale of the tile pattern. |
| `tileRotation` | number | 0 | Rotation of the tile pattern. |

## Parallax

```ts
far.tilePosition.x -= 0.5 * ticker.deltaTime;
near.tilePosition.x -= 2 * ticker.deltaTime;
```

## Common mistakes

- Always pass a texture; the default is `Texture.EMPTY`.
- Use `tileScale` to scale the pattern, not `scale`, which stretches the whole sprite.
- Prefer power-of-two textures for reliable hardware tiling.
