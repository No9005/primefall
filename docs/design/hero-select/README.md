# Hero Select: the design reference

The look of the Hero Select screen and of the poses its three Heroes strike. It was worked out with the product owner on the design canvas. **Build it the way it is shown here.** Where this text and the images disagree, the images and the CSS in `reference/` win. Decisions behind it: ticket #318 (and #319, the Player Hero parameter it builds on).

## Update: Hero Names, bigger Heroes, the BIO sheet (design canvas page "Hero Select: names and bios", variant A)

Chosen by the product owner. **Where this section differs from the table below, this section wins.** The pictures are `overview/names-controller.png` and `overview/names-bio.png` (screenshots of the game at 844 x 390).

- **Heroes:** the sprites are drawn at 3 screen px per sprite px (before: 2); the feet of every Hero stand at y 214 (area top 56, feet 158 inside it); the tap area of a Hero is 240 x 238.
- **Under each Hero:** its **Hero Name** (Rajdhani 700 19 px, letter spacing 0.12 em, white; teal when selected) at y 246, and its class (Rajdhani 600 12 px, letter spacing 0.2 em, muted) at y 270. No bar under the name.
- **The band below:** only the role text (Barlow 500 14 px, line height 20, at (40, 298), 600 wide), and **under it** the two quiet pills VIEW CARDS and BIO at (40, 344), 10 px apart, 32 high. BIO has a teal border. With no Hero selected the band shows TAP A HERO and its text and no buttons. START stays at the right.
- **The BIO sheet** (a sheet like the card list: 764 x 358 at (40, 16) over the 72 % dark overlay, background `#151b23`, border 1 px `#2a3643`): no title and no divider, only the close button (40 x 40) at the top right (right 14, top 14). The close-up (240 x 224, steel border, from `bio.png` at 8 x) at (28, 62) in the sheet. Right of it, from y 57 and flush with the top of the close-up: the Hero Name (Rajdhani 700 32 px, 36 line height), the class in teal (700 13 px, letter spacing 0.2 em), the bio (Barlow 15 px, line height 22, 16 px below), then the line of the Hero in italic with quotation marks (14 px below).
- **The words** are in `apps/web/src/hero-select.ts` (`HERO_PROFILES`); their source is `docs/design/world/README.md`.
- **The background grid** is visible (lines at 5.5 % white) and drifts diagonally, one cell (64 x 36 px) in 36 s; with reduced motion it stands still.

## Files

- `overview/screen-1-idle.png` … `screen-5-cards.png`: the five states of the screen at 844 x 390 (landscape phone). **This is what your own screenshot is compared with.** `overview/HeroSelectScreen.png` shows all five on one sheet.
- `overview/HeroSelectPoses.png`: the idle and ready pose of each Hero (a moment taken from the transition).
- `sheets/bruiser-ready.png`, `controller-ready.png`, `assassin-ready.png`: filmstrips of the ready transition, six frames at the times printed on each.
- `reference/HeroSelectPoses.html`, `reference/HeroSelectScreen.html`: the live pages. **Open them in a browser to see the real motion.** Every pose animation is plain CSS `@keyframes` with the exact numbers; the figure rig, the colours and the units are the ones of `docs/design/animation/README.md` (px at game size, angles in CSS degrees: 0 = arm hangs down, -90 = forward, -180 = up, positive = clockwise). Only the poses are new.

## The screen (844 x 390, all numbers in CSS px)

| Element | Size and position | Look |
|---|---|---|
| Background | the whole screen | graphite `#12161c` with the faint tile grid of the board |
| Back button | **40 high, at (24, 12)**, a pill; one of the two most important controls, so it stands out | fill steel at 70% (`rgba(61,90,115,0.7)`), border 2 px `#dbe4ec`, "BACK" with an arrow in white, Rajdhani 700 16 px, letter spacing 0.1 em |
| Title | centred, top 20 | "CHOOSE YOUR HERO", Rajdhani 700 18 px, letter spacing 0.22 em |
| Mode chip | 30 high, right 24, top 17, a pill | text "CLASSIC" (teal `#2ec4b6`), "ATTACK" (orange `#ff8a3d`) or "DEFEND" (blue `#4da3ff`), Rajdhani 700 13 px; border 1.5 px and text in that colour, no fill |
| Hero areas | three invisible tap areas, 240 x 190, tops at 64, lefts at 24, 302, 580 (pitch 278); **no boxes, no frames** | the Heroes stand directly on the board background, feet at (120, 118) inside the area, magnified **2.5 x**; the name (Rajdhani 700 19 px, letter spacing 0.12 em) sits at the bottom of the area, about 30 px below the Squad ring; **selected**: the name turns teal and a 36 x 3 px teal bar sits under it; the others have a white name. No class line under the name (the info text starts with it). |
| Selected Bruiser | its feet move left to x 62 inside its area so its shots (38 px tracer) stay inside the area | |
| Free space | at least 24 px at the screen edges, at least 30 px between the Heroes' names and the info text, 10 px between the info text and View cards; do not add boxes or dividers | the screen is meant to feel light |
| Info text | (40, 276), 560 wide, **no box** | plain text on the background: name in teal (Rajdhani 700 17 px, letter spacing 0.12 em), text Barlow 500 14 px, line height 1.35; empty state: "TAP A HERO" in the same style and one line of Barlow 14 px |
| View cards button | **small and quiet**: 10 px under the info text, left-aligned with it, 32 high, a pill | 1 px steel border `#3d5a73`, text `#aebccb`, Rajdhani 600 13 px, letter spacing 0.08 em |
| Start button | 160 x 48, right 24, bottom 20, radius 24; with Back the most important control | enabled: teal fill, graphite text, Rajdhani 700 20 px, letter spacing 0.12 em; **disabled** (nothing selected): no fill, steel border, muted text `#8a99a8` |
| Card list | opens as a sheet at (40, 16), 764 x 358, padding 14 / 24, over a 72% dark overlay | header 48 high with 10 px below it: "CONTROLLER: 12 CARDS" teal 19 px and a close button 40 x 40 at the right that never touches a table line; one row per card, 29 high with a 1 px line `#26313d` between rows: name (Rajdhani 700 16 px), type (orange Attack, cyan Utility), cost (orange mono), effect (Barlow 14 px); duplicates written "x2" |

