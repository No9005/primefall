# Animated GIFs

## Quick start

```ts
import "pixi.js/gif";
import { Assets, GifSprite } from "pixi.js";

const source = await Assets.load("explosion.gif");
const gif = new GifSprite(source);
app.stage.addChild(gif);
```

## Playback

```ts
gif.play();
gif.stop();
gif.currentFrame = 5;
```

## Common mistakes

- Import `pixi.js/gif` before loading.
- Prefer spritesheets for performance-critical animations.
