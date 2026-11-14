# MVP Card Set Spec

This is the complete fixed card set for the offline 3v3 prototype. Every card can alternatively be used as Pitch 1 or Move 2. A card fulfills only one of these roles during a round.

Cards with the same name are identical in every respect. Cards that differ have different names. Every card costs 1 Energy. There is no Overdrive: a card has one effect (ADR 0003, removed in the #415 deck redesign test).

## Declared Target

An Attack that hits a single enemy Hero (every Attack except Breach Charge, which aims at a tile) names that Hero in planning. Only an enemy that is Visible at that moment can be named, whatever its Range and Line of Sight from the planned position; a Ghost or an Unknown enemy cannot (Ghost Shot is the way to hit a Ghost). The Attack is checked in the Tick it fires: the target must still be visible to the Squad, not Exhausted, within the card's Range, in Line of Sight and not behind Full Cover. If any check fails, the Attack misses and does nothing; later actions of the Queue still run. Attacks written as "an enemy" or "the target" without a Range below follow the same rule with the Range of the card. Utility cards that need a visible enemy (Charge, Pull, Gravity Snare) keep checking visibility when they resolve.

## Status effects

**Slow:** The affected Hero’s next Move 2 use becomes Move 1. Slow lasts until the end of the next Resolution.

## Deck sizes (ADR 0025)

The Deck is a Hero's life, so the classes differ in toughness: Bruiser 12 cards, Controller 10, Assassin 9. A Squad has 31 cards.

## Bruiser / Vanguard (Max Overload) — 12 cards

Max wants to be up close and personal: he pulls enemies to himself and shields himself (`docs/design/decks.md`). The cards have no passives; what a card does stands on the card.

1. **Buy One, Get Two** (Double Shot) — Attack, 1 Energy, Range 1 to 2: Make two Attacks on the named visible enemy Hero, one after the other. Each deals 2 damage, 3 at Range 1.
2. **Express Delivery** (Rush) — Utility, 1 Energy: This Hero gains Shield 2 until the end of the Round, then moves up to 5 tiles toward the named visible, not Exhausted enemy Hero and ends next to it; the move stops early at a wall, Full Cover or another Hero. It can only name an enemy Hero, so it is not a Move.
3. **Express Delivery** — as card 2.
4. **Hard Hat** (Shield) — Utility, 1 Energy: This Hero gains Shield 2.
5. **Hard Hat** — as card 4.
6. **Cargo Hook** (Grappling Hook) — Utility, 1 Energy, Range 7: Move the named visible enemy Hero directly toward this Hero until it stands next to it. It stops early at a wall, Full Cover or another Hero. It can also name a Ghost: it works if the enemy still stands on the tile where the Squad last saw it, otherwise the action fails.
7. **Cargo Hook** — as card 6.
8. **Handle With Care** (Close Attack) — Attack, 1 Energy, Range 1 to 2: Deal 2 damage to the named visible enemy Hero; 3 damage at Range 1.
9. **Handle With Care** — as card 8.
10. **Handle With Care** — as card 8.
11. **Time for Coffee** (Concussion Round) — Attack, 1 Energy, Range 3: Deal 1 damage and apply Slow until the end of the next Resolution.
12. **Time for Coffee** — as card 11.

The order in `HERO_DECKS` is different (the old positions of Handle With Care and Time for Coffee are kept for the tests); the order has no rule meaning.

## Controller / Tactician (Tilly Turnover) — 10 cards

The Controller has one attack. Placed Cover (Fortify, Deploy Cover, Barricade) stays until it is destroyed; at most three Placed Cover tiles per Squad, the oldest disappears first; only Cover-destroying effects (Breach Charge, Wrecking Blow) remove it. Tilly creates and destroys Cover; she has no Shield cards.

1. **Tag Round** — Attack, 1 Energy, Range 2: Deal 1 damage and apply Marked until the end of the next Resolution.
2. **Scout Drone** — Utility, 1 Energy: Reveal a 3 by 3 area anywhere on the map (no Range, also in the Fog) for two Resolutions. A Hidden enemy inside is shown but stays Hidden. The enemy Squad sees which area was scanned and for how many more Resolutions, not what is in it.
3. **Scout Drone** — as card 2.
4. **Breach Charge** — Attack, 1 Energy, Range 3: Aim at a tile; deal 2 damage to the enemy Hero standing there and destroy Half Cover on the tile.
5. **Wrecking Blow** — Attack, 1 Energy, Range 2: Deal 2 damage to the named visible enemy Hero; destroy any Cover (Half or Full) on the target tile after the damage of the Tick.
6. **Fortify** — Utility, 1 Energy: Place Half Cover on the tile of an allied Hero within Range 3 (Placed Cover).
7. **Deploy Cover** — Utility, 1 Energy: Place Half Cover on an empty tile (Placed Cover).
8. **Barricade** — Utility, 1 Energy: Place Full Cover on an empty tile within Range 3 (Placed Cover).
9. **Gravity Snare** — Utility, 1 Energy: A visible enemy gains Slow until the end of the next Resolution.
10. **Overwatch Uplink** — Utility, 1 Energy: An allied Hero may attack an enemy in Half Cover during this round without the Half Cover damage reduction.

## Assassin / Striker — 9 cards

The Assassin deals damage at range and has no Shield cards. Its Attacks have a **Minimum Range**: a target closer than that cannot be hit (the Attack misses with the reason "too close", checked before Line of Sight).

1. **Precision Shot** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is visible and within Range 2 to 5 with a clear Line of Sight when the Attack fires; otherwise it misses.
2. **Long Shot** — Attack, 1 Energy: Range 3 to 7; deal 2 damage.
3. **Long Shot** — as card 2.
4. **Cover Breaker** — Attack, 1 Energy, Range 2 to 5: Deal 2 damage; ignore Half Cover.
5. **Shield Breaker** — Attack, 1 Energy: Deal 2 Piercing Damage to the named visible enemy Hero if it is allowed when the Attack fires (see Declared Target, Range 2 to 4); otherwise it misses. Shield is not reduced by it. Half Cover still reduces the damage by 1; Full Cover still blocks.
6. **Ghost Shot** — Attack, 1 Energy, Range 2 to 5: Target the last known position of a Ghost; deal 2 damage to an enemy that occupies that tile during Resolution, otherwise the shot hits nobody.
7. **Execution Round** — Attack, 1 Energy, Range 2 to 5: Deal 3 damage to the named visible enemy Hero if it is allowed when the Attack fires (see Declared Target); otherwise it misses. It ignores Half Cover (ADR 0025).
8. **Vanish** — Utility, 1 Energy: This Hero becomes Hidden for up to two Resolutions, provided it ends movement in Cover.
9. **Reposition** — Utility, 1 Energy: This Hero gains Move 3 during this round.
