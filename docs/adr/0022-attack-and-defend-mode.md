# Attack and Defend Mode

> **Terminology:** `GLOSSARY.md` now calls the Spawn strips Drop Points (this record: Spawn). This record keeps its original words.

Primefall gets a second match mode, Attack and Defend, next to the classic mode. The player chooses the mode when a match starts. The classic mode stays the default and keeps every rule it has today; ADR 0010 (Prime Zone and Victory) and ADR 0019 (Round Limit and Tiebreak) stay valid for it and are not superseded.

## Context

In the classic mode the Zone decides every match before resources matter. Measured with the balance harness (`npm run balance` in `packages/game-core`, AI against AI), a match ends after 5 to 7 Rounds by the Zone, whatever the card numbers are: more damage, a smaller Deck, Pitch that exiles and Attacks that cost 2 Energy all leave about 6.3 Rounds, 100% Zone wins and no Exhaustion. Both Squads run to the middle and Attack; nothing in the match asks for resources, Cover or position. The wanted feeling is asymmetric roles with one Deck as the only life, where every card counts.

## Decision

In Attack and Defend one Squad is the **Defender** and the other is the **Attacker**.

- **Start:** the Defender's three Heroes start on the Prime Zone tiles of the inner column next to their side (column 14 for the Left Squad, column 16 for the Right Squad, rows 7 to 9). The Attacker starts on its Spawn tiles as usual.
- **Control of the Zone:** at the end of a Resolution the Attacker takes control of the Prime Zone when at least one Attacker Hero stands in it and it has at least as many non-exhausted Heroes in it as the Defender; a tie goes to the Attacker. Otherwise the previous controller keeps it. The Defender never wins by holding the Zone.
- **The Attacker wins** by controlling the Zone during 3 consecutive Resolutions, or by Exhausting all three Defender Heroes (ADR 0011).
- **The Defender wins** with **Defence Held**: the Round limit of the mode (default 12) has been played and the Attacker has not won. The 30 Round limit and the Deck tiebreak of ADR 0019 do not apply to this mode.
- The Round limit and the tie rule are constants in one place so that they can be tuned with the balance harness.
- Everything else is unchanged: Decks, Energy, Pitch, cards, Fog of War, Exhaustion, Cover, Resolution order.

The numbers are a first guess. An experiment (AI against AI, 300 seeds, not merged) gave matches of 9.7 Rounds without stalls and an Attacker win rate of 27% at Round limit 10 and 47% at Round limit 14. The AI is the measuring instrument, not a human: all numbers are to be re-checked by playing.

## Consequences

- A new match end reason, Defence Held, next to the Zone win, Squad loss and the Round limit of the classic mode.
- The saved snapshot of a match carries the mode and, in Attack and Defend, which Squad is the Attacker.
- The AI needs one plan per role: it pushes the Zone as Attacker and holds it while keeping its Decks as Defender.
- The web app needs a mode choice and a HUD that shows the role and the Round limit; this needs a design first.
- The balance harness gets a variant per mode and role.
- Zone Decay (each Hero that ends a Resolution in the Zone moves the top card of its Deck to the Exile) is a tuning option for later, not part of the first version.

## Status

Proposed. The owner accepts it by merging.
