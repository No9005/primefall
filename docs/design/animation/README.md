# Hero and effect animation: the design reference

How the board effects look and move, and the timing the Hero clips are played with. It was worked out with the product owner on a design canvas. **Build it the way it is shown here.** Where this text and the images disagree, the images and the CSS in `reference/` win.

**The Heroes themselves are pixel-art sprite sheets** (`apps/web/public/assets/heroes/<class>/`, format and clips: `docs/design/heroes/README.md`, loaded by `apps/web/src/heroes.ts`). The earlier shape rig (boxes and ellipses, a 36 px figure) and its pose pages were removed; the sheets are the reference for how a Hero looks and moves. This page keeps what still holds: the effects, the beats of the clips (when an effect starts), the team colours and the playback rules.

## How to read this folder

- `overview/*.png`: one picture per reference page, the whole sheet at once.
- `sheets/*.png`: **filmstrips**. One strip per animation, six frames taken at the times printed in each frame (milliseconds from the start). Read them left to right.
- `reference/*.html`: the live reference pages. **Open them in a browser to see the real motion.** Every animation is plain CSS `@keyframes` with the exact numbers (px at game size, degrees, percentages of the duration): those are the source of truth for offsets and timing. The pages can be opened from disk, no server needed.
  - `EffectsWeapons.html`, `EffectsField.html`: the board effects. Sheets `effects-weapons-1..2`, `effects-field-1..2`.
  - `TeamColours.html`: the team colour options (option A, blue against red, was chosen). The sprites carry **no** team colour: the Squad is told by the ring the renderer draws under the feet (own `#2ec4b6`, enemy `#e5484d`, see `apps/web/src/hero-style.ts` and `docs/design/decisions.md`).

## Units and conventions

- Numbers are **px at game size**: a tile is the 46 x 24 diamond; a Hero sprite frame is 136 x 104 px, scaled by 2 (a Hero is about 90 px tall on the board). Some effect numbers below were written for the old 36 px figure; where an effect sits on a Hero, the code (`effects-layer.ts`, `hero-style.ts`) holds the final offsets.
- The origin of a Hero is the **centre of its feet**; y grows downwards, so up is negative. A Hero **faces right** (+x); an enemy is the same sprite mirrored (`scale.x = -1`).
- The animations are **deterministic**: no randomness; the same events always play the same way. Respect `prefers-reduced-motion`: no movement, only state changes and fades.
- Do not use filters (blur, drop shadow, brightness) in PixiJS: they are slow on phones. Use a white tint or a white overlay for the hit flash. Glows are a few overlapping circles with falling alpha.

## Clips (Hero poses)

Durations are the whole clip at normal speed; the sheets of `docs/design/heroes/` (`clips.json` per class) play them. "Active" means from the start until the Hero is back at rest. The beats are where the action happens (from the start, in ms); the effects below start at these beats. The last column is the clip name in `clips.json` (the Bruiser has more clips for the cards of its Deck, the Hero Select has `select_*`; the lists are in `clips.json`).

| Clip | Class | Played for | Duration | Beats | Clip name |
|---|---|---|---|---|---|
| Idle | all | a Hero that does nothing | loop 2000 | breath peak at 1000 | `idle` |
| Walk | all | `Step` | loop 640 (Assassin 500) | one stride per tile step: a half cycle per step | `walk` |
| Wait | all | `Wait` | loop 3200 | look left at 830, right at 2200; a grey II mark above the head | `wait` |
| Attack: Slam Shot | Bruiser | `AttackHit` / `AttackFailed` of Slam Shot, Concussion Round | once 2400 | aim 290-580, **fire 620**, settle 910, rest 1540 | `slam` |
| Attack: Precision Shot | Assassin | Precision Shot, Cover Breaker, Shield Breaker, Execution Round, Ghost Shot | once 2200 | aim 260-480, **fire 570**, rest 1450 | `precision` |
| Attack: Long Shot | Assassin | Long Shot | once 3600 | kneel 290-790, scope glint 1370, **fire 1650**, stand 2590-3170 | `long` |
| Attack: Pulse Bolt | Controller | Pulse Bolt, Shock Pulse | once 2400 | raise 240-530, **fire 620**, rest 1630 | `pulse` |
| Attack: Tag Round | Controller | Tag Round | once 2800 | raise, **fire 730**, reticle 1290-1400 | `tag` |
| Block | all | `ShieldGained` from a Block | once 3200 | crouch 320-700, bubble 900, release 2500-2900 | `block` |
| Hit | all | the target of `AttackHit` with Deck Damage | once 2600 | impact 310-360, settled 1350 | `hit` |
| Hit, Shield absorbs | all | `AttackHit` with `absorbed > 0` and no `damage` | once 2600 | impact 310, ripple 420, one ruby bursts | `shield` |
| Take cover (half / full) | all | a Move that ends on Half or Full Cover | loop 4400 / 4800 | duck 440-1050 / slide in 0-1050 | `half`, `full` |
| In cover (half / full) | all | a Hero standing on Cover while idle | loop 3400 / 3600 (Assassin 2400 half, 4400 full: kneels and scans left and right through the scope) | peeks | `half`, `full` |
| Exhausted | all | `Exhausted` | once 5400 | hit 650, buckle 970-1840, fall 1840-3350, slab 4000-4860; **Bruiser falls backwards, Assassin backwards and flings the rifle forward (1400-2800), Controller topples forward with sparks** | `exhausted` |
| Hidden | Assassin | `HiddenGained` | once 4200 | cloak sweep 670-1010, ghost 1260-3600, reveal 3860 | `hidden` |
| Slow pulse | Controller | Slow applied | once 2600 | fire 680, field 1200, field pulses at 1200/1560/1870/2180 | `slow` |
| Scout Drone | Controller | `AreaRevealed` | once 3600 | lift 500-800, fly 800-1650, hover 1650-2520, return 2520-3380 | `drone` |
| Aegis Protocol | Controller | Shield on an ally | once 3200 | raise 380-700, beam 900, dome 1340, hold to 2560 | `aegis` |
| Deploy Cover / Fortify | Controller | `CoverPlaced` | once 3400 | slam 750-950, wall rises 1020-1430, holds to 2720 | `deploy` |

