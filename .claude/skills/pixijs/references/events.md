# PixiJS Events

PixiJS uses a federated event system that mirrors DOM events on the scene graph.

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

- `none`: no interaction; children are ignored.
- `passive`: default; object is not interactive, but interactive children work.
- `auto`: hit tested only when a parent is interactive.
- `static`: standard interaction for buttons, tiles, and drag targets.
- `dynamic`: like static, plus synthetic hover events for animated objects.

## Pointer events

Use pointer events for cross-device input:

- `pointerdown`
- `pointerup`
- `pointerupoutside`
- `pointermove`
- `pointerover`
- `pointerout`
- `pointertap`
- `pointercancel`

## Dragging

Use `globalpointermove` for drag operations; normal move events fire only while the pointer is over the object.

```ts
sprite.on("globalpointermove", (event) => {
  if (dragging) {
    sprite.position.set(event.global.x, event.global.y);
  }
});
```

## Hit areas

Use a `hitArea` to override bounds-based hit testing:

```ts
sprite.hitArea = new Rectangle(0, 0, 100, 50);
```

## Common mistakes

- Set `eventMode = "static"` before adding listeners.
- Use `cursor = "pointer"`, not the removed `buttonMode`.
- Use `globalpointermove` for global drag tracking.
