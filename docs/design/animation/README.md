# Hero and effect animation: the design reference

This is what the Hero figures and the board effects look like and how they move. It was worked out with the product owner on a design canvas; the images and the `reference/` pages in this folder are the result. **Build it the way it is shown here.** Where this text and the images disagree, the images and the CSS in `reference/` win.

The final art (sprites, VFX assets) is produced separately (see `asset-contract.md`). Until it arrives the figures and effects are drawn with plain shapes, exactly like the reference: boxes, ellipses and polygons with a dark outline. Nothing here needs image files.

## How to read this folder

- `overview/*.png`: one picture per reference page, the whole sheet at once.
- `sheets/*.png`: **filmstrips**. One strip per animation, six frames taken at the times printed in each frame (milliseconds from the start of the animation). Read them left to right. "once" animations play one pass and then rest; "loop" animations repeat.
- `reference/*.html`: the live reference pages. **Open them in a browser to see the real motion.** Every animation is plain CSS `@keyframes` with the exact numbers (px at game size, degrees, percentages of the duration): those are the source of truth for angles, offsets and timing. Translate them one to one into the PixiJS rig and effects. The pages can be opened from disk, no server needed.
  - `BruiserPoses.html`, `AssassinPoses.html`, `ControllerPoses.html`: the figures and their poses.
  - `EffectsWeapons.html`, `EffectsField.html`, `OverdriveEffects.html`: the board effects.
  - `Squad.html`, `TeamColours.html`: the three Heroes next to each other, and the team colour options (option A, blue against red, was chosen).

Sheets by file: `bruiser-1..3`, `assassin-1..4`, `controller-1..4` (poses); `effects-weapons-1..2`, `effects-field-1..2`, `overdrive-1..3` (effects).

## Units and conventions

- All numbers are **px at game size**: a Hero is about 36 px tall, a tile is the 46 x 24 diamond. The reference pages magnify the figure 3 x for reading; the small copy in each corner is the real size.
- The origin of a figure is the **centre of its feet**; y grows downwards, so up is negative. A figure **faces right** (+x). An enemy is the same figure mirrored horizontally (`scaleX(-1)`).
- Angles are CSS angles: positive is **clockwise**. An arm that hangs down is 0 deg; pointing forward (to the right) is -90 deg; straight up is -180 deg.
- The animations are **deterministic**: no randomness; the same events always play the same way. Respect `prefers-reduced-motion`: no movement, only state changes and fades.
- Do not use filters (blur, drop shadow, brightness) in PixiJS: they are slow on phones. The reference uses a brightness filter for the hit flash; use a white tint or a white overlay instead. Glows are a few overlapping circles with falling alpha.

## The figure rig

Parts, in drawing order (back to front). All coordinates are at game size relative to the feet.

| Part | Box (x, y, w, h) | Pivot | Notes |
|---|---|---|---|
| Ring | ellipse 32 x 16, centred on (0, 0) | | 2.5 px, team colour: own `#2ec4b6`, enemy `#e5484d` |
| Back arm | (-12, -25, 4, 11) | shoulder (-10, -24) | rest angle +4 deg |
| Legs | L (-8, -10, 6, 10), R (2, -10, 6, 10) | hip, top centre | radius 3 |
| Torso group | origin (0, -10) | the hip | lean and bob move the whole group (body, head, arms, pads) |
| Body | (-9, -26, 18, 16), radius 6 | | with a lighter plate (8 x 5) on the chest |
| Head | (-5, -37, 10, 10), circle | bottom centre | a dark visor slit (5 x 2) on the facing side |
| Front arm | (8, -25, 4, 11) | shoulder (10, -24) | rest angle -30 deg; hand = 5 px circle at its end; the **weapon is a child of the front arm** and points along it |
| Wrapper effects | bubble, rubies, bolt, flash | | separate layers above the figure |

Every shape has a dark outline (`#0b1016`, 1.5 px on body and head, 1 px on limbs).

**Bruiser** (heavy): the parts above, plus two **shoulder pads** (11 x 9, radius 6, at (-15, -29) and (4, -29), drawn above the arms). Gun: 6 x 13, muzzle 24 px from the shoulder.

**Assassin** (light): body 14 wide, legs 5 wide, arms 3.5 wide; a long rifle (4 x 20, muzzle at 31 px from the shoulder, with a 6 x 3 cyan scope on it); an **angular hood** (18 x 16 polygon on the head, points in the reference CSS) with a cyan visor; a short, ragged **half-cape** (12 x 18 polygon hanging from the back of the shoulders, a gradient from the arm colour to the leg colour).

**Controller** (medium, tech): a **backpack** (7 x 11 at (-14, -27)), an **antenna** (2 x 15) on it with a 6 px yellow **beacon** that blinks (opacity 1 to 0.25, 1.4 s loop), a short pulse emitter (5 x 11) in the front hand, a cyan **wrist console** (6 x 5) on the back arm, a blue helmet with an amber visor.

### Team colours (decided)

