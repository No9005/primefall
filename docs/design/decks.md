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
- **No passives (decided later in the chat; the earlier decision is withdrawn).** Passives only add complexity. What the card says is what it does: the +1 damage at short range stands on the cards of Max that use it.
- **No Block.** Using any card as Block 2 is gone from the rules and the code (ADR 0002). Shield comes only from Shield cards.
- **Tilly creates and destroys Cover** (she is the Controller). Max no longer breaks Cover.
- **Fewer effects:** the decks use fewer different effects; Max is built first.
- **Max carries objects without a malus** (see _Carrying_).
- **The default movement rises to 3** (see _Move 3_).
- **Overdrive is removed as a test** (decided in the chat; done in the branch `agent/issue-415-deck-redesign`: the cards have no Overdrive mode, Ghost Shot is the Ghost card). **Pitch stays. Every card costs 1 Energy** (so one pitched card pays for one card). **No Link:** synergy should come natively from the cards and their states, not from a condition text on the card.

## Main function of each Hero (one sentence)

| Hero | Main function |
|---|---|
| **Max Overload** (Bruiser) | Max gets there first and stays: he holds the ground and does not let himself be pushed off. |
| **Tilly Turnover** (Controller) | Tilly changes the ground and sees across it: Cover, Fields and the drone decide where the enemy can walk and what he can hide. |
| **Kit Crosshair** (Assassin) | Kit decides the fight before it starts: unseen, from a distance, on one target. |

## Passives (dropped)

