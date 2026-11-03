import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type SquadPlan } from "./plan";
import type { GridPosition } from "./reactor-deck";
import { resolveRound } from "./resolution";

const LEFT_BRUISER = "left-bruiser";
const LEFT_CONTROLLER = "left-controller";
const LEFT_ASSASSIN = "left-assassin";
const RIGHT_BRUISER = "right-bruiser";
const RIGHT_CONTROLLER = "right-controller";

/** A Round-1 match with the given Heroes moved to the given tiles. */
function matchWith(positions: Record<string, GridPosition>): MatchState {
  const match = startRound(createMatch(5));
  for (const hero of match.heroes) hero.position = positions[hero.id] ?? hero.position;
  return match;
}

function movePlan(match: MatchState, squad: SquadId, moves: Record<string, GridPosition>): SquadPlan {
  return {
    squad,
    heroes: Object.entries(moves).map(([heroId, destination]) => {
      const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
      return { heroId, queue: [{ kind: ActionKind.Move as const, card: hero.hand[0]!, destination }] };
    }),
  };
}

const at = (col: number, row = 3): GridPosition => ({ col, row });
const positionOf = (match: MatchState, heroId: string) => match.heroes.find((hero) => hero.id === heroId)!.position;
const mirror = ({ col, row }: GridPosition): GridPosition => ({ col: 30 - col, row });

function moveBruiser(positions: Record<string, GridPosition>, others: Record<string, GridPosition> = {}) {
  const match = matchWith(positions);
  const plans = [movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(10), ...others })];
  return resolveRound(match, plans);
}

describe("Heroes walking through each other (ADR 0013)", () => {
  it("walks through an ally and ends behind it", () => {
    const { match } = moveBruiser({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9) });
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(10));
  });

  it("walks through an enemy and ends behind it", () => {
    const { match, events } = moveBruiser({ [LEFT_BRUISER]: at(8), [RIGHT_BRUISER]: at(9) });
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(10));
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.Step, EventKind.Step]);
  });

  it("walks through an Exhausted Hero", () => {
    const match = matchWith({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9) });
    match.heroes.find((hero) => hero.id === LEFT_CONTROLLER)!.exhausted = true;
    const { match: after } = resolveRound(match, [movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(10) })]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual(at(10));
  });

  it("stops on the last free tile when the destination is occupied", () => {
    const { match, events } = moveBruiser({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(10) });
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9));
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(10));
    expect(events).toMatchObject([
      { kind: EventKind.Step, to: at(9) },
      { kind: EventKind.MoveBlocked, from: at(9) },
    ]);
  });

  it("stops on the last free tile when an enemy stands on the destination", () => {
    const { match } = moveBruiser({ [LEFT_BRUISER]: at(8), [RIGHT_BRUISER]: at(10) });
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9));
  });

  it("stays when every tile of the walk is occupied", () => {
    const { match, events } = moveBruiser({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9), [LEFT_ASSASSIN]: at(10) });
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(8));
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.MoveBlocked]);
  });

  it("lets two Heroes with the same destination both stop short", () => {
    const match = matchWith({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(12) });
    const plan = movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(10), [LEFT_CONTROLLER]: at(10) });
    const { match: after } = resolveRound(match, [plan]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual(at(9));
    expect(positionOf(after, LEFT_CONTROLLER)).toEqual(at(11));
  });

  it("lets a Hero and an enemy with the same destination both stop short", () => {
    const match = matchWith({ [LEFT_BRUISER]: at(8), [RIGHT_BRUISER]: at(12) });
    const plans = [
      movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(10) }),
      movePlan(match, SquadId.Right, { [RIGHT_BRUISER]: at(10) }),
    ];
    const { match: after } = resolveRound(match, plans);
    expect(positionOf(after, LEFT_BRUISER)).toEqual(at(9));
    expect(positionOf(after, RIGHT_BRUISER)).toEqual(at(11));
  });

  it("never ends two Heroes on one tile when a Hero swaps places with another", () => {
    const match = matchWith({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(10) });
    const plan = movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(10), [LEFT_CONTROLLER]: at(8) });
    const { match: after } = resolveRound(match, [plan]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual(at(10));
    expect(positionOf(after, LEFT_CONTROLLER)).toEqual(at(8));
  });

  it("still stops at a Wall", () => {
    // (5,6) is the first Wall of the upper channel Wall.
    const match = matchWith({ [LEFT_BRUISER]: at(3, 6), [LEFT_CONTROLLER]: at(4, 6) });
    const { match: after } = resolveRound(match, [movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(5, 6) })]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual(at(3, 6));
  });

  it("still does not cut a Wall corner while walking through a Hero", () => {
    const match = matchWith({ [LEFT_BRUISER]: at(5, 5), [LEFT_CONTROLLER]: at(4, 6) });
    const { match: after } = resolveRound(match, [movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(4, 6) })]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual(at(5, 5));
  });

  it("is symmetric: a Left Squad and its mirror image end on mirrored tiles", () => {
    const match = matchWith({
      [LEFT_BRUISER]: at(8),
      [LEFT_CONTROLLER]: at(10),
      [RIGHT_BRUISER]: mirror(at(8)),
      [RIGHT_CONTROLLER]: mirror(at(10)),
      [LEFT_ASSASSIN]: at(8, 8),
    });
    const plans = [
      movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(10) }),
      movePlan(match, SquadId.Right, { [RIGHT_BRUISER]: mirror(at(10)) }),
    ];
    const { match: after } = resolveRound(match, plans);
    expect(positionOf(after, RIGHT_BRUISER)).toEqual(mirror(positionOf(after, LEFT_BRUISER)));
    expect(positionOf(after, LEFT_BRUISER)).toEqual(at(9));
  });
});
