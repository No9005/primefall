import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type SquadPlan } from "./plan";
import type { GridPosition } from "./reactor-deck";
import { getSquadEvents, resolveRound } from "./resolution";

const LEFT_BRUISER = "left-bruiser";
const LEFT_CONTROLLER = "left-controller";

/** A Round-1 match with the given Heroes moved to the given tiles. */
function matchWith(positions: Record<string, GridPosition>): MatchState {
  const match = startRound(createMatch(5));
  for (const hero of match.heroes) hero.position = positions[hero.id] ?? hero.position;
  return match;
}

/** Plans Move 2 for each Hero, in order, using the first cards of its Hand. */
function movePlan(match: MatchState, moves: Record<string, GridPosition[]>): SquadPlan {
  return {
    squad: SquadId.Left,
    heroes: Object.entries(moves).map(([heroId, destinations]) => {
      const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
      return {
        heroId,
        queue: destinations.map((destination, i) => ({ kind: ActionKind.Move as const, card: hero.hand[i]!, destination })),
      };
    }),
  };
}

const positionOf = (match: MatchState, heroId: string) => match.heroes.find((hero) => hero.id === heroId)!.position;

describe("resolveRound: Move", () => {
  it("moves a Hero up to two tiles per action and diagonally", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 8, row: 5 } });
    const { match: after, events } = resolveRound(match, [movePlan(match, { [LEFT_BRUISER]: [{ col: 10, row: 7 }] })]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual({ col: 10, row: 7 });
    expect(events.map(({ kind, tick, to }) => [kind, tick, to])).toEqual([
      [EventKind.Step, 1, { col: 9, row: 6 }],
      [EventKind.Step, 1, { col: 10, row: 7 }],
    ]);
  });

  it("resolves one action per Hero per Tick", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 8, row: 5 } });
    const plan = movePlan(match, { [LEFT_BRUISER]: [{ col: 10, row: 5 }, { col: 10, row: 3 }] });
    const { events } = resolveRound(match, [plan]);
    expect(events.map(({ tick }) => tick)).toEqual([1, 1, 2, 2]);
  });

  it("stops a Hero in front of a Wall", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 3, row: 3 } });
    const { match: after, events } = resolveRound(match, [movePlan(match, { [LEFT_BRUISER]: [{ col: 5, row: 3 }] })]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual({ col: 3, row: 3 });
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.MoveBlocked]);
  });

  it("stops a Hero after the first step when the second hits a Wall", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 2, row: 3 } });
    const { match: after, events } = resolveRound(match, [movePlan(match, { [LEFT_BRUISER]: [{ col: 4, row: 3 }] })]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual({ col: 3, row: 3 });
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.Step, EventKind.MoveBlocked]);
  });

  it("does not let a diagonal step cut a Wall corner", () => {
    // (4,2) is a Wall: stepping from (3,2) to (4,1) would squeeze past its corner.
    const match = matchWith({ [LEFT_BRUISER]: { col: 3, row: 2 } });
    const { match: after } = resolveRound(match, [movePlan(match, { [LEFT_BRUISER]: [{ col: 4, row: 1 }] })]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual({ col: 3, row: 2 });
  });

  it("fails a step into another Hero", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 8, row: 5 }, [LEFT_CONTROLLER]: { col: 9, row: 5 } });
    const { match: after } = resolveRound(match, [movePlan(match, { [LEFT_BRUISER]: [{ col: 9, row: 5 }] })]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual({ col: 8, row: 5 });
  });

  it("makes two Heroes entering the same free tile in the same Tick both fail", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 8, row: 5 }, [LEFT_CONTROLLER]: { col: 10, row: 5 } });
    const plan = movePlan(match, { [LEFT_BRUISER]: [{ col: 9, row: 5 }], [LEFT_CONTROLLER]: [{ col: 9, row: 5 }] });
    const { match: after, events } = resolveRound(match, [plan]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual({ col: 8, row: 5 });
    expect(positionOf(after, LEFT_CONTROLLER)).toEqual({ col: 10, row: 5 });
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.MoveBlocked, EventKind.MoveBlocked]);
  });

  it("moves a used card leaves the Hand for the Discard", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 8, row: 5 } });
    const plan = movePlan(match, { [LEFT_BRUISER]: [{ col: 9, row: 5 }] });
    const used = plan.heroes[0]!.queue[0]!.card;
    const bruiser = resolveRound(match, [plan]).match.heroes.find((hero) => hero.id === LEFT_BRUISER)!;
    expect(bruiser.hand).not.toContain(used);
    expect(bruiser.discard).toEqual([used]);
  });

  it("discards the card of a failed move as well", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 3, row: 3 } });
    const plan = movePlan(match, { [LEFT_BRUISER]: [{ col: 5, row: 3 }] });
    const bruiser = resolveRound(match, [plan]).match.heroes.find((hero) => hero.id === LEFT_BRUISER)!;
    expect(bruiser.discard).toHaveLength(1);
  });

  it("gives identical results for identical state and plans, without touching the input", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 8, row: 5 } });
    const before = structuredClone(match);
    const plan = movePlan(match, { [LEFT_BRUISER]: [{ col: 10, row: 5 }, { col: 10, row: 3 }] });
    expect(resolveRound(match, [plan])).toEqual(resolveRound(match, [plan]));
    expect(match).toEqual(before);
  });

  it("does nothing for empty plans", () => {
    const match = matchWith({});
    const { match: after, events } = resolveRound(match, [{ squad: SquadId.Left, heroes: [] }]);
    expect(after).toEqual(match);
    expect(events).toEqual([]);
  });
});

