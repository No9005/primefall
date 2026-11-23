# Design principles

The few ideas every rule, card, screen and picture of Primefall is measured against. They are short on purpose: the detail lives in the ADRs, `GLOSSARY.md`, `docs/design/game-goals.md` (goals and gauges), `docs/design/decisions.md` (the owner's decisions) and `docs/design/world-and-style.md` (world, look, sound). If a change contradicts a principle, say so and ask the owner; do not decide it silently. Vocabulary follows `GLOSSARY.md`.

Core fantasy: *I out-planned you, out-read your Hand, and took the zone.*

## 1. Plan together, resolve deterministically

Both Squads plan at the same time and commit; neither can react to the other's final plan. The Resolution then plays out the same way every time: same Match State plus same Squad Plans gives the same result, with seeded randomness at most. No twitch skill, no waiting for the other player. The simulation is the only place the rules live; rendering and AI consume it. (ADR 0006, 0013, 0017.)

## 2. Cards are the only resource

A card is life, Energy, Shield and action at once, so every use has a price and nothing may take the price away. Damage removes cards from the Deck (Deck-as-Life), Pitch turns a card into Energy, and a Hero whose cards are gone is Exhausted. There is no second pool of health. (ADR 0001, 0002, 0007, 0011.)

## 3. Information is a game

Fog of War, Ghosts and hidden plans stay central: a Squad sees what its Heroes see, a Hero that leaves sight leaves a Ghost, and a miss on something no longer seen reveals nothing. Ownership and score are public; Hero positions, Hands, Energy and Queues are not. Scouting must always be worth a decision. (ADR 0004, 0005; `docs/design/decisions.md`, "Information shown".)

## 4. Strategies, not one strategy

Several plans are viable (rush, split, hold vision, flank), none dominates, each has a counter. A match is a tug of war that is decided late, and mistakes cost cards while good play saves them. Zones that cannot all be held at once force the Squad to split. We do not argue about balance, we measure it against the gauges of `game-goals.md`. (ADR 0010, 0024.)

## 5. Every Hero has one role, and its Deck is built around it

Three Heroes, three jobs: the Bruiser closes in and wins up close, the Assassin deals damage at range, the Controller shapes the ground (Cover, vision) and is strongest with an ally. Each Hero has one main function and a weakness that another Hero covers, so a mixed Squad beats a Squad of one class. The Deck is the Hero's role made concrete: its size is its toughness (Bruiser 12, Controller 10, Assassin 9), and every card has to pass three tests:

- **Role:** does it serve the Hero's one main function? Cards that make the Hero do a little of everything are cut.
- **Story:** does it fit who the Hero is (`docs/design/world/README.md`)? The Controller's Cover cards are scrap-built gear because Tilly is a tinkerer.
- **Missions:** do the three Decks together serve the goals of the match (hold zones now, later carry and extract, sabotage; `docs/design/world/missions.md`)?

When a class does not play to its strengths (the Bruiser has no way to stick to an enemy, the Assassin cannot keep distance, a Controller Deck is monotone), the fix is a new Deck, not a rule exception. Positioning, Cover and Line of Sight still matter more than the choice of the strongest card. (ADR 0014, 0020, 0023, 0025.)

## 6. Readable at a glance, on a phone

Landscape, one primary decision per Round, cards readable on a small screen, Commit that feels consequential, and a Resolution that explains cause and effect so a player never loses without understanding why. About 15 Rounds and 15 minutes at most. Text at least 12 px with contrast 4.5:1, touch targets 40 x 40 px (enforced by tests). Clarity beats visual noise; a UI change is checked against the agreed design element by element. (ADR 0021, 0026; `docs/design/decisions.md`.)

## 7. Two layers: grim picture, satirical voice

The world is a science-fiction universe of the 1980s and 1990s that does not take itself fully seriously. The pictures and sound are grim, mysterious and quiet; the voice (names, clients, advertising, contract texts) is satirical. If the pictures turn funny too, the mystery is lost. Both Squads do the same job for different clients, so there are no good and bad sides and the rules are symmetric. Little text is read on a phone: the world lives in names, map names and pictures. (`docs/design/world-and-style.md`, `docs/design/world/README.md`.)

## 8. Pixel art with weight

Stylized 2.5D pixel art from one fixed view, scaled by whole numbers. Animation is deliberately exaggerated, with the hand-drawn pixel animation of *Metal Slug* as the bar: dense frames, anticipation, squash and stretch, follow-through, a split body, details that move out of step, and an impact with layers (flash, debris, smoke, a short hit stop). Heroes never overlap each other. (`docs/design/animation-criteria.md`, `docs/design/animation/README.md`, `docs/design/heroes/README.md`.)
