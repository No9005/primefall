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
const mirror = ({ col, row }: GridPosition): GridPosition => ({ col: 44 - col, row });

/** Plays the Left Squad's Moves and returns where the Heroes end. */
function play(positions: Record<string, GridPosition>, moves: Record<string, GridPosition>) {
  const match = matchWith(positions);
  return resolveRound(match, [movePlan(match, SquadId.Left, moves)]);
}

describe("Heroes that move do not hinder each other (ADR 0013)", () => {
  it("lets two Heroes whose paths cross both arrive", () => {
    const { match, events } = play(
      { [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9, 5) },
      { [LEFT_BRUISER]: at(10), [LEFT_CONTROLLER]: at(9) },
    );
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(10));
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(9));
    expect(events.map(({ kind }) => kind)).not.toContain(EventKind.MoveBlocked);
  });

  it("lets two Heroes swap tiles", () => {
    const { match } = play(
      { [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9) },
      { [LEFT_BRUISER]: at(9), [LEFT_CONTROLLER]: at(8) },
    );
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9));
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(8));
  });

  it("lets a Hero follow a Hero that walks away in the same corridor", () => {
    const { match, events } = play(
      { [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9) },
      { [LEFT_BRUISER]: at(10), [LEFT_CONTROLLER]: at(11) },
    );
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(10));
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(11));
    expect(events.map(({ kind }) => kind)).not.toContain(EventKind.MoveBlocked);
  });

  it("does not let a Hero walk through an ally or an enemy that stands still", () => {
    for (const standing of [LEFT_CONTROLLER, RIGHT_BRUISER]) {
      const { match, events } = play({ [LEFT_BRUISER]: at(8), [standing]: at(10) }, { [LEFT_BRUISER]: at(10) });
      expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9));
      expect(events).toMatchObject([
        { kind: EventKind.Step, to: at(9) },
        { kind: EventKind.MoveBlocked, from: at(9) },
      ]);
    }
  });

  it("stops in front of a Hero that stands next to it and does not move", () => {
    const { match, events } = play({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9) }, { [LEFT_BRUISER]: at(10) });
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(8));
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.MoveBlocked]);
  });

  it("does not let a Hero walk through a Hero on a Wait, but an Exhausted Hero is no obstacle", () => {
    const match = matchWith({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9) });
    const bruiser = movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(10) });
    const wait = { heroId: LEFT_CONTROLLER, queue: [{ kind: ActionKind.Wait as const }] };
    const { match: after } = resolveRound(match, [{ ...bruiser, heroes: [...bruiser.heroes, wait] }]);
    expect(positionOf(after, LEFT_BRUISER)).toEqual(at(8));
    expect(positionOf(after, LEFT_CONTROLLER)).toEqual(at(9));

    const exhausted = matchWith({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9) });
    exhausted.heroes.find((hero) => hero.id === LEFT_CONTROLLER)!.exhausted = true;
    const { match: afterExhausted } = resolveRound(exhausted, [movePlan(exhausted, SquadId.Left, { [LEFT_BRUISER]: at(10) })]);
    expect(positionOf(afterExhausted, LEFT_BRUISER)).toEqual(at(10));
  });

  it("makes the Hero behind a Hero whose step fails fail too", () => {
    // The Controller cannot step onto the Assassin, so the Bruiser's tile (9) stays taken.
    const { match } = play(
      { [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(9), [LEFT_ASSASSIN]: at(10) },
      { [LEFT_BRUISER]: at(10), [LEFT_CONTROLLER]: at(11) },
    );
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(8));
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(9));
  });

  it("lets two Heroes stepping onto the same free tile both stay", () => {
    const { match, events } = play(
      { [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(10) },
      { [LEFT_BRUISER]: at(9), [LEFT_CONTROLLER]: at(9) },
    );
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(8));
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(10));
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.MoveBlocked, EventKind.MoveBlocked]);
  });

  it("lets a Hero and an enemy stepping onto the same free tile both stay", () => {
    const match = matchWith({ [LEFT_BRUISER]: at(8), [RIGHT_BRUISER]: at(10) });
    const plans = [
      movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(9) }),
      movePlan(match, SquadId.Right, { [RIGHT_BRUISER]: at(9) }),
    ];
    const { match: after } = resolveRound(match, plans);
    expect(positionOf(after, LEFT_BRUISER)).toEqual(at(8));
    expect(positionOf(after, RIGHT_BRUISER)).toEqual(at(10));
  });

  it("stops a Hero that fails its second step on the tile it reached", () => {
    const { match } = play({ [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(10) }, { [LEFT_BRUISER]: at(10) });
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9));
  });

  it("still stops at a Wall", () => {
    // (10,7) is the first Wall of the ruin wall at columns 10 and 11.
    const { match } = play({ [LEFT_BRUISER]: at(8, 7) }, { [LEFT_BRUISER]: at(10, 7) });
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9, 7));
  });

  it("still does not cut a Wall corner", () => {
    const { match } = play({ [LEFT_BRUISER]: at(9, 5) }, { [LEFT_BRUISER]: at(10, 4) });
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9, 5));
  });
});

