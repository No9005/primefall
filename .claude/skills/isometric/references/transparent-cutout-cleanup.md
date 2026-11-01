# Transparent Cutout Cleanup

## Overview

AI-generated sprites come on a background. Naive removal leaves a colored halo or jagged edge. This skill produces clean alpha cutouts.

## Process

1. Generate on a plain flat background.
2. Use a background-removal model rather than a hard color key.
3. Inspect edges at 400% zoom for halo or fringe pixels.
4. Defringe edge color so no background tint remains.
5. Erode alpha by 1px if a faint halo persists.
6. Save as PNG with straight alpha; verify on light and dark backgrounds.
7. Batch cleaned sprites for the atlas packer.

## Verification

- [ ] Edges are clean at 400% zoom on light and dark backgrounds.
- [ ] No background-color contamination on semi-transparent pixels.
- [ ] All sprites exported as straight-alpha PNG.
