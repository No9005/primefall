import { afterEach, describe, expect, it } from "vitest";
import { EffectKind, HERO_DECKS, HeroClass } from "./cards";
import { EventKind, SquadId } from "./host";
import { createMatch, MAX_PLACED_COVER_PER_SQUAD, type MatchState, startRound } from "./match";
import { ActionKind, type SquadPlan } from "./plan";
import { CoverKind, coverAgainst, coverAt, type GridPosition, tileAt, TileKind } from "./reactor-deck";
import { resolveRound } from "./resolution";

const LEFT_CONTROLLER = "left-controller";
const RIGHT_CONTROLLER = "right-controller";
const LEFT_BRUISER = "left-bruiser";
const RIGHT_BRUISER = "right-bruiser";

// Controller card 8 is Deploy Cover, card 9 (the second Deploy Cover) is swapped for a Full Cover test card
// until the Barricade comes with the deck ticket; Pulse Bolt (0, 1) is Pitch fodder.
const DEPLOY_COVER = 8;
const TEST_BARRICADE = 9;
const BRUISER_BREACH_CHARGE = 4;
const BRUISER_SLAM_SHOT = 0;

const decks = HERO_DECKS as Record<HeroClass, unknown[]>;
const originalCard = HERO_DECKS[HeroClass.Controller][TEST_BARRICADE]!;
afterEach(() => {
  decks[HeroClass.Controller]![TEST_BARRICADE] = originalCard;
});

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const tileOf = (index: number): GridPosition => ({ col: 8 + index, row: 3 });

/** Plays `card` (Deploy Cover or the test Barricade) with the Controller of `squad` onto `tile`, in a new Round. */
function place(match: MatchState, squad: SquadId, card: number, tile: GridPosition) {
  const next = startRound(match);
  const id = squad === SquadId.Left ? LEFT_CONTROLLER : RIGHT_CONTROLLER;
  hero(next, id).position = { col: tile.col, row: 5 };
  hero(next, id).hand = [card, 0, 1, 5];
  const plan: SquadPlan = {
    squad,
    heroes: [{ heroId: id, queue: [{ kind: ActionKind.Primary, card, target: id, tile }], pitched: [0] }],
  };
  return resolveRound(next, [plan]);
}

