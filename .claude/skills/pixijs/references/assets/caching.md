# Caching

Every asset loaded through `Assets` is cached until explicitly unloaded. The cache is keyed by resolved URL, alias, and bundle identifier.

## Quick start

```ts
await Assets.load("hero.png");

const cached = Assets.get("hero.png");
const sprite = new Sprite(cached);

await Assets.unload("hero.png");
```

## Synchronous access

```ts
await Assets.load(["hero.png", "enemy.png"]);

const hero = Assets.get("hero");
const enemy = Assets.get("enemy");
```

`Assets.get()` returns `undefined` if the asset has not been loaded yet.

## Deduping

```ts
const tex1 = await Assets.load("hero.png");
const tex2 = await Assets.load("hero.png");
// tex1 === tex2
```

## Unloading

```ts
sprite.destroy();
await Assets.unload("hero.png");
```

Always destroy or detach display objects that reference an asset before unloading it.

## Bundle unloading

```ts
level1Container.destroy({ children: true });
await Assets.unloadBundle("level1");
```

## Common mistakes

- Do not call `Assets.get()` before `Assets.load()`.
- Unload bundles between levels to release GPU memory.
- Do not use sprites after their texture has been unloaded.
