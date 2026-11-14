# MVP Card Set Spec

This is the complete fixed card set for the offline 3v3 prototype. Every card can alternatively be used as Pitch 1, Move 2, or (in Attack and Defend only; the classic mode has no Block) Block 2. A card fulfills only one of these roles during a round.

Cards with the same name are identical in every respect, including their Overdrive: if one copy has an Overdrive, every copy of that card has exactly the same one. Cards that differ have different names.

Activating Overdrive exiles the card and **replaces** its standard effect; an Overdrive text is complete and says explicitly what it adds to or keeps from the standard effect. Each Deck has two or three Overdrive modes (distinct Overdrive effects) on at most four cards.

## Declared Target

An Attack that hits a single enemy Hero (every Attack except Shockwave and Breach Charge, which aim at an area or a tile) names that Hero in planning. Only an enemy that is Visible at that moment can be named, whatever its Range and Line of Sight from the planned position; a Ghost or an Unknown enemy cannot (Ghost Shot Overdrive is the way to hit a Ghost). The Attack is checked in the Tick it fires: the target must still be visible to the Squad, not Exhausted, within the card's Range, in Line of Sight and not behind Full Cover. If any check fails, the Attack misses and does nothing; later actions of the Queue still run. Attacks written as "an enemy" or "the target" without a Range below follow the same rule with the Range of the card. Utility cards that need a visible enemy (Charge, Pull, Gravity Snare) keep checking visibility when they resolve.

## Status effects

**Slow:** The affected Hero’s next Move 2 use becomes Move 1. Slow lasts until the end of the next Resolution.

**Knockback 2:** Move the target up to two tiles directly away from the attacker. The target stops early at a wall, full Cover, or another Hero.

## Deck sizes (ADR 0025)

The Deck is a Hero's life, so the classes differ in toughness: Bruiser 12 cards, Controller 10, Assassin 9. A Squad has 31 cards.

## Bruiser / Vanguard — 12 cards

1. **Slam Shot** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is visible and within Range 2 with a clear Line of Sight when the Attack fires; otherwise it misses. Deals 3 damage at Range 1 (ADR 0025).
2. **Slam Shot** — as card 1.
3. **Concussion Round** — Attack, 1 Energy: Deal 2 damage; apply Slow until the end of the next Resolution.
4. **Breach Charge** — Attack, 2 Energy: Deal 2 damage and destroy Half Cover on the target tile. **Overdrive:** Destroy any Cover on the target tile and deal 2 damage to each Hero on the target tile and on adjacent tiles, including allied Heroes and this Hero.
5. **Shockwave** — Attack, 2 Energy: Deal 2 damage to every enemy Hero within Range 1 and apply Knockback 2. **Overdrive:** Deal 3 damage to every enemy Hero within Range 1 and apply Knockback 2.
6. **Bulwark** — Utility, 1 Energy: This Hero gains Shield 3.
7. **Bulwark** — as card 6.
8. **Charge** — Utility, 1 Energy: Move up to 3 tiles toward the named visible, not Exhausted enemy Hero and end next to it; the move stops early at a wall, Full Cover or another Hero. This Hero gains Shield 1 until the end of the Round and +1 damage on its next Attack at Range 1 in that Round (used once; it expires with the Round). A Slam Shot at Range 1 after a Charge deals 4.
9. **Charge** — as card 8.
10. **Pull** — Utility, 1 Energy, Range 4: Move the named visible enemy Hero up to 2 tiles directly toward this Hero. It stops early at a wall, Full Cover or another Hero, like Knockback, and may leave a zone.
11. **Adrenal Surge** — Utility, 2 Energy: This Hero permanently gains +1 Attack until Exhaustion. **Overdrive:** This Hero and an allied Hero each permanently gain +1 Attack until Exhaustion.
12. **Wrecking Blow** — Attack, 1 Energy, Range 2: Deal 2 damage to the named visible enemy Hero; destroy any Cover (Half or Full) on the target tile after the damage of the Tick.

