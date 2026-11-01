---
name: pixijs
description: Entry point for PixiJS v8 tasks; routes to specialized skills for application, scene graph, assets, events, color, math, ticker, performance, filters, and rendering.
license: MIT
---

# PixiJS v8 Skill Router

PixiJS is a fast 2D rendering library for the web using WebGL, WebGPU, and Canvas fallback.

## How to use this skill

1. Find the specialized skill matching the task.
2. Load that skill's `SKILL.md` and follow its guidance.
3. For API details not covered by a sub-skill, consult the official PixiJS documentation.

## Skill router

### Foundations

| Skill | Use for |
|---|---|
| `pixijs-application` | Creating and configuring a PixiJS Application. |
| `pixijs-core-concepts` | Renderer pipeline, render loop, systems, and render targets. |
| `pixijs-create` | Project scaffolding and TypeScript setup. |
| `pixijs-environments` | Web Workers, Node/SSR, and strict-CSP contexts. |
| `pixijs-migration-v8` | Upgrading from PixiJS v7. |
| `pixijs-scene-core-concepts` | Scene graph, transforms, render order, masking, and layers. |

### Scene objects

| Skill | Use for |
|---|---|
| `pixijs-scene-container` | Containers, transforms, zIndex, bounds, and coordinate conversion. |
| `pixijs-scene-sprite` | Sprite, AnimatedSprite, NineSliceSprite, and TilingSprite. |
| `pixijs-scene-graphics` | Vector shapes, paths, fills, strokes, and gradients. |
| `pixijs-scene-text` | Text, BitmapText, HTMLText, and text styles. |
| `pixijs-scene-mesh` | Custom geometry and meshes. |
| `pixijs-scene-particle-container` | High-performance particle rendering. |
| `pixijs-scene-dom-container` | HTML overlays on the canvas. |

### Utilities

| Skill | Use for |
|---|---|
| `pixijs-assets` | Loading textures, sprite sheets, fonts, JSON, and bundles. |
| `pixijs-color` | Colors, tints, and color conversion. |
| `pixijs-events` | Pointer, mouse, touch, and wheel input. |
| `pixijs-math` | Points, vectors, matrices, shapes, and hit testing. |
| `pixijs-ticker` | Frame updates and render-loop control. |

### Advanced

| Skill | Use for |
|---|---|
| `pixijs-accessibility` | Screen-reader and keyboard accessibility. |
| `pixijs-blend-modes` | Advanced compositing. |
| `pixijs-custom-rendering` | Custom shaders, uniforms, and render pipes. |
| `pixijs-filters` | Visual effects and filters. |
| `pixijs-performance` | Profiling and optimizing FPS, draw calls, and GPU memory. |
