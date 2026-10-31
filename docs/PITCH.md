# Primefall — Product & Game Design Pitch

## Summary

**Primefall** is a mobile-friendly, web-based **2.5D tactical 3v3 game**. It combines the simultaneous planning and deterministic resolution of *Frozen Synapse*, the card-driven combat and resource decisions of *Slay the Spire* and *Flesh and Blood*, and the team-objective structure of a MOBA such as *Vainglory*.

Instead of a continuous real-time MOBA, both teams plan their next round at the same time, commit their commands simultaneously, and then watch a short, deterministic combat resolution.

The project starts as an **offline-first prototype**: one player controls a team of three heroes against AI-controlled allies and enemies. Online multiplayer, accounts, progression systems, monetization, and on-the-go deckbuilding are explicitly out of scope for the first playable core.

## Positioning

**Genre:** Tactical card-battler / round-based MOBA hybrid  
**Format:** 3v3  
**Platform:** Mobile-first web game, playable on desktop browsers  
**Visual style:** Stylized 2.5D with an orthographic camera  
**Session length:** Target 8–15 minutes per match  
**Core fantasy:** “I out-planned you, out-read your hand, and took the objective.”

Primefall is not a traditional MOBA. It removes twitch reflexes, last-hitting, and continuous movement control. It replaces them with readable tactical decisions: positioning, information, timing, resource management, and simultaneous commitment.

## Core gameplay loop

Each match consists of a sequence of short rounds.

1. **Round start:** Both teams receive card draws, energy, objective state, and updated battlefield information.
2. **Planning phase:** Each player has a limited amount of time to move heroes, play cards, set attacks or defenses, and prepare reactions.
3. **Commit phase:** Both teams lock in their commands simultaneously. Neither side can see the other team’s final commands before committing.
4. **Resolution phase:** The game deterministically simulates movement, line of sight, attacks, blocks, abilities, status effects, and objective captures over a short combat window.
5. **Replay phase:** Both teams watch the same resolution, understand why it happened, and receive any rewards or state changes.
6. **Next round:** Players draw new cards, recover or spend resources, and plan again.

A match ends when one team destroys or controls the enemy core, completes the decisive objective, or forces the opposing team into an unrecoverable position.

## Design pillars

### 1. Simultaneous commitment

Every meaningful action is planned before it resolves. Players must anticipate their opponents rather than react in real time.

This creates tension without requiring fast reflexes and makes the game accessible on mobile.

### 2. Readable tactical depth

A player should be able to understand the battlefield within seconds:

- Where are my heroes?
- What can I see?
- What objectives matter?
- What cards can I play?
- What is the opponent likely to do?

Complexity should come from interactions between a small number of clear systems, not from opaque rules or excessive UI.

### 3. Cards as tactical tools

Cards are not primarily collectible content in the first version. They are the player’s tactical vocabulary.

A card may represent:

- Movement or repositioning
- A ranged or melee attack
- A block, shield, or counter
- Vision, scouting, or denial
- A buff, debuff, trap, or area effect
- An objective-focused action

Every card should have a clear purpose and be readable on a phone-sized screen.

### 4. Resource decisions matter

Inspired by *Flesh and Blood*, players should regularly face meaningful tradeoffs:

- Spend energy now for aggression?
- Keep cards to block an expected attack?
- Invest in vision and positioning?
- Save resources for a larger combo next round?

Defense should be an active decision, not merely a health bar.

### 5. Team play without micromanagement

The player controls one hero directly and coordinates with two allied heroes.

In the first prototype, allies are AI-controlled. Later, each human player should control one hero while sharing team-level information and objectives.

The design should reward coordination through positioning, complementary hero kits, and shared objectives—not through complicated ping systems or excessive communication requirements.

## Inspiration map

| Source | What Primefall takes | What it avoids |
|---|---|---|
| *Frozen Synapse* | Simultaneous planning, deterministic simulation, line of sight, “commit and resolve” tension | Extremely granular waypoint planning and long, opaque simulations |
| *Slay the Spire* | Card hand, energy, block, draw, combat-focused card effects | Roguelike map progression and on-the-go deckbuilding in the MVP |
| *Flesh and Blood* | Active defense, resource pitching, attack/block interaction, combo potential | High physical TCG rules complexity and large card vocabulary |
| *Vainglory* | 3v3 structure, lanes/objectives, hero roles, teamfight pacing | Real-time movement, last-hitting, item shop complexity, and long match length |

## Initial hero and team structure

The first version should use three fixed hero archetypes per team:

### Bruiser / Vanguard

- Durable frontline hero
- Controls space and protects allies
- Uses cards for shields, taunts, area denial, and short-range pressure

### Controller / Tactician

- Utility-focused hero
- Provides vision, movement tools, buffs, debuffs, traps, or area control
- Rewards planning and information advantage

### Assassin / Striker

- High-risk damage dealer
- Uses mobility and burst attacks
- Punishes exposed enemies and poor resource decisions

Each hero begins with a fixed deck. Deckbuilding may be added later, but the initial game must prove that fixed decks already create interesting decisions.

## Map and objectives

The first map should be compact, symmetric, and readable on a phone.

### Proposed layout

- One central lane or corridor
- Two side routes for flanking and vision play
- A central objective area
- One core or base area per team
- Limited terrain features: walls, high ground, bushes, or vision blockers

### Objective ideas

The central objective should create a reason for teams to leave their base and fight.

Possible MVP objective:

- Capture and hold a central zone for several rounds.
- Capturing the zone grants a team-wide advantage, such as extra energy, card draw, or a power surge.

Alternative objective:

- Escort or destroy a neutral objective.
- Control a relay that opens a path toward the enemy core.

The objective should encourage teamfights without forcing every round into the same location.

## Combat systems

### Movement

Heroes move along a grid, tile map, or waypoint-based 2.5D battlefield.

Movement should be simple, predictable, and visually clear. The first version should avoid complex pathfinding controls.

### Line of sight

Line of sight is a core tactical system.

- Enemies outside vision are hidden or shown as last-known positions.
- Walls, terrain, and certain cards can block vision.
- Vision cards and abilities create temporary information advantages.

### Attacks

Attacks have clear range, direction, damage, and timing.

Attacks should resolve during the shared simulation phase, not during the planning phase.

### Defense

Defense is active.

A player may spend cards or energy to:

- Block an incoming attack
- Gain shield
- Move out of a predicted line of fire
- Counter or redirect an attack
- Protect an ally

### Energy

Energy limits how many actions a player can take per round.

It prevents players from playing every strong card at once and forces prioritization.

### Status effects

The MVP should use only a few clear status effects:

- Shield
- Slow
- Root or immobilize
- Damage-over-time
- Empowered attack
- Vision reveal

Avoid complex stacking rules until the core loop is proven.

## First playable prototype

The first playable version should answer one question:

> Is simultaneous planning plus card-based combat fun in a compact 3v3 battlefield?

### MVP features

- One compact 2.5D map
- Two teams of three heroes
- Player controls one hero; AI controls the other five heroes
- Fixed decks for all heroes
- Card hand, energy, draw, and discard
- Movement, line of sight, basic attacks, block/shield, and one utility effect
- Simultaneous planning and deterministic resolution
- Central objective
- Match end condition
- Local match state in browser memory
- Optional `localStorage` support for continuing or reviewing a match

### MVP exclusions

- Online multiplayer
- Accounts and authentication
- Persistent progression
- Ranked matchmaking
- Card collection or deckbuilding
- Monetization
- Cosmetics
- Voice or text chat
- Complex tutorial systems

## Technical direction

### Architecture

The game should be built around a deterministic TypeScript game engine that is independent from UI and hosting.

Recommended separation:

- `game-core`: rules, entities, cards, simulation, validation, and AI
- `game-client`: rendering, input, UI, animations, and sound
- `game-data`: hero definitions, cards, map data, balance values, and localization strings

The same engine should be usable for:

- Local PvE matches
- Future online matches
- Automated balance simulations
- Unit tests
- Replay generation

### Frontend

- **Framework:** Next.js and React
- **Rendering:** PixiJS
- **UI:** React components for hand, energy, hero status, objective state, and planning controls
- **Input:** Touch-first, with desktop mouse/keyboard support

### 2.5D presentation

Use a stylized 2.5D presentation rather than full 3D:

- Orthographic or near-orthographic camera
- Sprite- or mesh-based heroes
- Layered terrain and subtle elevation
- Simple shadows and lighting
- Clear silhouette readability
- Animation used to communicate intent and resolution, not to obscure gameplay

### Hosting and persistence

For the first prototype:

- Deploy the web app to **Vercel Free**
- Run the simulation entirely client-side
- Store no persistent backend data
- Use in-memory state during a match
- Optionally persist local match state in `localStorage`

Online multiplayer will eventually require shared match state and validation, but that should not block the first prototype.

## Determinism and fairness

The simulation should be deterministic:

> Same initial state + same commands = same resolution.

This enables:

- Reliable replays
- Easier debugging
- Automated balance testing
- Fair future multiplayer validation
- Server-authoritative anti-cheat later

Randomness, if used at all, should be seeded and visible in the match record.

## UX principles

- One primary decision per round should be immediately obvious.
- Cards must be readable on a small screen.
- The commit button should feel consequential.
- The resolution replay should clearly explain cause and effect.
- Players should never lose because they did not understand what happened.
- The UI should favor clarity over visual noise.

## Success criteria

The prototype is successful if:

- A player can complete a full match against AI without external explanation.
- The planning phase creates meaningful anticipation.
- Cards create visible tactical tradeoffs.
- The central objective produces interesting team decisions.
- A player wants to immediately replay a match to try a different plan.
- The simulation is deterministic and testable.

## Open questions

These questions should be resolved during early prototyping:

1. Should the map use a grid, free movement with waypoints, or tile-based lanes?
2. How long should the planning phase be on mobile?
3. How many cards should a player hold and draw each round?
4. Should all three heroes be controlled by one player in the prototype, or one hero with two AI allies?
5. What is the best central objective: zone control, relay capture, escort, or core push?
6. How much randomness is acceptable in card draws and combat resolution?
7. Should heroes share a team energy pool or each have individual energy?
8. Which visual theme best supports readability: sci-fi, dark fantasy, elemental fantasy, or abstract tactical?

## Immediate next steps

1. Define the first map layout and movement rules.
2. Define three hero kits and their fixed starter decks.
3. Create a minimal card set: move, attack, block, vision, and one utility card.
4. Build the deterministic TypeScript simulation.
5. Build a basic PixiJS 2.5D rendering layer.
6. Add AI opponents that use legal actions and simple heuristics.
7. Playtest the full offline match loop.
8. Iterate on round length, card count, energy economy, and objective pacing.
