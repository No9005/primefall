# Fooocus to PixiJS Asset Production Plan

## Purpose

This document defines the production-ready workflow for creating Primefall’s first Hero and Reactor Deck assets with Fooocus, then integrating them into PixiJS.

It covers the three Hero classes, the Reactor Deck Grid, the minimum viable pose set, and the skills used to keep art, grid behavior, and rendering consistent.

Primefall is a mobile-first, 2.5D tactical 3v3 game with simultaneous planning and deterministic Resolution. Its visual presentation must prioritize readable silhouettes, clear tactical information, and fast comprehension on a phone-sized screen.

## Tooling

Primefall uses three tools with clearly separated responsibilities.

| Tool | Responsibility |
|---|---|
| **Fooocus** | Generates all raster art: Hero Showcases, Iso Idle sprites, gameplay poses, floor tiles, walls, Cover, Reactor assets, and VFX. |
| **`0xheycat/isometric-game-skills`** | Defines isometric art direction, sprite conventions, grid math, depth sorting, tile picking, transparent cutout cleanup, and atlas packing. |
| **`pixijs/pixijs-skills`** | Authoritative reference for PixiJS implementation: application setup, asset loading, sprites, containers, events, ticker, math, performance, filters, and particles. |

Do not use `gamedev-skills/awesome-gamedev-agent-skills` for this workflow.

### Skill responsibilities

The skill names below are topics. In the repository they are consolidated into two skills: `isometric` and `pixijs`. Each topic name here is the matching file under that skill's `references/` directory (for example `pixijs-assets` is `.claude/skills/pixijs/references/assets.md`).

| Production concern | Skill / tool |
|---|---|
| Hero identity, visual style, and prompt language | Fooocus + `isometric-art-direction` |
| Hero Showcase generation | Fooocus |
| Iso Idle and gameplay pose generation | Fooocus + `isometric-character-sprites` |
| Floor, wall, Cover, Reactor, and Overwatch Nest generation | Fooocus + `isometric-object-sprites` / `seamless-isometric-terrain` |
| Transparent PNG cleanup and alpha export | `transparent-cutout-cleanup` |
| Sprite naming, atlas layout, padding, and pivots | `spritesheet-atlas-packing` |
| 21 x 11 Grid coordinates, movement, and range math | `isometric-grid-math` + `pixijs-math` |
| PixiJS application, asset loading, sprites, and layers | `pixijs`, `pixijs-application`, `pixijs-assets`, `pixijs-scene-container`, `pixijs-scene-sprite` |
| Tile selection, Hero selection, and touch input | `tile-picking-interaction` + `pixijs-events` |
| Hero/Cover depth sorting and occlusion | `depth-sorting-occlusion` + `pixijs-scene-container` |
| Resolution replay, animation timing, and VFX | `pixijs-ticker`, `pixijs-scene-sprite`, `pixijs-scene-particle-container` |
| Mobile performance | `pixijs-performance` |
| Shield, Hidden, Marked, and target-highlight effects | `pixijs-filters` + `pixijs-color` |

## Visual Direction

The target look is **stylized sci-fi tactical 2.5D**, not photorealistic and not a detailed AAA render.

### Core visual rules

- **2:1 isometric projection** for all Heroes, Cover, walls, and props.
- **Clean cel-shaded game art** with bold, readable silhouettes.
- **Limited sci-fi palette:** dark graphite, steel blue, teal, warm orange accents, and restrained red for enemy or danger signals.
- **Simple directional lighting** with a consistent light direction across every asset.
- **Soft contact shadows**, kept subtle so they do not interfere with Grid readability.
- **Flat or near-flat backgrounds**, removed before export to PixiJS.
- **No visual noise:** every prop must be recognizable as floor, wall, Full Cover, Half Cover, objective, or decoration.

### Why this direction

Primefall’s UX depends on players quickly understanding positioning, Line of Sight, Cover, and the Prime Zone. Highly detailed or photorealistic assets would reduce readability. A clean stylized look supports the game’s tactical clarity and mobile-first presentation.

## Production Principles

### Hero Showcase first

For each Hero, create the **Hero Selection Showcase** before generating gameplay sprites. The Showcase establishes the Hero’s identity, silhouette, costume, weapon, palette, and personality in a more readable three-quarter front view.