Our Squad is the blue family, the enemy the red family, and the class is a shade inside the family (Bruiser darkest, Controller in the middle, Assassin lightest). Enemy visors glow red (`#ff5a5a`; Controller `#ff9a5a`). Colours: body / plate / legs / arms / accent (pads, helmet, hood).

| | Bruiser | Controller | Assassin |
|---|---|---|---|
| Own | `#2a56a8` `#5f8fe0` `#173a78` `#234a94` `#1f4488` | `#4f8fe6` `#a9ccff` `#2d5aa8` `#3f78d0` `#2a5fb8` | `#8ec3ff` `#d0e8ff` `#4a7ab8` `#6aa6ea` `#3a6ab0` |
| Enemy | `#a3212c` `#d8606a` `#6e141c` `#8c1b25` `#7a1822` | `#e04a44` `#ff9c96` `#9a2a2a` `#c93a38` `#b02e2e` | `#ff9a92` `#ffd0cc` `#b04a4a` `#e87a76` `#a63a3a` |

The class stays readable by **shape** (shoulder pads, antenna, hood), the team by **colour**. Weapon and effect colours (orange slug, light-blue tracer, blue orb, gold Overdrive) do not depend on the team.

## Clips (Hero poses)

Durations are the whole clip at normal speed. "Active" means from the start until the Hero is back at rest. The beats are where the action happens (from the start, in ms). The sheet and strip names are in the images.

| Clip | Class | Played for | Duration | Beats | Image |
|---|---|---|---|---|---|
| Idle | all | a Hero that does nothing | loop 2000 | breath peak at 1000 | `bruiser-1`, `assassin-1`, `controller-1` |
| Walk | all | `Step` | loop 640 (Assassin 500) | one stride per tile step: a half cycle per step | same |
| Wait | all | `Wait` | loop 3200 | look left at 830, right at 2200; a grey II mark above the head | same |
| Attack: Slam Shot | Bruiser | `AttackHit` / `AttackFailed` of Slam Shot, Concussion Round | once 2400 | aim 290-580, **fire 620**, settle 910, rest 1540 | `bruiser-1` |
| Attack: Precision Shot | Assassin | Precision Shot, Cover Breaker, Shield Breaker, Execution Round, Ghost Shot | once 2200 | aim 260-480, **fire 570**, rest 1450 | `assassin-1` |
| Attack: Long Shot | Assassin | Long Shot | once 3600 | kneel 290-790, scope glint 1370, **fire 1650**, stand 2590-3170 | `assassin-2` |
| Attack: Pulse Bolt | Controller | Pulse Bolt, Shock Pulse | once 2400 | raise 240-530, **fire 620**, rest 1630 | `controller-1` |
| Attack: Tag Round | Controller | Tag Round | once 2800 | raise, **fire 730**, reticle 1290-1400 | `controller-1` |
| Block | all | `ShieldGained` from a Block | once 3200 | crouch 320-700, bubble 900, release 2500-2900 | `bruiser-2`, `assassin-2`, `controller-3` |
| Hit | all | the target of `AttackHit` with Deck Damage | once 2600 | impact 310-360, settled 1350 | same |
| Hit, Shield absorbs | all | `AttackHit` with `absorbed > 0` and no `damage` | once 2600 | impact 310, ripple 420, one ruby bursts | `bruiser-2` |
| Take cover (half / full) | all | a Move that ends on Half or Full Cover | loop 4400 / 4800 | duck 440-1050 / slide in 0-1050 | `bruiser-3`, `assassin-3`, `controller-3` |
| In cover (half / full) | all | a Hero standing on Cover while idle | loop 3400 / 3600 (Assassin 2400 half, 4400 full: kneels and scans left and right through the scope) | peeks | same |
| Exhausted | all | `Exhausted` | once 5400 | hit 650, buckle 970-1840, fall 1840-3350, slab 4000-4860; **Bruiser falls backwards, Assassin backwards and flings the rifle forward (1400-2800), Controller topples forward with sparks** | `bruiser-3`, `assassin-4`, `controller-4` |
| Hidden | Assassin | `HiddenGained` | once 4200 | cloak sweep 670-1010, ghost 1260-3600, reveal 3860 | `assassin-2` |
| Slow pulse | Controller | Slow applied | once 2600 | fire 680, field 1200, field pulses at 1200/1560/1870/2180 | `controller-2` |
| Scout Drone | Controller | `AreaRevealed` | once 3600 | lift 500-800, fly 800-1650, hover 1650-2520, return 2520-3380 | `controller-2` |
| Aegis Protocol | Controller | Shield on an ally | once 3200 | raise 380-700, beam 900, dome 1340, hold to 2560 | `controller-2` |
| Deploy Cover / Fortify | Controller | `CoverPlaced` | once 3400 | slam 750-950, wall rises 1020-1430, holds to 2720 | `controller-3` |

The poses of a class differ on purpose: the Bruiser is heavy and slow, the Assassin light and quick, the Controller steady. Keep those differences.

## Effects

