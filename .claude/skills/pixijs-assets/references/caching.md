# Caching

## Quick start

```ts
await Assets.load("hero.png");

const cached = Assets.get("hero.png");
const sprite = new Sprite(cached);

await Assets.unload("hero.png");
```

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

## Bundle unloading

```ts
level1Container.destroy({ children: true });
await Assets.unloadBundle("level1");
```

## Common mistakes

- Do not call `Assets.get()` before `Assets.load()`.
- Unload bundles between levels.