The approved Showcase is then used as an Image Prompt reference to create the Hero’s first isometric Idle sprite. Only after that Iso Idle has been validated in PixiJS should the remaining gameplay poses be produced.

This order prevents spending time on many gameplay frames for a Hero design that may still change.

### One asset per generation

Generate each Hero pose, prop, wall type, and floor tile as a separate image. Do not ask Fooocus for a complete sprite sheet in one generation; it tends to mix poses, duplicate characters, and produce inconsistent frames.

### Fixed visual foundation

Every prompt must reuse the same:

- Art style: `clean cel-shaded sci-fi game art`
- Palette: `dark graphite, steel blue, teal, warm orange accents`
- Lighting: `soft directional lighting, subtle contact shadow`
- Background: `isolated on plain flat background`
- Quality terms: `crisp edges, readable silhouette, high quality game sprite`

### Variable parts

Only change what the asset needs:

- Hero class and equipment
- Camera view: three-quarter front for Showcase, 2:1 isometric for gameplay
- Pose or animation frame
- Weapon or held object
- Prop type
- Tile type
- Direction, where required

### Export rules

- Export transparent PNGs with alpha.
- Use one consistent pixels-per-unit scale.
- Hero pivot: bottom center.
- Tile pivot: bottom vertex of the 2:1 diamond.
- Prop pivot: bottom center.
- Animation frames must share identical canvas size, padding, and pivot.

## Fooocus Settings

### Global settings

| Setting | Recommended value | Reason |
|---|---|---|
| Base model | Juggernaut XL v8/v9 | Versatile SDXL model; good starting point for stylized sci-fi game assets. |
| Alternative model | AnimaPencilXL | Use if Juggernaut results are too realistic or too render-heavy. |
| Performance | Speed for drafts, Quality for finals | Speed enables fast pose iteration; Quality produces final production frames. |
| Aspect ratio | 1024 x 1024 for props and tiles; 832 x 1216 for Heroes | SDXL is most reliable around 1024 px; vertical ratios suit full-body Heroes. |
| Guidance scale | 4–6 | Keeps the model responsive to the prompt without making images harsh. |
| Image sharpness | 2–4 | Produces crisp sprite edges without unnatural over-sharpening. |
| Seed | Fixed during iteration; record final seeds | Makes prompt changes comparable and allows controlled variation. |
| Refiner | None | Avoids shifting the established stylized look. |
| Styles | None or Fooocus V2 | Strong style presets can override the intended game-art direction. |

### Image Prompt settings

| Use case | Control mode | Weight | Stop At | Reason |
|---|---|---:|---:|---|
| Convert approved Hero Showcase into Iso Idle | ImagePrompt | 0.5–0.7 | 0.7–0.9 | Transfers identity, palette, costume, and proportions without copying the Showcase pose. |
| New Hero gameplay pose from approved Iso Idle | PyraCanny | 0.8–1.0 | 0.4–0.5 | Preserves silhouette, proportions, and pose structure. |
| Very strict pose or weapon position | PyraCanny | 1.0 | 0.4–0.5 | Maximizes structural control. |
| Reuse approved color and material style | ImagePrompt | 0.4–0.7 | 0.7–0.9 | Transfers palette and material feel without copying the pose. |
| Map tile variation | ImagePrompt | 0.4–0.6 | 0.8–0.9 | Keeps tile family consistent while allowing a new surface type. |

## Prompt Structure

### Fixed prompt block

Use this block in every gameplay-asset prompt:

```text
Primefall stylized sci-fi tactical game asset,
2:1 isometric view,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

### Hero Showcase prompt block

Use this block for Character Selection art:

```text
Primefall hero selection showcase,
three-quarter front view,
confident heroic pose,
full body, facing viewer,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft dramatic rim lighting, subtle ground shadow,
isolated on plain dark background,
crisp edges, readable silhouette, high quality game character art
```

### Negative prompt

Use this negative prompt for all generations:

```text
photorealistic, realistic photo, 3D render, blurry, noisy, text, watermark, logo,
busy background, multiple characters, cropped, deformed, extra limbs, mutated,
low contrast, muddy colors, complex background, UI elements
```

### Prompt template

```text
[single asset type] + [Hero class or object] + [pose/state] +
[unique visual details] + [fixed Primefall style block]
```

Example:

```text
single Primefall Bruiser Hero, standing idle while holding compact kinetic shotgun,
heavy armored exosuit, broad silhouette, teal armor plates, orange energy accents,
Primefall stylized sci-fi tactical game asset,
2:1 isometric view,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

