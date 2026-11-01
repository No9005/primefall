# Renderers: WebGPU, WebGL, and Canvas

PixiJS v8 ships three renderers: WebGPU, WebGL, and Canvas.

## Quick start

```ts
const app = new Application();

await app.init({
  preference: ["webgpu", "webgl"],
  width: 800,
  height: 600,
  antialias: true,
});

document.body.appendChild(app.canvas);
```

## Preference forms

```ts
await app.init({ preference: "webgpu" });
await app.init({ preference: ["webgpu", "webgl"] });
await app.init({ preference: ["canvas"] });
```

A string falls back through the default priority. An array restricts the renderer to the listed backends in order.

## Systems and pipes

Each renderer has Systems for lifecycle services and RenderPipes for per-renderable instruction building.

## Render targets

```ts
renderer.render({
  container: myContainer,
  target: renderTexture,
});
```

## Manual rendering

```ts
await app.init({ autoStart: false });

function frame() {
  app.renderer.render(app.stage);
  requestAnimationFrame(frame);
}
```

## Common mistakes

- Always include WebGL as a fallback when preferring WebGPU.
- CanvasRenderer does not support filters, masks beyond basic clipping, compressed textures, or custom shaders.
- Do not render before `app.init()` resolves.
