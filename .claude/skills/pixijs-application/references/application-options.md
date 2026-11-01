# ApplicationOptions reference

## View / canvas

| Option | Type | Default | Description |
|---|---|---|---|
| `width` | number | 800 | Initial width. |
| `height` | number | 600 | Initial height. |
| `canvas` | ICanvas | — | Existing canvas. |
| `resolution` | number | 1 | Device pixel ratio. |
| `autoDensity` | boolean | false | HiDPI scaling. |
| `antialias` | boolean | false | GPU MSAA. |

## Background

| Option | Type | Default | Description |
|---|---|---|---|
| `backgroundColor` | ColorSource | 0x000000 | Clear color. |
| `backgroundAlpha` | number | 1 | Clear alpha. |
| `clearBeforeRender` | boolean | true | Clear each frame. |

## Renderer preference

| Option | Type | Default | Description |
|---|---|---|---|
| `preference` | string or array | webgl | Preferred renderer. |
| `webgl` | object | — | WebGL-only options. |
| `webgpu` | object | — | WebGPU-only options. |

## Ticker

| Option | Type | Default | Description |
|---|---|---|---|
| `autoStart` | boolean | true | Start render loop. |
| `sharedTicker` | boolean | false | Use shared ticker. |

## Resize

| Option | Type | Default | Description |
|---|---|---|---|
| `resizeTo` | Window or HTMLElement | null | Auto-resize target. |

## Events

| Option | Default | Description |
|---|---|---|
| `eventMode` | passive | Default interaction mode. |
| `eventFeatures.globalMove` | true | Global move events. |

## Garbage collection

| Option | Type | Default | Description |
|---|---|---|---|
| `gcActive` | boolean | true | Enable GC. |
| `gcMaxUnusedTime` | number | 60000 | Idle time before cleanup. |
| `gcFrequency` | number | 30000 | GC interval. |
