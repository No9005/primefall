---
name: pixijs-scene-particle-container
description: Use when rendering thousands of lightweight sprites in PixiJS v8.
license: MIT
---

# PixiJS ParticleContainer

`ParticleContainer` renders hundreds to tens of thousands of lightweight particles efficiently.

## Quick start

```ts
const container = new ParticleContainer({
  texture,
  boundsArea: new Rectangle(0, 0, app.screen.width, app.screen.height),
  dynamicProperties: {
    position: true,
    rotation: false,
    color: false,
  },
});

container.addParticle(
  new Particle({
    texture,
    x: 100,
    y: 200,
    anchorX: 0.5,
    anchorY: 0.5,
  }),
);

app.stage.addChild(container);
```

## Rules

- Add `Particle` instances with `addParticle()`, not Sprites with `addChild()`.
- All particles in one container must share the same base texture source.
- Set `boundsArea`; otherwise culling and hit testing can fail.
- Mark only animated properties as dynamic.
- Use `particleChildren`, not `children`, to inspect particles.

## Limitations

- No filters, masks, or per-particle blend modes.
- No nested children on particles.
- Wrap the ParticleContainer in a normal Container to group it with other scene objects.
