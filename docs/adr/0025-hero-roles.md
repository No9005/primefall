# Hero Roles

The three classes get different jobs, toughness, reach and tools. Almost every Attack no longer deals 2 damage at similar range.

## Context

Almost every Hero attacks for 2 damage and that is all; the classes differ little except in Range (Bruiser 3, Controller 2, Assassin 5 to 7). The Controller has four attacks among its twelve cards. The wanted game is a tug of war with distinct roles, strengths and weaknesses (`docs/design/game-goals.md`, ADR 0024).

## Decision

**Toughness (the Deck size, because the Deck is the life):** Bruiser 12, Controller 10, Assassin 9. The Assassin may become 10 after the measurement.

**Bruiser, tank and enabler.** Attacks at Range 1 to 2: 2 damage, 3 at Range 1. New **Charge** (Utility, 1 Energy): move up to 3 tiles toward a named visible enemy and end next to it, gain Shield 1 until the end of the Round and +1 damage on the next Attack at Range 1 in that Round (a hit at Range 1 after a Charge deals 4). New **Pull** (1 Energy): pull a visible enemy up to 2 tiles toward the Bruiser (stops at a wall, Full Cover or a Hero, like Knockback; it may pull a Hero out of a zone). New **Wrecking Blow** (Attack, 1 Energy, Range 1 to 2, 2 damage): destroys any Cover on the target tile. Keeps Knockback (Shockwave), Breach Charge and Bulwark (Shield 3 on itself). Deck: 2 Slam Shot, Concussion Round, Breach Charge, Shockwave, 2 Charge, Pull, 2 Bulwark, Adrenal Surge, Wrecking Blow.

**Controller, support.** One attack, **Tag Round** (1 damage, Marked, Range 2). Placed Cover (Deploy Cover, Fortify, the new **Barricade** that places Full Cover) stays until it is destroyed; at most three Placed Cover tiles per Squad, the oldest disappears first; only Cover-destroying effects (Breach Charge, Wrecking Blow) remove it. The **Scout Drone** can be sent to any tile of the map, also into the Fog, reveals 3 by 3 (Overdrive 5 by 5) for two Resolutions and shows a Hidden Assassin without ending Hidden; the enemy sees which area was revealed, not what is in it. **Reinforce** (ally Shield 2) moves from the Bruiser to the Controller. Deck: Tag Round, 2 Scout Drone, Aegis Protocol, Reinforce, Fortify, Deploy Cover, Barricade, Gravity Snare, Overwatch Uplink.

**Assassin, glass cannon.** Damage at range, no Shield cards. Attacks have a **Minimum Range**: nothing at Range 1; Precision Shot, Cover Breaker, Shield Breaker, Ghost Shot and Execution Round hit from Range 2, Long Shot from Range 3. **Execution Round** also ignores Half Cover. Deck: Precision Shot, 2 Long Shot, Cover Breaker, Shield Breaker, Ghost Shot, Execution Round, Vanish, Reposition. A second Shield Breaker in place of Ghost Shot is tried only after the measurement.

A new miss reason (`TooClose`) joins the Declared Target checks. The cards Suppress, Forward Deploy, one Concussion Round, both Pulse Bolt, Shock Pulse, one Precision Shot, one Vanish and Mark Target leave the decks.

Block in Attack and Defend is unchanged (ADR 0024). The classic mode has Shield cards only.

## Consequences

- A Squad has 31 cards instead of 36; the Round-limit tiebreak of Attack and Defend (ADR 0019) compares other totals (the numbers, not the rule, change). Three Assassins would have 27 cards.
- Placed Cover changes the map during a match; the Cover cap keeps lanes open. The map ticket must expect Placed Cover.
- The distance duel, the damage share and the composition win rate are the gauges (`docs/design/game-goals.md`).
- Hero Select card lists and class texts change; the AI plays all classes with the same weights and may need class weights.
- Every card number is a starting point for the measurement, not a final value.

## Status

Proposed. The owner accepts it by merging.
