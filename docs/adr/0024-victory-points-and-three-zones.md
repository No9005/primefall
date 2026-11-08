# Victory Points and Three Zones

The classic mode is won by Victory Points from three zones, not by holding one Prime Zone for three Resolutions.

## Context

The classic mode is one-sided (`docs/design/game-goals.md`). The first Squad in the Zone wins; the Squads run there, play Shield plus Attack, and no plan, position or vision matters. The rule "control the Zone for three Resolutions" (ADR 0010) is shorter than the opponent's way to the Zone, and a tie keeps the previous controller. Cards are life, energy and Shield at once, but Block (any card is Shield 2) takes the price away: a Hero that Blocks every Round is never Exhausted (#355).

The owner wants a game of resources and strategies where a mistake costs cards, several plans are viable and nothing dominates.

## Decision

For the **classic mode** only:

- **Three zones:** the Prime Zone in the middle (2 Victory Points per Resolution) and two Outposts at the sides (1 each).
- **Activation:** the Outposts are active from Round 1, the Prime Zone from Round 4, visible from the start.
- **Control:** the Squad with more non-exhausted Heroes in a zone controls it. Equal and at least one each is Contested and scores for nobody. An empty zone scores for nobody.
- **Victory Points:** at the end of each Resolution a Squad earns the value of each zone it controls. The first Squad to reach 30 wins at once. After Round 15 the higher score wins; a tie goes to the larger number of cards not in the Exile.
- **Exhaustion** of a whole Squad still ends the match at once.
- **Block** is no longer an action of every card. Shield comes from Shield cards. The refill rule is decided after the Exposed Hero measurement is repeated.
- **Information:** control of each zone and both scores are public; enemy Heroes stay in the Fog.
- The Overwatch Nest is removed for now.
- Attack and Defend (ADR 0022) keeps its own win rules, Round limit and Block. The cards and combat rules of ADR 0023 to 0025 (decks, Crossfire, Minimum Range, Placed Cover) apply to both modes, so its balance (#302) is measured again after the new decks.

Considered and not chosen now: three mission types per game (hidden objectives, a later layer if the zones are not enough), a rotating zone (the way across the map takes two to three Rounds, so it would be out of reach), a progress track with Abbau and decay for a tie in one zone (#341, replaced by the points).

## Open: a takeover bonus

Taking a zone from the enemy (it controlled the zone at the end of the previous Resolution, you control it now) may give a one-time bonus. It is built as two tunable constants, **off by default** (bonus 0): the bonus equals the value of the zone (2 for the Prime Zone, 1 for an Outpost) and a cooldown per zone (3 Resolutions) against passing a zone back and forth. It is switched on only if the tug-of-war gauge (`docs/design/game-goals.md`) misses its target: the lead changes at least twice in at least half of the matches.

## Consequences

- ADR 0010 and ADR 0019 stop applying to the classic mode; they still describe the history and Attack and Defend keeps its own rules.
- The map needs two Outposts and a larger Prime Zone (#349), and the AI needs plans for splitting between zones.
- The HUD shows Victory Points and the control of each zone instead of the progress dots; the Round counter shows the limit 15.
- The balance harness gets new gauges (`docs/design/game-goals.md`); the numbers of #302 for Attack and Defend are unaffected.
- The length of a match is bounded by the Round Limit: about 15 minutes at the planning timer and the Resolution in the worst case.

## Status

Proposed. The owner accepts it by merging.
