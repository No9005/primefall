import { describe, expect, it } from "vitest";
import { planSquad } from "./ai";
import { HeroClass } from "./cards";
import { EventKind, type HeroView, SquadId } from "./host";
import { buildSquadView, createMatch, startRound } from "./match";
import { ActionKind, findMoveCollisions, type QueuedAction, reachableMoveDestinations, type SquadPlan } from "./plan";
import { type GridPosition, isStepAllowed, REACTOR_DECK, TileKind, tileAt } from "./reactor-deck";
import { resolveRound } from "./resolution";

/** A row of five open tiles where every step along the row is allowed. */
function openRow(): GridPosition[] {
  for (let row = 0; row < REACTOR_DECK.height; row++) {
    for (let col = 0; col + 4 < REACTOR_DECK.width; col++) {
      const tiles = Array.from({ length: 5 }, (_, i) => ({ col: col + i, row }));
      const open = tiles.every((tile) => ![undefined, TileKind.Wall].includes(tileAt(REACTOR_DECK, tile)));
      if (open && tiles.every((tile, i) => i === 0 || isStepAllowed(tiles[i - 1]!, tile))) return tiles;
    }
  }
  throw new Error("no open row");
}

const hero = (id: string, position: GridPosition): HeroView => ({
  id,
  heroClass: HeroClass.Bruiser,
  position,
  deckCount: 0,
  exileCount: 0,
  hand: [],
  exhausted: false,
  slowed: false,
  hidden: false,
  marked: false,
});
const move = (destination: GridPosition): QueuedAction => ({ kind: ActionKind.Move, card: 0, destination });
const planOf = (queues: Record<string, QueuedAction[]>): SquadPlan => ({
  squad: SquadId.Left,
  heroes: Object.entries(queues).map(([heroId, queue]) => ({ heroId, queue })),
});

describe("findMoveCollisions", () => {
  const [a, b, c, d, e] = openRow() as [GridPosition, GridPosition, GridPosition, GridPosition, GridPosition];

  it("flags two Heroes moving to the same free tile in the same Tick", () => {
    const heroes = [hero("x", a), hero("y", e)];
    const result = findMoveCollisions(heroes, [planOf({ x: [move(c)], y: [move(c)] })]);
    expect(result.map(({ heroId, tick }) => [heroId, tick]).sort()).toEqual([["x", 1], ["y", 1]]);
  });

  it("flags a Move that would end on a standing ally", () => {
    const heroes = [hero("x", a), hero("y", c)];
    const result = findMoveCollisions(heroes, [planOf({ x: [move(c)] })]);
    expect(result).toEqual([{ heroId: "x", tick: 1, destination: c, blockedBy: "y" }]);
  });

  it("flags a Move that would walk through a standing ally", () => {
    const heroes = [hero("x", a), hero("y", b)];
    expect(findMoveCollisions(heroes, [planOf({ x: [move(c)] })])).toEqual([{ heroId: "x", tick: 1, destination: c, blockedBy: "y" }]);
  });

  it("does not flag a Hero that follows an ally walking away in the same Tick", () => {
    const heroes = [hero("x", a), hero("y", b)];
    expect(findMoveCollisions(heroes, [planOf({ x: [move(c)], y: [move(d)] })])).toEqual([]);
  });

  it("does not flag a Move through a tile an ally has just left", () => {
    const heroes = [hero("x", a), hero("y", b)];
    expect(findMoveCollisions(heroes, [planOf({ y: [move(d)], x: [{ kind: ActionKind.Block, card: 0 }, move(c)] })])).toEqual([]);
  });

  it("returns nothing for a plan without Squad conflicts", () => {
    const heroes = [hero("x", a), hero("y", e)];
    expect(findMoveCollisions(heroes, [planOf({ x: [move(b)], y: [move(d)] })])).toEqual([]);
  });
});

describe("findMoveCollisions against the Resolution", () => {
  it.each(Array.from({ length: 20 }, (_, i) => i + 1))("matches the blocked Moves of own Heroes (seed %i)", (seed) => {
    const match = startRound(createMatch(seed));
    const view = buildSquadView(match, SquadId.Left);
    const ai = planSquad(view);
    // A player Move: the first Hero heads for a tile an ally stands on or plans to enter, when it can reach one.
    const [first] = view.heroes;
    const others = ai.heroes.filter((h) => h.heroId !== first!.id);
    const contested = [
      ...view.heroes.filter((h) => h !== first).map((h) => h.position),
      ...others.flatMap((h) => h.queue.flatMap((action) => (action.kind === ActionKind.Move ? [action.destination] : []))),
    ];
    const reachable = reachableMoveDestinations(first!.position);
    const destination =
      reachable.find((tile) => contested.some((other) => other.col === tile.col && other.row === tile.row)) ?? reachable[0]!;
    const plan: SquadPlan = { squad: SquadId.Left, heroes: [{ heroId: first!.id, queue: [{ kind: ActionKind.Move as const, card: first!.hand[0]!, destination }] }, ...others] };
    const flagged = new Set(findMoveCollisions(view.heroes, [plan]).map(({ heroId, tick }) => `${heroId}@${tick}`));
    const result = resolveRound(match, [plan, { squad: SquadId.Right, heroes: [] }]);
    const own = new Set(view.heroes.map((h) => h.id));
    const blocked = new Set(
      result.events.flatMap((event) => (event.kind === EventKind.MoveBlocked && own.has(event.heroId) ? [`${event.heroId}@${event.tick}`] : [])),
    );
    expect(flagged).toEqual(blocked);
  });
});