describe("Moves may cross in the middle of a walk; only the tile where a Move ends must be free (issue 184)", () => {
  it("lets two Heroes whose paths pass the same tile in the first step both arrive", () => {
    const { match, events } = play(
      { [LEFT_BRUISER]: at(8, 3), [LEFT_CONTROLLER]: at(9, 2) },
      { [LEFT_BRUISER]: at(10, 3), [LEFT_CONTROLLER]: at(9, 4) },
    );
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(10, 3));
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(9, 4));
    expect(events.map(({ kind }) => kind)).not.toContain(EventKind.MoveBlocked);
  });

  it("stops two Heroes that end on the same tile one step earlier on their own path", () => {
    const { match } = play(
      { [LEFT_BRUISER]: at(8), [LEFT_CONTROLLER]: at(12) },
      { [LEFT_BRUISER]: at(10), [LEFT_CONTROLLER]: at(10) },
    );
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9));
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(11));
  });

  it("shortens a walk again when a shortened walk makes it collide", () => {
    // Bruiser and Assassin both end on 10 and stop on 9 and 11, which is where the Controller ends, so they collide
    // again: the Assassin cannot move at all, and then the Controller cannot walk through it.
    const { match } = play(
      { [LEFT_BRUISER]: at(8), [LEFT_ASSASSIN]: at(12), [LEFT_CONTROLLER]: at(13) },
      { [LEFT_BRUISER]: at(10), [LEFT_ASSASSIN]: at(10), [LEFT_CONTROLLER]: at(11) },
    );
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9));
    expect(positionOf(match, LEFT_ASSASSIN)).toEqual(at(12));
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(13));
  });

  it("does not let a Hero walk through a Hero whose own Move ends where it started", () => {
    // A Move towards a Wall corner ends on the start tile, so that Hero stays.
    const { match } = play(
      { [LEFT_BRUISER]: at(9, 6), [LEFT_CONTROLLER]: at(9, 5) },
      { [LEFT_BRUISER]: at(9, 4), [LEFT_CONTROLLER]: at(10, 4) },
    );
    expect(positionOf(match, LEFT_CONTROLLER)).toEqual(at(9, 5));
    expect(positionOf(match, LEFT_BRUISER)).toEqual(at(9, 6));
  });
});

describe("the movement rule is symmetric and independent of the order of the Heroes", () => {
  const crossing = (squadMirrored: boolean) => {
    const place = squadMirrored ? mirror : (tile: GridPosition) => tile;
    const squad = squadMirrored ? SquadId.Right : SquadId.Left;
    const [first, second, standing] = squadMirrored
      ? [RIGHT_BRUISER, RIGHT_CONTROLLER, "right-assassin"]
      : [LEFT_BRUISER, LEFT_CONTROLLER, LEFT_ASSASSIN];
    return { place, squad, first, second, standing };
  };

  function run(mirrored: boolean, reverse: boolean) {
    const { place, squad, first, second, standing } = crossing(mirrored);
    const match = matchWith({
      [first]: place(at(8)),
      [second]: place(at(9)),
      [standing]: place(at(10)),
    });
    if (reverse) match.heroes.reverse();
    const ordered = movePlan(match, squad, { [first]: place(at(10)), [second]: place(at(11)) });
    const plan = reverse ? { ...ordered, heroes: [...ordered.heroes].reverse() } : ordered;
    const { match: after } = resolveRound(match, [plan]);
    return [first, second, standing].map((id) => positionOf(after, id));
  }

  it("ends a Left Squad and its mirror image on mirrored tiles", () => {
    const left = run(false, false);
    expect(run(true, false)).toEqual(left.map(mirror));
    expect(left).toEqual([at(8), at(9), at(10)]);
  });

  it("does not depend on the order of the Heroes", () => {
    expect(run(false, true)).toEqual(run(false, false));
    expect(run(true, true)).toEqual(run(true, false));
  });

  it("ends two Squads that aim at the same tile on mirrored tiles", () => {
    const match = matchWith({ [LEFT_BRUISER]: at(20, 7), [RIGHT_BRUISER]: mirror(at(20, 7)) });
    const plans = [
      movePlan(match, SquadId.Left, { [LEFT_BRUISER]: at(22, 7) }),
      movePlan(match, SquadId.Right, { [RIGHT_BRUISER]: at(22, 7) }),
    ];
    const { match: after } = resolveRound(match, plans);
    expect(positionOf(after, RIGHT_BRUISER)).toEqual(mirror(positionOf(after, LEFT_BRUISER)));
  });
});
