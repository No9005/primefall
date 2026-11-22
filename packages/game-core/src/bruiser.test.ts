import { describe, expect, it } from "vitest";
import { cardIndex, HeroClass } from "./cards";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type PrimaryAction, type SquadPlan } from "./plan";
import { type GridPosition } from "./notstrom-map";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";
const CONTROLLER = "left-controller";
const ENEMY = "right-bruiser";
const ENEMY_CONTROLLER = "right-controller";
const ENEMY_ASSASSIN = "right-assassin";
const idx = (name: string, copy = 0) => cardIndex(HeroClass.Bruiser, name, copy);
// Pitch fodder: the second Handle With Care, both Hard Hats and the first Express Delivery.
const SLAM_SHOT = idx("Handle With Care");
const CONCUSSION_ROUND = idx("Time for Coffee");
const BUY_ONE_GET_TWO = idx("Buy One, Get Two");
const PITCH = [idx("Handle With Care", 1), idx("Hard Hat"), idx("Hard Hat", 1), idx("Express Delivery")];

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const deckSize = (match: MatchState, id: string) => hero(match, id).deck.length;

/** A fight in the Prime Zone: this Bruiser at (21,12), the enemy Bruiser at (22,12). */
function fight(positions: Record<string, GridPosition> = {}): MatchState {
  const match = startRound(createMatch(5));
  const placed: Record<string, GridPosition> = {
    [BRUISER]: { col: 21, row: 12 },
    [ENEMY]: { col: 22, row: 12 },
    [CONTROLLER]: { col: 21, row: 10 },
    [ENEMY_CONTROLLER]: { col: 25, row: 15 },
    [ENEMY_ASSASSIN]: { col: 25, row: 16 },
    ...positions,
  };
  for (const [id, position] of Object.entries(placed)) hero(match, id).position = position;
  return match;
}

/** The Bruiser plays `card` with enough Pitch for its Energy cost. */
function play(match: MatchState, card: number, action: Partial<PrimaryAction> = {}, energy = 2): SquadPlan {
  hero(match, BRUISER).hand = [card, ...PITCH.slice(0, 3)];
  return {
    squad: SquadId.Left,
    heroes: [
      {
        heroId: BRUISER,
        queue: [{ kind: ActionKind.Primary, card, target: ENEMY, ...action }],
        pitched: PITCH.slice(0, energy),
      },
    ],
  };
}

describe("Handle With Care and Time for Coffee", () => {
  it("Handle With Care deals 2 damage at Range 2 and 3 damage at Range 1 (ADR 0025)", () => {
    const far = fight({ [ENEMY]: { col: 23, row: 12 } });
    const afterFar = resolveRound(far, [play(far, SLAM_SHOT, {}, 1)]).match;
    expect(deckSize(far, ENEMY) - deckSize(afterFar, ENEMY)).toBe(2);
    const close = fight();
    const afterClose = resolveRound(close, [play(close, SLAM_SHOT, {}, 1)]).match;
    expect(deckSize(close, ENEMY) - deckSize(afterClose, ENEMY)).toBe(3);
  });

  it("Time for Coffee deals 1 damage and Slows the target until the end of the next Resolution", () => {
    const match = fight();
    const after = resolveRound(match, [play(match, CONCUSSION_ROUND, {}, 1)]).match;
    expect(deckSize(match, ENEMY) - deckSize(after, ENEMY)).toBe(1);
    expect(hero(after, ENEMY).slow).toBe(1);
  });
});

describe("Buy One, Get Two", () => {
  it("makes two Attacks on the same target: 2 damage each, 3 each at Range 1", () => {
    const far = fight({ [ENEMY]: { col: 23, row: 12 } });
    const { match: afterFar, events } = resolveRound(far, [play(far, BUY_ONE_GET_TWO, {}, 1)]);
    expect(deckSize(far, ENEMY) - deckSize(afterFar, ENEMY)).toBe(4);
    expect(events.filter(({ kind }) => kind === EventKind.AttackHit)).toHaveLength(2);
    const close = fight();
    const afterClose = resolveRound(close, [play(close, BUY_ONE_GET_TWO, {}, 1)]).match;
    expect(deckSize(close, ENEMY) - deckSize(afterClose, ENEMY)).toBe(6);
  });
});
