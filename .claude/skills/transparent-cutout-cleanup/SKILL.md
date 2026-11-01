---
name: transparent-cutout-cleanup
description: Use when removing backgrounds from generated sprites to get clean alpha edges.
license: MIT
---

# Transparent Cutout Cleanup

## Process

1. Generate on a plain flat background.
2. Use a background-removal model.
3. Inspect edges at 400% zoom.
4. Defringe edge color.
5. Erode alpha by 1px if needed.
6. Save as PNG with straight alpha.
7. Batch cleaned sprites for the atlas packer.

## Verification

- [ ] Edges are clean on light and dark backgrounds.
- [ ] No background-color contamination.
- [ ] All sprites exported as straight-alpha PNG.
