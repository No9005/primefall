# AnimatedSprite

`AnimatedSprite` cycles through an array of textures for frame-based animation.

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
| `autoPlay` | boolean | false | Start playback immediately. |
| `autoUpdate` | boolean | true | Drive playback from Ticker.shared. |
| `loop` | boolean | true | Restart after the last frame. |

## Playback control

```ts
walk.play();
walk.stop();
walk.gotoAndStop(3);
walk.gotoAndPlay(0);
walk.currentFrame = 2;
```

## Per-frame timing

```ts
const explosion = new AnimatedSprite({
  textures: [
    { texture: frame0, time: 100 },
    { texture: frame1, time: 200 },
  ],
});
```

`FrameObject.time` is in milliseconds.

## Common mistakes

- Load the spritesheet before using `Texture.from()` on its frames.
- Set `autoPlay: true` or call `play()`.
- Use milliseconds, not seconds, for `FrameObject.time`.
