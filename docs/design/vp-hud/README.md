# Victory Points HUD (#362)

Design references for the Victory Points and three-zone HUD, 844 x 390 (landscape phone). Drawn on the design canvas page "Victory Points HUD (#362)"; these are screenshots of the boards at 2x. The pictures are a sketch of the look, not the game's own drawing: sizes, spacing and exact colours come from the tokens in `docs/design/decisions.md` (own teal `#2ec4b6`, enemy red `#e5484d`, amber for Contested).

- `b-one-pill.png` (chosen): one pill with the score (own : enemy) and three zone dots (Outpost, Prime Zone, Outpost). The dot colour is the zone state. The inactive Prime Zone is a larger dashed dot with `R4`, and the line `PRIME ZONE ACTIVE IN n` sits under the pill.
- `d-callouts.png` (chosen): the end-of-Resolution callouts (`OUTPOST +1`, `ENEMY OUTPOST +1`, `PRIME ZONE +2`, `CONTESTED`, and at the start of Round 4 `PRIME ZONE ACTIVE`).
- `a-chips-backup.png` (backup, only if B does not look good in the game): the score pill with three named zone chips under it.
