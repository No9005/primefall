# Animated GIFs

PixiJS loads animated GIFs through `Assets.load()` and returns a `GifSource`. GIF support requires the `pixi.js/gif` side-effect import.

## Quick start

```ts
import "pixi.js/gif";
import { Assets, GifSprite } from "pixi.js";

const source = await Assets.load("explosion.gif");
const gif = new GifSprite(source);
app.stage.addChild(gif);
```

## Load options

```ts
const source = await Assets.load({
  src: "pixel-art.gif",
  data: {
    fps: 12,
    scaleMode: "nearest",
    resolution: 2,
  },
});
```

## Playback control

```ts
gif.play();
gif.stop();
gif.currentFrame = 5;
gif.animationSpeed = 0.5;
gif.loop = false;
```

## Sharing a source

Multiple `GifSprite` instances can share the same `GifSource`; each has independent playback state.

## Cleanup

```ts
gif.destroy();
await Assets.unload("explosion.gif");
```

## Common mistakes

- Import `pixi.js/gif` before loading a GIF.
- Prefer spritesheets for performance-critical animations.
- Do not call `destroy(true)` when other sprites share the source.