Each effect is a few shapes with an alpha curve. Timings are from the moment of the action (fire = the `fire` beat of the Hero's clip). Pictures: `effects-weapons-*`, `effects-field-*`, `overdrive-*`.

- **Muzzle flash**: a radial blob at the muzzle, 0 to 1.5 x scale over 70 ms, gone by 270 ms. Colour by weapon.
- **Projectile**: leaves at the fire beat. Slam slug: 11 x 5 orange, 0.10 px/ms. Precision tracer: a 24 x 2 light-blue streak, 0.30 px/ms. Pulse orb: 7 px, grows from 0.8 to 1.4 x on the way, 0.10 px/ms. Tag dart: 14 x 3 pink. Long Shot: no flight, an instant white-cyan line the whole way that fades over 450 ms, plus a red dotted laser (1 px) visible for 480 ms before the shot.
- **Impact** (when the projectile arrives): a burst (radial blob, 0.2 to 1.9 x over 330 ms), 3 to 4 sparks flying 9 to 18 px, a ground ring (ellipse that grows 0.5 to 2.2 x and fades over 500 ms). The target flashes white and is knocked 4 px back for 150 ms (the Hit clip).
- **Numbers**: rise 14 px over 800 ms while fading out. Deck Damage red `-2`, long-range bonus gold `-4`, Shield blue `Shield -2`, `Blocked` grey, `Out of range` grey. The first frame appears 20 ms after the impact.
- **Marked**: a red reticle (22 px ring with a cross) locks on from 2.4 x to 1 x scale, rotates 45 deg and stays until the end of the next Resolution, with a small `MARKED` tag.
- **Slow**: a violet ground field (34 x 16 ellipse) pulsing three times, and an icon of three stacked downward chevrons above the head until the end of the next Resolution.
- **Shockwave**: three expanding ground rings along the floor (orange, 48 x 24 growing to 3 x), dust puffs, and every enemy within Range 1 slides back two tiles (24 px per tile step, 300 ms) with a skid line and a `Knockback 2` tag.
- **Breach Charge**: the charge arcs (parabola, 26 px high) to the tile, a fireball (radial blob), smoke, the Cover breaks into 4 chunks that fly off, a dark scorch diamond stays.
- **Cover placed**: a team-coloured flash on the tile, a wall (34 x 12) rises out of the ground (scale 0 to 1.15 to 1) with dust. It stays until it is destroyed (no pips); the Squad's own Placed Cover carries four teal corner marks (docs/design/role-visuals/380/). **Half Cover reducing damage**: the projectile hits the wall, chips fly, `-1` with a `Half Cover` tag.
- **Shield**: three blue rubies pop above the Hero (scale 0 to 1.5 to 1), an ellipse bubble forms. Every absorbed hit: a ripple runs over the bubble and one ruby disappears; at zero the bubble breaks into five shards.
- **Scout Drone area**: a 3 by 3 diamond of fog tiles lifts from the middle outwards (cyan tint) while the drone hovers; enemies in it fade in; two pips count the Resolutions; then the fog closes. The drone circles over the area and sends scan rays down; the scanned Squad sees a dashed amber outline with a sweep and `SCANNED · n` (docs/design/role-visuals/380/).
- **Fog and Ghost**: an enemy that leaves sight fades to a 45 % alpha Ghost with a dashed ring and a `last seen` tag while fog rolls over the tile.
- **Prime Zone**: the 3 by 3 zone is grey (`#8a99a8` at 20 %) while empty, teal at 35 to 55 % when our Squad holds it with a ring pulse per Resolution, gold when the third is reached, amber when contested.
- **Overdrive** (gold `#ffb000` / `#ffd24a`): before the action the Hero gets a gold glow (radial blob), two gold rings rising from the ground and rising sparks with an `OVERDRIVE` tag; the effects are the normal ones but gold and stronger as shown in `overdrive-*`. Adrenal Surge leaves a small gold double-chevron badge with `+1` beside the Hero's ring until Exhaustion.

## Playback rules

- A Resolution Tick plays all actions of that Tick at the same time. **The Tick lasts until the slowest clip of that Tick has reached its active end** (at least one step of 450 ms). A tap on the speed control halves every duration.
- All durations are multiplied by one constant (`CLIP_SPEED`, default 1) so the product owner can tune the whole feel in one place.
- Effects follow the **events** of the Resolution (`Step`, `Wait`, `AttackHit`, `AttackFailed`, `ShieldGained`, `SlowApplied`, `MarkedApplied`, `HiddenGained`, `Knockback`, `CoverPlaced`, `CoverDestroyed`, `AreaRevealed`, `Exhausted`). The Hero's clip and the target's reaction are scheduled from the same event, so the impact lands when the projectile arrives.
- Fog of War holds: an effect is drawn only for events the player's Squad perceives.
- An animation never changes the rules or the final state: when it is skipped, cut short or reduced to a fade, the result on the board is the same.
- Performance target: a mid-range phone at 60 fps with six Heroes and several effects; draw with the Heroes' own Graphics, no filters, no per-frame allocation.
