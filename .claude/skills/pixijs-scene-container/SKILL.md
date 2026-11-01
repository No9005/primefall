---
name: pixijs-scene-container
description: Use when grouping, positioning, or transforming display objects in PixiJS v8.
license: MIT
---

# PixiJS Scene Container

## Quick start

```ts
const group = new Container({
  label: "hero-group",
  x: 200,
  y: 150,
  sortableChildren: true,
});

group.addChild(body, head);
app.stage.addChild(group);
```

## zIndex sorting

```ts
const world = new Container({ sortableChildren: true });
ground.zIndex = 0;
player.zIndex = 10;
world.addChild(ground, player);
```

## Common mistakes

- Wrap leaves in a Container to group them.
- Use `.rectangle` on Bounds for Rectangle APIs.
- Use `cacheAsTexture()`, not `cacheAsBitmap`.