describe("resolveRound: Pitch and Block", () => {
  const handOf = (match: MatchState) => match.heroes.find((hero) => hero.id === LEFT_BRUISER)!.hand;

  it("discards pitched cards", () => {
    const match = matchWith({});
    const hand = [...handOf(match)];
    const plan: SquadPlan = { squad: SquadId.Left, heroes: [{ heroId: LEFT_BRUISER, queue: [], pitched: [hand[0]!, hand[1]!] }] };
    const bruiser = resolveRound(match, [plan]).match.heroes.find((hero) => hero.id === LEFT_BRUISER)!;
    expect(bruiser.hand).toEqual([hand[2], hand[3]]);
    expect(bruiser.discard).toEqual([hand[0], hand[1]]);
  });

  it("creates Shield 2 in the Tick of the Block and clears it before the next Round", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 8, row: 5 } });
    const hand = [...handOf(match)];
    const queue = [
      { kind: ActionKind.Move as const, card: hand[0]!, destination: { col: 9, row: 5 } },
      { kind: ActionKind.Block as const, card: hand[1]! },
    ];
    const { match: after, events } = resolveRound(match, [{ squad: SquadId.Left, heroes: [{ heroId: LEFT_BRUISER, queue }] }]);
    const shield = events.filter(({ kind }) => kind === EventKind.ShieldGained);
    expect(shield).toEqual([{ kind: EventKind.ShieldGained, tick: 2, heroId: LEFT_BRUISER, amount: 2 }]);
    expect(after.heroes.every((hero) => hero.shield === 0)).toBe(true);
    expect(after.heroes.find((hero) => hero.id === LEFT_BRUISER)!.discard).toEqual([hand[0], hand[1]]);
  });
});

describe("getSquadEvents", () => {
  it("returns the events as copies", () => {
    const match = matchWith({ [LEFT_BRUISER]: { col: 8, row: 5 } });
    const resolution = resolveRound(match, [movePlan(match, { [LEFT_BRUISER]: [{ col: 9, row: 5 }] })]);
    const visible = getSquadEvents(SquadId.Left, resolution);
    expect(visible).toEqual(resolution.events);
    expect(visible[0]).not.toBe(resolution.events[0]);
  });
});