The poses of a class differ on purpose: the Bruiser is heavy and slow, the Assassin light and quick, the Controller steady. Keep those differences.

## Effects

Each effect is a few shapes with an alpha curve. Timings are from the moment of the action (fire = the `fire` beat of the Hero's clip). Pictures: `effects-weapons-*`, `effects-field-*`. Effects of removed cards (Shockwave, Breach Charge, Adrenal Surge) were taken out; Knockback and Pull are drawn as a slide of the figure (`playback.ts`).

- **Muzzle flash**: a radial blob at the muzzle, 0 to 1.5 x scale over 70 ms, gone by 270 ms. Colour by weapon.
- **Projectile**: leaves at the fire beat. Slam slug: 11 x 5 orange, 0.10 px/ms. Precision tracer: a 24 x 2 light-blue streak, 0.30 px/ms. Pulse orb: 7 px, grows from 0.8 to 1.4 x on the way, 0.10 px/ms. Tag dart: 14 x 3 pink. Long Shot: no flight, an instant white-cyan line the whole way that fades over 450 ms, plus a red dotted laser (1 px) visible for 480 ms before the shot.
- **Impact** (when the projectile arrives): a burst (radial blob, 0.2 to 1.9 x over 330 ms), 3 to 4 sparks flying 9 to 18 px, a ground ring (ellipse that grows 0.5 to 2.2 x and fades over 500 ms). The target flashes white and is knocked 4 px back for 150 ms (the Hit clip).
- **Numbers**: rise 14 px over 800 ms while fading out. Deck Damage red `-2`, long-range bonus gold `-4`, Shield blue `Shield -2`, `Blocked` grey, `Out of range` grey. The first frame appears 20 ms after the impact.
- **Marked**: a red reticle (22 px ring with a cross) locks on from 2.4 x to 1 x scale, rotates 45 deg and stays until the end of the next Resolution, with a small `MARKED` tag.
- **Slow**: a violet ground field (34 x 16 ellipse) pulsing three times, and an icon of three stacked downward chevrons above the head until the end of the next Resolution.
- **Cover placed**: a team-coloured flash on the tile, a wall (34 x 12) rises out of the ground (scale 0 to 1.15 to 1) with dust. It stays until it is destroyed (no pips); the Squad's own Placed Cover carries four teal corner marks (docs/design/role-visuals/380/). **Half Cover reducing damage**: the projectile hits the wall, chips fly, `-1` with a `Half Cover` tag.
- **Shield**: three blue rubies pop above the Hero (scale 0 to 1.5 to 1), an ellipse bubble forms. Every absorbed hit: a ripple runs over the bubble and one ruby disappears; at zero the bubble breaks into five shards.
- **Scout Drone area**: a 3 by 3 diamond of fog tiles lifts from the middle outwards (cyan tint) while the drone hovers; enemies in it fade in; two pips count the Resolutions; then the fog closes. The drone circles over the area and sends scan rays down; the scanned Squad sees a dashed amber outline with a sweep and `SCANNED · n` (docs/design/role-visuals/380/).
- **Fog and Ghost**: an enemy that leaves sight fades to a 45 % alpha Ghost with a dashed ring and a `last seen` tag while fog rolls over the tile.
- **Prime Zone**: the 3 by 3 zone is grey (`#8a99a8` at 20 %) while empty, teal at 35 to 55 % when our Squad holds it with a ring pulse per Resolution, gold when the third is reached, amber when contested.

## Playback rules

- A Resolution Tick plays all actions of that Tick at the same time. **The Tick lasts until the slowest clip of that Tick has reached its active end** (at least one step of 450 ms).
- All durations are multiplied by one constant (`CLIP_SPEED`, default 1) so the product owner can tune the whole feel in one place.
- Effects follow the **events** of the Resolution (`Step`, `Wait`, `AttackHit`, `AttackFailed`, `ShieldGained`, `SlowApplied`, `MarkedApplied`, `HiddenGained`, `Knockback`, `CoverPlaced`, `CoverDestroyed`, `AreaRevealed`, `Exhausted`). The Hero's clip and the target's reaction are scheduled from the same event, so the impact lands when the projectile arrives.
- Fog of War holds: an effect is drawn only for events the player's Squad perceives.
- An animation never changes the rules or the final state: when it is skipped, cut short or reduced to a fade, the result on the board is the same.
- Performance target: a mid-range phone at 60 fps with six Heroes and several effects; draw with the Heroes' own Graphics, no filters, no per-frame allocation.