## Hero Showcase Production

Create one Showcase per Hero for the Character Selection screen. These are UI-only assets and do not replace gameplay sprites.

### Recommended Hero Selection layout

- Use a large three-quarter front Hero Showcase as the main visual.
- Show Hero name, class, Range, short role description, and Confirm button near the Showcase.
- Use compact Hero tiles for selection.
- Optionally show a small Iso Idle preview beside the Confirm button to connect the selection screen with Grid gameplay.

The Showcase should be more heroic and readable than the gameplay sprite; the Iso Idle remains the source of truth for Grid scale and gameplay presentation.

### Bruiser / Vanguard Showcase

```text
Primefall hero selection showcase,
single stylized sci-fi Bruiser Vanguard hero,
three-quarter front view, confident heroic pose, full body, facing viewer,
heavy armored exosuit, broad silhouette, teal armor plates,
orange energy accents, compact kinetic shotgun held low,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft dramatic rim lighting, subtle ground shadow,
isolated on plain dark background,
crisp edges, readable silhouette, high quality game character art
```

### Controller / Tactician Showcase

```text
Primefall hero selection showcase,
single stylized sci-fi Controller Tactician hero,
three-quarter front view, confident heroic pose, full body, facing viewer,
light tactical suit, holographic wrist device activated,
small pulse sidearm held low, blue-teal energy accents,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft dramatic rim lighting, subtle ground shadow,
isolated on plain dark background,
crisp edges, readable silhouette, high quality game character art
```

### Assassin / Striker Showcase

```text
Primefall hero selection showcase,
single stylized sci-fi Assassin Striker hero,
three-quarter front view, confident heroic pose, full body, facing viewer,
lightweight dark armor, narrow silhouette,
long precision rifle held across body, orange targeting accents,
hooded tactical helmet,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft dramatic rim lighting, subtle ground shadow,
isolated on plain dark background,
crisp edges, readable silhouette, high quality game character art
```

### Showcase settings

| Setting | Recommended value | Reason |
|---|---|---|
| Aspect ratio | 832 x 1216 or 896 x 1152 | Full-body Hero art needs a vertical format. |
| Performance | Quality | There are only three Showcase assets, but they are highly visible UI art. |
| Guidance scale | 5–6 | Keeps class, pose, weapon, and costume aligned with the prompt. |
| Image sharpness | 3 | Produces clean UI-ready edges. |
| Seed | Fix after selecting a strong draft | Allows controlled refinement. |
| Image Prompt | Optional approved style reference | Helps maintain the shared Primefall look. |

## Hero Pose Set

The MVP needs expressive but economical animation. Do not create a unique pose for every card. Instead, reuse a small set of shared tactical poses and add class-specific weapon or effect sprites.

### Shared Hero poses

Every Hero needs these base gameplay poses:

| Pose | Used for | Notes |
|---|---|---|
| `idle` | Planning phase, waiting state | First gameplay sprite generated from the approved Showcase. |
| `move` | Move commands and Resolution movement | One reusable movement pose; rotate or mirror where possible. |
| `attack_ranged` | Most Attack cards | Weapon aimed forward; muzzle flash as separate VFX. |
| `block_shield` | Block 2, Shield effects | Defensive stance with shield VFX. |
| `utility_cast` | Utility cards, Overdrives, drones, Cover deployment | One generic casting/activation pose. |
| `hit` | Deck Damage feedback | Short recoil or stagger. |
| `exhausted` | Deck empty / Hero removal | Kneeling or lowered stance; no death gore. |

### Class-specific additions

