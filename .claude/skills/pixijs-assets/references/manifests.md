# Manifests

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
        ],
      },
    ],
  },
});

await Assets.loadBundle("game");
```

## Patterns

```ts
{ alias: "hero", src: "hero@{0.5,1,2}x.{webp,png}" }
```

## Common mistakes

- Call `Assets.init()` once.
- Provide fallback formats.
- Init before adding ad-hoc assets.
