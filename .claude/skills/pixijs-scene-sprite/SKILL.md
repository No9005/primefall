---
name: pixijs-scene-sprite
description: Use when drawing images in PixiJS v8.
license: MIT
---

# PixiJS Scene Sprite

## Quick start

```ts
const texture = await Assets.load("hero.png");

const hero = new Sprite({
  texture,
  anchor: 0.5,
});

app.stage.addChild(hero);
```

## AnimatedSprite

```ts
const sheet = await Assets.load("hero.json");
const hero = new AnimatedSprite(sheet.animations["walk"]);
hero.animationSpeed = 0.15;
hero.play();
```

## References

- `references/sprite.md`
- `references/animated-sprite.md`
- `references/nineslice-sprite.md`
- `references/tiling-sprite.md`

## Common mistakes

- Use `Assets.load()` before creating a Sprite from a URL.
- Use `anchor` to center a sprite.
- Do not add children to a Sprite.
