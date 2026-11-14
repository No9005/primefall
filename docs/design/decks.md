# Decks: ideas and the recommended redesign

**Status: a collection of ideas from a chat session with the product owner (issue #415). Nothing here is decided as a rule, specified, built or measured, except where "decided" is written.** Numbers are starting points for the balance harness. The current rules are `docs/specs/mvp-card-set.md` and ADR 0025; the Heroes are in `docs/design/world/README.md`, the missions in `docs/design/world/missions.md`.

This file keeps **every idea for the cards**, also those that did not make the recommended decks. Whatever is decided later, ideas are added here and not deleted (move a rejected one to _Parked and rejected ideas_ with the reason).

## Why a redesign

The playtester of #415 is right: the classes do not play to their strengths. Examples he gave: the Bruiser wants to stick to an enemy and has Knockback; the Assassin wants distance and has none; the Controller's deck is monotone (Fortify and Deploy Cover are almost the same, Barricade barely differs, two Shield cards, a reveal that did little). ADR 0025 fixed part of this (Charge, Pull, the Scout Drone anywhere); the rest is open.

Three tests for every card:

- **A, role:** does it serve the one main function of the Hero?
- **B, story:** does it fit who the Hero is (`docs/design/world/README.md`)?
- **C, missions:** do the three Heroes together cover Hold zones, Carry and extract and Sabotage (`missions.md`)?

## Decided in the chat

- The decks are designed anew, from the main function of each Hero.
- **Each Hero has one main function; every card serves it.** No Hero does vision, healing, cover and Shield at once.
- **Tilly has the Field and the drone reconnaissance** (cover, Fields and the Scout Drone). The Shield and healing ideas leave her.
- **Every Hero gets a passive effect.** Max: +1 damage at close distance. Kit: +1 damage when the target is at the Attack's maximum Range. Tilly: open (options below).
- **Max carries objects without a malus** (see _Carrying_).
- **The default movement rises to 3** (see _Move 3_).

## Main function of each Hero (one sentence)

| Hero | Main function |
|---|---|
| **Max Overload** (Bruiser) | Max gets there first and stays: he holds the ground and does not let himself be pushed off. |
| **Tilly Turnover** (Controller) | Tilly changes the ground and sees across it: Cover, Fields and the drone decide where the enemy can walk and what he can hide. |
| **Kit Crosshair** (Assassin) | Kit decides the fight before it starts: unseen, from a distance, on one target. |

## Passives

| Hero | Passive (proposal) | Replaces |
|---|---|---|
| **Max** | **Close quarters:** every Attack of this Hero deals +1 damage at Range 1. | The "3 damage at Range 1" text of Slam Shot and the +1 of Charge (the passive carries it). |
| **Kit** | **Full stretch:** every Attack of this Hero deals +1 damage when the target is at the Attack's maximum Range. | The Overdrive bonus of Long Shot at Range 6 and 7 (the passive carries it). |
| **Tilly** | **Open.** Options: **(a) Tinker:** she may hold four Placed Cover or Fields instead of three (the cap of ADR 0025 is three per Squad; this is hers alone). **(b) Long fuse:** her Fields and her drone areas last one Resolution longer. **(c) Spotted:** an enemy inside a drone area she reveals takes +1 damage from her Squad's first Attack on it each Round. My recommendation: **(b)**, it lifts both of her tools (Field and drone) and adds no new status; (a) is the simplest to build; (c) ties her to Kit and Max and may be too strong. | |

Rules needed: a passive is a Hero rule, not a card. It belongs in the glossary (term to be chosen) and an ADR.

## Carrying

Decided: **Max carries objects without a malus.** The proposal for the others, until the rules of Carry and extract exist: a Hero carrying an object has its Move 3 reduced to Move 2 and cannot use Charge-like moves; the object drops on its tile when the carrier is Exhausted. Max has none of this. Kit's **Snatch** picks up a dropped object. The rules (pick up, carry, drop, who may pick up) are part of the mission ticket, not of this one.

## Move 3

Decided: the default movement rises to 3 (every card can be used as Move 3 instead of Move 2; a Hero's queue has at most four actions, so up to nine tiles per Round if three actions are Moves). What follows:

- **Slow** (today: the next Move 2 becomes Move 1): proposal, the next Move 3 becomes Move 1, as it was in relation; an alternative is Move 2.
- **Charge** (moves up to 3 toward an enemy) is no longer faster than a Move: raise it to up to 4 tiles, or keep 3 and let the Shield 1 be its point.
- **Reposition** of the Assassin (Move 3 this round) has no point any more; the Assassin's deck replaces it (Silent Entry).
- **Map:** the walk from a Drop Point to the first zone is about 19 to 20 tiles on Crossroads v2, three Rounds with Move 2; with Move 3 it is about two. This also solves the open point of #361 (the Outposts should be about two Rounds from a Drop Point).
- **Range and sight** stay. The AI, the balance harness and the tutorial text ("Move 2") need updating.

## Recommended decks

Status: **existing** (as in the spec), **changed** (text changed), **new**. Energy costs are the current ones where the card exists. Deck sizes are those of ADR 0025 (Bruiser 12, Controller 10, Assassin 9; the Deck is the life); they are kept until the measurement.

### Max Overload (Bruiser), 12 cards: hold, engage, break

| # | Card | Energy | Effect (proposal) | Status |
|---|---|---|---|---|
| 1-2 | **Slam Shot** x2 | 1 | Attack, Range 1 to 2: deal 2 damage to the named visible enemy Hero. (The +1 at Range 1 is the passive.) | changed |
| 3 | **Breach Charge** | 2 | Attack: deal 2 damage and destroy Half Cover on the target tile. **Overdrive:** destroy any Cover on the target tile and deal 2 damage to every Hero on it and next to it, allies and this Hero included. | existing |
| 4 | **Wrecking Blow** | 1 | Attack, Range 1 to 2: deal 2 damage to the named visible enemy Hero; destroy any Cover on the target tile after the damage. | existing |
| 5 | **Shockwave** | 2 | Attack: deal 2 damage to every enemy Hero within Range 1. **Overdrive:** 3 damage. **Knockback is removed** (the Bruiser wants to stay next to them). | changed |
| 6-7 | **Charge** x2 | 1 | Utility: move up to 4 tiles toward the named visible enemy Hero and end next to it (stops at a wall, Full Cover or a Hero); gain Shield 1 until the end of the Round. (The +1 damage is the passive.) | changed |
| 8 | **Pull** | 1 | Utility, Range 4: move the named visible enemy Hero up to 2 tiles toward this Hero (stops at a wall, Full Cover or a Hero; may leave a zone). The flavour name on the card can be Cargo Hook. | existing |
| 9-10 | **Bulwark** x2 | 1 | Utility: this Hero gains Shield 3. | existing |
| 11 | **Brace** | 1 | Utility: until the end of the Round this Hero cannot be moved by Pull or Knockback and gains Shield 1. Keeps him in a zone. | **new** |
| 12 | **Guard** | 1 | Utility: an allied Hero within Range 2 gains Shield 3. **Overdrive:** two allied Heroes each gain Shield 3. | changed (it is Aegis Protocol of the Controller, moved) |

Overdrive modes: Breach Charge, Shockwave, Guard. Out: Concussion Round (the Slow belongs to Tilly), Adrenal Surge (a permanent buff next to a passive), Reinforce (merged into Guard).

### Tilly Turnover (Controller), 10 cards: the Field and the sight

| # | Card | Energy | Effect (proposal) | Status |
|---|---|---|---|---|
| 1 | **Tag Round** | 1 | Attack, Range 2: deal 1 damage and apply Marked until the end of the next Resolution. **Overdrive:** also Slow. | existing |
| 2-3 | **Scout Drone** x2 | 1 | Utility: reveal a 3 by 3 area anywhere on the map, also in the Fog, for two Resolutions; a Hidden enemy inside is shown and stays Hidden. The enemy sees which area was scanned, not who looks. **Overdrive:** 5 by 5. | existing |
| 4 | **Barricade** | 1 | Utility, Range 3: place Full Cover on an empty tile (Placed Cover). | existing |
| 5 | **Scrap Wall** | 1 | Utility, Range 3: place Half Cover on an empty tile or on the tile of an allied Hero (Placed Cover). It merges Fortify and Deploy Cover. | changed (Fortify + Deploy Cover) |
| 6-7 | **Arc Field** x2 | 2 | Utility, Range 4: place a Field on a tile for two Resolutions. An enemy Hero that stands on it at the end of a Tick takes 1 damage. **Overdrive:** a 3 by 3 Field. (The number of Ticks per Resolution makes this strong: to be measured; a variant is damage once per Resolution.) | **new** |
| 8 | **Gravity Snare** | 2 | Utility: a visible enemy Hero gains Slow until the end of the next Resolution. | existing |
| 9 | **Overwatch Uplink** | 1 | Utility: an allied Hero may attack an enemy in Half Cover this round without the Half Cover damage reduction. | existing |
| 10 | **Rig Charge** | 2 | Utility: prepare a mission target next to this Hero; the next Attack on it deals +2 damage (Sabotage). Without a mission it can be used as Pitch, Move or Block like every card. | **new** (mission card) |

Overdrive modes: Tag Round, Scout Drone, Arc Field. Out: Aegis Protocol and Reinforce (Shield belongs to Max), Fortify and Deploy Cover (merged into Scrap Wall), Field Repair (below).

### Kit Crosshair (Assassin), 9 cards: unseen, at range, on one target

| # | Card | Energy | Effect (proposal) | Status |
|---|---|---|---|---|
| 1-2 | **Long Shot** x2 | 1 | Attack, Range 3 to 7: deal 2 damage. (The +1 at Range 6 and 7 is the passive; the Overdrive 4 damage is replaced.) **Overdrive:** deal 3 damage at maximum Range. | changed |
| 3 | **Recoil Shot** | 1 | Attack, Range 2 to 5: deal 2 damage and apply Knockback 1 (the tester's wish: the Assassin keeps his distance). | **new** |
| 4 | **Shield Breaker** | 2 | Attack, Range 2 to 4: deal 2 Piercing Damage; Shield is not reduced; Half Cover still reduces it by 1, Full Cover blocks. | existing |
| 5 | **Execution Round** | 2 | Attack, Range 2 to 5: deal 3 damage; ignores Half Cover. | existing |
| 6 | **Ghost Shot** | 1 | Attack, Range 2 to 5: deal 2 damage to the named visible enemy Hero. **Overdrive:** target the last known position of a Ghost; it hits if an enemy stands on that tile during the Resolution. | existing |
| 7 | **Vanish** | 1 | Utility: this Hero becomes Hidden for up to two Resolutions, provided it ends its movement in Cover. | existing |
| 8 | **Silent Entry** | 1 | Utility: move up to 3 tiles; this Hero stays Hidden and is not shown by a drone area on the way. The weapon for Sabotage and for cutting off a carrier. | **new** (replaces Reposition) |
| 9 | **Snatch** | 1 | Utility: pick up a dropped object within 2 tiles of this Hero (Carry and extract). Without a mission: Pitch, Move or Block. | **new** (mission card) |

Overdrive modes: Long Shot, Ghost Shot. Out: Precision Shot (Recoil Shot and Long Shot cover its range), Cover Breaker (Execution Round already ignores Half Cover), Reposition (Move 3 is the default now), Mark Target (already out).

## The three missions and the Heroes

| Mission | Max | Tilly | Kit | New rule |
|---|---|---|---|---|
| **Hold zones** | holds the zone (Brace, Bulwark, Charge, Pull) | shapes the ground (Barricade, Scrap Wall, Arc Field, Gravity Snare) | shoots from a distance (Long Shot, Recoil Shot, Execution Round) | Field (damage at the end of a Tick); Brace; the passives |
| **Carry and extract** | carries without a malus; hooks and breaks | blocks lanes with Cover and Fields; the drone finds the carrier | cuts off the enemy carrier (Silent Entry, Snatch) | carry, drop and pick up an object |
| **Sabotage** | breaks Cover and the target (Wrecking Blow, Breach Charge) | rigs the target (Rig Charge), the drone finds it | gets behind the lines unseen (Silent Entry), removes the defenders | a target with a damage value |

## Parked and rejected ideas

All ideas of the chat and of the tester, with their state:

| Idea | State | Reason or where it could come back |
|---|---|---|
| Knockback on the Bruiser (Shockwave) | **rejected** | He wants to stay next to the enemy (the tester, the owner). Shockwave stays as plain area damage. |
| Knockback on the Assassin | recommended (Recoil Shot) | He wants distance. |
| Mobility card for the Bruiser instead of Knockback | done by ADR 0025 | Charge, Pull. |
| A field that damages units each Tick (the tester) | recommended (Arc Field) | Goes with Slow. Danger: the number of Ticks. |
| Field Repair: a discarded card returns to the Deck (healing for Tilly) | **parked** | The Deck is the life; a heal changes the rules and her toughness. Tilly has no Shield or healing now. |
| Shield for Tilly (Aegis Protocol, Reinforce) | moved to Max (Guard) | One main function each. |
| Fortify and Deploy Cover as separate cards | **merged** | Scrap Wall. |
| A grabbing arm: Tilly picks up an object from a distance | **parked** | Her third arm; it would give her a carry job. Possible when Carry and extract is specified. |
| A second reveal for Kit (a scope scan) | **parked** | The drone belongs to Tilly (decided). |
| Concussion Round (Slow) on Max | out | Slow belongs to Tilly. |
| Adrenal Surge (permanent +1 Attack) | out | A passive covers it. May return as an Overdrive-only card. |
| Precision Shot, Cover Breaker (Kit) | out | Overlap. May return if the measurement shows a hole. |
| Mark Target (Kit) | out since ADR 0025 | Could return as the marker of a Sabotage target. |
| Suppress, Forward Deploy | out since ADR 0025 | |

## Open questions

1. Tilly's passive: (a), (b), (c) or another.
2. Slow with Move 3: Move 1 or Move 2.
3. Arc Field: damage each Tick or once per Resolution; one tile or a pattern.
4. Mission cards (Rig Charge, Snatch): in the deck only in the mission mode, or always (every card can be Pitch, Move or Block, so none is dead, but they are weaker in the classic mode).
5. The toughness (12, 10, 9): keep until the measurement?
6. Names of the passives and the term in the glossary.
