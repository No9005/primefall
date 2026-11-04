import { describe, expect, it } from "vitest";
import { EventKind, SquadId, Visibility } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, PlanIssueKind, type QueuedAction, type SquadPlan, validatePlan } from "./plan";
import { CoverKind, coverAt, type GridPosition, REACTOR_DECK, TileKind, tileAt, withTile } from "./reactor-deck";
import { resolveRound } from "./resolution";

const CONTROLLER = "left-controller";
const BRUISER = "left-bruiser";
const ASSASSIN = "left-assassin";
const ENEMY = "right-bruiser";

// Controller cards: 2 Tag Round, 3 Shock Pulse, 4 Scout Drone, 6 Aegis Protocol, 7 Fortify, 8 Deploy Cover,
// 10 Gravity Snare, 11 Overwatch Uplink; 0 Pulse Bolt and 1 Pulse Bolt serve as Pitch fodder.
const PULSE_BOLT = 0;
const TAG_ROUND = 2;
const SHOCK_PULSE = 3;
const SCOUT_DRONE = 4;
const AEGIS_PROTOCOL = 6;
const FORTIFY = 7;
const DEPLOY_COVER = 8;
const GRAVITY_SNARE = 10;
const OVERWATCH_UPLINK = 11;

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const primary = (card: number, target: string, extra: Partial<QueuedAction> = {}): QueuedAction =>
  ({ kind: ActionKind.Primary, card, target, ...extra }) as QueuedAction;
const move = (card: number, destination: GridPosition): QueuedAction => ({ kind: ActionKind.Move, card, destination });
const planOf = (heroId: string, queue: QueuedAction[], pitched: number[], squad = SquadId.Left): SquadPlan => ({
  squad,
  heroes: [{ heroId, queue, pitched }],
});

/** Left Controller at (8,5) and the enemy Bruiser at (10,5), both seeing each other. */
function setup(hand: number[]): MatchState {
  const match = startRound(createMatch(5));
  hero(match, CONTROLLER).position = { col: 8, row: 5 };
  hero(match, CONTROLLER).hand = hand;
  hero(match, ENEMY).position = { col: 10, row: 5 };
  hero(match, ENEMY).hand = [0, 1, 2, 3];
  return match;
}

const enemyView = (match: MatchState, squad = SquadId.Left) =>
  buildSquadView(match, squad).enemies.find((enemy) => enemy.id === (squad === SquadId.Left ? ENEMY : CONTROLLER))!;

describe("Tag Round", () => {
  it("deals 1 damage and Marks the target, and a Marked Hero stays Visible out of sight for the next Resolution", () => {
    const match = setup([TAG_ROUND, PULSE_BOLT, 1, 5]);
    const { match: after, events } = resolveRound(match, [planOf(CONTROLLER, [primary(TAG_ROUND, ENEMY)], [PULSE_BOLT])]);
    expect(events).toContainEqual({
      kind: EventKind.AttackHit, tick: 1, heroId: CONTROLLER, targetId: ENEMY, absorbed: 0, damage: 1, card: "Tag Round", distance: expect.any(Number),
    });
    expect(events).toContainEqual({ kind: EventKind.MarkedApplied, tick: 1, heroId: CONTROLLER, targetId: ENEMY, card: "Tag Round" });
    expect(hero(after, ENEMY).slow).toBe(0);

    // The enemy is far from every Hero of the Squad but still Visible, and shows as Marked.
    hero(after, ENEMY).position = { col: 19, row: 1 };
    const seen = enemyView(after);
    expect(seen).toMatchObject({ visibility: Visibility.Visible, marked: true });

    // Marked ends with the next Resolution.
    const next = resolveRound(startRound(after), []).match;
    expect(hero(next, ENEMY).marked).toBe(0);
    expect(enemyView(next).visibility).not.toBe(Visibility.Visible);
  });

  it("Overdrive also Slows the target and Exiles the card", () => {
    const match = setup([TAG_ROUND, PULSE_BOLT, 1, 5]);
    const { match: after, events } = resolveRound(match, [
      planOf(CONTROLLER, [primary(TAG_ROUND, ENEMY, { overdrive: true })], [PULSE_BOLT]),
    ]);
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.AttackHit, EventKind.SlowApplied, EventKind.MarkedApplied]);
    expect(hero(after, ENEMY).slow).toBeGreaterThan(0);
    expect(hero(after, CONTROLLER).exile).toContain(TAG_ROUND);
  });
});

