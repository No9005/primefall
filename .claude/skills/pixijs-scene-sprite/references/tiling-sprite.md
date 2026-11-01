# TilingSprite

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
| `texture` | Texture | Texture.EMPTY | Repeated texture. |
| `width` | number | 256 | Tiling width. |
| `height` | number | 256 | Tiling height. |
| `tilePosition` | PointData | 0,0 | Pattern offset. |
| `tileScale` | PointData | 1,1 | Pattern scale. |

## Common mistakes

- Always pass a texture.
- Use `tileScale` to scale the pattern.
- Prefer power-of-two textures.
