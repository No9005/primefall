# MVP Card Set Spec

This is the complete fixed card set for the offline 3v3 prototype. Every card can alternatively be used as Pitch 1, Move 2, or Block 2. A card fulfills only one of these roles during a round.

Cards with the same name are identical in every respect, including their Overdrive: if one copy has an Overdrive, every copy of that card has exactly the same one. Cards that differ have different names.

Activating Overdrive exiles the card and **replaces** its standard effect; an Overdrive text is complete and says explicitly what it adds to or keeps from the standard effect. Each Deck has three Overdrive modes (three distinct Overdrive effects) on at most four cards.

## Declared Target

An Attack that hits a single enemy Hero (every Attack except Shockwave and Breach Charge, which aim at an area or a tile) names that Hero in planning. Only an enemy that is Visible at that moment can be named, whatever its Range and Line of Sight from the planned position; a Ghost or an Unknown enemy cannot (Ghost Shot Overdrive is the way to hit a Ghost). The Attack is checked in the Tick it fires: the target must still be visible to the Squad, not Exhausted, within the card's Range, in Line of Sight and not behind Full Cover. If any check fails, the Attack misses and does nothing; later actions of the Queue still run. Attacks written as "an enemy" or "the target" without a Range below follow the same rule with the Range of the card. Utility cards that need a visible enemy (Suppress, Gravity Snare) keep checking visibility when they resolve.

## Status effects

**Slow:** The affected Hero’s next Move 2 use becomes Move 1. Slow lasts until the end of the next Resolution.

**Knockback 2:** Move the target up to two tiles directly away from the attacker. The target stops early at a wall, full Cover, or another Hero.

## Bruiser / Vanguard — 12 cards

1. **Slam Shot** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is visible and within Range 3 with a clear Line of Sight when the Attack fires; otherwise it misses.
2. **Slam Shot** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is visible and within Range 3 with a clear Line of Sight when the Attack fires; otherwise it misses.
3. **Concussion Round** — Attack, 1 Energy: Deal 2 damage; apply Slow until the end of the next Resolution.
4. **Concussion Round** — Attack, 1 Energy: Deal 2 damage; apply Slow until the end of the next Resolution.
5. **Breach Charge** — Attack, 2 Energy: Deal 2 damage and destroy Half Cover on the target tile. **Overdrive:** Destroy any Cover on the target tile and deal 2 damage to each Hero on the target tile and on adjacent tiles, including allied Heroes and this Hero.
6. **Shockwave** — Attack, 2 Energy: Deal 2 damage to every enemy Hero within Range 1 and apply Knockback 2. **Overdrive:** Deal 3 damage to every enemy Hero within Range 1 and apply Knockback 2.
7. **Bulwark** — Utility, 1 Energy: This Hero gains Shield 3.
8. **Bulwark** — Utility, 1 Energy: This Hero gains Shield 3.
9. **Forward Deploy** — Utility, 1 Energy: An allied Hero gains an additional Move 2 during this round.
10. **Suppress** — Utility, 1 Energy: A visible enemy gains Slow and cannot become Hidden during this round.
11. **Reinforce** — Utility, 1 Energy: An allied Hero gains Shield 2.
12. **Adrenal Surge** — Utility, 2 Energy: This Hero permanently gains +1 Attack until Exhaustion. **Overdrive:** This Hero and an allied Hero each permanently gain +1 Attack until Exhaustion.

Overdrive modes: Breach Charge, Shockwave, and Adrenal Surge (three Overdrive cards).

## Controller / Tactician — 12 cards

1. **Pulse Bolt** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is visible and within Range 2 with a clear Line of Sight when the Attack fires; otherwise it misses.
2. **Pulse Bolt** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is visible and within Range 2 with a clear Line of Sight when the Attack fires; otherwise it misses.
3. **Tag Round** — Attack, 1 Energy: Deal 1 damage and apply Marked until the end of the next Resolution. **Overdrive:** Deal 1 damage; apply Marked and Slow until the end of the next Resolution.
4. **Shock Pulse** — Attack, 1 Energy: Deal 1 damage to the named visible enemy Hero if it is visible and within Range 2 with a clear Line of Sight when the Attack fires, and apply Slow until the end of the next Resolution.
5. **Scout Drone** — Utility, 1 Energy: Reveal a 3 by 3 area within Range 4 for two Resolutions. **Overdrive:** Reveal a 5 by 5 area within Range 4 for two Resolutions.
6. **Scout Drone** — Utility, 1 Energy: Reveal a 3 by 3 area within Range 4 for two Resolutions. **Overdrive:** Reveal a 5 by 5 area within Range 4 for two Resolutions.
7. **Aegis Protocol** — Utility, 1 Energy: An allied Hero gains Shield 3. **Overdrive:** Two allied Heroes each gain Shield 3.
8. **Fortify** — Utility, 1 Energy: Place Half Cover on the tile of an allied Hero within Range 3 for two Resolutions.
9. **Deploy Cover** — Utility, 1 Energy: Place Half Cover on an empty tile for two Resolutions.
10. **Deploy Cover** — Utility, 1 Energy: Place Half Cover on an empty tile for two Resolutions.
11. **Gravity Snare** — Utility, 2 Energy: A visible enemy gains Slow until the end of the next Resolution.
12. **Overwatch Uplink** — Utility, 1 Energy: An allied Hero may attack an enemy in Half Cover during this round without the Half Cover damage reduction.

Overdrive modes: Tag Round, Scout Drone (both cards) and Aegis Protocol (four Overdrive cards in total).

## Assassin / Striker — 12 cards

1. **Precision Shot** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is visible and within Range 5 with a clear Line of Sight when the Attack fires; otherwise it misses.
2. **Precision Shot** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is visible and within Range 5 with a clear Line of Sight when the Attack fires; otherwise it misses.
3. **Piercing Round** — Attack, 1 Energy: Deal 2 damage; ignore Half Cover.
4. **Piercing Round** — Attack, 1 Energy: Deal 2 damage; ignore Half Cover.
5. **Long Shot** — Attack, 1 Energy: Range 7; deal 2 damage. **Overdrive:** Range 7; deal 4 damage if the target is at Range 6 or 7, otherwise deal 2 damage.
6. **Long Shot** — Attack, 1 Energy: Range 7; deal 2 damage. **Overdrive:** Range 7; deal 4 damage if the target is at Range 6 or 7, otherwise deal 2 damage.
7. **Ghost Shot** — Attack, 1 Energy: Deal 2 damage to the named visible enemy Hero if it is allowed when the Attack fires (see Declared Target); otherwise it misses. **Overdrive:** Target the last known position of a Ghost instead; the shot hits only if an enemy occupies that tile during Resolution.
8. **Execution Round** — Attack, 2 Energy: Deal 3 damage to the named visible enemy Hero if it is allowed when the Attack fires (see Declared Target); otherwise it misses.
9. **Vanish** — Utility, 1 Energy: This Hero becomes Hidden for up to two Resolutions, provided it ends movement in Cover.
10. **Vanish** — Utility, 1 Energy: This Hero becomes Hidden for up to two Resolutions, provided it ends movement in Cover.
11. **Mark Target** — Utility, 1 Energy: Mark an enemy within the Hero’s current sight range until the end of the next Resolution. **Overdrive:** Mark the enemy; if it is within Range 5 (this Hero's weapon range), also deal 1 damage.
12. **Reposition** — Utility, 1 Energy: This Hero gains Move 3 during this round.

Overdrive modes: Long Shot (both cards), Ghost Shot and Mark Target (four Overdrive cards in total).