describe("Pulse Bolt, Shock Pulse and Gravity Snare", () => {
  it("Pulse Bolt deals 2 damage", () => {
    const match = setup([PULSE_BOLT, 1, 5, 9]);
    const { events } = resolveRound(match, [planOf(CONTROLLER, [primary(PULSE_BOLT, ENEMY)], [1])]);
    expect(events).toEqual([
      { kind: EventKind.AttackHit, tick: 1, heroId: CONTROLLER, targetId: ENEMY, absorbed: 0, damage: 2, card: "Pulse Bolt", distance: expect.any(Number) },
    ]);
  });

  it("Shock Pulse deals 1 damage and Slows", () => {
    const match = setup([SHOCK_PULSE, PULSE_BOLT, 1, 5]);
    const { match: after, events } = resolveRound(match, [planOf(CONTROLLER, [primary(SHOCK_PULSE, ENEMY)], [PULSE_BOLT])]);
    expect(events[0]).toMatchObject({ kind: EventKind.AttackHit, damage: 1 });
    expect(hero(after, ENEMY).slow).toBeGreaterThan(0);
  });

  it("Gravity Snare costs 2 Energy and Slows a visible enemy", () => {
    const match = setup([GRAVITY_SNARE, PULSE_BOLT, 1, 5]);
    const { match: after } = resolveRound(match, [planOf(CONTROLLER, [primary(GRAVITY_SNARE, ENEMY)], [PULSE_BOLT, 1])]);
    expect(hero(after, ENEMY).slow).toBeGreaterThan(0);
    const view = buildSquadView(match, SquadId.Left);
    const issues = validatePlan(view, planOf(CONTROLLER, [primary(GRAVITY_SNARE, ENEMY)], [PULSE_BOLT]));
    expect(issues.map(({ kind }) => kind)).toEqual([PlanIssueKind.NotEnoughEnergy]);
  });
});

describe("Scout Drone", () => {
  /** The Controller at (9,5), Full Cover on (11,5) between it and the enemy at (13,5). */
  function blockedSight(hand: number[]): MatchState {
    const match = startRound(createMatch(5));
    match.grid = withTile(match.grid, { col: 11, row: 5 }, TileKind.FullCover);
    hero(match, CONTROLLER).position = { col: 9, row: 5 };
    hero(match, CONTROLLER).hand = hand;
    hero(match, ENEMY).position = { col: 13, row: 5 };
    return match;
  }

  it("reveals a 3 by 3 area through Full Cover, shows what is in it and updates Ghost memory", () => {
    const match = blockedSight([SCOUT_DRONE, PULSE_BOLT, 1, 5]);
    expect(enemyView(match).visibility).not.toBe(Visibility.Visible);
    const plan = planOf(CONTROLLER, [primary(SCOUT_DRONE, CONTROLLER, { tile: { col: 13, row: 5 } })], [PULSE_BOLT]);
    expect(validatePlan(buildSquadView(match, SquadId.Left), plan)).toEqual([]);
    const { match: after, events } = resolveRound(match, [plan]);
    expect(events).toContainEqual({ kind: EventKind.AreaRevealed, tick: 1, heroId: CONTROLLER, to: { col: 13, row: 5 }, amount: 3, card: "Scout Drone" });

    const view = buildSquadView(after, SquadId.Left);
    expect(view.revealedAreas).toEqual([{ center: { col: 13, row: 5 }, size: 3, remaining: 1 }]);
    expect(view.enemies.find((enemy) => enemy.id === ENEMY)).toMatchObject({ visibility: Visibility.Visible, position: { col: 13, row: 5 } });
    expect(after.ghosts[SquadId.Left][ENEMY]!.position).toEqual({ col: 13, row: 5 });
    // The enemy Squad learns nothing about the area.
    expect(buildSquadView(after, SquadId.Right).revealedAreas).toEqual([]);
  });

  it("does not show an enemy just outside the 3 by 3 area, but the 5 by 5 Overdrive does", () => {
    const match = blockedSight([SCOUT_DRONE, PULSE_BOLT, 1, 5]);
    const centre = { col: 11, row: 5 };
    const standard = resolveRound(match, [planOf(CONTROLLER, [primary(SCOUT_DRONE, CONTROLLER, { tile: centre })], [PULSE_BOLT])]);
    expect(enemyView(standard.match).visibility).not.toBe(Visibility.Visible);
    const overdrive = resolveRound(match, [
      planOf(CONTROLLER, [primary(SCOUT_DRONE, CONTROLLER, { tile: centre, overdrive: true })], [PULSE_BOLT]),
    ]);
    expect(enemyView(overdrive.match).visibility).toBe(Visibility.Visible);
    expect(hero(overdrive.match, CONTROLLER).exile).toContain(SCOUT_DRONE);
    expect(buildSquadView(overdrive.match, SquadId.Left).revealedAreas[0]!.size).toBe(5);
  });

  it("lasts two Resolutions, the one it is played in included", () => {
    const match = blockedSight([SCOUT_DRONE, PULSE_BOLT, 1, 5]);
    const tile = { col: 13, row: 5 };
    const first = resolveRound(match, [planOf(CONTROLLER, [primary(SCOUT_DRONE, CONTROLLER, { tile })], [PULSE_BOLT])]).match;
    expect(first.revealedAreas).toHaveLength(1);
    const second = resolveRound(startRound(first), []).match;
    expect(second.revealedAreas).toHaveLength(0);
    expect(enemyView(second).visibility).not.toBe(Visibility.Visible);
  });

  it("does not reveal a Hidden enemy and fails beyond Range 4", () => {
    const match = blockedSight([SCOUT_DRONE, PULSE_BOLT, 1, 5]);
    hero(match, ENEMY).hidden = 2;
    const tile = { col: 13, row: 5 };
    const inRange = resolveRound(match, [planOf(CONTROLLER, [primary(SCOUT_DRONE, CONTROLLER, { tile })], [PULSE_BOLT])]);
    expect(enemyView(inRange.match).visibility).not.toBe(Visibility.Visible);

    hero(match, ENEMY).hidden = 0;
    const far = { col: 14, row: 5 };
    const tooFar = resolveRound(match, [planOf(CONTROLLER, [primary(SCOUT_DRONE, CONTROLLER, { tile: far })], [PULSE_BOLT])]);
    expect(tooFar.events).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: CONTROLLER }]);
    expect(tooFar.match.revealedAreas).toEqual([]);
  });
});

