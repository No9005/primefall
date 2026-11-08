import { describe, expect, it } from "vitest";
import { withFullCover } from "./full-cover-fixture";
import { EventKind, SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type SquadPlan } from "./plan";
import { CoverKind, coverAgainst, coverAt, findTiles, type GridPosition, TileKind, tileAt } from "./reactor-deck";
import { resolveRound } from "./resolution";
import { restoreLocalHost } from "./local-host";

const LEFT_BRUISER = "left-bruiser";
const RIGHT_BRUISER = "right-bruiser";
const RIGHT_ASSASSIN = "right-assassin";
// Bruiser card 0 is Slam Shot (Range 3); card 4 is Breach Charge (destroys Half Cover).
const SLAM_SHOT = 2; // Concussion Round: damage 2, Range 3 (Slam Shot is Range 1 to 2 since ADR 0025)
const BREACH_CHARGE = 4;

const WRECK_TILE: GridPosition = { col: 8, row: 3 };
const OPEN_TILE: GridPosition = { col: 8, row: 5 };
const ATTACKER: GridPosition = { col: 5, row: 3 };

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;

/** A Round-2 match in which the Right Assassin was Exhausted on `tile` in the Resolution of Round 1. */
function matchWithWreck(tile: GridPosition): MatchState {
  const start = startRound(createMatch(5));
  hero(start, RIGHT_ASSASSIN).position = tile;
  hero(start, RIGHT_ASSASSIN).deck = [];
  const after = startRound(resolveRound(start, []).match);
  expect(hero(after, RIGHT_ASSASSIN).exhausted).toBe(true);
  return after;
}

const slam = (target: string): SquadPlan => ({
  squad: SquadId.Left,
  heroes: [{ heroId: LEFT_BRUISER, queue: [{ kind: ActionKind.Primary, card: SLAM_SHOT, target }] }],
});

/** The Deck Damage a Slam Shot from the attacker's tile does to the Right Bruiser standing on `tile`. */
function slamDamage(match: MatchState, from: GridPosition, tile: GridPosition): number {
  hero(match, LEFT_BRUISER).position = from;
  hero(match, LEFT_BRUISER).hand = [SLAM_SHOT, 0, 1, 3];
  hero(match, RIGHT_BRUISER).position = tile;
  const { events } = resolveRound(match, [slam(RIGHT_BRUISER)]);
  const hit = events.find(({ kind }) => kind === EventKind.AttackHit)!;
  return hit.damage!;
}

describe("Half Cover left by an Exhausted Hero", () => {
  it("protects a Hero standing on the tile at Range 2 or more, not at Range 1", () => {
    const match = matchWithWreck(WRECK_TILE);
    expect(coverAt(match.grid, WRECK_TILE)).toBe(CoverKind.Half);
    const open = slamDamage(structuredClone(match), ATTACKER, OPEN_TILE);
    expect(slamDamage(structuredClone(match), ATTACKER, WRECK_TILE)).toBe(open - 1);
    expect(coverAgainst(match.grid, { col: 7, row: 3 }, WRECK_TILE)).toBe(CoverKind.None);
    expect(slamDamage(structuredClone(match), { col: 7, row: 3 }, WRECK_TILE)).toBe(open);
  });

  it("is no obstacle: another Hero walks onto and through the tile", () => {
    const match = matchWithWreck(WRECK_TILE);
    hero(match, LEFT_BRUISER).position = { col: 7, row: 3 };
    const plan: SquadPlan = {
      squad: SquadId.Left,
      heroes: [{ heroId: LEFT_BRUISER, queue: [{ kind: ActionKind.Move, card: hero(match, LEFT_BRUISER).hand[0]!, destination: { col: 9, row: 3 } }] }],
    };
    expect(hero(resolveRound(match, [plan]).match, LEFT_BRUISER).position).toEqual({ col: 9, row: 3 });
    const stop: SquadPlan = { ...plan, heroes: [{ ...plan.heroes[0]!, queue: [{ ...plan.heroes[0]!.queue[0]!, destination: WRECK_TILE } as never] }] };
    expect(hero(resolveRound(match, [stop]).match, LEFT_BRUISER).position).toEqual(WRECK_TILE);
  });

  it("leaves the Prime Zone a Prime Zone tile", () => {
    const zone = findTiles(startRound(createMatch(5)).grid, TileKind.PrimeZone)[0]!;
    const match = matchWithWreck(zone);
    expect(tileAt(match.grid, zone)).toBe(TileKind.PrimeZone);
    expect(coverAt(match.grid, zone)).toBe(CoverKind.Half);
  });

  it("is destroyed by Breach Charge, and the tile is plain floor afterwards", () => {
    const match = matchWithWreck(WRECK_TILE);
    hero(match, LEFT_BRUISER).position = ATTACKER;
    hero(match, LEFT_BRUISER).hand = [BREACH_CHARGE, SLAM_SHOT, 1, 2];
    const plan: SquadPlan = {
      squad: SquadId.Left,
      heroes: [{ heroId: LEFT_BRUISER, queue: [{ kind: ActionKind.Primary, card: BREACH_CHARGE, target: LEFT_BRUISER, tile: WRECK_TILE }], pitched: [SLAM_SHOT, 1] }],
    };
    const { match: after, events } = resolveRound(match, [plan]);
    expect(events.map(({ kind }) => kind)).toContain(EventKind.CoverDestroyed);
    expect(coverAt(after.grid, WRECK_TILE)).toBe(CoverKind.None);
    expect(tileAt(after.grid, WRECK_TILE)).toBe(TileKind.Floor);
  });

  it("keeps Full Cover on a Full Cover tile", () => {
    const match = withFullCover(matchWithWreck(WRECK_TILE), WRECK_TILE);
    expect(coverAt(match.grid, WRECK_TILE)).toBe(CoverKind.Full);
  });
});

describe("Squad View of wreck Cover", () => {
  it("lists a wreck the Squad sees but not one it has not seen", () => {
    const far: GridPosition = { col: 22, row: 3 };
    const unseen = matchWithWreck(far);
    expect(buildSquadView(unseen, SquadId.Left).wreckCover).toEqual([]);
    hero(unseen, LEFT_BRUISER).position = { col: 18, row: 3 };
    const seen = resolveRound(unseen, []).match;
    expect(buildSquadView(seen, SquadId.Left).wreckCover).toEqual([far]);
  });

  it("lists a wreck of the Squad's own Hero at once", () => {
    const start = startRound(createMatch(5));
    hero(start, RIGHT_ASSASSIN).position = { col: 25, row: 3 };
    hero(start, RIGHT_ASSASSIN).deck = [];
    const after = resolveRound(start, []).match;
    expect(buildSquadView(after, SquadId.Right).wreckCover).toEqual([{ col: 25, row: 3 }]);
    expect(buildSquadView(after, SquadId.Left).wreckCover).toEqual([]);
  });
});

describe("Saved matches", () => {
  it("loads an old save in which a Hero is Exhausted and gives its tile Half Cover", async () => {
    const match = startRound(createMatch(5));
    hero(match, RIGHT_ASSASSIN).exhausted = true;
    hero(match, RIGHT_ASSASSIN).position = { col: 5, row: 4 };
    hero(match, LEFT_BRUISER).position = ATTACKER;
    const old: Partial<MatchState> = { ...match };
    delete old.knownWrecks;
    const restored = restoreLocalHost(JSON.stringify({ version: 1, match: old }));
    expect(restored).toBeDefined();
    const view = await restored!.getSquadView(SquadId.Left);
    expect(view.wreckCover).toEqual([{ col: 5, row: 4 }]);
  });
});
