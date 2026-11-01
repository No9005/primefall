# AnimatedSprite

## Quick start

```ts
const sheet = await Assets.load("character.json");

const walk = new AnimatedSprite({
  textures: sheet.animations["walk"],
  animationSpeed: 0.15,
  loop: true,
  autoPlay: true,
});

app.stage.addChild(walk);
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `textures` | Texture[] or FrameObject[] | — | Frame list. |
| `animationSpeed` | number | 1 | Playback multiplier. |
| `autoPlay` | boolean | false | Start immediately. |
| `loop` | boolean | true | Restart after last frame. |

## Playback

```ts
walk.play();
walk.stop();
walk.gotoAndPlay(0);
```

## Common mistakes

- Load the spritesheet first.
- Set `autoPlay: true` or call `play()`.
- `FrameObject.time` is in milliseconds.