describe("Placed Cover", () => {
  it("is still there after many Rounds", () => {
    let { match } = place(startRound(createMatch(5)), SquadId.Left, DEPLOY_COVER, tileOf(0));
    for (let round = 0; round < 5; round += 1) match = resolveRound(startRound(match), []).match;
    expect(coverAt(match.grid, tileOf(0))).toBe(CoverKind.Half);
  });

  it("removes the oldest tile of the Squad when a fourth is placed, and says so with a destroyed-Cover event", () => {
    let match = startRound(createMatch(5));
    for (let index = 0; index < MAX_PLACED_COVER_PER_SQUAD; index += 1) {
      match = place(match, SquadId.Left, DEPLOY_COVER, tileOf(index)).match;
    }
    expect(match.placedCover).toHaveLength(MAX_PLACED_COVER_PER_SQUAD);
    const fourth = place(match, SquadId.Left, DEPLOY_COVER, tileOf(3));
    expect(fourth.events).toContainEqual(expect.objectContaining({ kind: EventKind.CoverDestroyed, to: tileOf(0) }));
    expect(coverAt(fourth.match.grid, tileOf(0))).toBe(CoverKind.None);
    for (const index of [1, 2, 3]) expect(coverAt(fourth.match.grid, tileOf(index))).toBe(CoverKind.Half);
    expect(fourth.match.placedCover.map(({ position }) => position)).toEqual([tileOf(1), tileOf(2), tileOf(3)]);
  });

  it("counts per Squad", () => {
    let match = startRound(createMatch(5));
    for (let index = 0; index < MAX_PLACED_COVER_PER_SQUAD; index += 1) {
      match = place(match, SquadId.Left, DEPLOY_COVER, tileOf(index)).match;
    }
    const right = place(match, SquadId.Right, DEPLOY_COVER, tileOf(5));
    expect(right.events.some(({ kind }) => kind === EventKind.CoverDestroyed)).toBe(false);
    expect(right.match.placedCover).toHaveLength(MAX_PLACED_COVER_PER_SQUAD + 1);
    expect(coverAt(right.match.grid, tileOf(0))).toBe(CoverKind.Half);
  });

  it("does not count the Cover wreck of an Exhausted Hero", () => {
    let match = startRound(createMatch(5));
    hero(match, RIGHT_BRUISER).position = { col: 12, row: 8 };
    hero(match, RIGHT_BRUISER).deck = [];
    match = startRound(resolveRound(match, []).match);
    expect(hero(match, RIGHT_BRUISER).exhausted).toBe(true);
    expect(match.placedCover).toEqual([]);
    for (let index = 0; index < MAX_PLACED_COVER_PER_SQUAD; index += 1) {
      match = place(match, SquadId.Right, DEPLOY_COVER, tileOf(index)).match;
    }
    expect(coverAt(match.grid, { col: 12, row: 8 })).toBe(CoverKind.Half);
    expect(match.placedCover).toHaveLength(MAX_PLACED_COVER_PER_SQUAD);
  });

  /** A Left Bruiser at (5,3) attacks the Right Bruiser on (8,3), where Cover was placed. */
  function attackOnCoveredTile(card: number, cover: CoverKind) {
    const placed = place(startRound(createMatch(5)), SquadId.Left, card, tileOf(0)).match;
    expect(coverAt(placed.grid, tileOf(0))).toBe(cover);
    const next = startRound(placed);
    hero(next, LEFT_BRUISER).position = { col: 5, row: 3 };
    hero(next, LEFT_BRUISER).hand = [BRUISER_SLAM_SHOT, 1, 2, 3];
    hero(next, RIGHT_BRUISER).position = tileOf(0);
    const plan: SquadPlan = {
      squad: SquadId.Left,
      heroes: [{ heroId: LEFT_BRUISER, queue: [{ kind: ActionKind.Primary, card: BRUISER_SLAM_SHOT, target: RIGHT_BRUISER }], pitched: [1] }],
    };
    return resolveRound(next, [plan]);
  }

  it("is not destroyed by a normal Attack, and Half Cover reduces it by 1", () => {
    const { match, events } = attackOnCoveredTile(DEPLOY_COVER, CoverKind.Half);
    expect(events.find(({ kind }) => kind === EventKind.AttackHit)).toMatchObject({ damage: 1 });
    expect(events.some(({ kind }) => kind === EventKind.CoverDestroyed)).toBe(false);
    expect(coverAt(match.grid, tileOf(0))).toBe(CoverKind.Half);
  });

  it("Full Cover blocks an Attack", () => {
    decks[HeroClass.Controller]![TEST_BARRICADE] = {
      name: "Test Barricade", type: originalCard.type, energyCost: 1, target: originalCard.target,
      effects: [{ kind: EffectKind.PlaceCover, cover: CoverKind.Full }],
    };
    const { match, events } = attackOnCoveredTile(TEST_BARRICADE, CoverKind.Full);
    expect(coverAgainst(match.grid, { col: 5, row: 3 }, tileOf(0))).toBe(CoverKind.Full);
    expect(events.some(({ kind }) => kind === EventKind.AttackHit)).toBe(false);
    expect(events.some(({ kind }) => kind === EventKind.AttackFailed)).toBe(true);
    expect(coverAt(match.grid, tileOf(0))).toBe(CoverKind.Full);
  });

  it("is destroyed by Breach Charge and then no longer counts", () => {
    const placed = place(startRound(createMatch(5)), SquadId.Left, DEPLOY_COVER, tileOf(0)).match;
    const next = startRound(placed);
    hero(next, LEFT_BRUISER).position = { col: 5, row: 3 };
    hero(next, LEFT_BRUISER).hand = [BRUISER_BREACH_CHARGE, BRUISER_SLAM_SHOT, 1, 2];
    const plan: SquadPlan = {
      squad: SquadId.Left,
      heroes: [{
        heroId: LEFT_BRUISER,
        queue: [{ kind: ActionKind.Primary, card: BRUISER_BREACH_CHARGE, target: LEFT_BRUISER, tile: tileOf(0) }],
        pitched: [BRUISER_SLAM_SHOT, 1],
      }],
    };
    const { match, events } = resolveRound(next, [plan]);
    expect(events.some(({ kind }) => kind === EventKind.CoverDestroyed)).toBe(true);
    expect(coverAt(match.grid, tileOf(0))).toBe(CoverKind.None);
    expect(match.placedCover).toEqual([]);
  });

  describe("on a Prime Zone tile", () => {
    const primeTile: GridPosition = { col: 15, row: 7 };

    it("gives the Prime Zone tile back when a Breach Charge destroys the Cover", () => {
      const placed = place(startRound(createMatch(5)), SquadId.Left, DEPLOY_COVER, primeTile).match;
      expect(tileAt(placed.grid, primeTile)).toBe(TileKind.HalfCover);
      const next = startRound(placed);
      hero(next, LEFT_BRUISER).position = { col: 12, row: 7 };
      hero(next, LEFT_BRUISER).hand = [BRUISER_BREACH_CHARGE, BRUISER_SLAM_SHOT, 1, 2];
      const plan: SquadPlan = {
        squad: SquadId.Left,
        heroes: [{
          heroId: LEFT_BRUISER,
          queue: [{ kind: ActionKind.Primary, card: BRUISER_BREACH_CHARGE, target: LEFT_BRUISER, tile: primeTile }],
          pitched: [BRUISER_SLAM_SHOT, 1],
        }],
      };
      const { match } = resolveRound(next, [plan]);
      expect(tileAt(match.grid, primeTile)).toBe(TileKind.PrimeZone);
    });

    it("gives the Prime Zone tile back when a fourth placement removes the oldest Cover", () => {
      let match = place(startRound(createMatch(5)), SquadId.Left, DEPLOY_COVER, primeTile).match;
      for (let index = 0; index < MAX_PLACED_COVER_PER_SQUAD; index += 1) {
        match = place(match, SquadId.Left, DEPLOY_COVER, tileOf(index)).match;
      }
      expect(tileAt(match.grid, primeTile)).toBe(TileKind.PrimeZone);
    });
  });
});
