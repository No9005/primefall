import { describe, expect, it } from "vitest";
import { HeroClass } from "./cards";
import { type EnemyView, EventKind, SquadId, Visibility } from "./host";
import { buildSquadView, canSquadSee, createMatch, type MatchState, recordSightings, SIGHT_RANGE, startRound } from "./match";
import { ActionKind, type SquadPlan } from "./plan";
import { findTiles, type GridPosition, REACTOR_DECK, TileKind } from "./reactor-deck";
import { getSquadEvents, resolveRound } from "./resolution";

const LEFT_BRUISER = "left-bruiser";
const LEFT_CONTROLLER = "left-controller";
const RIGHT_BRUISER = "right-bruiser";

/** A Round-1 match where only the given Heroes are active, standing on the given tiles. The rest are Exhausted: they see nothing. */
function setup(placements: Record<string, GridPosition>): MatchState {
  const match = startRound(createMatch(5));
  for (const hero of match.heroes) {
    const position = placements[hero.id];
    if (position) hero.position = position;
    else hero.exhausted = true;
  }
  recordSightings(match);
  return match;
}

const enemyOf = (match: MatchState, squad: SquadId, heroId: string): EnemyView =>
  buildSquadView(match, squad).enemies.find((enemy) => enemy.id === heroId)!;

function moveTo(match: MatchState, squad: SquadId, heroId: string, ...destinations: GridPosition[]): SquadPlan {
  const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
  return {
    squad,
    heroes: [
      {
        heroId,
        queue: destinations.map((destination, i) => ({ kind: ActionKind.Move as const, card: hero.hand[i]!, destination })),
      },
    ],
  };
}

