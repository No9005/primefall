# Game goals: resources, victory points and zones

The goals of the classic mode and how each one is measured. Map, roles and AI are designed from these; a change is judged by the gauges at the end. Decided by the owner in the goals discussion (issue #339 and its sub-issues). The rules decision itself is ADR 0024.

## The problem

Matches are one-sided. Both Squads run to the Prime Zone and play Shield plus Attack there. The first Squad in the Zone wins; nothing in the match asks for position, vision or a plan. Measured with the balance harness (AI against AI, classic mode):

- A match ends after 5 to 6 Rounds, 100 % by the Zone; the first Squad in the Zone wins in 100 % of the pairings against a waiting or holding AI, and the card advantage at the end is about 0 (nobody is hurt).
- Round 1 is the same plan in all 300 matches; the AI Styles do not differ before the first contact in Round 3.
- A Hero that Blocks every Round is never Exhausted: the card played as Block returns to the Deck at the end of the Resolution.
- With a 3 by 3 Zone and 8-direction movement every lane to the Zone is equally long, so side routes give no advantage.

## Goals

1. **Cards are the only resource.** A card is life, energy, Shield and action at once. Every use of a card has a price; nothing may take the price away (Block as a free action did).
2. **Strategies, not one strategy.** Several different plans are viable (rush one point, split, hold vision, flank). None dominates overall; each has a counter.
3. **A tug of war.** The lead changes hands; matches are decided late; position, vision and timing matter more than the choice of Shield plus Attack.
4. **Mistakes cost cards, good play saves them.** The Squad that spends its cards better ends with more of them.
5. **Information is a game.** Fog of War and hidden plans stay central. Ownership and score are public; Hero positions are not.
6. **Mobile pace.** About 15 Rounds at most, 15 minutes at most (about 60 seconds per Round at the planning timer and a Resolution), typically much shorter.
7. **Reproducible and fair.** The simulation stays deterministic; both sides of the map are equal.

## Decisions for the classic mode (ADR 0024)

| Topic | Decision |
|---|---|
| Resource | Cards stay the only resource. |
| Shield | No Block action for every card. Shield comes from Shield cards (Bulwark, Reinforce, Aegis Protocol). Afterwards the Exposed Hero measurement is repeated; the refill rule is decided only after that (#355). |
| Zones | Three: the **Prime Zone** in the middle (2 Victory Points per Resolution) and two **Outposts** at the sides (1 Victory Point each). |
| Activation | The Outposts are active from Round 1, the Prime Zone from Round 4. Visible from the start. |
| Control | The Squad with more non-exhausted Heroes in a zone controls it. Equal and more than zero on both sides: **Contested**, nobody scores. An empty zone scores for nobody. |
| Victory | First to 30 Victory Points wins at once. Otherwise after Round 15 the higher score wins; a tie goes to the larger card advantage (cards not in the Exile). Exhaustion of a whole Squad still ends the match at once. |
| Length | At most 15 Rounds. |
| Public | Control of each zone and both scores are always visible; enemy Heroes stay in the Fog. |
| Attack and Defend | Unchanged (ADR 0022, #302). |
| Overwatch Nest | Removed for now (the tile, its rules and the AI weight). The card Overwatch Uplink stays. |

At most 4 Victory Points a Resolution can be scored (2 + 1 + 1) from Round 4, 2 before; at most about 54 in a match.

## What this replaces

- ADR 0010 and the three-consecutive-Resolutions win for the classic mode; ADR 0019 (30 Rounds, Deck tiebreak) for the classic mode.
- The progress track and the "Contested pauses, Abbau, decay" proposal of #341 (the points per Resolution make it unnecessary).
- Block as the Shield-making action of every card (user story 30, glossary Block).

## Gauges (every change is measured against these in the balance harness)

| Gauge | Target |
|---|---|
| **Tug of war** | The lead changes at least twice in at least half of the matches; the final margin is at most a third of the points scored in most matches; the pattern Block plus Attack is at most half of all Hero-rounds. |
| **Strategy balance** | A round-robin of fixed strategies (Rusher, Waiter, Holder, Flanker over lanes, Focus fire): no strategy wins more than 60 % or less than 40 % on average; each has at least one opponent it beats (over 60 %) and one that beats it (over 60 %). The card advantage is reported as a quality figure, not as a target. |
| **Variety** | At least 5 different move plans in Round 1 over 300 seeds. |
| **Pace** | At most 15 Rounds; Exhaustion in at least 30 % of the matches; no stalls above 2 %. |
| **Fairness** | Left and right Squad win within 5 % of each other. |

Existing tools: `npm run balance` (the harness), the Exposed Hero measurement (#343) and the ladder of three AI play styles used for the first measurement (Rusher, Waiter, Holder; the Waiter and Holder use the Attack and Defend branches of the AI).

## How other games do it (from memory, not verified)

- League of Legends: resource lead (gold) as a warning figure for victory, but victory is the objective; catch-up rules against the snowball.
- Overwatch and Brawl Stars: the map and the mode shape the meta; short matches; walls and bushes as core design.
- Rainbow Six Siege: very lethal, but readable through information before the fight.
- Team Fortress 2: classes with clear counters, chokepoints, readable maps; a contested point pauses the capture.
- Warhammer 40K and Infinity: points every round and a fixed end make waiting costly; hidden objective cards reward flanks and scouting.

## Open: the next stages

1. **Map** (#349): where the Outposts and the Prime Zone are, sight blockers, no Overwatch Nest, equal lanes for both Squads.
2. **Roles** (#348): what the Heroes do with two Outposts (deck sizes, Charge, the Scout Drone that shows a Hidden Assassin).
3. **AI**: plans for splitting between zones and for holding vision; a Squad plan from the seed.
4. **Mission types** (three per game) as a possible later layer; not part of this decision.
5. **Wording:** "Victory Points" uses the word "Point", which `docs/design/decisions.md` keeps out of the UI as a name for the Zone; the owner confirms the UI word.
