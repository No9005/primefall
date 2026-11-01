---
name: pixijs-application
description: Use when creating and configuring a PixiJS v8 Application.
license: MIT
---

# PixiJS Application

## Quick start

```ts
import { Application } from "pixi.js";

const app = new Application();

await app.init({
  resizeTo: window,
  background: "#1099bb",
  antialias: true,
  resolution: window.devicePixelRatio,
  autoDensity: true,
});

document.body.appendChild(app.canvas);
```

## Lifecycle

```ts
app.destroy(
  { removeView: true, releaseGlobalResources: true },
  { children: true, texture: true, textureSource: true },
);
```

## References

- `references/application-options.md`

## Common mistakes

- Pass options to `app.init()`, not the constructor.
- Use `app.canvas`, not `app.view`.
- Do not access renderer before init resolves.
