---
name: spritesheet-atlas-packing
description: Use when packing many isometric sprites into a texture atlas with a JSON map.
license: MIT
---

# Spritesheet & Atlas Packing

## Process

1. Collect cleaned sprites.
2. Pad each frame by 1-2px.
3. Pack into a power-of-two atlas.
4. Emit a JSON map with name, rect, and anchor.
5. Preserve anchors.
6. Verify every sprite resolves by name.

## Example

```json
{ "tree_oak": { "x": 0, "y": 0, "w": 128, "h": 160, "anchorX": 64, "anchorY": 150 } }
```

## Verification

- [ ] Power-of-two atlas with padding.
- [ ] JSON map resolves every sprite.
- [ ] No texture bleeding.
