---
name: pixijs-scene-container
description: Use when grouping, positioning, or transforming display objects in PixiJS v8.
license: MIT
---

# PixiJS Scene Container

`Container` is the general-purpose node of the PixiJS v8 scene graph. It holds children and applies transforms, alpha, tint, and blend mode to its subtree.

## Quick start

```ts
const group = new Container({
  label: "hero-group",
  x: 200,
  y: 150,
  sortableChildren: true,
});

const body = new Sprite(texture);
const head = new Sprite(headTexture);
head.position.set(0, -40);
head.zIndex = 1;

group.addChild(body, head);
app.stage.addChild(group);
```

## Adding and removing children

```ts
parent.addChild(a, b, c);
parent.removeChild(b);
parent.removeChildren();
```

Children render in array order: index 0 is drawn first, the last index is drawn last.

## Transforms

```ts
obj.x = 100;
obj.y = 200;
obj.scale.set(2);
obj.rotation = Math.PI / 4;
obj.pivot.set(50, 50);
obj.alpha = 0.5;
obj.tint = 0xff0000;
```

## zIndex sorting

```ts
const world = new Container({ sortableChildren: true });

ground.zIndex = 0;
player.zIndex = 10;
ui.zIndex = 100;

world.addChild(ground, player, ui);
```

When `sortableChildren` is true, children are sorted by `zIndex` before rendering.

## Bounds and coordinates

```ts
const bounds = container.getBounds();
const global = container.toGlobal(new Point(10, 20));
const local = container.toLocal(global);
```

## Common mistakes

- Sprites, Graphics, Text, and Mesh are leaves; wrap them in a Container to group them.
- `getBounds()` returns a `Bounds` object; use `.rectangle` for Rectangle-specific APIs.
- Use `cacheAsTexture()`, not the removed `cacheAsBitmap` property.
- Use `label`, not the deprecated `name`, for child lookup.
