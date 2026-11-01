---
name: isometric-art-direction
description: Use when starting an isometric project to lock ONE consistent art style before generating any asset.
license: MIT
---

# Isometric Art Direction

## Overview

This skill produces a one-page style sheet that every other asset skill must obey.

## Process

1. Fix the projection: true 2:1 isometric.
2. Fix the light direction.
3. Define a tight color palette.
4. Define the tile base size and anchor point.
5. Pick ONE shading style.
6. Write everything into a single STYLE.md.
7. Generate 3 test assets before scaling up.

## Verification

- [ ] A STYLE.md exists.
- [ ] 3 test assets look like the same game.
- [ ] Every asset prompt references the style sheet.