| Hero | Additional pose or asset | Covers |
|---|---|---|
| Bruiser / Vanguard | `heavy_attack` | Slam Shot, Concussion Round, Shockwave, Adrenal Surge |
| Bruiser / Vanguard | `breach_charge_throw` | Breach Charge and its Overdrive |
| Controller / Tactician | `drone_deploy` | Scout Drone |
| Controller / Tactician | `cover_deploy` | Deploy Cover |
| Assassin / Striker | `precision_aim` | Precision Shot, Piercing Round, Long Shot, Ghost Shot |
| Assassin / Striker | `hidden_crouch` | Vanish and Hidden state |

This gives approximately **7 shared poses plus 6 class-specific poses**, or 27 Hero gameplay sprite bases before directional variants. VFX such as shields, drones, Cover deployment, muzzle flashes, and explosions should be separate sprites.

## Hero Gameplay Prompt Examples

### Bruiser / Vanguard Iso Idle

Generate this only after the Bruiser Showcase is approved and background-removed.

```text
single Primefall Bruiser Hero, idle standing pose,
heavy armored exosuit, broad silhouette, teal armor plates,
orange energy accents, compact kinetic shotgun held low,
same character design as reference,
Primefall stylized sci-fi tactical game asset,
2:1 isometric view,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

Use the background-removed Bruiser Showcase as an Image Prompt with Weight 0.5–0.7 and Stop At 0.7–0.9.

### Bruiser heavy attack

```text
single Primefall Bruiser Hero, powerful close-range shotgun attack,
heavy armored exosuit, broad silhouette, teal armor plates,
orange energy accents, compact kinetic shotgun,
aggressive forward stance,
Primefall stylized sci-fi tactical game asset,
2:1 isometric view,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

Use the approved Bruiser Iso Idle as a PyraCanny reference with Weight 0.8–1.0 and Stop At 0.4–0.5.

### Controller / Tactician Iso Idle

```text
single Primefall Controller Hero, idle standing pose,
light tactical suit, holographic wrist device, small pulse sidearm,
blue-teal energy accents, compact silhouette,
same character design as reference,
Primefall stylized sci-fi tactical game asset,
2:1 isometric view,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

### Controller drone deployment

```text
single Primefall Controller Hero, deploying small scouting drone from wrist device,
light tactical suit, holographic wrist device, small pulse sidearm,
blue-teal energy accents, focused utility stance,
Primefall stylized sci-fi tactical game asset,
2:1 isometric view,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

### Assassin / Striker Iso Idle

```text
single Primefall Assassin Hero, idle standing pose,
lightweight dark armor, narrow silhouette, long precision rifle,
orange targeting accents, hooded tactical helmet,
same character design as reference,
Primefall stylized sci-fi tactical game asset,
2:1 isometric view,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

### Assassin precision aim

```text
single Primefall Assassin Hero, aiming long precision rifle,
lightweight dark armor, narrow silhouette,
orange targeting accents, hooded tactical helmet,
stable long-range firing stance,
Primefall stylized sci-fi tactical game asset,
2:1 isometric view,
clean cel-shaded game art,
dark graphite, steel blue, teal and warm orange accent palette,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

## Reactor Deck Grid Assets

The Reactor Deck is a damaged cargo ship with a central reactor, mirror-symmetric layout, 21 by 11 tile Grid, no interactive doors, and no vertical levels. Generate tiles and Cover as separate assets so PixiJS can compose the Grid from data.

### Required tile and prop set

| Asset | Quantity | Purpose |
|---|---:|---|
| Open floor tile | 2–3 variants | Standard movement tiles |
| Damaged floor tile | 1–2 variants | Visual variety without changing gameplay |
| Wall / Bulkhead | 1–2 variants | Grid boundaries and sight blockers |
| Full Cover | 1–2 variants | Blocks attacks and sight from a firing direction |
| Half Cover | 1–2 variants | Reduces damage by 1 but does not block sight |
| Reactor floor tile | 1 | Prime Zone center |
| Reactor edge tile | 1 | Transition into the Prime Zone |
| Overwatch Nest prop | 1 | Single Full Cover position overlooking the Prime Zone |
| Spawn marker | 1 | Optional visual marker for Squad spawn areas |

### Floor tile prompt

```text
single Primefall Reactor Deck floor tile, 2:1 isometric diamond shape,
damaged cargo ship metal flooring, dark graphite plating,
subtle teal technical markings, small scuffs and panel seams,
Primefall stylized sci-fi tactical game asset,
clean cel-shaded game art,
soft directional lighting,
isolated on plain flat background,
no walls, no props, seamless tileable,
crisp edges, high quality game sprite
```

