import { describe, expect, it } from "vitest";
import { planSquad } from "./ai";
import { EventKind, SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type SquadPlan } from "./plan";
import type { GridPosition } from "./reactor-deck";
import { REACTOR_DECK } from "./reactor-deck";
import { resolveRound } from "./resolution";

const mirror = ({ col, row }: GridPosition): GridPosition => ({ col: REACTOR_DECK.width - 1 - col, row });
const positionOf = (match: MatchState, heroId: string) => match.heroes.find((hero) => hero.id === heroId)!.position;

/** A Round-1 match with the given Heroes moved to the given tiles. */
function matchWith(positions: Record<string, GridPosition>): MatchState {
  const match = startRound(createMatch(5));
  for (const hero of match.heroes) hero.position = positions[hero.id] ?? hero.position;
  return match;
}

function movePlan(match: MatchState, squad: SquadId, moves: Record<string, GridPosition[]>): SquadPlan {
  return {
    squad,
    heroes: Object.entries(moves).map(([heroId, destinations]) => {
      const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
      return {
        heroId,
        queue: destinations.map((destination, i) => ({ kind: ActionKind.Move as const, card: hero.hand[i]!, destination })),
      };
    }),
  };
}

describe("a Hero whose Move step is blocked by an ally", () => {
  it.each(["left-bruiser", "left-controller", "left-assassin"])(
    "a player's %s planning Moves to the lower flank keeps moving next to AI allies (issue 159)",
    (playerHero) => {
      for (let seed = 1; seed <= 20; seed++) {
        const match = startRound(createMatch(seed));
        const allies = planSquad(buildSquadView(match, SquadId.Left)).heroes.filter(({ heroId }) => heroId !== playerHero);
        const start = positionOf(match, playerHero);
        const hero = match.heroes.find((candidate) => candidate.id === playerHero)!;
        // Straight down the start column: the allies' tiles are in the way.
        const destinations = [2, 4, 6].map((down) => ({ col: start.col, row: start.row + down }));
        const plan = {
          heroId: playerHero,
          queue: destinations.map((destination, i) => ({ kind: ActionKind.Move as const, card: hero.hand[i]!, destination })),
        };
        const { events } = resolveRound(match, [{ squad: SquadId.Left, heroes: [plan, ...allies] }]);
        const blocked = events.filter((event) => event.kind === EventKind.MoveBlocked && event.heroId === playerHero);
        // One failed step can be two Heroes entering the same free tile (ADR 0013); standing still is not.
        expect(blocked.length, `seed ${seed}`).toBeLessThanOrEqual(1);
      }
    },
  );

  it("walks round an ally that stands on the straight line and arrives", () => {
    const match = matchWith({ "left-bruiser": { col: 2, row: 11 }, "left-controller": { col: 3, row: 11 } });
    const { match: after, events } = resolveRound(match, [
      movePlan(match, SquadId.Left, { "left-bruiser": [{ col: 4, row: 11 }] }),
    ]);
    expect(positionOf(after, "left-bruiser")).toEqual({ col: 4, row: 11 });
    expect(events.filter((event) => event.kind === EventKind.Step).map((event) => event.kind === EventKind.Step && event.to)).toEqual([
      { col: 3, row: 10 },
      { col: 4, row: 11 },
    ]);
    expect(events.some((event) => event.kind === EventKind.MoveBlocked)).toBe(false);
  });

  it("emits MoveBlocked when no step gets closer", () => {
    const match = matchWith({
      "left-bruiser": { col: 2, row: 11 },
      "left-controller": { col: 3, row: 11 },
      "left-assassin": { col: 3, row: 10 },
      "right-bruiser": { col: 3, row: 12 },
    });
    const { match: after, events } = resolveRound(match, [
      movePlan(match, SquadId.Left, { "left-bruiser": [{ col: 4, row: 11 }] }),
    ]);
    expect(positionOf(after, "left-bruiser")).toEqual({ col: 2, row: 11 });
    expect(events.some((event) => event.kind === EventKind.MoveBlocked && event.heroId === "left-bruiser")).toBe(true);
  });

  it("still keeps two Heroes in place when they step on the same free tile", () => {
    const match = matchWith({ "left-bruiser": { col: 2, row: 11 }, "left-controller": { col: 4, row: 11 } });
    const { match: after } = resolveRound(match, [
      movePlan(match, SquadId.Left, { "left-bruiser": [{ col: 3, row: 11 }], "left-controller": [{ col: 3, row: 11 }] }),
    ]);
    expect(positionOf(after, "left-bruiser")).toEqual({ col: 2, row: 11 });
    expect(positionOf(after, "left-controller")).toEqual({ col: 4, row: 11 });
  });

  it.each([
    [{ col: 2, row: 11 }, { col: 3, row: 11 }, { col: 4, row: 11 }],
    [{ col: 2, row: 11 }, { col: 3, row: 12 }, { col: 4, row: 13 }],
    [{ col: 5, row: 6 }, { col: 5, row: 7 }, { col: 5, row: 9 }],
  ])("mirrors for the Right Squad (%j blocked by %j towards %j)", (start, blocker, destination) => {
    const left = matchWith({ "left-bruiser": start, "left-controller": blocker });
    const right = matchWith({ "right-bruiser": mirror(start), "right-controller": mirror(blocker) });
    const leftEnd = positionOf(
      resolveRound(left, [movePlan(left, SquadId.Left, { "left-bruiser": [destination] })]).match,
      "left-bruiser",
    );
    const rightEnd = positionOf(
      resolveRound(right, [movePlan(right, SquadId.Right, { "right-bruiser": [mirror(destination)] })]).match,
      "right-bruiser",
    );
    expect(rightEnd).toEqual(mirror(leftEnd));
    expect(leftEnd).not.toEqual(start);
  });
});
