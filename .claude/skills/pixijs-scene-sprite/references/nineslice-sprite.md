# NineSliceSprite

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
| `leftWidth` | number | 10 | Left border. |
| `topHeight` | number | 10 | Top border. |
| `rightWidth` | number | 10 | Right border. |
| `bottomHeight` | number | 10 | Bottom border. |

## Common mistakes

- Use `NineSliceSprite`, not `NineSlicePlane`.
- Resize with width/height, not scale.
