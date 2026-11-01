# Compressed Textures

GPU-compressed texture formats use 4-8x less GPU memory than PNG/JPEG and skip runtime decoding.

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

Import only the formats you use; each loader adds decoder runtime to the bundle.

## Format selection

| Format | Notes |
|---|---|
| DDS | Legacy desktop formats, wide support |
| KTX | Older Khronos container |
| KTX2 | Newer container, typically used with Basis Universal |
| Basis | Supercompressed, transcodes to GPU-native format at load time |

Use KTX2 + Basis for new projects unless you need a specific legacy format.

## Resolver fallback

```ts
Assets.add({
  alias: "background",
  src: "background.{ktx2,webp,png}",
});
```

## Common mistakes

- Always import the matching format loader before loading.
- Compressed textures require WebGL or WebGPU; provide a PNG/WebP fallback for Canvas.
