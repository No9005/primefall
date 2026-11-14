# Role visuals: cover, buff badge and the drop animation

What the owner has approved from the design canvas (page "New role visuals" and "Symbols and statuses"). **Build it the way the images show it; where text and images disagree, the images win.** Pull, Charge, the Hidden-and-seen look (built in #432), the marks and chip of built cover and the Scout Drone area in both views (built in #433) are approved in `380/`. Sizes below are game px (a tile is the 46 x 24 diamond); the images are drawn at 2 x game size.

## Decisions

| What | Decision | Image |
|---|---|---|
| Natural Cover (the map's own Half and Full Cover) | **Shield panels** (option B): a flat dark plinth (2 px high) with two bluish, translucent panels on the two back edges of the tile, like the cover shields of XCOM. Half: panels 16 px high; Full: 34 px. Panel fill a gradient from blue `#4da3ff` at 55 % at the foot to 8 % at the top, a 1.5 px blue foot line, a thin top line at 70 %. Flat and see-through, so the tile reads as a place to stand in. The cover glyph (a shield, half-filled for Half Cover, filled for Full Cover) sits above the panels and above a Hero that stands in the cover. | `images/cover-natural.png` |
| Built Cover (Placed Cover: Deploy Cover, Fortify, Barricade) | **Construction bars** (option C): two bars along the two back edges, 7 px thick, with yellow `#ffd24a` and black `#14181e` diagonal stripes (4 px bands at -35 degrees) on the face and a light grey `#d9dee4` top. Half: 9 px high; Full: 22 px with a thin rail 10 px above it. The tile stays open. This look is for cover a Hero has **built**; the map's own cover keeps B. | `images/cover-built.png` |
| Both together | Natural cover is blue, built cover is striped, so a player sees at once what a Controller built. | `images/cover-natural-and-built.png` |
| Drop animation of built Cover (the Controller's card) | The same colours: a yellow dashed target on the tile and a growing shadow, a striped crate falls onto it (0.45 s, ease-in), lands with a yellow ring and grey dust (0.22 s, the tile flashes yellow), then unfolds into the striped bars (0.5 s, ease-out) and holds. Half Cover (Deploy Cover) and Full Cover (Barricade) use the same drop, ending at 9 px and 22 px. | `images/cover-drop.webp` (animated), stills `drop-1-falling.png`, `drop-2-landing.png`, `drop-3-built.png` |
| Permanent buff (Adrenal Surge, +1 Attack) | A small badge **above the Hero's head** (about 50 px over the feet): a rounded frame 30 x 13 px, radius 4, dark fill `#0b1016`, 1.2 px gold `#ffd24a` line; **inside** the frame a double chevron pointing up, **centred vertically**, and the text +1 right next to it (gold, Rajdhani 700, about 10 px). It stays until Exhaustion. (It used to sit beside the Squad ring.) | `images/permanent-buff-badge.png` |
| Shield | Unchanged: blue crystals above the Hero's head and the bubble in front of it. Shield 1 of a Charge is one crystal. | – |

## Approved in `380/`, all built
- **#432:** Pull, Charge (path, streaks, the Shield tag, the tags CLOSE +1 and CHARGE +1) and Hidden, seen by a drone (`380/pull.png`, `pull-in-fog.png`, `charge.png`, `hidden-seen.png`).
- **#433:** the four corner marks of built cover (teal for the Squad's own, red for the enemy's), the chip COVER ●●● 3 / 3, the dashed outline of the oldest cover and of the new tile when a fourth is planned, the oldest crumbling without a scorch (`380/placed-cover.png`), and the Scout Drone area: the drone circling with scan rays in your view, a dashed amber outline with a sweep and `SCANNED · n` in the enemy's (`380/scout-drone-*.png`).

## How a ticket uses this
Take screenshots with the screenshot tool (844 x 390) of the states you touched and compare them with the images: shapes, colours, heights, the vertical centring of the chevrons in the badge, the yellow-black stripes. Fix every deviation yourself.
