---
name: pixijs-core-concepts
description: Use when understanding how PixiJS v8 renders frames and manages the render loop.
license: MIT
---

# PixiJS Core Concepts

## Quick start

```ts
console.log(app.renderer.name);

app.ticker.add((ticker) => {
  sprite.rotation += 0.01 * ticker.deltaTime;
});

app.renderer.render({ container: app.stage });
```

## References

- `references/renderers.md`
- `references/render-loop.md`

## Common mistakes

- Do not access renderer before init resolves.
- Set DOMAdapter before init for Workers/SSR.
- Check renderer.name before backend-specific code.