describe("Aegis Protocol", () => {
  const hand = [AEGIS_PROTOCOL, PULSE_BOLT, 1, 5];

  it("gives an allied Hero Shield 3", () => {
    const { events } = resolveRound(setup(hand), [planOf(CONTROLLER, [primary(AEGIS_PROTOCOL, BRUISER)], [PULSE_BOLT])]);
    expect(events).toEqual([{ kind: EventKind.ShieldGained, tick: 1, heroId: BRUISER, amount: 3, card: "Aegis Protocol", casterId: CONTROLLER }]);
  });

  it("Overdrive gives two allied Heroes Shield 3 each and Exiles the card", () => {
    const match = setup(hand);
    const plan = planOf(CONTROLLER, [primary(AEGIS_PROTOCOL, BRUISER, { overdrive: true, secondTarget: ASSASSIN })], [PULSE_BOLT]);
    expect(validatePlan(buildSquadView(match, SquadId.Left), plan)).toEqual([]);
    const { match: after, events } = resolveRound(match, [plan]);
    expect(events).toEqual([
      { kind: EventKind.ShieldGained, tick: 1, heroId: BRUISER, amount: 3, card: "Aegis Protocol", overdrive: true, casterId: CONTROLLER },
      { kind: EventKind.ShieldGained, tick: 1, heroId: ASSASSIN, amount: 3, card: "Aegis Protocol", overdrive: true, casterId: CONTROLLER },
    ]);
    expect(hero(after, CONTROLLER).exile).toContain(AEGIS_PROTOCOL);
  });

  it("Overdrive needs a second, different allied Hero", () => {
    const match = setup(hand);
    const view = buildSquadView(match, SquadId.Left);
    for (const secondTarget of [undefined, BRUISER, CONTROLLER, ENEMY]) {
      const plan = planOf(
        CONTROLLER,
        [primary(AEGIS_PROTOCOL, BRUISER, { overdrive: true, ...(secondTarget ? { secondTarget } : {}) })],
        [PULSE_BOLT],
      );
      expect(validatePlan(view, plan).map(({ kind }) => kind)).toEqual([PlanIssueKind.BadTarget]);
      // The simulation is safe on its own: nobody gains Shield.
      const { events } = resolveRound(match, [plan]);
      expect(events).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: CONTROLLER }]);
    }
  });
});

