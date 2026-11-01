# PixiJS Application

`Application` owns a renderer, root stage Container, canvas, and Ticker/Resize plugins.

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
const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

app.destroy(
  { removeView: true, releaseGlobalResources: true },
  { children: true, texture: true, textureSource: true },
);
```

- `new Application()` allocates the instance but creates nothing.
- `app.init(options)` is async and creates the renderer and plugins.
- `app.stage`, `app.renderer`, `app.canvas`, and `app.screen` are available after init resolves.
- The TickerPlugin calls `app.render()` every frame unless `autoStart: false`.

## Key options

```ts
await app.init({
  width: 800,
  height: 600,
  background: 0x1099bb,
  antialias: true,
  resolution: window.devicePixelRatio,
  autoDensity: true,
  preference: "webgl",
  resizeTo: window,
});
```

## Resize

```ts
await app.init({ resizeTo: window });
app.resizeTo = document.querySelector("#game-container");
app.resize();
```

## Ticker

```ts
app.ticker.add((ticker) => {
  sprite.rotation += 0.01 * ticker.deltaTime;
});
```

## Common mistakes

- Do not pass options to the `Application` constructor; pass them to `app.init()`.
- Use `app.canvas`, not the deprecated `app.view`.
- Do not access `app.canvas` or `app.renderer` before `app.init()` resolves.