The idea of a passive effect per Hero (Max +1 damage at Range 1, Kit +1 at the Attack's maximum Range, Tilly open with options Tinker, Long fuse and Spotted) was dropped: it adds a rule outside the cards. Reading the card explains the card. Where a bonus is wanted it is written on the card, for example "+1 damage at Range 1". The old text is kept in the git history of this file.

## Carrying

Decided: **Max carries objects without a malus.** The proposal for the others, until the rules of Carry and extract exist: a Hero carrying an object has its Move 3 reduced to Move 2 and cannot use Charge-like moves; the object drops on its tile when the carrier is Exhausted. Max has none of this. Kit's **Snatch** picks up a dropped object. The rules (pick up, carry, drop, who may pick up) are part of the mission ticket, not of this one.

## Move 3

Decided: the default movement rises to 3 (every card can be used as Move 3 instead of Move 2; a Hero's queue has at most four actions, so up to nine tiles per Round if three actions are Moves). What follows:

- **Slow** (today: the next Move 2 becomes Move 1): proposal, the next Move 3 becomes Move 1, as it was in relation; an alternative is Move 2.
- **Charge** (moves up to 3 toward an enemy) is no longer faster than a Move: raise it to up to 4 tiles, or keep 3 and let the Shield 1 be its point.
- **Reposition** of the Assassin (Move 3 this round) has no point any more; the Assassin's deck replaces it (Silent Entry).
- **Map:** the walk from a Drop Point to the first zone is about 19 to 20 tiles on Crossroads v2, three Rounds with Move 2; with Move 3 it is about two. This also solves the open point of #361 (the Outposts should be about two Rounds from a Drop Point).
- **Range and sight** stay. The AI and the balance harness need updating (the Tutorial is removed and will be rethought).

## Recommended decks

Status: **existing** (as in the spec), **changed** (text changed), **new**. Energy costs are the current ones where the card exists. Deck sizes are those of ADR 0025 (Bruiser 12, Controller 10, Assassin 9; the Deck is the life); they are kept until the measurement.

### Max Overload (Bruiser), 12 cards: up close and personal

Max wants to be up close and personal: he pulls enemies to himself and shields himself. Agreed in the chat; numbers are starting points. His Attacks reach Range 2 to 3, on purpose: only the Hook reaches far, to bring the enemy to him.

| # | Card | Energy | Effect (proposal) | Count |
|---|---|---|---|---|
| 1 | **Double Shot** | 1 | Attack, Range 1 to 2: two Attacks on the same target, 2 damage each, +1 damage each at Range 1. (Measure: 6 damage at Range 1 is a lot.) | 1 |
| 2 | **Rush** | 1 | Utility: first gain Shield 2, then move up to 5 tiles toward a named visible enemy Hero and end next to it (stops at a wall, Full Cover or a Hero). It can only aim at a Hero, so it is not a Move. | 2 |
| 3 | **Shield** | 1 | Utility: this Hero gains Shield 2. | 2 |
| 4 | **Grappling Hook** | 1 | Utility, Range 7: move the named visible enemy Hero toward this Hero (open: all the way next to Max, or at most 3 tiles); needs Line of Sight. It can also target a Ghost (the last known position; if the Hero is there it is pulled). | 2 |
| 5 | **Close Attack** | 1 | Attack, Range 1 to 2: deal 2 damage, +1 at Range 1. | 3 |
| 6 | **Concussion Round** | 1 | Attack, Range 3: deal 1 damage and apply Slow (the next Move is halved, until the end of the next Resolution). A hooked enemy cannot walk away. | 2 |

Notes:

- No Long Attack any more: its place is a second Concussion Round.
- Gone from Max's deck compared with the old one: Breach Charge, Wrecking Blow, Shockwave, Pull (replaced by the Hook), Adrenal Surge, Bulwark (replaced by Shield), Charge (replaced by Rush). They stay in this file as ideas; Cover destruction moves to Tilly.
- Synergy that arises natively: the Hook pulls an enemy next to Max, where Double Shot and Close Attack deal +1; Concussion Round keeps the hooked enemy there; Rush closes the rest and shields on the way in.
- Missing on purpose: no Knockback, no Cover breaking.

### Tilly Turnover (Controller), 10 cards: the Field and the sight

| # | Card | Energy | Effect (proposal) | Status |
|---|---|---|---|---|
| 1 | **Tag Round** | 1 | Attack, Range 2: deal 1 damage and apply Marked until the end of the next Resolution. | existing |
| 2-3 | **Scout Drone** x2 | 1 | Utility: reveal a 3 by 3 area anywhere on the map, also in the Fog, for two Resolutions; a Hidden enemy inside is shown and stays Hidden. The enemy sees which area was scanned, not who looks. | existing |
| 4 | **Barricade** | 1 | Utility, Range 3: place Full Cover on an empty tile (Placed Cover). | existing |
| 5 | **Scrap Wall** | 1 | Utility, Range 3: place Half Cover on an empty tile or on the tile of an allied Hero (Placed Cover). It merges Fortify and Deploy Cover. | changed (Fortify + Deploy Cover) |
| 6-7 | **Arc Field** x2 | 1 | Utility, Range 4: place a Field on a tile for two Resolutions. An enemy Hero that stands on it at the end of a Tick takes 1 damage. | **new** |
| 8 | **Gravity Snare** | 1 | Utility: a visible enemy Hero gains Slow until the end of the next Resolution. | existing |
| 9 | **Overwatch Uplink** | 1 | Utility: an allied Hero may attack an enemy in Half Cover this round without the Half Cover damage reduction. | existing |
| 10 | **Rig Charge** | 1 | Utility: prepare a mission target next to this Hero; the next Attack on it deals +2 damage (Sabotage). Without a mission it can be used as Pitch, Move or Block like every card. | **new** (mission card) |

### Kit Crosshair (Assassin), 9 cards: unseen, at range, on one target

| # | Card | Energy | Effect (proposal) | Status |
|---|---|---|---|---|
| 1-2 | **Long Shot** x2 | 1 | Attack, Range 3 to 7: deal 2 damage. (The +1 at Range 6 and 7 would be written on the card.) | changed |
| 3 | **Recoil Shot** | 1 | Attack, Range 2 to 5: deal 2 damage and apply Knockback 1 (the tester's wish: the Assassin keeps his distance). | **new** |
| 4 | **Shield Breaker** | 1 | Attack, Range 2 to 4: deal 2 Piercing Damage; Shield is not reduced; Half Cover still reduces it by 1, Full Cover blocks. | existing |
| 5 | **Execution Round** | 1 | Attack, Range 2 to 5: deal 3 damage; ignores Half Cover. | existing |
| 6 | **Ghost Shot** | 1 | Attack, Range 2 to 5: fire at the last known position of a Ghost; deal 2 damage to the enemy that stands there. | **changed** (this was its Overdrive; without Overdrive it is the card) |
| 7 | **Vanish** | 1 | Utility: this Hero becomes Hidden for up to two Resolutions, provided it ends its movement in Cover. | existing |
| 8 | **Silent Entry** | 1 | Utility: move up to 3 tiles; this Hero stays Hidden and is not shown by a drone area on the way. The weapon for Sabotage and for cutting off a carrier. | **new** (replaces Reposition) |
| 9 | **Snatch** | 1 | Utility: pick up a dropped object within 2 tiles of this Hero (Carry and extract). Without a mission: Pitch, Move or Block. | **new** (mission card) |

## The system: Pitch, Overdrive and synergy (ideas, not decided)

The owner's playtests: Pitch and Overdrive do not feel good, there is never a reason to use an Overdrive, and the cards have no synergy with each other (inside a Hero's deck and between the Heroes). The ideas below come from the rules as written (glossary, ADR 0001, ADR 0003); nothing here is measured. A first measurement to make: how often the AI uses an Overdrive in the balance harness.

**Why an Overdrive is never worth it (from the rules).** An Overdrive exiles the card, and the Deck is the life (ADR 0001): in a Deck of 9 to 12 cards that is about one tenth of the Hero's life for good, on top of the Energy the card costs. The reward is a stronger effect once (plus 1 or 2 damage, a bigger area). Only a few cards have one. It replaces the standard text, so it is also one more text to read, and a card already has four uses (effect, Pitch, Move, Block).

**Why Pitch feels like a tax.** Energy only comes from pitching a card, so a 2 Energy card costs two more cards of the queue. The choice is rarely interesting: the worst card is pitched.

**Idea 1: remove Overdrive.** Remove the exile mode (ADR 0003 would be superseded; exile stays only as Deck Damage). Its place is taken by the **Link**.

**Idea 2: Link. (The owner does not want it: synergy should come natively, from the cards and their states. Kept here as an idea.)** A card may carry one short condition and a small bonus: "**Link, Marked:** +1 damage." The conditions are a few shared states that the Heroes create and that last over Ticks, so it does not matter who plays first in a Round:

| State | Created by | Who profits (examples) |
|---|---|---|
| **Marked** | Tilly (Tag Round) | Kit: Execution Round +1 against a Marked target; Max: Pull on a Marked enemy also Slows it |
| **Slow** | Tilly (Gravity Snare, Tag Round Overdrive), Max (Concussion Round, if it returns) | Max: Charge and Pull cannot be avoided; Slam Shot +1 against a Slowed enemy |
| **Revealed** (inside a drone area) | Tilly (Scout Drone) | Kit and Max may name a Revealed enemy as target; Kit: Long Shot +1 |
| **Hidden** | Kit (Vanish, Silent Entry) | Kit: an Attack from Hidden +1 |
| **On a Field** | Tilly (Arc Field) | Max: Pull into the Field; Kit: Recoil Shot into the Field |
| **Cover** (Placed) | Tilly (Barricade, Scrap Wall) | Kit: Vanish needs Cover; Max: Brace in Cover gets Shield 2 |

**Synergies that already exist and need no new rule:** Recoil Shot pushes an enemy to the maximum Range, so the next Long Shot gets Kit's passive +1. Pull brings an enemy to Range 1, so Max's passive +1 applies. Tilly's Cover lets Kit use Vanish. Max's Wrecking Blow takes away Cover that protects an enemy from Kit.

**Idea 3: Pitch.** Option 1: leave Pitch as it is; when the cards have a Link, each card is worth playing, so pitching costs more and the choice is real. Option 2: a fixed Energy per Round (for example 3) and Pitch gives +1 on top; the tax goes away and the plan is easier to read, but it changes a core rule (spec stories 28 to 32). Recommendation: Option 1 first, measure, Option 2 as the fallback.

**Rules and risks.** (1) The player controls one Hero in the classic mode; the two others are planned by the AI. Synergy between Heroes must not depend on the timing of the AI, so only **lasting states** (Marked, Slow, Revealed, Field, Cover) are used as conditions, not "played earlier this Round". The AI must still learn to use them. (2) At most one Link per card, a bonus of at most +1, so that no card swings. (3) Six conditions at most, so that the player can learn them (they belong in the glossary).

## Tilly: Marked and Slow (the passive part is dropped)

**Passive idea of the owner: less damage in her own Cover.** On Half Cover she placed herself, Tilly takes 2 less damage instead of 1.

- *For:* it fits her main function (she reads the ground), it gives a reason to place Cover next to herself and to play around terrain, and the story is easy: she built it, she knows where to stand.
- *Danger:* most Attacks deal 2 damage, so 2 less is 0: on her own Half Cover she would be immune to a 2-damage Attack. Counters exist (Execution Round and Shield Breaker ignore or pierce Half Cover, Wrecking Blow and Breach Charge destroy it), but the gauge "damage share" (game-goals) must show that she is not unkillable.
- *Variants:* (a) 2 less, minimum 0 (strongest). (b) 2 less, but a hit never goes below 1: the same as today for 2-damage Attacks, so a change only against 3 damage. (c) **Her own Half Cover also works against Attacks from Range 1** (today Cover is ignored at Range 1): she cannot be rushed by a Bruiser on her Cover. My recommendation: **(c)**, it is a new fact about her place on the board, not a number, and it answers the Bruiser, the one Hero that stands next to her. (a) can be tried first in the harness.
- *Rule:* the Placed Cover has an owner already (#433); "her own" is the Cover placed by Tilly.

**How to explain Marked and Slow (story).** Marked is a statement about sight (glossary: the enemy is visible to the Squad until the end of the next round); Slow is a statement about the ground. So both follow from her two tools:

- **Marked comes from the drone.** The drone paints targets: a Marked enemy is one her drone tracks, which is why the Squad keeps sight of it. Tag Round is the drone's marker round (1 damage and a tracker). Overwatch Uplink is the same link: the drone guides an ally's shot past a Half Cover.
- **Slow comes from the ground.** A gravity or foam field slows what stands in it. Idea: **Gravity Snare becomes a Field** (the Field family: Arc Field damages, Snare Field slows), instead of a direct status on an enemy. Then she has two families of her own: the **Cover and Fields** of the ground and the **drone** with its markers. Every Slow comes from a tile, every Marked from the drone.

## Native synergy (ideas, no condition text on the cards)

Instead of a Link, the cards combine through what they do to the board and to the Heroes: a tile that is a Field, Cover that is placed or destroyed, a Hero that is pulled, pushed, slowed, marked or Hidden. Examples that need no new text: Recoil Shot pushes an enemy to the maximum Range, so Kit's passive +1 applies; Pull brings an enemy to Range 1, so Max's passive +1 applies; Pull or Recoil Shot into an Arc Field; a Snare Field holds an enemy where Max's Charge reaches; Tilly's Cover lets Kit use Vanish; a drone area shows what Kit and Max can name as a target. The deck design checks every card against this list: what does it do to the board or to a Hero that another card cares about?

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
| Adrenal Surge (permanent +1 Attack) | out | No passives; the card is simply not in the deck. |
| Precision Shot, Cover Breaker (Kit) | out | Overlap. May return if the measurement shows a hole. |
| Mark Target (Kit) | out since ADR 0025 | Could return as the marker of a Sabotage target. |
| Suppress, Forward Deploy | out since ADR 0025 | |

## Open questions

0. The system: decided in the chat: Overdrive removed as a test, Pitch stays, every card costs 1 Energy, no Link (see _The system_). Still open: how the synergy comes natively (see _Native synergy_).
1. Tilly: how Cover creation and destruction split across her cards (she now also breaks Cover).
2. Slow with Move 3: Move 1 or Move 2.
3. Arc Field: damage each Tick or once per Resolution; one tile or a pattern.
4. Mission cards (Rig Charge, Snatch): in the deck only in the mission mode, or always (every card can be Pitch or Move, so none is dead, but they are weaker in the classic mode).
5. The toughness (12, 10, 9): keep until the measurement?
