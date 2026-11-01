---
name: pixijs-events
description: Use when handling pointer, mouse, touch, or wheel input in PixiJS v8.
license: MIT
---

# PixiJS Events

## Quick start

```ts
const button = new Sprite(texture);
button.eventMode = "static";
button.cursor = "pointer";
app.stage.addChild(button);

button.on("pointertap", (event) => {
  console.log("clicked at", event.global.x, event.global.y);
});
```

## Event modes

- `none`
- `passive`
- `auto`
- `static`
- `dynamic`

## Dragging

```ts
sprite.on("globalpointermove", (event) => {
  if (dragging) {
    sprite.position.set(event.global.x, event.global.y);
  }
});
```

## Common mistakes

- Set `eventMode = "static"` before adding listeners.
- Use `cursor = "pointer"`, not `buttonMode`.
- Use `globalpointermove` for drag.
