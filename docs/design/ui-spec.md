# UI Spec: Offline MVP Prototype

The UI direction (orientation, layout, input, board rotation, terrain, style) is decided in ADR 0021; this page adds the screens, the information shown and the component states. Assets: `docs/design/asset-contract.md`. Vocabulary follows `GLOSSARY.md`. The UI language of the final app is not decided yet; the UI uses English terms.

## Principles

- One primary decision per Round must be obvious.
- Cards must be readable on a phone.
- Commit must feel consequential.
- The replay must explain cause and effect.
- Landscape only, whole board always visible, zoom and pan for details: see ADR 0021. Desktop scales the same layout.
- The board fills the whole screen as the bottom layer; HUD panels overlay it at the edges (layout in ADR 0021). Zoom goes from the fitted scale to about 3 times it; the Zoom/Fit button zooms on the selected Hero (about 2.5 times the fitted scale) and its label says where the next tap goes. Resizing or rotating returns to the fitted view.

## Screens

1. **Start**: product name, "Play" (Reactor Deck, 3v3 vs AI, you control the Bruiser), seed shown small for bug reports.
2. **Planning** (main screen, layout in ADR 0021): "Round X / 30", planning timer and Prime Zone control progress (0 to 3 Resolutions per Squad) in the top pill. The Squad panel shows the three Heroes (Deck / Exile counts, selected Hero highlighted; allied Heroes are AI planned and show their queue read-only) and the Queue of the selected Hero. The Hand of up to 4 cards, the Energy orb and the Commit button.
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
- Resolved by ADR 0020: Chebyshev distance (the Range overlay is a square), Pitch is a planning step marked on the card, and a queue has at most 4 actions (5 with Forward Deploy).
- Camera: the full 31 x 17 Grid is about 3072 px wide at 128 px tiles, so the phone view scales it down a lot; check tile and sprite readability once real assets exist.
- Art direction and the open question about pixel art for eight view angles: ADR 0021.
- Final card artwork and iconography (placeholders use text only).
- Sound and haptics are out of scope for the MVP.
