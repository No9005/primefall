---
name: pixijs-core-concepts
description: Use when understanding how PixiJS v8 renders frames, selects a renderer, and manages the render loop.
license: MIT
---

# PixiJS Core Concepts

PixiJS v8 uses a systems-and-pipes renderer. The renderer selects a GPU backend, the render loop drives per-frame work, and the environment layer adapts PixiJS to browser, Worker, or SSR contexts.

## Quick start

```ts
console.log(app.renderer.name); // 'webgl' | 'webgpu' | 'canvas'

app.ticker.add((ticker) => {
  sprite.rotation += 0.01 * ticker.deltaTime;
});

app.renderer.render({ container: app.stage });
```

## Renderer

`app.renderer` is a WebGL, WebGPU, or Canvas renderer selected by `autoDetectRenderer`. Backend preference is set during `Application.init({ preference })`.

`preference` is a hint, not a guarantee. Check `app.renderer.name` before using backend-specific features.

## Render loop

`app.ticker.add(fn)` registers a callback that runs every frame. The TickerPlugin registers `app.render()` at `UPDATE_PRIORITY.LOW`.

For manual control, set `autoStart: false` and call `app.renderer.render(app.stage)` from your own loop.

## Common mistakes

- Do not access `app.renderer` before `app.init()` resolves.
- Set `DOMAdapter` before `Application.init()` when using Workers or SSR.
- Do not assume WebGPU is active just because it was preferred.
