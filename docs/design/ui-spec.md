# UI Spec: Offline MVP Prototype

Clickable mockups: `docs/design/mockups.html` (open in a browser). Assets: `docs/design/asset-contract.md`. Vocabulary follows `GLOSSARY.md`. The UI language of the final app is not decided yet; the mockups use English terms.

## Principles

- One primary decision per Round must be obvious.
- Cards must be readable on a phone.
- Commit must feel consequential.
- The replay must explain cause and effect.
- Orientation: **landscape first** (Grid is 21 x 11 tiles, about 2:1). In portrait the app shows a "Rotate your device" notice. Desktop scales the same layout.
- The board fills the whole screen as the bottom layer; HUD panels overlay it at the edges. The default camera frames the central 13 columns around the Prime Zone; pinch or drag pans and zooms, double tap re-centres on the selected Hero.

## Screens

1. **Start**: product name, "Play" (Reactor Deck, 3v3 vs AI, you control the Bruiser), seed shown small for bug reports.
2. **Planning** (main screen): top bar with "Round X / 30", planning timer, Prime Zone control progress (0 to 3 Resolutions per Squad). Left: Squad panel with the three Heroes (Deck / Exile counts, selected Hero highlighted; allied Heroes are AI planned and show their queue read-only). Bottom: Hand of up to 4 cards and the Energy readout. Right: action queue of the selected Hero and the Commit button.
3. **Resolution**: same board, HUD reduced to Tick indicator ("Tick 2 / 4"), an event log that names cause and effect ("Bruiser Slam Shot hits Enemy Assassin, 2 Deck Damage"), play / pause / speed (1x, 2x) and skip to end.
4. **End**: result (victory, defeat, draw), reason (Prime Zone held, all Heroes Exhausted, Round Limit with Deck totals), Round reached, "Play again" and the match seed.
5. **Card detail** (sheet over Planning): the card with its four uses (Primary effect, Pitch 1, Move 2, Block 2) and Overdrive where available. Disabled uses state why (for example "needs 2 Energy").

## Information shown (ADR 0017)

- Own Hand: full cards. Own Deck and Exile: counts. Hand size never exceeds 4.
- Visible enemy: position, Shield, Deck / Discard / Exile counts.
- Ghost enemy: faded sprite at last known position, counts last seen, label "last seen".
- Unknown enemy: no marker; the Squad panel lists it as "Unknown".
- Never shown: enemy Hands, Energy, queues.

## Component states

| Component | States |
|---|---|
| Card | in Hand, selected, use chosen (Primary / Pitch / Move 2 / Block 2), cannot afford, already used this Round, Overdrive armed |
| Energy | Pitched total, spent, available |
| Queue slot | empty, filled (card + use + target), invalid at plan time (marked, still sendable), failed at execution (Resolution log) |
| Hero token | selected, allied, Visible enemy, Ghost enemy, Hidden, Marked, Slow, Shielded, Exhausted |
| Grid tile | normal, in range of selected card, target candidate, Prime Zone, Cover (Full / Half), Overwatch Nest |
| Commit | idle, waiting for enemy Squad, timer expired |

## Design tokens

Dark tactical HUD. Colours: graphite `#12161c` (ground), panel `#1b222b`, steel `#3d5a73`, teal `#2ec4b6` (own Squad, primary action), orange `#ff8a3d` (cost, Overdrive, warnings), red `#e5484d` (enemy, danger), text `#dbe4ec`. Fonts: Rajdhani for HUD labels and numbers, Barlow for body text, IBM Plex Mono for counts. Touch targets at least 44 px. Card text at least 12 px on a 844 x 390 screen.

## Open points

- UI language (English or German).
- Distance metric for Range and sight range (Chebyshev, Manhattan or Euclidean) is not defined in the ADRs. The mockup draws Range 3 as a square (Chebyshev) for layout only.
- Whether Pitch is a queue action or a planning-time funding step. The mockup treats it as funding (a marker on the card, not a queue slot).
- Maximum number of actions per Hero queue (the mockup shows 4 slots).
- Camera: the full 21 x 11 Grid is about 2048 px wide at 128 px tiles, so the phone view scales it to roughly 0.65; check tile and sprite readability once real assets exist.
- Final card artwork and iconography (placeholders use text only).
- Sound and haptics are out of scope for the MVP.
