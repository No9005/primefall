---
name: pixijs-scene-particle-container
description: Use when rendering thousands of lightweight sprites in PixiJS v8.
license: MIT
---

# PixiJS ParticleContainer

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

container.addParticle(new Particle({ texture, x: 100, y: 200 }));
app.stage.addChild(container);
```

## Rules

- Use `addParticle()`, not `addChild()`.
- All particles share one base texture.
- Set `boundsArea`.
- Use `particleChildren`, not `children`.
