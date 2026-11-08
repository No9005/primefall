import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type SquadPlan } from "./plan";
import { CoverKind, coverAgainst, coverAt, type GridPosition, hasLineOfSight, parseGrid, REACTOR_DECK } from "./reactor-deck";
import { resolveRound } from "./resolution";
import { withFullCover } from "./full-cover-fixture";

const LEFT_BRUISER = "left-bruiser";
const RIGHT_BRUISER = "right-bruiser";
// Concussion Round (card 2) serves as the damage 2, Range 3 Attack.
const SLAM_SHOT = 2; // Concussion Round: damage 2, Range 3 (Slam Shot is Range 1 to 2 since ADR 0025)

// The Reactor Deck has no Full Cover tile; the matches here get one at (15,1).
const FULL_COVER = { col: 15, row: 1 };

const hero = (match: MatchState, heroId: string) => match.heroes.find((candidate) => candidate.id === heroId)!;

/** The left Bruiser attacks the right Bruiser; returns the single Attack event. */
function attackFrom(attacker: GridPosition, target: GridPosition) {
  const match = withFullCover(startRound(createMatch(5)), FULL_COVER);
  hero(match, LEFT_BRUISER).position = attacker;
  hero(match, RIGHT_BRUISER).position = target;
  hero(match, LEFT_BRUISER).hand = [0, 1, 2, 3];
  const plan: SquadPlan = {
    squad: SquadId.Left,
    heroes: [{ heroId: LEFT_BRUISER, queue: [{ kind: ActionKind.Primary, card: SLAM_SHOT, target: RIGHT_BRUISER }], pitched: [1] }],
  };
  return resolveRound(match, [plan]).events[0]!;
}

describe("Cover against Attacks", () => {
  // The Reactor Deck has Half Cover at (14,5).
  const halfCover = { col: 14, row: 5 };

  it("reduces damage by 1 for a target on Half Cover attacked from Range 2 or more", () => {
    expect(attackFrom({ col: 17, row: 5 }, halfCover)).toMatchObject({ kind: EventKind.AttackHit, damage: 1 });
    expect(attackFrom({ col: 16, row: 5 }, halfCover)).toMatchObject({ kind: EventKind.AttackHit, damage: 1 });
  });

  it("flags the hit that Half Cover reduced, so the playback can show the wall taking it", () => {
    expect(attackFrom({ col: 17, row: 5 }, halfCover)).toMatchObject({ halfCover: true });
    expect(attackFrom({ col: 15, row: 5 }, halfCover)).not.toHaveProperty("halfCover");
    expect(attackFrom({ col: 17, row: 5 }, { col: 8, row: 5 })).not.toHaveProperty("halfCover");
  });

  it("ignores Half Cover for an attacker at Range 1", () => {
    expect(attackFrom({ col: 15, row: 5 }, halfCover)).toMatchObject({ kind: EventKind.AttackHit, damage: 2 });
    expect(attackFrom({ col: 15, row: 4 }, halfCover)).toMatchObject({ kind: EventKind.AttackHit, damage: 2 });
  });

  it("has no facing: Half Cover protects from every side", () => {
    expect(attackFrom({ col: 14, row: 8 }, halfCover)).toMatchObject({ damage: 1 });
    expect(attackFrom({ col: 14, row: 3 }, halfCover)).toMatchObject({ damage: 1 });
  });

  it("blocks Attacks from Range 2 or more against a Hero on Full Cover", () => {
    expect(attackFrom({ col: 15, row: 3 }, FULL_COVER).kind).toBe(EventKind.AttackFailed);
    expect(attackFrom({ col: 15, row: 4 }, FULL_COVER).kind).toBe(EventKind.AttackFailed);
    expect(attackFrom({ col: 17, row: 3 }, FULL_COVER).kind).toBe(EventKind.AttackFailed);
  });

  it("lets an attacker at Range 1 hit a Hero on Full Cover", () => {
    expect(attackFrom({ col: 15, row: 2 }, FULL_COVER)).toMatchObject({ kind: EventKind.AttackHit, damage: 2 });
  });

  it("lets a Hero on Cover attack out of it", () => {
    expect(attackFrom(FULL_COVER, { col: 15, row: 4 }).kind).toBe(EventKind.AttackHit);
  });

  it("classifies tiles", () => {
    expect(coverAt(REACTOR_DECK, halfCover)).toBe(CoverKind.Half);
    expect(coverAt(withFullCover(startRound(createMatch(5)), FULL_COVER).grid, FULL_COVER)).toBe(CoverKind.Full);
    expect(coverAt(REACTOR_DECK, { col: 8, row: 5 })).toBe(CoverKind.None);
    expect(coverAgainst(REACTOR_DECK, { col: 15, row: 5 }, halfCover)).toBe(CoverKind.None);
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
