# PixiJS Assets

The `Assets` API is PixiJS's asset loader, resolver, and cache.

## Quick start

```ts
import { Assets, Sprite } from "pixi.js";

await Assets.init({ basePath: "/static/" });

const texture = await Assets.load("hero.png");
const hero = new Sprite(texture);
app.stage.addChild(hero);
```

## Load multiple assets

```ts
const [hero, enemy] = await Assets.load(["hero.png", "enemy.png"]);
```

## Alias an asset

```ts
await Assets.load({
  alias: "logo",
  src: "logo.webp",
});

const logo = new Sprite(Assets.get("logo"));
```

## Sprite sheets

Load a spritesheet JSON with its associated texture:

```ts
const sheet = await Assets.load("hero.json");
const frame = new Sprite(sheet.textures["hero_idle"]);
```

## Bundles

```ts
await Assets.load({
  alias: "level-one",
  src: "level-one.json",
});
```

## Common mistakes

- Use `Assets.load()` to fetch a texture; `Texture.from()` only reads the cache.
- Use `{ alias, src }`, not the removed positional `Assets.add(key, url)` form.
- Unload bundles or textures when changing screens to release GPU memory.
