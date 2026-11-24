# Nachtbrand: a look preview for the neon megacity map

A first look at a fourth map, worked out with the product owner in a chat session: a megacity at night with wet, broken tar (potholes and craters), burning cars, towers with lit windows and neon, and high ground on fire escapes and parking garage decks. Rain, flames, smoke and flickering signs are live.

**Status: preview pages only. Nothing here is a tileset, nothing is in the app, and there is no map in `packages/game-core`.** `reference/looks.html` is a copy of the published artifact page "Neon City Preview" (open it in a browser to see the motion). It draws everything in code: a probe crossing ("Crater Corner") and one layout ("Crossfire Boulevard") on the 45 x 25 board with the Crossroads structure (the Prime Zone in a plaza, Outposts on the avenue, Drop Points at the ends of the boulevard).

Same scale as the other maps (tiles of 32 x 16 px, `docs/design/notstrom-map/`). The world frame is in `docs/design/world/README.md` ("Neon city: rain, signs, corporate towers"). Picture references from the owner: pixel-art cities in the rain, neon signs in pink, cyan and orange, a deep blue-violet night.

## What is decided and what is open

- **Owner's brief:** a megacity, plenty of tar, burning cars, high ground over houses (fire escapes, parking garages), tar with holes and broken spots, animation for mood such as rain.
- **Open, no rules:** burning cars as Full Cover (a fire that hurts or spreads would be a new rule); wrecks as Half Cover; potholes and craters as difficult terrain or deep Half Cover; high ground (not in the rules, ADR 0020); whether rain changes Line of Sight or sound; how the decks are entered (a proposal: by ramp or fire-escape tile only; a Hero on a deck sees two tiles further and loses Hidden to the street).
- **Readability:** tall buildings hide the street in an isometric view. In the layout the front quarters are about half as high and the blocks near the plaza lower; check this against the board scale and the Heroes (about 45 px).
- **The name** is **Nachtbrand** (the owner's pick from Teerfeuer, Glutgasse and Nachtbrand). The folder is still called `neon-city`.
- **Next step if wanted:** cut it into a tileset and an atlas as for `docs/design/jungle-field/` (PR #508), with the effects as frames.

## The backyard scene

`reference/backyard.html` is one scene instead of a board: a walled courtyard (15 x 14 tiles) behind two tenements and an annex. A burning car and burning barrels, a crater and potholes in the tar, dumpsters, crates, a chain-link fence with a gate, a clothesline between the walls, steam from a manhole, neon signs. High ground: the fire escapes and the flat roof of the annex. Rain, flames, smoke, steam and the flicker of the neon are live. Same engine as `looks.html`; the fence blocks movement but not sight (a proposal), dumpsters and crates are Half Cover candidates, burning things Full Cover candidates.
