import { cardIndex, HeroClass } from "./cards";
import { describe, expect, it } from "vitest";
import { withFullCover } from "./full-cover-fixture";
import { EventKind, SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, recordSightings, startRound } from "./match";
import { ActionKind, moveDestinations, PlanIssueKind, type SquadPlan, validatePlan } from "./plan";
import {
  CoverKind,
  coverAgainst,
  coverAt,
  destroyCover,
  type GridPosition,
  hasLineOfSight,
  parseGrid,
  REACTOR_DECK,
  TileKind,
  tileAt,
} from "./reactor-deck";
import { getSquadEvents, resolveRound } from "./resolution";

const LEFT_BRUISER = "left-bruiser";
const RIGHT_BRUISER = "right-bruiser";
// Bruiser card 4 is Breach Charge (2 Energy, Range 3, 2 damage, destroys Half Cover); card 0 is Slam Shot.
const BREACH_CHARGE = cardIndex(HeroClass.Bruiser, "Breach Charge");
const SLAM_SHOT = cardIndex(HeroClass.Bruiser, "Slam Shot");

const HALF_COVER_TILE = { col: 18, row: 8 };
const FULL_COVER_TILE = { col: 15, row: 1 };

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;

function setup(positions: Record<string, GridPosition>): MatchState {
  const match = startRound(createMatch(5));
  hero(match, LEFT_BRUISER).hand = [BREACH_CHARGE, SLAM_SHOT, 1, 2];
  for (const [id, position] of Object.entries(positions)) hero(match, id).position = position;
  return match;
}

const breachPlan = (tile: GridPosition): SquadPlan => ({
  squad: SquadId.Left,
  heroes: [
    {
      heroId: LEFT_BRUISER,
      queue: [{ kind: ActionKind.Primary, card: BREACH_CHARGE, target: LEFT_BRUISER, tile }],
      pitched: [SLAM_SHOT, 1],
    },
  ],
});

describe("Breach Charge", () => {
  it("damages the enemy on Half Cover through the Cover and destroys it", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 18, row: 11 }, [RIGHT_BRUISER]: HALF_COVER_TILE });
    const { match: after, events } = resolveRound(match, [breachPlan(HALF_COVER_TILE)]);
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.AttackHit, EventKind.CoverDestroyed]);
    // Half Cover still reduces the 2 damage of the charge itself by 1.
    expect(events[0]).toMatchObject({ heroId: LEFT_BRUISER, targetId: RIGHT_BRUISER, damage: 1 });
    expect(events[1]).toMatchObject({ heroId: LEFT_BRUISER, to: HALF_COVER_TILE });
    expect(coverAt(after.grid, HALF_COVER_TILE)).toBe(CoverKind.None);
    expect(hero(after, RIGHT_BRUISER).position).toEqual(HALF_COVER_TILE);
  });

  it("leaves Full Cover standing and blocks the damage to a Hero on it", () => {
    const match = withFullCover(setup({ [LEFT_BRUISER]: { col: 15, row: 4 }, [RIGHT_BRUISER]: FULL_COVER_TILE }), FULL_COVER_TILE);
    const { match: after, events } = resolveRound(match, [breachPlan(FULL_COVER_TILE)]);
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.AttackFailed]);
    expect(coverAt(after.grid, FULL_COVER_TILE)).toBe(CoverKind.Full);
    expect(hero(after, RIGHT_BRUISER).deck).toHaveLength(hero(match, RIGHT_BRUISER).deck.length);
  });

  it("deals full damage on open ground and changes no Cover", () => {
    const target = { col: 8, row: 3 };
    const match = setup({ [LEFT_BRUISER]: { col: 5, row: 3 }, [RIGHT_BRUISER]: target });
    const { match: after, events } = resolveRound(match, [breachPlan(target)]);
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.AttackHit]);
    expect(events[0]).toMatchObject({ damage: 2 });
    expect(after.grid).toEqual(REACTOR_DECK);
  });

  it("destroys Half Cover on an empty tile, and fails beyond Range", () => {
    const empty = setup({ [LEFT_BRUISER]: { col: 18, row: 11 } });
    expect(coverAt(resolveRound(empty, [breachPlan(HALF_COVER_TILE)]).match.grid, HALF_COVER_TILE)).toBe(CoverKind.None);
    const far = setup({ [LEFT_BRUISER]: { col: 18, row: 12 } });
    const { match: after, events } = resolveRound(far, [breachPlan(HALF_COVER_TILE)]);
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.AttackFailed]);
    expect(coverAt(after.grid, HALF_COVER_TILE)).toBe(CoverKind.Half);
  });

  it("no longer protects the tile in later Resolutions", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 18, row: 11 }, [RIGHT_BRUISER]: HALF_COVER_TILE });
    const destroyed = resolveRound(match, [breachPlan(HALF_COVER_TILE)]).match;
    expect(coverAgainst(destroyed.grid, { col: 18, row: 11 }, HALF_COVER_TILE)).toBe(CoverKind.None);
    const next = startRound(destroyed);
    hero(next, LEFT_BRUISER).hand = [SLAM_SHOT, 1, 2, 3];
    hero(next, LEFT_BRUISER).position = { col: 18, row: 10 };
    const slam: SquadPlan = {
      squad: SquadId.Left,
      heroes: [{ heroId: LEFT_BRUISER, queue: [{ kind: ActionKind.Primary, card: SLAM_SHOT, target: RIGHT_BRUISER }], pitched: [1] }],
    };
    expect(resolveRound(next, [slam]).events[0]).toMatchObject({ kind: EventKind.AttackHit, damage: 2 });
  });
});