describe("Placed Cover", () => {
  const PRIME_TILE = { col: 14, row: 7 };

  it("Deploy Cover turns an empty tile into Half Cover for two Resolutions and then restores the tile", () => {
    const match = setup([DEPLOY_COVER, PULSE_BOLT, 1, 5]);
    hero(match, CONTROLLER).position = { col: 13, row: 5 };
    const tile = PRIME_TILE;
    const plan = planOf(CONTROLLER, [primary(DEPLOY_COVER, CONTROLLER, { tile })], [PULSE_BOLT]);
    const { match: first, events } = resolveRound(match, [plan]);
    expect(events).toEqual([{ kind: EventKind.CoverPlaced, tick: 1, heroId: CONTROLLER, to: tile, card: "Deploy Cover" }]);
    expect(coverAt(first.grid, tile)).toBe(CoverKind.Half);
    expect(buildSquadView(first, SquadId.Left).placedCover).toEqual([tile]);

    // It protects through the next Round's planning and Resolution, then it is gone.
    const nextRound = startRound(first);
    expect(coverAt(nextRound.grid, tile)).toBe(CoverKind.Half);
    const second = resolveRound(nextRound, []).match;
    expect(coverAt(second.grid, tile)).toBe(CoverKind.None);
    // The Prime Zone tile is back, not plain floor.
    expect(tileAt(second.grid, tile)).toBe(TileKind.PrimeZone);
    expect(second.placedCover).toEqual([]);
    expect(buildSquadView(second, SquadId.Left).placedCover).toEqual([]);
  });

  it("Deploy Cover fails on a Wall, on existing Cover and on a tile with a Hero", () => {
    const match = setup([DEPLOY_COVER, PULSE_BOLT, 1, 5]);
    for (const tile of [{ col: 5, row: 6 }, { col: 6, row: 4 }, { col: 8, row: 2 }, { col: 10, row: 5 }]) {
      const { match: after, events } = resolveRound(match, [planOf(CONTROLLER, [primary(DEPLOY_COVER, CONTROLLER, { tile })], [PULSE_BOLT])]);
      expect(events.some(({ kind }) => kind === EventKind.CoverPlaced)).toBe(false);
      expect(after.placedCover).toEqual([]);
      expect(after.grid).toEqual(match.grid);
    }
    const plan = planOf(CONTROLLER, [primary(DEPLOY_COVER, CONTROLLER, { tile: { col: 5, row: 6 } })], [PULSE_BOLT]);
    expect(validatePlan(buildSquadView(match, SquadId.Left), plan).map(({ kind }) => kind)).toEqual([PlanIssueKind.BadTarget]);
  });

  it("Half Cover placed in a Tick reduces damage from then on", () => {
    // The enemy Bruiser (Range 3) shoots the Controller in Tick 2; Deploy Cover in Tick 1 covers the Controller's new tile.
    const match = setup([DEPLOY_COVER, PULSE_BOLT, 1, 5]);
    hero(match, ENEMY).position = { col: 11, row: 5 };
    hero(match, ENEMY).hand = [0, 1, 2, 3];
    const target = { col: 8, row: 5 };
    expect(coverAt(match.grid, target)).toBe(CoverKind.None);
    // Cover cannot be placed under a Hero, so the Controller steps off and the cover goes behind it.
    const plan = planOf(CONTROLLER, [primary(DEPLOY_COVER, CONTROLLER, { tile: { col: 7, row: 5 } }), move(PULSE_BOLT, { col: 7, row: 5 })], [1]);
    const { match: after, events } = resolveRound(match, [plan]);
    expect(events.some(({ kind }) => kind === EventKind.CoverPlaced)).toBe(true);
    // The Controller moved onto the new Cover in Tick 2 and stands on Half Cover.
    expect(coverAt(after.grid, hero(after, CONTROLLER).position)).toBe(CoverKind.Half);
  });

  it("Fortify puts Half Cover under an allied Hero within Range 3", () => {
    const match = setup([FORTIFY, PULSE_BOLT, 1, 5]);
    hero(match, BRUISER).position = { col: 9, row: 4 };
    const { match: after, events } = resolveRound(match, [planOf(CONTROLLER, [primary(FORTIFY, BRUISER)], [PULSE_BOLT])]);
    expect(events).toEqual([{ kind: EventKind.CoverPlaced, tick: 1, heroId: CONTROLLER, to: { col: 9, row: 4 }, card: "Fortify" }]);
    expect(coverAt(after.grid, { col: 9, row: 4 })).toBe(CoverKind.Half);
    expect(hero(after, BRUISER).position).toEqual({ col: 9, row: 4 });
  });

  it("Fortify fails beyond Range 3 and on a tile that already has Cover", () => {
    const match = setup([FORTIFY, PULSE_BOLT, 1, 5]);
    const far = resolveRound(match, [planOf(CONTROLLER, [primary(FORTIFY, BRUISER)], [PULSE_BOLT])]);
    expect(far.events).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: CONTROLLER }]);
    hero(match, BRUISER).position = { col: 6, row: 4 };
    const covered = resolveRound(match, [planOf(CONTROLLER, [primary(FORTIFY, BRUISER)], [PULSE_BOLT])]);
    expect(covered.events).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: CONTROLLER }]);
    expect(covered.match.placedCover).toEqual([]);
  });

  it("an enemy Squad sees placed Cover only on tiles it sees", () => {
    const match = setup([DEPLOY_COVER, PULSE_BOLT, 1, 5]);
    const tile = { col: 8, row: 3 };
    const { match: after } = resolveRound(match, [planOf(CONTROLLER, [primary(DEPLOY_COVER, CONTROLLER, { tile })], [PULSE_BOLT])]);
    expect(buildSquadView(after, SquadId.Left).placedCover).toEqual([tile]);
    // The right Bruiser at (10,5) sees (8,3).
    expect(buildSquadView(after, SquadId.Right).placedCover).toEqual([tile]);
    hero(after, ENEMY).position = { col: 19, row: 1 };
    for (const other of after.heroes.filter((candidate) => candidate.squad === SquadId.Right)) other.position = { col: 19, row: 9 };
    expect(buildSquadView(after, SquadId.Right).placedCover).toEqual([]);
  });

  it("destroyed placed Cover does not come back when it would expire", () => {
    const match = setup([DEPLOY_COVER, PULSE_BOLT, 1, 5]);
    const tile = { col: 8, row: 3 };
    const { match: placed } = resolveRound(match, [planOf(CONTROLLER, [primary(DEPLOY_COVER, CONTROLLER, { tile })], [PULSE_BOLT])]);
    placed.grid = withTile(placed.grid, tile, TileKind.Floor);
    const later = resolveRound(startRound(resolveRound(startRound(placed), []).match), []).match;
    expect(coverAt(later.grid, tile)).toBe(CoverKind.None);
    expect(tileAt(REACTOR_DECK, tile)).toBe(TileKind.Floor);
  });
});