Overdrive modes: Breach Charge, Shockwave and Adrenal Surge (three Overdrive cards).

## Controller / Tactician — 10 cards

The Controller has one attack. Placed Cover (Fortify, Deploy Cover, Barricade) stays until it is destroyed; at most three Placed Cover tiles per Squad, the oldest disappears first; only Cover-destroying effects (Breach Charge, Wrecking Blow) remove it.

1. **Tag Round** — Attack, 1 Energy, Range 2: Deal 1 damage and apply Marked until the end of the next Resolution. **Overdrive:** Deal 1 damage; apply Marked and Slow until the end of the next Resolution.
2. **Scout Drone** — Utility, 1 Energy: Reveal a 3 by 3 area anywhere on the map (no Range, also in the Fog) for two Resolutions. A Hidden enemy inside is shown but stays Hidden. The enemy Squad sees which area was scanned and for how many more Resolutions, not what is in it. **Overdrive:** Reveal a 5 by 5 area.
3. **Scout Drone** — as card 2.
4. **Aegis Protocol** — Utility, 1 Energy: An allied Hero gains Shield 3. **Overdrive:** Two allied Heroes each gain Shield 3.
5. **Reinforce** — Utility, 1 Energy: An allied Hero gains Shield 2.
6. **Fortify** — Utility, 1 Energy: Place Half Cover on the tile of an allied Hero within Range 3 (Placed Cover).
7. **Deploy Cover** — Utility, 1 Energy: Place Half Cover on an empty tile (Placed Cover).
8. **Barricade** — Utility, 1 Energy: Place Full Cover on an empty tile within Range 3 (Placed Cover).
9. **Gravity Snare** — Utility, 2 Energy: A visible enemy gains Slow until the end of the next Resolution.
10. **Overwatch Uplink** — Utility, 1 Energy: An allied Hero may attack an enemy in Half Cover during this round without the Half Cover damage reduction.

Overdrive modes: Tag Round, Scout Drone (both cards) and Aegis Protocol (four Overdrive cards in total).

## Assassin / Striker — 9 cards

The Assassin deals damage at range and has no Shield cards. Its Attacks have a **Minimum Range**: a target closer than that cannot be hit (the Attack misses with the reason "too close", checked before Line of Sight).

1. **Precision Shot** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is visible and within Range 2 to 5 with a clear Line of Sight when the Attack fires; otherwise it misses.
2. **Long Shot** — Attack, 1 Energy: Range 3 to 7; deal 2 damage. **Overdrive:** Range 3 to 7; deal 4 damage if the target is at Range 6 or 7, otherwise deal 2 damage.
3. **Long Shot** — as card 2.
4. **Cover Breaker** — Attack, 1 Energy, Range 2 to 5: Deal 2 damage; ignore Half Cover.
5. **Shield Breaker** — Attack, 2 Energy: Deal 2 Piercing Damage to the named visible enemy Hero if it is allowed when the Attack fires (see Declared Target, Range 2 to 4); otherwise it misses. Shield is not reduced by it. Half Cover still reduces the damage by 1; Full Cover still blocks.
6. **Ghost Shot** — Attack, 1 Energy, Range 2 to 5: Deal 2 damage to the named visible enemy Hero if it is allowed when the Attack fires (see Declared Target); otherwise it misses. **Overdrive:** Target the last known position of a Ghost instead; the shot hits only if an enemy occupies that tile during Resolution.
7. **Execution Round** — Attack, 2 Energy, Range 2 to 5: Deal 3 damage to the named visible enemy Hero if it is allowed when the Attack fires (see Declared Target); otherwise it misses. It ignores Half Cover (ADR 0025).
8. **Vanish** — Utility, 1 Energy: This Hero becomes Hidden for up to two Resolutions, provided it ends movement in Cover.
9. **Reposition** — Utility, 1 Energy: This Hero gains Move 3 during this round.

Overdrive modes: Long Shot (both cards) and Ghost Shot (three Overdrive cards in total; the Assassin has two modes since Mark Target left the Deck).
