# Declared Target and Miss

An Attack that hits one enemy Hero names that Hero in planning and is checked only in the Tick it fires. A failed check is a Miss with one reason, and it never reveals more than the attacker's Squad already knew.

## Context

Both Squads plan at the same time, before anything moves (ADR 0006), and a Hero's Queue holds up to four actions, so a Hero often plans a shot after its own Moves, or at a target that will have moved by then (ADR 0013). Checking Range and Line of Sight while planning would forbid those plans, and it would make the planner tell the player where enemy Heroes stand. At the same time the Fog of War must hold (ADR 0005): a shot at a Hero the Squad no longer sees must not tell it where that Hero is.

The product spec that used to carry these rules (`docs/specs/offline-mvp-prototype.md`) was retired. The rules now live in `packages/game-core` and its tests; this record keeps the decision that ADR 0013 only states in one paragraph.

## Decision

- **Naming a target.** An Attack that hits a single enemy Hero names it in planning. Only an enemy that is Visible to the Squad at that moment and not Exhausted can be named, whatever its Range and Line of Sight from the planned position. A Ghost or an Unknown enemy cannot be named by a normal Attack. Ghost Shot is the exception: it names a Ghost's last known tile and hits only if an enemy stands on that tile when it fires.
- **Plan-time checks never block Commit** for Range, Minimum Range or Line of Sight. The planner only shows a hint that the shot may miss.
- **Checking a shot.** In the Tick the Attack fires, against the positions at the end of that Tick's movement, the checks run in this order and the first one that fails makes the Attack a Miss with that reason:
  1. the target is Visible to the attacker's Squad (`NotVisible`),
  2. the target is not Exhausted (`TargetExhausted`),
  3. the target is within the card's Range (`OutOfRange`),
  4. the target is not closer than the card's Minimum Range (`TooClose`),
  5. the target is in Line of Sight (`NoLineOfSight`),
  6. the target is not behind Full Cover (`FullCover`).
- **A Miss does nothing.** No damage, no Deck Damage, and the later actions of the Queue still run. Simultaneous Attacks are all checked before any damage is applied, so they all resolve.
- **A Miss reveals nothing the Squad did not know.** A `NotVisible` Miss carries no distance, no position and creates no Ghost, and only the attacker's Squad is told about it. The other Squad learns nothing.
- **Cards that ignore Cover** (the `IgnoreCover` effect) are not stopped by Cover in the last two checks; the order of the checks is unchanged.

### Two small rules that go with it

- **Wait** is a Queue action that does nothing for one Tick. It needs no card and no Energy and takes one slot of the Queue.
- **An Exhausted Hero leaves Half Cover on its tile**; Cover that is better than Half Cover stays as it is.
- **An Exhausted Hero is no obstacle to Moves.** A walk does not stop in front of it and its tile does not block the end of a Move (this corrects the list of obstacles in ADR 0013).
- **A wreck (the Half Cover an Exhausted Hero leaves) is ordinary Half Cover.** Any effect that destroys Cover (today the area attacks) destroys a wreck too; wrecks get no special protection. A Squad that has seen a wreck destroyed forgets it; one that has not keeps it in its view.

## Consequences

- A shot can be planned after a Move and still miss for a reason the player can read in the Resolution log, one reason per Miss.
- The test seam is the Match Simulation: a test gives a Match State and two Squad Plans and expects a hit, or a Miss with exactly one reason, and that the Queue goes on.
- Adding a check means choosing its place in the order; the first failing check names the reason, so a new check can change what the log says for an existing Miss.
- Supplements ADR 0013 (which names the first five checks without Minimum Range) and ADR 0005; it does not change them.

## Status

Accepted.
