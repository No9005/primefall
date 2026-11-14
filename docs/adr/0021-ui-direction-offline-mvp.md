# UI Direction of the Offline MVP

The offline MVP is played in landscape on a phone, with the whole board always visible, cards played by dragging, and terrain drawn from the grid. This records decisions that were made in tickets (#97, #98, #114 to #126, #131) and in chat, so that `docs/design/ui-spec.md` can point here.

## Orientation and fit

- Landscape only. Portrait shows a "Rotate your device" notice.
- The whole board is always visible at the fitted scale, also after a resize or rotation. Zoom and pan are for details: pinch (or the mouse wheel), one-finger pan only while zoomed, a Zoom/Fit button, and an automatic zoom when a Move is planned.

## Layout

- Top left: the Squad panel with the Queue window. Top right: chips for the enemy Heroes.
- A thin top pill with the Round, the Prime Zone progress and the timer.
- Bottom left: the card fan with the effect text of the card. Next to it the Energy orb. Bottom right: Commit.

## Input

Cards are played by dragging them onto a zone:

| Drop on | Result |
|---|---|
| An enemy | Primary effect |
| A tile | Move 2 |
| Near the Hero | A Primary effect that needs no target |
| The Block chip | Block 2 |
| The Energy orb | Pitch |

The tap flow stays as a fallback. A card with Overdrive shows the Normal and the Overdrive face side by side; the player chooses by the face the card is dropped as.

## Board rotation

Eight fixed views, 45 degrees apart, switched with two buttons and a short animation. Heroes always face the camera.

## Terrain is drawn from the grid

In the Original style, floor, Walls, Cover, the Overwatch Nest, the Prime Zone, the Outposts and the Spawn tiles are shapes computed from the grid and the view angle, not sprites. In the Pixel art style the terrain is built from the tileset "Notstrom" (see Style); the grid still decides what goes where. In both styles:

- A thin wall kit: wall, corner, pillar, and low wall (Half Cover, with a yellow top edge).
- A lit field of view and dark fog. Nothing is visible behind Walls.
- A shot line: teal and dashed when clear; red and dotted with a cross when blocked. Cover on the line is marked.

## Style

Clear and graphic for the MVP. The final look is 8/16-bit pixel art in a dirty sci-fi setting, in the spirit of Final Fantasy Tactics and Jetpack Joyride. Pixel art is the default style and shows the terrain in **one fixed view**: the tileset is drawn for one angle, so the board has no rotation and zooms in whole steps (0.5x, 1x, 2x) with nearest-neighbour scaling. The eight views remain for the Original style.

## Map principles

The map itself is decided in ADR 0016. Its principles: one open Prime Zone in the middle; the middle channel is a fast, exposed shooting channel; the flanks are covered stalking routes with ambush spots; no pillars until a mechanic exists for them.