### Wall / Bulkhead prompt

```text
single Primefall Reactor Deck wall segment, 2:1 isometric view,
damaged cargo ship bulkhead, dark graphite metal panels,
teal technical markings, orange warning stripe,
Primefall stylized sci-fi tactical game asset,
clean cel-shaded game art,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

### Full Cover prompt

```text
single Primefall Reactor Deck Full Cover prop, 2:1 isometric view,
heavy reinforced cargo container, dark graphite metal,
teal panel details, orange hazard markings,
clear blocking silhouette,
Primefall stylized sci-fi tactical game asset,
clean cel-shaded game art,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

### Half Cover prompt

```text
single Primefall Reactor Deck Half Cover prop, 2:1 isometric view,
low damaged cargo crate, dark graphite metal,
teal panel details, orange hazard markings,
lower silhouette than Full Cover,
Primefall stylized sci-fi tactical game asset,
clean cel-shaded game art,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

### Reactor / Prime Zone prompt

```text
single Primefall Reactor Deck reactor floor tile, 2:1 isometric diamond shape,
central sci-fi reactor platform, circular dark metal base,
glowing teal energy core, orange warning accents,
Primefall stylized sci-fi tactical game asset,
clean cel-shaded game art,
soft directional lighting,
isolated on plain flat background,
no Heroes, no walls, seamless tileable,
crisp edges, high quality game sprite
```

### Overwatch Nest prompt

```text
single Primefall Reactor Deck Overwatch Nest prop, 2:1 isometric view,
elevated-looking reinforced observation position,
dark graphite metal structure, teal scanning light,
orange hazard markings, clear Full Cover silhouette,
Primefall stylized sci-fi tactical game asset,
clean cel-shaded game art,
soft directional lighting, subtle contact shadow,
isolated on plain flat background,
crisp edges, readable silhouette, high quality game sprite
```

## VFX Assets

Generate effects separately from Heroes. PixiJS can then attach, rotate, scale, and animate them independently.

| VFX | Used for |
|---|---|
| Muzzle flash | Ranged attacks |
| Energy projectile | Pulse Bolt, Tag Round, precision shots |
| Shotgun blast | Bruiser attacks |
| Shield ring | Block, Bulwark, Aegis Protocol |
| Cover deploy effect | Deploy Cover |
| Drone sprite | Scout Drone |
| Mark reticle | Marked status |
| Slow indicator | Slow status |
| Reactor pulse | Prime Zone control feedback |
| Explosion / breach effect | Breach Charge and Overdrive |

### Muzzle flash prompt

```text
single sci-fi muzzle flash VFX sprite,
short bright orange energy burst,
transparent-background-ready game effect,
clean stylized game art,
isolated on plain black background,
no weapon, no character, no text
```

### Shield VFX prompt

```text
single sci-fi shield VFX sprite,
translucent teal hexagonal energy barrier,
compact circular shape,
transparent-background-ready game effect,
clean stylized game art,
isolated on plain black background,
no character, no weapon, no text
```

## Production-Ready Workflow

Use this workflow for every new Hero and for the first Reactor Deck asset set.

### 1. Define art direction

Use `isometric-art-direction` to lock:

- 2:1 isometric camera
- Cel-shaded sci-fi style
- Primefall palette
- Light direction
- Silhouette rules
- Asset naming conventions

Do not generate production assets before these rules are written down.

### 2. Create the first Hero Showcase

Generate the Bruiser / Vanguard Showcase in Fooocus.

Approve:

- Hero identity
- Silhouette
- Costume
- Weapon
- Palette
- Lighting
- Overall readability

Remove the background and save the result as a transparent PNG.

### 3. Create the first Iso Idle

Use the approved Showcase as an Image Prompt reference in Fooocus.

Generate one Iso Idle sprite using `isometric-character-sprites` conventions.

Use:

- Control mode: `ImagePrompt`
- Weight: `0.5–0.7`
- Stop At: `0.7–0.9`

### 4. Prepare the sprite for PixiJS

Use `transparent-cutout-cleanup` to:

- Remove background remnants
- Repair alpha edges
- Remove stray pixels
- Preserve a clean silhouette
- Export a transparent PNG

Use `spritesheet-atlas-packing` to define:

- File name
- Canvas size
- Padding
- Pivot
- Pixels-per-unit
- Future atlas placement

### 5. Validate in PixiJS

Use official `pixijs-skills` to build a minimal test scene.

Load:

- One Iso Idle Hero
- One open floor tile
- One wall
- One Full Cover
- One Half Cover

Use `pixijs-application`, `pixijs-assets`, `pixijs-scene-container`, `pixijs-scene-sprite`, and `pixijs-math`.

Validate:

- Hero scale relative to tiles
- Bottom-center Hero pivot
- Tile pivot at the lower diamond vertex
- Shadow direction
- Layer order
- Depth sorting behind and in front of Cover
- Touch and mouse tile picking
- Performance on a mobile-sized canvas

### 6. Approve the production baseline

The baseline is approved only when the Hero, floor, wall, Full Cover, and Half Cover look consistent in PixiJS.

Do not generate the full pose set or complete map asset set before this approval.

### 7. Produce remaining Hero poses

Use the approved Iso Idle as a PyraCanny reference.

Generate the shared poses:

- `move`
- `attack_ranged`
- `block_shield`
- `utility_cast`
- `hit`
- `exhausted`

Then generate class-specific poses.

Use:

- Control mode: `PyraCanny`
- Weight: `0.8–1.0`
- Stop At: `0.4–0.5`

### 8. Produce Reactor Deck assets

Use `isometric-object-sprites` and `seamless-isometric-terrain` conventions to generate:

- Floor variants
- Walls
- Full Cover
- Half Cover
- Reactor tiles
- Overwatch Nest
- Spawn marker

Validate each asset in the same PixiJS test scene.

### 9. Produce VFX separately

Generate VFX in Fooocus as isolated sprites.

Use `pixijs-scene-particle-container`, `pixijs-ticker`, and `pixijs-filters` to attach and animate them independently from Hero sprites.

### 10. Package for PixiJS

Use `spritesheet-atlas-packing` to create:

- Consistent frame sizes
- Uniform padding
- Correct pivots
- Atlas JSON or PixiJS-compatible sprite-sheet metadata
- Stable asset names

Validate the atlas in PixiJS before expanding the asset library.

## Production Order

1. Lock art direction with `isometric-art-direction`.
2. Create the Bruiser / Vanguard Hero Showcase in three-quarter front view.
3. Approve silhouette, costume, weapon, palette, lighting, and overall Hero identity.
4. Remove the Showcase background and save it as a transparent PNG.
5. Generate the Bruiser Iso Idle from the approved Showcase using ImagePrompt.
6. Clean up alpha and define pivot, canvas, padding, and atlas conventions.
7. Test the Iso Idle in a minimal PixiJS Grid scene with floor, wall, Full Cover, and Half Cover.
8. Approve Grid scale, pivot, shadow direction, silhouette readability, depth sorting, and visual consistency.
9. Generate the Controller and Assassin Showcases using the approved visual language.
10. Generate their Iso Idle sprites from the approved Showcases.
11. Generate the remaining shared gameplay poses for each Hero using PyraCanny.
12. Generate class-specific poses and VFX.
13. Generate floor, wall, Full Cover, Half Cover, reactor, and Overwatch Nest assets.
14. Remove backgrounds, export transparent PNGs, and validate all assets in PixiJS.
15. Package animation frames into PixiJS-compatible atlases.
16. Only then produce remaining variants and animation frames.

## Acceptance Criteria

An asset is production-ready when:

- It was generated as a single isolated asset.
- It uses the shared visual language and palette.
- Hero Showcases use the three-quarter front view; gameplay sprites use the shared 2:1 isometric camera.
- Its silhouette is readable at mobile scale.
- It has a clean transparent background.
- Its pivot is correct for PixiJS.
- Its lighting direction matches all other assets.
- It has been validated in the PixiJS Grid test scene.
- It does not visually compete with Grid, Cover, or objective information.
- Animation frames align in size, pivot, and proportions.
- Atlas naming, padding, and metadata are stable.