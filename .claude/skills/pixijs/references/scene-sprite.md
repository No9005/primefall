# PixiJS Scene Sprite

PixiJS provides `Sprite`, `AnimatedSprite`, `NineSliceSprite`, and `TilingSprite`.

## Sprite

```ts
const texture = await Assets.load("hero.png");

const hero = new Sprite({
  texture,
  anchor: 0.5,
});

hero.x = app.screen.width / 2;
hero.y = app.screen.height / 2;
app.stage.addChild(hero);
```

## AnimatedSprite

```ts
const sheet = await Assets.load("hero.json");

const hero = new AnimatedSprite(sheet.animations["walk"]);
hero.animationSpeed = 0.15;
hero.play();
```

## Anchor vs pivot

Use `anchor` to center a sprite:

```ts
sprite.anchor.set(0.5);
```

`anchor` shifts only the texture draw origin. `pivot` shifts the transform origin and visual position.

## Common mistakes

- Use `Assets.load()` before creating a Sprite from a URL.
- Do not add children to a Sprite; wrap sprites in a Container instead.
- Use `NineSliceSprite`, not the removed `NineSlicePlane` name.