describe("Visible, Ghost and Unknown", () => {
  it("shows every enemy as Unknown at the start: the Drop Point areas are far apart", () => {
    const view = buildSquadView(startRound(createMatch(1)), SquadId.Left);
    expect(view.enemies.map((enemy) => enemy.visibility)).toEqual(Array(3).fill(Visibility.Unknown));
  });

  it("sees an enemy within sight range 7 and Line of Sight, but not at 8", () => {
    const left = { [LEFT_BRUISER]: { col: 2, row: 5 } };
    expect(SIGHT_RANGE).toBe(7);
    expect(enemyOf(setup({ ...left, [RIGHT_BRUISER]: { col: 9, row: 5 } }), SquadId.Left, RIGHT_BRUISER).visibility).toBe(Visibility.Visible);
    expect(enemyOf(setup({ ...left, [RIGHT_BRUISER]: { col: 10, row: 5 } }), SquadId.Left, RIGHT_BRUISER).visibility).toBe(Visibility.Unknown);
  });

  it("does not see through a Wall even within sight range", () => {
    // The Walls at (10,7) and (11,7) block the straight line from (8,7) to (12,7).
    const match = setup({ [LEFT_BRUISER]: { col: 8, row: 7 }, [RIGHT_BRUISER]: { col: 12, row: 7 } });
    expect(enemyOf(match, SquadId.Left, RIGHT_BRUISER).visibility).toBe(Visibility.Unknown);
  });

  it("cannot see the Prime Zone from the Drop Point areas", () => {
    const primeZone = findTiles(REACTOR_DECK, TileKind.PrimeZone);
    const fresh = startRound(createMatch(3));
    for (const squad of [SquadId.Left, SquadId.Right]) {
      expect(primeZone.some((tile) => canSquadSee(fresh, squad, tile))).toBe(false);
    }
  });

  it("shares vision: one Hero seeing an enemy is enough", () => {
    const enemy = { [RIGHT_BRUISER]: { col: 9, row: 5 } };
    const alone = setup({ [LEFT_BRUISER]: { col: 1, row: 1 }, ...enemy });
    expect(enemyOf(alone, SquadId.Left, RIGHT_BRUISER).visibility).toBe(Visibility.Unknown);
    const together = setup({ [LEFT_BRUISER]: { col: 1, row: 1 }, [LEFT_CONTROLLER]: { col: 3, row: 5 }, ...enemy });
    expect(enemyOf(together, SquadId.Left, RIGHT_BRUISER)).toMatchObject({ visibility: Visibility.Visible, position: { col: 9, row: 5 } });
  });

  it("turns Visible into Ghost at the position where the enemy was last seen, then back to Visible", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 3, row: 3 }, [RIGHT_BRUISER]: { col: 8, row: 3 } });
    expect(enemyOf(match, SquadId.Left, RIGHT_BRUISER).visibility).toBe(Visibility.Visible);

    // Two Moves east: (10,3) after Tick 1 is still in sight range, (12,3) after Tick 2 is not.
    const leaving = resolveRound(match, [moveTo(match, SquadId.Right, RIGHT_BRUISER, { col: 10, row: 3 }, { col: 12, row: 3 })]);
    const nextRound = startRound(leaving.match);
    expect(enemyOf(nextRound, SquadId.Left, RIGHT_BRUISER)).toMatchObject({
      visibility: Visibility.Ghost,
      position: { col: 10, row: 3 },
      lastSeenRound: 1,
    });
    // Vision is mutual: at (10,3) after Tick 1 the right Squad saw the left Bruiser too.
    expect(enemyOf(nextRound, SquadId.Right, LEFT_BRUISER)).toMatchObject({ visibility: Visibility.Ghost, position: { col: 3, row: 3 } });

    // The Ghost stays while nobody looks, and the enemy is Visible again when it returns.
    const idle = startRound(resolveRound(nextRound, []).match);
    expect(enemyOf(idle, SquadId.Left, RIGHT_BRUISER).visibility).toBe(Visibility.Ghost);
    const returning = startRound(
      resolveRound(idle, [moveTo(idle, SquadId.Right, RIGHT_BRUISER, { col: 10, row: 3 })]).match,
    );
    expect(enemyOf(returning, SquadId.Left, RIGHT_BRUISER)).toMatchObject({ visibility: Visibility.Visible, position: { col: 10, row: 3 } });
  });

  it("remembers the counts last seen, not the current ones", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 3, row: 5 }, [RIGHT_BRUISER]: { col: 8, row: 5 } });
    const seenDeck = match.heroes.find((hero) => hero.id === RIGHT_BRUISER)!.deck.length;
    match.heroes.find((hero) => hero.id === RIGHT_BRUISER)!.position = { col: 15, row: 5 };
    match.heroes.find((hero) => hero.id === RIGHT_BRUISER)!.deck.pop();
    expect(enemyOf(match, SquadId.Left, RIGHT_BRUISER)).toMatchObject({
      visibility: Visibility.Ghost,
      position: { col: 8, row: 5 },
      deckCount: seenDeck,
      discardCount: 0,
      exileCount: 0,
    });
  });

  it("shows a Visible enemy's Shield and Deck, Discard and Exile counts", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 3, row: 5 }, [RIGHT_BRUISER]: { col: 8, row: 5 } });
    const enemy = match.heroes.find((hero) => hero.id === RIGHT_BRUISER)!;
    enemy.shield = 2;
    expect(enemyOf(match, SquadId.Left, RIGHT_BRUISER)).toMatchObject({
      visibility: Visibility.Visible,
      shield: 2,
      deckCount: enemy.deck.length,
      discardCount: 0,
      exileCount: 0,
    });
  });
});

