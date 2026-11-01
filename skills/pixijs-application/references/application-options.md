# ApplicationOptions reference

Every option accepted by `app.init(options)`.

## View / canvas

| Option | Type | Default | Description |
|---|---|---|---|
| `width` | number | 800 | Initial width in CSS pixels. |
| `height` | number | 600 | Initial height in CSS pixels. |
| `canvas` | ICanvas | — | Existing canvas to render into. |
| `resolution` | number | 1 | Device pixel ratio. |
| `autoDensity` | boolean | false | Scale CSS dimensions for HiDPI. |
| `antialias` | boolean | false | GPU MSAA where supported. |

```ts
await app.init({
  width: 1280,
  height: 720,
  resolution: window.devicePixelRatio,
  autoDensity: true,
  antialias: true,
});
```

## Background

| Option | Type | Default | Description |
|---|---|---|---|
| `backgroundColor` | ColorSource | 0x000000 | Canvas clear color. |
| `background` | ColorSource | — | Alias for backgroundColor. |
| `backgroundAlpha` | number | 1 | Clear alpha, 0-1. Cannot change after init. |
| `clearBeforeRender` | boolean | true | Clear the target before each frame. |

## Renderer preference

| Option | Type | Default | Description |
|---|---|---|---|
| `preference` | string or array | webgl | Preferred renderer. |
| `webgl` | object | — | WebGL-only options. |
| `webgpu` | object | — | WebGPU-only options. |
| `canvasOptions` | object | — | Canvas-only options. |

```ts
await app.init({ preference: ["webgpu", "webgl"] });
```

An array restricts the renderer to the listed backends in order; anything not listed is excluded.

## Ticker

| Option | Type | Default | Description |
|---|---|---|---|
| `autoStart` | boolean | true | Start the render loop automatically. |
| `sharedTicker` | boolean | false | Use Ticker.shared instead of a per-app ticker. |

## Resize

| Option | Type | Default | Description |
|---|---|---|---|
| `resizeTo` | Window or HTMLElement | null | Element the renderer auto-resizes to. |

## Events

| Option | Default | Description |
|---|---|---|
| `eventMode` | passive | Default interaction mode. |
| `eventFeatures.move` | true | Pointer move events. |
| `eventFeatures.globalMove` | true | Global move events. |
| `eventFeatures.click` | true | Click and tap events. |
| `eventFeatures.wheel` | true | Wheel events. |

## Garbage collection

| Option | Type | Default | Description |
|---|---|---|---|
| `gcActive` | boolean | true | Enable renderer garbage collection. |
| `gcMaxUnusedTime` | number | 60000 | Idle time before cleanup, in ms. |
| `gcFrequency` | number | 30000 | GC sweep interval, in ms. |
