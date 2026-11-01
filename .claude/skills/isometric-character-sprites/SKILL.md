---
name: isometric-character-sprites
description: Use when generating isometric characters in consistent 8 directions with a fixed feet-anchor and exaggerated Metal Slug-style movement poses.
license: MIT
---

# Isometric Character Sprites

## Process

1. Lock art direction and character height.
2. Generate the same character in 8 directions.
3. Keep proportions identical.
4. Fix seed/settings.
5. Clean alpha.
6. Define the feet-anchor.
7. Test by cycling directions.

## Movement poses (Metal Slug style)

Movement poses must be exaggerated and readable, in the spirit of Metal Slug:

- Strong, clear silhouettes — the pose must read instantly, even at small size.
- Exaggerated weight shifts — lean into the direction of movement.
- Big anticipation and follow-through — wind up before an action, overshoot after it.
- Dynamic limbs — arms and legs swing widely, never stiff or neutral.
- Head and torso lead the motion — the body follows the intended direction.
- Squash and stretch where appropriate — compress on impact, extend on release.
- Feet stay grounded per pose — the feet-anchor must remain consistent for depth sorting.

### Prompt additions for movement poses

When generating walk, run, attack, or reaction poses, add phrases like:

```text
exaggerated dynamic pose, strong silhouette, Metal Slug inspired action pose,
wide limb swing, leaned-forward running posture, dramatic follow-through,
clear readable silhouette, game-ready sprite
```

Avoid:

```text
neutral pose, stiff limbs, static standing, realistic proportions
```

## Verification

- [ ] 8 consistent directions exist.
- [ ] Feet-anchor is identical.
- [ ] Cycling directions shows no jump.
- [ ] Movement poses read as exaggerated and dynamic, Metal Slug-inspired.
- [ ] Silhouettes are clear at small size.
