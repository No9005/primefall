---
name: spritesheet-atlas-packing
description: Use when packing many isometric sprites into a texture atlas with a JSON map so the engine draws from one image with correct frame coordinates.
license: MIT
---

# Spritesheet & Atlas Packing

## Overview

An atlas packs sprites into one image plus a JSON map of frame rectangles. This reduces texture binds and enables named frame lookups.

## Process

1. Collect cleaned, transparent sprites into one folder.
2. Pad each frame by 1-2px to prevent texture bleeding.
3. Pack into a power-of-two atlas, such as 2048 x 2048.
4. Emit a JSON map with name, x, y, width, height, and anchor.
5. Preserve source anchors so placement stays correct.
6. Verify every sprite resolves by name and renders at the right anchor.

## Example

```json
{ "tree_oak": { "x": 0, "y": 0, "w": 128, "h": 160, "anchorX": 64, "anchorY": 150 } }
```

## Verification

- [ ] All sprites are packed into a power-of-two atlas with padding.
- [ ] The JSON map resolves every sprite by name with the correct anchor.
- [ ] No texture bleeding occurs at fractional zoom.
