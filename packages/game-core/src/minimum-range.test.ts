import { describe, expect, it } from "vitest";
import { withFullCover } from "./full-cover-fixture";
import { AttackFailReason, EventKind, SquadId } from "./host";
import { createMatch, type MatchState, recordSightings, startRound } from "./match";
import { ActionKind, type SquadPlan } from "./plan";
import { resolveRound } from "./resolution";

const ASSASSIN = "left-assassin";
const ENEMY = "right-bruiser";
// Assassin cards: 0 Precision Shot (Minimum Range 2), 4 Long Shot (Minimum Range 3); card 1 serves as Pitch.
const PRECISION_SHOT = 0;
const LONG_SHOT = 4;
const PITCH = 1;

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;

/** The Assassin on (2,1) and the enemy Bruiser `distance` tiles to the right, in the open. */
function sceneAt(distance: number): MatchState {
  const match = startRound(createMatch(5));
  hero(match, ASSASSIN).position = { col: 2, row: 1 };
  hero(match, ASSASSIN).hand = [PITCH, PRECISION_SHOT, LONG_SHOT, 2];
  hero(match, ENEMY).position = { col: 2 + distance, row: 1 };
  recordSightings(match);
  return match;
}

function fire(match: MatchState, card: number) {
  const plan: SquadPlan = {
    squad: SquadId.Left,
    heroes: [{ heroId: ASSASSIN, queue: [{ kind: ActionKind.Primary, card, target: ENEMY }], pitched: [PITCH] }],
  };
  return resolveRound(match, [plan]).events.find(
    ({ kind }) => kind === EventKind.AttackHit || kind === EventKind.AttackFailed,
  );
}

describe("Minimum Range", () => {
  it("makes a Precision Shot at Range 1 miss with TooClose and at Range 2 hit", () => {
    expect(fire(sceneAt(1), PRECISION_SHOT)).toMatchObject({ kind: EventKind.AttackFailed, reason: AttackFailReason.TooClose });
    expect(fire(sceneAt(2), PRECISION_SHOT)).toMatchObject({ kind: EventKind.AttackHit });
  });

  it("makes a Long Shot at Range 2 miss with TooClose and at Range 3 hit", () => {
    expect(fire(sceneAt(2), LONG_SHOT)).toMatchObject({ kind: EventKind.AttackFailed, reason: AttackFailReason.TooClose });
    expect(fire(sceneAt(3), LONG_SHOT)).toMatchObject({ kind: EventKind.AttackHit });
  });

  it("checks Range before TooClose: beyond the Range is OutOfRange", () => {
    expect(fire(sceneAt(6), PRECISION_SHOT)).toMatchObject({ reason: AttackFailReason.OutOfRange });
  });

  it("checks TooClose before Line of Sight", () => {
    // Full Cover between the two, so the shot would also have no Line of Sight.
    const match = withFullCover(sceneAt(2), { col: 3, row: 1 });
    expect(fire(match, LONG_SHOT)).toMatchObject({ reason: AttackFailReason.TooClose });
  });

  it("leaves a card without a Minimum Range alone", () => {
    const match = startRound(createMatch(5));
    hero(match, "left-bruiser").position = { col: 2, row: 1 };
    hero(match, "left-bruiser").hand = [0, 1, 2, 3];
    hero(match, ENEMY).position = { col: 3, row: 1 };
    recordSightings(match);
    const plan: SquadPlan = {
      squad: SquadId.Left,
      heroes: [{ heroId: "left-bruiser", queue: [{ kind: ActionKind.Primary, card: 0, target: ENEMY }], pitched: [1] }],
    };
    const events = resolveRound(match, [plan]).events;
    expect(events).toContainEqual(expect.objectContaining({ kind: EventKind.AttackHit }));
  });
});
