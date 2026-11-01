# NineSliceSprite

`NineSliceSprite` stretches a texture using 9-slice scaling. Corners stay unscaled, edges stretch in one direction, and the center stretches in both directions.

## Quick start

```ts
const texture = await Assets.load("panel.png");

const panel = new NineSliceSprite({
  texture,
  leftWidth: 20,
  topHeight: 20,
  rightWidth: 20,
  bottomHeight: 20,
  width: 400,
  height: 200,
});

app.stage.addChild(panel);
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `texture` | Texture | Texture.EMPTY | Source texture. |
| `leftWidth` | number | 10 | Left border width. |
| `topHeight` | number | 10 | Top border height. |
| `rightWidth` | number | 10 | Right border width. |
| `bottomHeight` | number | 10 | Bottom border height. |
| `width` | number | texture width | Stretched sprite width. |
| `height` | number | texture height | Stretched sprite height. |

## Runtime resize

```ts
panel.width = 600;
panel.height = 300;
```

Setting width and height modifies the sprite vertices, not the texture UVs. Corners stay fixed-size.

## Common mistakes

- Use `NineSliceSprite`, not the removed `NineSlicePlane` name.
- Resize with `width` and `height`, not `scale`.
- Keep opposing borders smaller than the texture dimensions.
