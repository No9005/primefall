import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, matchFromSquadView, buildSquadView, startRound, type MatchState } from "./match";
import { ActionKind, moveDestinations, moveEnd, reachableMoveDestinations } from "./plan";
import { hasLineOfSight, isStepAllowed } from "./notstrom-map";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";

function atRound(round: number): MatchState {
  let match = createMatch(5);
  for (let i = 0; i < round; i++) match = startRound(match);
  return match;
}

function walkInto(match: MatchState, destination: { col: number; row: number }) {
  const bruiser = match.heroes.find((hero) => hero.id === BRUISER)!;
  bruiser.position = { col: 18, row: 12 };
  const plan = { squad: SquadId.Left, heroes: [{ heroId: BRUISER, queue: [{ kind: ActionKind.Move as const, card: bruiser.hand[0]!, destination }] }] };
  const { match: after, events } = resolveRound(match, [plan]);
  return { position: after.heroes.find((hero) => hero.id === BRUISER)!.position, events };
}

describe("the Prime Zone behind its laser walls", () => {
  it("is closed to steps before Round 4 and open from Round 4", () => {
    expect(atRound(1).grid.zoneClosed).toBe(true);
    expect(atRound(3).grid.zoneClosed).toBe(true);
    expect(atRound(4).grid.zoneClosed).toBeFalsy();
  });

  it("stops a Move at the edge of the zone and says so", () => {
    const { position, events } = walkInto(atRound(1), { col: 21, row: 12 });
    expect(position).toEqual({ col: 19, row: 12 });
    expect(events.map(({ kind }) => kind)).toContain(EventKind.MoveBlocked);
  });

  it("lets a Move into the zone through from Round 4", () => {
    expect(walkInto(atRound(4), { col: 21, row: 12 }).position).toEqual({ col: 21, row: 12 });
  });

  it("offers no zone tile as a destination while it is closed, and every one when it is open", () => {
    const closed = atRound(1).grid;
    const open = atRound(4).grid;
    expect(moveDestinations({ col: 19, row: 12 }, closed)).not.toContainEqual({ col: 20, row: 12 });
    expect(moveDestinations({ col: 19, row: 12 }, open)).toContainEqual({ col: 20, row: 12 });
    expect(reachableMoveDestinations({ col: 19, row: 12 }, closed)).not.toContainEqual({ col: 21, row: 12 });
    expect(moveEnd({ col: 19, row: 12 }, { col: 21, row: 12 }, closed)).toEqual({ col: 19, row: 12 });
    expect(isStepAllowed({ col: 19, row: 12 }, { col: 20, row: 12 }, closed)).toBe(false);
  });

  it("does not block the Line of Sight and reaches the Squad View, so the AI and the planner see it closed", () => {
    const match = atRound(1);
    expect(hasLineOfSight(match.grid, { col: 18, row: 12 }, { col: 26, row: 12 })).toBe(true);
    const view = buildSquadView(match, SquadId.Left);
    expect(view.grid.zoneClosed).toBe(true);
    expect(matchFromSquadView(view, 1).grid.zoneClosed).toBe(true);
    expect(buildSquadView(atRound(4), SquadId.Left).grid.zoneClosed).toBeFalsy();
  });
});