Texts of the info box (decided by the owner, each on two lines at 560 px): Bruiser: "Tank and enabler. +1 damage at Range 1." Controller: "Support. Builds lasting Cover, shields allies and sends the Scout Drone anywhere on the map. One weak attack." Assassin: "Glass cannon. Deals damage from range and hides with Vanish. Cannot hit what stands next to it." The cards in the list come from the card display data of `game-core` (`docs/specs/mvp-card-set.md` is the source), not typed again.

Touch targets and text follow `docs/design/decisions.md` (primary controls at least 40 x 40, text at least 12 px, contrast 4.5:1).

## The poses

| Hero | Idle (loop) | Ready, on select (plays once in the game, then holds) |
|---|---|---|
| Bruiser | Muzzle pointed at the sky (front arm -168 deg to -175 deg), head tilted up, breathing. 2 s | The front arm swings to -94 deg between 6% and 16% of 6 s, three shots at 22%, 34%, 46% (muzzle flash, recoil of the torso to -9 deg and 3 px back, a 38 px tracer on the screen, 60 px on the sheet), holds the aim at about -93 deg and breathes. Then it stays aimed to the side. |
| Controller | Scout Drone in the hand (arm -72 deg to -86 deg), tossed 9 px up and caught, the head follows it, the emitter stowed. 2.4 s | The arm lifts to -165 deg and the drone is released (18%), it flies out and hovers about 30 px over the Hero, bobbing; the head looks up; the emitter fades in and the arm comes down to -78 deg. Then the drone keeps hovering and bobbing. |
| Assassin | Calm: the rifle held up in front of the face (arm -128 deg to -116 deg), the head tilted down 10 to 14 deg, a cyan glint over the scope. 3.2 s | The rifle is lowered to -30 deg (6% to 30%), a cyan shimmer (brightness 2.2 for a moment), then the Hero is about 35% visible, the ring at 25%, a small cyan "Hidden" label floats up. Then it stays in that Hidden look. |

Tapping the selected Hero plays its ready transition again from the start. Tapping another Hero returns the previous one to its idle pose and plays the new one. With `prefers-reduced-motion`: no animation, the static last frame of the ready transition (and the idle poses held still). These poses are for this screen only; on the board the Heroes keep their clips.

## Alignment (check this explicitly; the owner does not want rounds of micro corrections)

- **Icons and labels in a button**: the arrow of Back and Next is a drawn icon (SVG or a Pixi shape), **not a text glyph** (a glyph falls back to another font and sits too low). Its vertical centre is the vertical centre of the capital letters of the label, the gap to the label is 8 px (Back) and 10 px (Next), and icon plus label together are centred in the pill. Compare the cropped buttons in the images.
- **Shared centre lines**: Back, the title and the mode chip share one vertical centre (y 32); the Start/Next button and its neighbours share their right edge (right 24); the chip's right edge and the Start/Next button's right edge are the same x.
- **Shared edges**: the left edge of the Back button, of the info text and of the View cards button is the same x where the references show it so (Back at 24, text and View cards at 40 on the Hero Select screen). Hero names are centred under their Heroes' Squad rings.
- **Rows**: elements in a row have the same height and the same top (the two role buttons, the three Hero areas); gaps between them are equal.
- Spacing and sizes are multiples of 2 px, as in the tables. A deviation of more than 1 px from the table is a defect to fix, not to list.

## How a ticket uses this

Take a screenshot of each state with the screenshot tool (a scenario for the Hero Select is part of ticket #318), compare it with the matching `overview/screen-*.png` and the table above, fix every deviation yourself (sizes, positions, colours, the pose at the moment shown in the sheets) and attach the final screenshots to the pull request.
