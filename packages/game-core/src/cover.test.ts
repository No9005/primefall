import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, chebyshevDistance, type SquadPlan } from "./plan";
import { CoverKind, coverAgainst, coverAt, type GridPosition, hasLineOfSight, parseGrid, REACTOR_DECK } from "./reactor-deck";
import { resolveRound } from "./resolution";
import { withFullCover } from "./full-cover-fixture";

const LEFT_BRUISER = "left-bruiser";
const RIGHT_BRUISER = "right-bruiser";
// Cards: the Assassin's Long Shot (card 0, damage 3, Range 3 to 7) shoots from Range 3 or more; the Bruiser's
// Handle With Care (card 0, damage 2, 3 at Range 1) from Range 1.
const LEFT_ASSASSIN = "left-assassin";

// The Reactor Deck has no Full Cover tile; the matches here get one at (15,1).
const FULL_COVER = { col: 15, row: 1 };

const hero = (match: MatchState, heroId: string) => match.heroes.find((candidate) => candidate.id === heroId)!;

/** The left Assassin (the left Bruiser at Range 1) attacks the right Bruiser; returns the single Attack event. */
function attackFrom(attacker: GridPosition, target: GridPosition) {
  const match = withFullCover(startRound(createMatch(5)), FULL_COVER);
  const shooter = chebyshevDistance(attacker, target) === 1 ? LEFT_BRUISER : LEFT_ASSASSIN;
  hero(match, shooter).position = attacker;
  hero(match, RIGHT_BRUISER).position = target;
  hero(match, shooter).hand = [0, 1, 2, 3];
  const plan: SquadPlan = {
    squad: SquadId.Left,
    heroes: [{ heroId: shooter, queue: [{ kind: ActionKind.Primary, card: 0, target: RIGHT_BRUISER }], pitched: [1] }],
  };
  return resolveRound(match, [plan]).events[0]!;
}

describe("Cover against Attacks", () => {
  // The Reactor Deck has Half Cover at (18,8).
  const halfCover = { col: 18, row: 8 };

  it("reduces damage by 1 for a target on Half Cover attacked from Range 3 or more", () => {
    expect(attackFrom({ col: 21, row: 8 }, halfCover)).toMatchObject({ kind: EventKind.AttackHit, damage: 2 });
    expect(attackFrom({ col: 22, row: 8 }, halfCover)).toMatchObject({ kind: EventKind.AttackHit, damage: 2 });
  });

  it("flags the hit that Half Cover reduced, so the playback can show the wall taking it", () => {
    expect(attackFrom({ col: 21, row: 8 }, halfCover)).toMatchObject({ halfCover: true });
    expect(attackFrom({ col: 19, row: 8 }, halfCover)).not.toHaveProperty("halfCover");
    expect(attackFrom({ col: 21, row: 8 }, { col: 25, row: 8 })).not.toHaveProperty("halfCover");
  });

  it("ignores Half Cover for an attacker at Range 1", () => {
    expect(attackFrom({ col: 19, row: 8 }, halfCover)).toMatchObject({ kind: EventKind.AttackHit, damage: 3 });
    expect(attackFrom({ col: 19, row: 7 }, halfCover)).toMatchObject({ kind: EventKind.AttackHit, damage: 3 });
  });

  it("has no facing: Half Cover protects from every side", () => {
    expect(attackFrom({ col: 18, row: 11 }, halfCover)).toMatchObject({ damage: 2 });
    expect(attackFrom({ col: 18, row: 5 }, halfCover)).toMatchObject({ damage: 2 });
  });

  it("blocks Attacks from Range 2 or more against a Hero on Full Cover", () => {
    expect(attackFrom({ col: 15, row: 4 }, FULL_COVER).kind).toBe(EventKind.AttackFailed);
    expect(attackFrom({ col: 15, row: 5 }, FULL_COVER).kind).toBe(EventKind.AttackFailed);
    expect(attackFrom({ col: 18, row: 4 }, FULL_COVER).kind).toBe(EventKind.AttackFailed);
  });

  it("lets an attacker at Range 1 hit a Hero on Full Cover", () => {
    expect(attackFrom({ col: 15, row: 2 }, FULL_COVER)).toMatchObject({ kind: EventKind.AttackHit, damage: 3 });
  });

  it("lets a Hero on Cover attack out of it", () => {
    expect(attackFrom(FULL_COVER, { col: 15, row: 4 }).kind).toBe(EventKind.AttackHit);
  });

  it("classifies tiles", () => {
    expect(coverAt(REACTOR_DECK, halfCover)).toBe(CoverKind.Half);
    expect(coverAt(withFullCover(startRound(createMatch(5)), FULL_COVER).grid, FULL_COVER)).toBe(CoverKind.Full);
    expect(coverAt(REACTOR_DECK, { col: 23, row: 8 })).toBe(CoverKind.None);
    expect(coverAgainst(REACTOR_DECK, { col: 19, row: 8 }, halfCover)).toBe(CoverKind.None);
  });
});

describe("Line of Sight and Cover", () => {
  // Full Cover (F) and Half Cover (H) sit between the end tiles.
  const grid = parseGrid(["....F....", "....H....", "........."]);

  it("is blocked by a Full Cover tile in between", () => {
    expect(hasLineOfSight(grid, { col: 3, row: 0 }, { col: 5, row: 0 })).toBe(false);
    expect(hasLineOfSight(grid, { col: 5, row: 0 }, { col: 3, row: 0 })).toBe(false);
  });

  it("is not blocked by Half Cover in between", () => {
    expect(hasLineOfSight(grid, { col: 3, row: 1 }, { col: 5, row: 1 })).toBe(true);
  });

  it("is not blocked by the Full Cover tile of an end point", () => {
    expect(hasLineOfSight(grid, { col: 3, row: 0 }, { col: 4, row: 0 })).toBe(true);
    expect(hasLineOfSight(grid, { col: 4, row: 0 }, { col: 4, row: 2 })).toBe(true);
  });
});
