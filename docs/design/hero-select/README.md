# Hero Select: the design reference

The look of the Hero Select screen and of the poses its three Heroes strike. It was worked out with the product owner on the design canvas. **Build it the way it is shown here.** Where this text and the images disagree, the images and the CSS in `reference/` win. Decisions behind it: ticket #318 (and #319, the Player Hero parameter it builds on).

## Files

- `overview/screen-1-idle.png` … `screen-5-cards.png`: the five states of the screen at 844 x 390 (landscape phone). **This is what your own screenshot is compared with.** `overview/HeroSelectScreen.png` shows all five on one sheet.
- `overview/HeroSelectPoses.png`: the idle and ready pose of each Hero (a moment taken from the transition).
- `sheets/bruiser-ready.png`, `controller-ready.png`, `assassin-ready.png`: filmstrips of the ready transition, six frames at the times printed on each.
- `reference/HeroSelectPoses.html`, `reference/HeroSelectScreen.html`: the live pages. **Open them in a browser to see the real motion.** Every pose animation is plain CSS `@keyframes` with the exact numbers; the figure rig, the colours and the units are the ones of `docs/design/animation/README.md` (px at game size, angles in CSS degrees: 0 = arm hangs down, -90 = forward, -180 = up, positive = clockwise). Only the poses are new.

## The screen (844 x 390, all numbers in CSS px)

| Element | Size and position | Look |
|---|---|---|
| Background | the whole screen | graphite `#12161c` with the faint tile grid of the board |
| Back button | 44 high, at (8, 6), a pill | steel border `#3d5a73`, "BACK" with an arrow, Rajdhani 700 16 px, letter spacing 0.1 em |
| Title | centred, top 12 | "CHOOSE YOUR HERO", Rajdhani 700 20 px, letter spacing 0.22 em |
| Mode chip | 34 high, right 8, top 10, a pill | text "CLASSIC" (teal `#2ec4b6`), "ATTACK" (orange `#ff8a3d`) or "DEFEND" (blue `#4da3ff`); border and text in that colour |
| Hero cards | three, 268 x 208, tops at 58, lefts at 8, 288, 568 | panel `#1b222b`, border 2 px steel; **selected**: border teal, background `#1b2a33` |
| Hero in a card | feet at (134, 132) inside the card, magnified **2.5 x**; the ground tile (46 x 24 diamond, `#243040`) and the Squad ring under the feet | the same rig and own-Squad colours as `Squad.html`; the Bruiser of the selected card is shifted left (feet at x 70) so its shots stay inside the card |
| Name and class | at the bottom of the card | name Rajdhani 700 20 px, letter spacing 0.1 em; class line (Frontline, Support, Scout and striker) Rajdhani 12 px `#aebccb` |
| Info box | (8, 274), 636 x 108, radius 8 | panel `#1b222b` at 97%, border 1.5 px steel; empty state: "TAP A HERO" (Rajdhani 700 18 px) and one line of Barlow 14 px; with a Hero: the name in teal (Rajdhani 700 20 px) and the text (Barlow 500 14 px, line height 1.3, 470 px wide) |
| View cards button | at the right of the info box, 44 high, a pill | teal border and text, Rajdhani 700 16 px |
| Start button | 176 x 56, right 8, bottom 8, radius 28 | enabled: teal fill, graphite text, Rajdhani 700 22 px, letter spacing 0.12 em; **disabled** (nothing selected): no fill, steel border, muted text `#8a99a8` |
| Card list | opens as a sheet at (40, 12), 764 x 366, over a 72% dark overlay | header "CONTROLLER: 12 CARDS" teal; a close button 44 x 44; one row per card, 32 high: name (Rajdhani 700 16 px), type (orange Attack, cyan Utility), cost (orange mono), effect (Barlow 14 px); duplicates written "x2" |

Texts of the info box (a first draft, the owner corrects them): Bruiser: "Frontline. Controls close space and the Prime Zone, soaks damage with Shield and breaks Cover with its Zone Overdrive." Controller: "Support. Enables the Squad with Shield, Vision, Cover deployment, Slow and Marked effects." Assassin: "Scout and striker. Scouts from Hidden, marks targets and punishes exposed enemies from long range." The cards in the list come from the card display data of `game-core` (`docs/specs/mvp-card-set.md` is the source), not typed again.

Touch targets and text follow `docs/design/decisions.md` (primary controls at least 40 x 40, text at least 12 px, contrast 4.5:1).

## The poses

| Hero | Idle (loop) | Ready, on select (plays once in the game, then holds) |
|---|---|---|
| Bruiser | Muzzle pointed at the sky (front arm -168 deg to -175 deg), head tilted up, breathing. 2 s | The front arm swings to -94 deg between 6% and 16% of 6 s, three shots at 22%, 34%, 46% (muzzle flash, recoil of the torso to -9 deg and 3 px back, a 38 px tracer on the screen, 60 px on the sheet), holds the aim at about -93 deg and breathes. Then it stays aimed to the side. |
| Controller | Scout Drone in the hand (arm -72 deg to -86 deg), tossed 9 px up and caught, the head follows it, the emitter stowed. 2.4 s | The arm lifts to -165 deg and the drone is released (18%), it flies out and hovers about 46 px over the Hero, bobbing; the head looks up; the emitter fades in and the arm comes down to -78 deg. Then the drone keeps hovering and bobbing. |
| Assassin | Calm: the rifle held up in front of the face (arm -128 deg to -116 deg), the head tilted down 10 to 14 deg, a cyan glint over the scope. 3.2 s | The rifle is lowered to -30 deg (6% to 30%), a cyan shimmer (brightness 2.2 for a moment), then the Hero is about 35% visible, the ring at 25%, a small cyan "Hidden" label floats up. Then it stays in that Hidden look. |

Tapping the selected Hero plays its ready transition again from the start. Tapping another Hero returns the previous one to its idle pose and plays the new one. With `prefers-reduced-motion`: no animation, the static last frame of the ready transition (and the idle poses held still). These poses are for this screen only; on the board the Heroes keep their clips.

## How a ticket uses this

Take a screenshot of each state with the screenshot tool (a scenario for the Hero Select is part of ticket #318), compare it with the matching `overview/screen-*.png` and the table above, fix every deviation yourself (sizes, positions, colours, the pose at the moment shown in the sheets) and attach the final screenshots to the pull request.
