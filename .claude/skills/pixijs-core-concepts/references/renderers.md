# Renderers

PixiJS v8 ships WebGPU, WebGL, and Canvas renderers.

## Quick start

```ts
await app.init({
  preference: ["webgpu", "webgl"],
  width: 800,
  height: 600,
  antialias: true,
});
```

## Preference forms

```ts
await app.init({ preference: "webgpu" });
await app.init({ preference: ["webgpu", "webgl"] });
await app.init({ preference: ["canvas"] });
```

## Render targets

```ts
renderer.render({
  container: myContainer,
  target: renderTexture,
});
```

## Common mistakes

- Include WebGL fallback when preferring WebGPU.
- CanvasRenderer lacks filters, masks, compressed textures, custom shaders.
- Do not render before init resolves.
