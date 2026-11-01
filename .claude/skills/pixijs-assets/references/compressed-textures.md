# Compressed Textures

## Quick start

```ts
import "pixi.js/ktx2";
import { Assets, Sprite } from "pixi.js";

const texture = await Assets.load("background.ktx2");
const bg = new Sprite(texture);
app.stage.addChild(bg);
```

## Format imports

```ts
import "pixi.js/dds";
import "pixi.js/ktx";
import "pixi.js/ktx2";
import "pixi.js/basis";
```

## Resolver fallback

```ts
Assets.add({
  alias: "background",
  src: "background.{ktx2,webp,png}",
});
```

## Common mistakes

- Import the matching loader before loading.
- Provide PNG/WebP fallback for Canvas.
