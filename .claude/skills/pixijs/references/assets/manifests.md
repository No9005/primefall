# Manifests

A manifest describes every bundle in the application. Pass it to `Assets.init({ manifest })` so bundles are registered at startup.

## Quick start

```ts
await Assets.init({
  manifest: {
    bundles: [
      {
        name: "load-screen",
        assets: [{ alias: "logo", src: "logo.png" }],
      },
      {
        name: "game",
        assets: [
          { alias: "hero", src: "hero.{webp,png}" },
          { alias: "enemies", src: "enemies.json" },
        ],
      },
    ],
  },
});

await Assets.loadBundle("load-screen");
await Assets.loadBundle("game");
```

## Format and resolution patterns

```ts
{ alias: "hero", src: "hero@{0.5,1,2}x.{webp,avif,png}" }
```

The resolver expands the pattern and selects the best match based on device pixel ratio and browser format support.

## Multiple aliases

```ts
{
  alias: ["hero", "player"],
  src: "hero.png"
}
```

## Data options

```ts
{
  alias: "tile",
  src: "tile.png",
  data: { scaleMode: "nearest" }
}
```

## Background loading

```ts
await Assets.init({ manifest });
await Assets.loadBundle("load-screen");

Assets.backgroundLoadBundle("game");
await Assets.loadBundle("game");
```

## Common mistakes

- Call `Assets.init()` only once.
- Always provide at least one fallback format.
- Call `Assets.init()` before adding ad-hoc assets or bundles.
