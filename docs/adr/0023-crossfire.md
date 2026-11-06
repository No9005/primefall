# Crossfire

Hits by different attackers on the same Hero in consecutive Ticks deal extra damage.

## Context

The Prime Zone is not dangerous. Block 2 is nearly free, so a Hero that runs into the middle takes little, and nobody punishes the rush (#339). The wanted feeling is lethal and positional: the middle is dangerous and flanking beats rushing in.

## Decision

**Crossfire:** when an Attack hits a target and an Attack by a **different** Hero hit the **same** target in the same Tick or the Tick directly before, the later hit deals **+1 damage**. Every further hit by a new attacker in the chain gets +1 again.

- Any Attack that hits counts, even if Shield absorbs it completely. Misses do not count. The same attacker twice is not crossfire.
- Damage to allied Heroes (for example Breach Charge Overdrive) creates no crossfire. An area hit counts as one hit on each Hero it hits.
- Hits in the same Tick are ordered as Resolution already orders them. One empty Tick ends the chain.
- The bonus is added to the incoming damage before Shield absorbs, so Shield can absorb it.
- The window is the Ticks of one Resolution; it does not reach over Rounds, so no state is kept in the Match State.
- It applies in the classic mode and in Attack and Defend (ADR 0022).
- `AttackHit` carries `crossfire`, the bonus actually added.

Considered and not chosen now: facing and rear damage (complexity, a new display) and a flat damage increase (kills the rusher and the flanker alike).

## Consequences

- Shield stays; the Block value may be reduced in a measured variant (#339).
- The Attack and Defend numbers of ADR 0022 (#302) shift and need a new balance measurement in both modes.
- The web app can show Crossfire from the `crossfire` field (separate ticket); the AI does not use it yet (separate ticket).

## Status

Proposed. The owner accepts it by merging.