describe("the Squad View never contains hidden enemy information", () => {
  it("delivers only identity for Unknown and no Hand, Energy, Queue or Deck order for any state", () => {
    const match = setup({
      [LEFT_BRUISER]: { col: 3, row: 5 },
      [RIGHT_BRUISER]: { col: 8, row: 5 },
      "right-controller": { col: 18, row: 9 },
    });
    // The Assassin is Exhausted far away and was never seen; the Controller is out of sight; make one a Ghost.
    const ghosted = match.heroes.find((hero) => hero.id === RIGHT_BRUISER)!;
    ghosted.position = { col: 15, row: 5 };
    const view = buildSquadView(match, SquadId.Left);
    const byState = Object.fromEntries(view.enemies.map((enemy) => [enemy.heroClass, enemy]));
    expect(Object.keys(byState[HeroClass.Controller]!).sort()).toEqual(["heroClass", "id", "visibility"]);
    expect(Object.keys(byState[HeroClass.Assassin]!).sort()).toEqual(["heroClass", "id", "visibility"]);
    expect(Object.keys(byState[HeroClass.Bruiser]!).sort()).toEqual([
      "deckCount",
      "discardCount",
      "exileCount",
      "heroClass",
      "id",
      "lastSeenRound",
      "position",
      "visibility",
    ]);
    const json = JSON.stringify(view.enemies);
    expect(json).not.toMatch(/hand|energy|queue|seed|rng/i);
    expect(json).not.toContain("18");
  });

  it("does not leak the position of an Unknown enemy through its identity", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 1, row: 1 }, [RIGHT_BRUISER]: { col: 19, row: 9 } });
    expect(enemyOf(match, SquadId.Left, RIGHT_BRUISER)).toEqual({
      id: RIGHT_BRUISER,
      heroClass: HeroClass.Bruiser,
      visibility: Visibility.Unknown,
    });
  });
});

describe("events outside the Squad's perception are not delivered", () => {
  it("delivers nothing about an enemy moving in the fog, but the mover's Squad sees its own events", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 1, row: 1 }, [RIGHT_BRUISER]: { col: 15, row: 5 } });
    const resolution = resolveRound(match, [moveTo(match, SquadId.Right, RIGHT_BRUISER, { col: 17, row: 5 })]);
    expect(getSquadEvents(SquadId.Left, resolution)).toEqual([]);
    expect(getSquadEvents(SquadId.Right, resolution).map((event) => event.kind)).toEqual([EventKind.Step, EventKind.Step]);
  });

  it("delivers the movement of an enemy that a Squad Hero sees", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 3, row: 5 }, [RIGHT_BRUISER]: { col: 8, row: 5 } });
    const resolution = resolveRound(match, [moveTo(match, SquadId.Right, RIGHT_BRUISER, { col: 10, row: 5 })]);
    expect(getSquadEvents(SquadId.Left, resolution)).toHaveLength(2);
  });

  it("delivers a step that is seen only on the tile it left", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 3, row: 5 }, [RIGHT_BRUISER]: { col: 10, row: 5 } });
    const resolution = resolveRound(match, [moveTo(match, SquadId.Right, RIGHT_BRUISER, { col: 12, row: 5 })]);
    // A Move 2 gives one event per tile: (10,5)->(11,5) starts in sight range 7, (11,5)->(12,5) is out of it.
    const delivered = getSquadEvents(SquadId.Left, resolution);
    expect(delivered.map((event) => event.from)).toEqual([{ col: 10, row: 5 }]);
  });

  it("delivers an Attack to the attacked Squad even from out of sight, without revealing the position", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 1, row: 1 }, [RIGHT_BRUISER]: { col: 3, row: 1 } });
    match.heroes.find((hero) => hero.id === RIGHT_BRUISER)!.hand = [0, 1, 2, 3];
    const plan: SquadPlan = {
      squad: SquadId.Right,
      heroes: [{ heroId: RIGHT_BRUISER, queue: [{ kind: ActionKind.Primary, card: 0, target: LEFT_BRUISER }], pitched: [1] }],
    };
    const resolution = resolveRound(match, [plan]);
    const delivered = getSquadEvents(SquadId.Left, resolution);
    expect(delivered.map((event) => event.kind)).toEqual([EventKind.AttackHit]);
    expect(JSON.stringify(delivered)).not.toContain('"position"');
  });
});