describe("Overwatch Uplink", () => {
  // The enemy Bruiser stands on Half Cover at (6,4); the allied Bruiser attacks it from (9,4) with Slam Shot (card 0, 2 damage).
  function coverFight(): MatchState {
    const match = setup([OVERWATCH_UPLINK, PULSE_BOLT, 1, 5]);
    hero(match, BRUISER).position = { col: 9, row: 4 };
    hero(match, BRUISER).hand = [0, 1, 2, 3];
    hero(match, ENEMY).position = { col: 6, row: 4 };
    return match;
  }
  const bruiserPlan = (queue: QueuedAction[], pitched: number[]): SquadPlan => ({
    squad: SquadId.Left,
    heroes: [
      { heroId: CONTROLLER, queue: [primary(OVERWATCH_UPLINK, BRUISER)], pitched: [PULSE_BOLT] },
      { heroId: BRUISER, queue, pitched },
    ],
  });

  it("lets the ally attack an enemy in Half Cover without the damage reduction", () => {
    const withoutUplink = resolveRound(coverFight(), [
      { squad: SquadId.Left, heroes: [{ heroId: BRUISER, queue: [primary(0, ENEMY)], pitched: [1] }] },
    ]);
    expect(withoutUplink.events[0]).toMatchObject({ kind: EventKind.AttackHit, damage: 1 });

    const { match: after, events } = resolveRound(coverFight(), [bruiserPlan([primary(0, ENEMY)], [1])]);
    expect(events).toContainEqual({ kind: EventKind.CoverReductionIgnored, tick: 1, heroId: CONTROLLER, targetId: BRUISER, card: "Overwatch Uplink" });
    expect(events.find(({ kind }) => kind === EventKind.AttackHit)).toMatchObject({ heroId: BRUISER, damage: 2 });
    // It ends with the Round.
    expect(hero(after, BRUISER).ignoresHalfCover).toBe(false);
  });

  it("does not change Attacks resolved in earlier Ticks of the Round", () => {
    const match = coverFight();
    const plan: SquadPlan = {
      squad: SquadId.Left,
      heroes: [
        // The Uplink is the Controller's second action; the Bruiser attacks in Tick 1 and again in Tick 2.
        { heroId: CONTROLLER, queue: [move(1, { col: 8, row: 4 }), primary(OVERWATCH_UPLINK, BRUISER)], pitched: [PULSE_BOLT] },
        { heroId: BRUISER, queue: [primary(0, ENEMY), primary(1, ENEMY)], pitched: [2, 3] },
      ],
    };
    const hits = resolveRound(match, [plan]).events.filter(({ kind }) => kind === EventKind.AttackHit);
    expect(hits.map(({ tick, damage }) => ({ tick, damage }))).toEqual([
      { tick: 1, damage: 1 },
      { tick: 2, damage: 2 },
    ]);
  });
});