describe("destroyed Cover", () => {
  const fullCover = { col: 2, row: 1 };

  it("stops blocking Line of Sight and stays an occupiable tile", () => {
    const from = { col: 1, row: 1 };
    const throughCover = parseGrid(["#######", "#.F...#", "#######"]);
    expect(hasLineOfSight(throughCover, from, { col: 4, row: 1 })).toBe(false);
    const broken = destroyCover(throughCover, fullCover);
    expect(hasLineOfSight(broken, from, { col: 4, row: 1 })).toBe(true);
    expect(tileAt(broken, fullCover)).toBe(TileKind.Floor);
    expect(moveDestinations(from, broken, 1)).toContainEqual(fullCover);
  });

  it("leaves tiles without Cover untouched", () => {
    expect(destroyCover(REACTOR_DECK, { col: 1, row: 1 })).toBe(REACTOR_DECK);
  });
});

describe("destroyed Cover and the Fog of War", () => {
  it("shows the Squad View of the Squad that sees the tile, and not of the Squad that does not", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 18, row: 11 } });
    const { match: after } = resolveRound(match, [breachPlan(HALF_COVER_TILE)]);
    expect(buildSquadView(after, SquadId.Left).destroyedCover).toEqual([HALF_COVER_TILE]);
    // The right Squad stands on its Drop Point tiles, far away from the tile.
    expect(buildSquadView(after, SquadId.Right).destroyedCover).toEqual([]);
  });

  it("reaches the other Squad once it sees the tile, and keeps it afterwards", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 18, row: 11 } });
    const { match: after } = resolveRound(match, [breachPlan(HALF_COVER_TILE)]);
    hero(after, RIGHT_BRUISER).position = { col: 24, row: 8 };
    recordSightings(after);
    expect(buildSquadView(after, SquadId.Right).destroyedCover).toEqual([HALF_COVER_TILE]);
    hero(after, RIGHT_BRUISER).position = { col: 38, row: 8 };
    recordSightings(after);
    expect(buildSquadView(after, SquadId.Right).destroyedCover).toEqual([HALF_COVER_TILE]);
  });

  it("only sends the CoverDestroyed event to Squads that see the tile", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 18, row: 11 } });
    const result = resolveRound(match, [breachPlan(HALF_COVER_TILE)]);
    expect(getSquadEvents(SquadId.Left, result).map(({ kind }) => kind)).toEqual([EventKind.CoverDestroyed]);
    expect(getSquadEvents(SquadId.Right, result)).toEqual([]);
  });
});

describe("planning Breach Charge", () => {
  const view = (match: MatchState) => buildSquadView(match, SquadId.Left);

  it("accepts a tile target and rejects a missing tile or a Wall", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 18, row: 11 } });
    expect(validatePlan(view(match), breachPlan(HALF_COVER_TILE))).toEqual([]);
    const withoutTile = breachPlan(HALF_COVER_TILE);
    delete (withoutTile.heroes[0]!.queue[0] as { tile?: GridPosition }).tile;
    expect(validatePlan(view(match), withoutTile).map(({ kind }) => kind)).toEqual([PlanIssueKind.BadTarget]);
    expect(validatePlan(view(match), breachPlan({ col: 0, row: 0 })).map(({ kind }) => kind)).toEqual([PlanIssueKind.BadTarget]);
  });
});
