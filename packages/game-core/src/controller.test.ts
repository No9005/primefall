import { describe, expect, it } from "vitest";
import { cardIndex, HeroClass } from "./cards";
import { EventKind, SquadId, Visibility } from "./host";
import { areaTiles, buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, PlanIssueKind, type QueuedAction, type SquadPlan, validatePlan } from "./plan";
import { AttackFailReason } from "./host";
import { CoverKind, coverAt, type GridPosition, TileKind, withTile } from "./notstrom-map";
import { resolveRound } from "./resolution";

const CONTROLLER = "left-controller";
const BRUISER = "left-bruiser";
const ENEMY = "right-bruiser";

const idx = (name: string, copy = 0) => cardIndex(HeroClass.Controller, name, copy);
const PRICE_TAG = idx("Price Tag");
const SITE_SURVEY = idx("Site Survey");
const URBAN_RENEWAL = idx("Urban Renewal");
const TEMPORARY_SOLUTION = idx("Temporary Solution");
const HEAVY_METAL = idx("Heavy Metal");
// The second copy of each card serves as Pitch fodder.
const PITCH = [idx("Price Tag", 1), idx("Site Survey", 1)];

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const primary = (card: number, target: string, extra: Partial<QueuedAction> = {}): QueuedAction =>
  ({ kind: ActionKind.Primary, card, target, ...extra }) as QueuedAction;
const move = (card: number, destination: GridPosition): QueuedAction => ({ kind: ActionKind.Move, card, destination });
const planOf = (heroId: string, queue: QueuedAction[], pitched: number[], squad = SquadId.Left): SquadPlan => ({
  squad,
  heroes: [{ heroId, queue, pitched }],
});
/** The Controller plays `card` on `tile` (a card aimed at a tile or an area is confirmed on the Hero itself). */
const onTile = (card: number, tile: GridPosition) => primary(card, CONTROLLER, { tile });

/** Left Controller at (8,3) and the enemy Bruiser at (10,3), both seeing each other. */
function setup(hand: number[]): MatchState {
  const match = startRound(createMatch(5));
  hero(match, CONTROLLER).position = { col: 8, row: 3 };
  hero(match, CONTROLLER).hand = hand;
  hero(match, ENEMY).position = { col: 10, row: 3 };
  hero(match, ENEMY).hand = [0, 1, 2, 3];
  return match;
}

/** Plain floor round `center`, so Cover and Walls of the map do not matter. */
function clearArea(match: MatchState, center: GridPosition, size = 3): void {
  for (const tile of areaTiles(match.grid, center, size)) match.grid = withTile(match.grid, tile, TileKind.Floor);
}

const enemyView = (match: MatchState, squad = SquadId.Left) =>
  buildSquadView(match, squad).enemies.find((enemy) => enemy.id === (squad === SquadId.Left ? ENEMY : CONTROLLER))!;

describe("Price Tag", () => {
  it("deals 1 damage and Marks the target, and a Marked Hero stays Visible out of sight for the next Resolution", () => {
    const match = setup([PRICE_TAG, PITCH[0]!, 1, 5]);
    const { match: after, events } = resolveRound(match, [planOf(CONTROLLER, [primary(PRICE_TAG, ENEMY)], [PITCH[0]!])]);
    expect(events).toContainEqual({
      kind: EventKind.AttackHit, tick: 1, heroId: CONTROLLER, targetId: ENEMY, absorbed: 0, damage: 1, crossfire: 0, card: "Price Tag", distance: expect.any(Number),
    });
    expect(events).toContainEqual({ kind: EventKind.MarkedApplied, tick: 1, heroId: CONTROLLER, targetId: ENEMY, card: "Price Tag" });

    // The enemy is far from every Hero of the Squad but still Visible, and shows as Marked.
    hero(after, ENEMY).position = { col: 19, row: 1 };
    expect(enemyView(after)).toMatchObject({ visibility: Visibility.Visible, marked: true });

    // Marked ends with the next Resolution.
    const next = resolveRound(startRound(after), []).match;
    expect(hero(next, ENEMY).marked).toBe(0);
    expect(enemyView(next).visibility).not.toBe(Visibility.Visible);
  });

  it("makes every hit on a Marked Hero deal 1 more damage, whoever hits", () => {
    const match = setup([PRICE_TAG, PITCH[0]!, 1, 5]);
    hero(match, ENEMY).marked = 2;
    const hit = (plan: SquadPlan) => resolveRound(match, [plan]).events.find(({ kind }) => kind === EventKind.AttackHit)!;
    expect(hit(planOf(CONTROLLER, [primary(PRICE_TAG, ENEMY)], [PITCH[0]!]))).toMatchObject({ damage: 2, marked: 1 });
    // The Bruiser's Handle With Care (2 damage, 3 at Range 1) at Range 2.
    hero(match, BRUISER).position = { col: 8, row: 4 };
    hero(match, BRUISER).hand = [0, 1, 2, 3];
    expect(hit(planOf(BRUISER, [primary(0, ENEMY)], [1]))).toMatchObject({ damage: 3, marked: 1 });
    // Without the mark it is 1 less.
    hero(match, ENEMY).marked = 0;
    expect(hit(planOf(BRUISER, [primary(0, ENEMY)], [1])).marked).toBeUndefined();
  });

  it("deals 2 damage with Scrap", () => {
    const match = setup([PRICE_TAG, PITCH[0]!, 1, 5]);
    hero(match, CONTROLLER).scrap = true;
    const { events } = resolveRound(match, [planOf(CONTROLLER, [primary(PRICE_TAG, ENEMY)], [PITCH[0]!])]);
    expect(events.find(({ kind }) => kind === EventKind.AttackHit)).toMatchObject({ damage: 2 });
  });
});

describe("Site Survey", () => {
  /** The Controller at (9,3), Full Cover on (11,3) between it and the enemy at (13,3). */
  function blockedSight(hand: number[]): MatchState {
    const match = startRound(createMatch(5));
    match.grid = withTile(match.grid, { col: 11, row: 3 }, TileKind.FullCover);
    hero(match, CONTROLLER).position = { col: 9, row: 3 };
    hero(match, CONTROLLER).hand = hand;
    hero(match, ENEMY).position = { col: 13, row: 3 };
    return match;
  }
  const survey = (tile: GridPosition) => planOf(CONTROLLER, [onTile(SITE_SURVEY, tile)], [PITCH[0]!]);

  it("reveals a 3 by 3 area through Full Cover, shows what is in it and updates Ghost memory", () => {
    const match = blockedSight([SITE_SURVEY, PITCH[0]!, 1, 5]);
    expect(enemyView(match).visibility).not.toBe(Visibility.Visible);
    const plan = survey({ col: 13, row: 3 });
    expect(validatePlan(buildSquadView(match, SquadId.Left), plan)).toEqual([]);
    const { match: after, events } = resolveRound(match, [plan]);
    expect(events).toContainEqual({ kind: EventKind.AreaRevealed, tick: 1, heroId: CONTROLLER, to: { col: 13, row: 3 }, amount: 3, card: "Site Survey" });

    const view = buildSquadView(after, SquadId.Left);
    expect(view.revealedAreas).toEqual([{ center: { col: 13, row: 3 }, size: 3, remaining: 2 }]);
    expect(view.enemies.find((enemy) => enemy.id === ENEMY)).toMatchObject({ visibility: Visibility.Visible, position: { col: 13, row: 3 } });
    expect(after.ghosts[SquadId.Left][ENEMY]!.position).toEqual({ col: 13, row: 3 });
    // The enemy Squad learns nothing about the area.
    expect(buildSquadView(after, SquadId.Right).revealedAreas).toEqual([]);
  });

  it("lasts three Resolutions, the one it is played in included", () => {
    const match = blockedSight([SITE_SURVEY, PITCH[0]!, 1, 5]);
    const first = resolveRound(match, [survey({ col: 13, row: 3 })]).match;
    const second = resolveRound(startRound(first), []).match;
    expect(second.revealedAreas).toHaveLength(1);
    const third = resolveRound(startRound(second), []).match;
    expect(third.revealedAreas).toHaveLength(0);
    expect(enemyView(third).visibility).not.toBe(Visibility.Visible);
  });

  it("reveals a 5 by 5 area with Scrap", () => {
    const match = blockedSight([SITE_SURVEY, PITCH[0]!, 1, 5]);
    hero(match, CONTROLLER).scrap = true;
    const { match: after, events } = resolveRound(match, [survey({ col: 13, row: 3 })]);
    expect(events).toContainEqual(expect.objectContaining({ kind: EventKind.AreaRevealed, amount: 5 }));
    expect(buildSquadView(after, SquadId.Left).revealedAreas).toEqual([{ center: { col: 13, row: 3 }, size: 5, remaining: 2 }]);
  });

  it("shows a Hidden enemy inside the area, which stays Hidden", () => {
    const match = blockedSight([SITE_SURVEY, PITCH[0]!, 1, 5]);
    hero(match, ENEMY).hidden = 2;
    const { match: after } = resolveRound(match, [survey({ col: 13, row: 3 })]);
    expect(enemyView(after).visibility).toBe(Visibility.Visible);
    expect(hero(after, ENEMY).hidden).toBeGreaterThan(0);
    // Outside the area a Hidden enemy is still not seen.
    hero(after, ENEMY).position = { col: 16, row: 3 };
    expect(enemyView(after).visibility).not.toBe(Visibility.Visible);
  });

  it("reaches any tile of the map, also far from the Controller and in the Fog", () => {
    const match = blockedSight([SITE_SURVEY, PITCH[0]!, 1, 5]);
    const far = { col: 19, row: 1 };
    hero(match, ENEMY).position = far;
    const plan = survey(far);
    expect(validatePlan(buildSquadView(match, SquadId.Left), plan)).toEqual([]);
    const { match: after } = resolveRound(match, [plan]);
    expect(buildSquadView(after, SquadId.Left).revealedAreas).toHaveLength(1);
    expect(enemyView(after)).toMatchObject({ visibility: Visibility.Visible, position: far });
  });

  it("tells the enemy which area was scanned and for how long, not what is in it", () => {
    const match = blockedSight([SITE_SURVEY, PITCH[0]!, 1, 5]);
    const tile = { col: 13, row: 3 };
    const { match: after } = resolveRound(match, [survey(tile)]);
    const enemySide = buildSquadView(after, SquadId.Right);
    expect(enemySide.scannedAreas).toEqual([{ center: tile, size: 3, remaining: 2 }]);
    expect(buildSquadView(after, SquadId.Left).scannedAreas).toEqual([]);
    expect(enemySide.revealedAreas).toEqual([]);
    // The scanning Squad's Heroes stay as unknown to the enemy as before.
    expect(enemySide.enemies.every((enemy) => enemy.visibility !== Visibility.Visible || enemy.id !== CONTROLLER)).toBe(true);
    // The area ends after three Resolutions.
    const later = [1, 2, 3].reduce((state) => resolveRound(startRound(state), []).match, after);
    expect(buildSquadView(later, SquadId.Right).scannedAreas).toEqual([]);
  });
});

describe("Temporary Solution", () => {
  const PRIME_TILE = { col: 22, row: 12 };

  it("turns an empty tile into Half Cover that stays", () => {
    const match = setup([TEMPORARY_SOLUTION, PITCH[0]!, 1, 5]);
    hero(match, CONTROLLER).position = { col: 20, row: 12 };
    const plan = planOf(CONTROLLER, [onTile(TEMPORARY_SOLUTION, PRIME_TILE)], [PITCH[0]!]);
    const { match: first, events } = resolveRound(match, [plan]);
    expect(events).toEqual([{ kind: EventKind.CoverPlaced, tick: 1, heroId: CONTROLLER, to: PRIME_TILE, card: "Temporary Solution" }]);
    expect(coverAt(first.grid, PRIME_TILE)).toBe(CoverKind.Half);
    expect(buildSquadView(first, SquadId.Left).placedCover).toEqual([PRIME_TILE]);

    // It is still there after further Rounds.
    const second = resolveRound(startRound(resolveRound(startRound(first), []).match), []).match;
    expect(coverAt(second.grid, PRIME_TILE)).toBe(CoverKind.Half);
  });

  it("reaches 5 tiles and fails beyond, on a Wall, on existing Cover and on a tile with a Hero", () => {
    const match = setup([TEMPORARY_SOLUTION, PITCH[0]!, 1, 5]);
    clearArea(match, { col: 12, row: 7 }, 5);
    const near = { col: 8, row: 8 };
    const placed = resolveRound(match, [planOf(CONTROLLER, [onTile(TEMPORARY_SOLUTION, near)], [PITCH[0]!])]);
    expect(placed.events.some(({ kind }) => kind === EventKind.CoverPlaced)).toBe(true);
    for (const tile of [{ col: 8, row: 9 }, { col: 10, row: 5 }, { col: 7, row: 2 }, { col: 10, row: 3 }]) {
      const { match: after, events } = resolveRound(match, [planOf(CONTROLLER, [onTile(TEMPORARY_SOLUTION, tile)], [PITCH[0]!])]);
      expect(events.some(({ kind }) => kind === EventKind.CoverPlaced)).toBe(false);
      expect(after.placedCover).toEqual([]);
    }
    // A Wall cannot be aimed at; a tile of floor can.
    const view = buildSquadView(match, SquadId.Left);
    const plan = (tile: GridPosition) => planOf(CONTROLLER, [onTile(TEMPORARY_SOLUTION, tile)], [PITCH[0]!]);
    expect(validatePlan(view, plan({ col: 10, row: 5 })).map(({ kind }) => kind)).toEqual([PlanIssueKind.BadTarget]);
    expect(validatePlan(view, plan(near))).toEqual([]);
  });

  it("makes Full Cover with Scrap, which Urban Renewal earns earlier in the same Round", () => {
    const match = setup([URBAN_RENEWAL, TEMPORARY_SOLUTION, PITCH[0]!, PITCH[1]!]);
    clearArea(match, { col: 11, row: 6 });
    match.grid = withTile(match.grid, { col: 11, row: 6 }, TileKind.HalfCover);
    clearArea(match, { col: 8, row: 5 }, 1);
    const target = { col: 8, row: 5 };
    const { match: after, events } = resolveRound(match, [
      planOf(CONTROLLER, [onTile(URBAN_RENEWAL, { col: 11, row: 6 }), onTile(TEMPORARY_SOLUTION, target)], PITCH),
    ]);
    expect(events).toContainEqual(expect.objectContaining({ kind: EventKind.ScrapGained, tick: 1, heroId: CONTROLLER }));
    expect(coverAt(after.grid, target)).toBe(CoverKind.Full);
    // Without the Scrap earlier in the Round it is Half Cover.
    const plain = resolveRound(match, [planOf(CONTROLLER, [onTile(TEMPORARY_SOLUTION, target)], PITCH)]).match;
    expect(coverAt(plain.grid, target)).toBe(CoverKind.Half);
  });
});

describe("Urban Renewal", () => {
  const CENTER = { col: 11, row: 3 };

  /** A cleared 3 by 3 area at (11,3) with the enemy at (11,2), the allied Bruiser at (12,4), Half Cover on (10,2) and Full Cover on (12,3). */
  function areaFight(): MatchState {
    const match = setup([URBAN_RENEWAL, PITCH[0]!, 1, 5]);
    clearArea(match, CENTER);
    match.grid = withTile(withTile(match.grid, { col: 10, row: 2 }, TileKind.HalfCover), { col: 12, row: 3 }, TileKind.FullCover);
    hero(match, ENEMY).position = { col: 11, row: 2 };
    hero(match, BRUISER).position = { col: 12, row: 4 };
    return match;
  }
  const throwAt = (tile: GridPosition) => planOf(CONTROLLER, [onTile(URBAN_RENEWAL, tile)], [PITCH[0]!]);

  it("deals 2 damage to every Hero in the 3 by 3 area, allies included, and destroys all the Cover in it", () => {
    const { match: after, events } = resolveRound(areaFight(), [throwAt(CENTER)]);
    const hits = events.filter(({ kind }) => kind === EventKind.AttackHit);
    expect(hits.map(({ targetId, damage, card }) => ({ targetId, damage, card })).sort((a, b) => a.targetId!.localeCompare(b.targetId!))).toEqual([
      { targetId: BRUISER, damage: 2, card: "Urban Renewal" },
      { targetId: ENEMY, damage: 2, card: "Urban Renewal" },
    ]);
    const destroyed = events.filter(({ kind }) => kind === EventKind.CoverDestroyed).map(({ to }) => to);
    expect(destroyed).toHaveLength(2);
    expect(destroyed).toEqual(expect.arrayContaining([{ col: 10, row: 2 }, { col: 12, row: 3 }]));
    expect(coverAt(after.grid, { col: 10, row: 2 })).toBe(CoverKind.None);
    expect(coverAt(after.grid, { col: 12, row: 3 })).toBe(CoverKind.None);
  });

  it("ignores Cover and Line of Sight for the damage: a Hero behind Full Cover is hurt", () => {
    const match = areaFight();
    hero(match, ENEMY).position = { col: 12, row: 3 };
    const hit = resolveRound(match, [throwAt(CENTER)]).events.find(({ kind, targetId }) => kind === EventKind.AttackHit && targetId === ENEMY);
    expect(hit).toMatchObject({ damage: 2 });
  });

  it("gives Scrap when it destroyed Cover, until the end of the Round, and not otherwise", () => {
    const { match: after, events } = resolveRound(areaFight(), [throwAt(CENTER)]);
    expect(events.filter(({ kind }) => kind === EventKind.ScrapGained)).toEqual([{ kind: EventKind.ScrapGained, tick: 1, heroId: CONTROLLER, to: CENTER }]);
    // Scrap lasts to the end of the Round only.
    expect(hero(after, CONTROLLER).scrap).toBe(false);
    expect(buildSquadView(after, SquadId.Left).heroes.find((h) => h.id === CONTROLLER)!.scrap).toBe(false);

    const bare = areaFight();
    clearArea(bare, CENTER);
    expect(resolveRound(bare, [throwAt(CENTER)]).events.some(({ kind }) => kind === EventKind.ScrapGained)).toBe(false);
  });

  it("works within Range 4 and fails beyond it", () => {
    const match = areaFight();
    clearArea(match, { col: 12, row: 3 });
    const far = { col: 13, row: 3 };
    const { events } = resolveRound(match, [throwAt(far)]);
    expect(events.some(({ kind }) => kind === EventKind.AttackHit)).toBe(false);
    expect(resolveRound(match, [throwAt({ col: 14, row: 3 })]).events).toContainEqual(
      expect.objectContaining({ kind: EventKind.AttackFailed, reason: AttackFailReason.OutOfRange }),
    );
  });
});

describe("Heavy Metal", () => {
  const CENTER = { col: 11, row: 3 };

  /** The enemy Bruiser at (10,3) is inside a field at (11,3); in Tick 1 the Controller plays Heavy Metal, in Tick 2 the enemy moves 3 tiles west. */
  function fieldFight(scrap = false): { match: MatchState; plan: SquadPlan[] } {
    const match = setup([HEAVY_METAL, PITCH[0]!, 1, 5]);
    clearArea(match, CENTER, 5);
    hero(match, CONTROLLER).scrap = scrap;
    const plan = [
      planOf(CONTROLLER, [onTile(HEAVY_METAL, CENTER)], [PITCH[0]!]),
      planOf(ENEMY, [{ kind: ActionKind.Wait }, move(0, { col: 7, row: 3 })], [], SquadId.Right),
    ];
    return { match, plan };
  }

  it("makes a Scrap Field that Slows a Hero that starts a Move in it and hurts it once for the Move", () => {
    const { match, plan } = fieldFight();
    const { match: after, events } = resolveRound(match, plan);
    expect(events).toContainEqual({ kind: EventKind.FieldPlaced, tick: 1, heroId: CONTROLLER, to: CENTER, amount: 3, card: "Heavy Metal" });
    // Move 3 slowed to Move 1: the Hero leaves for (9,3) and pays 1 damage.
    expect(hero(after, ENEMY).position).toEqual({ col: 9, row: 3 });
    expect(events).toContainEqual({ kind: EventKind.SlowUsed, tick: 2, heroId: ENEMY });
    expect(events).toContainEqual({
      kind: EventKind.AttackHit, tick: 2, heroId: CONTROLLER, targetId: ENEMY, absorbed: 0, damage: 1, crossfire: 0, card: "Heavy Metal",
    });
  });

  it("does not hurt a Hero that stays, and not one that never touches the field", () => {
    const { match, plan } = fieldFight();
    const waiting = [plan[0]!, planOf(ENEMY, [{ kind: ActionKind.Wait }, { kind: ActionKind.Wait }], [], SquadId.Right)];
    expect(resolveRound(match, waiting).events.some(({ kind }) => kind === EventKind.AttackHit)).toBe(false);
    hero(match, ENEMY).position = { col: 14, row: 5 };
    const walking = [plan[0]!, planOf(ENEMY, [{ kind: ActionKind.Wait }, move(0, { col: 14, row: 8 })], [], SquadId.Right)];
    const { events } = resolveRound(match, walking);
    expect(events.some(({ kind }) => kind === EventKind.AttackHit || kind === EventKind.SlowUsed)).toBe(false);
  });

  it("lasts until the end of the next Resolution, one more with Scrap", () => {
    const plain = resolveRound(fieldFight().match, [fieldFight().plan[0]!]).match;
    expect(plain.scrapFields).toHaveLength(1);
    expect(resolveRound(startRound(plain), []).match.scrapFields).toHaveLength(0);
    const scrap = resolveRound(fieldFight(true).match, [fieldFight(true).plan[0]!]).match;
    const second = resolveRound(startRound(scrap), []).match;
    expect(second.scrapFields).toHaveLength(1);
    expect(resolveRound(startRound(second), []).match.scrapFields).toHaveLength(0);
  });

  it("is known to its own Squad, and to the enemy only while it sees a tile of it", () => {
    const { match, plan } = fieldFight();
    const { match: after } = resolveRound(match, [plan[0]!]);
    expect(buildSquadView(after, SquadId.Left).scrapFields).toEqual([{ center: CENTER, size: 3, remaining: 1, own: true }]);
    // The enemy Bruiser at (10,3) stands in it and sees it.
    expect(buildSquadView(after, SquadId.Right).scrapFields).toEqual([{ center: CENTER, size: 3, remaining: 1, own: false }]);
    for (const enemy of after.heroes.filter((candidate) => candidate.squad === SquadId.Right)) enemy.position = { col: 21, row: 12 };
    expect(buildSquadView(after, SquadId.Right).scrapFields).toEqual([]);
  });

  it("can only be aimed at a tile within Range 4", () => {
    const match = setup([HEAVY_METAL, PITCH[0]!, 1, 5]);
    clearArea(match, { col: 14, row: 3 }, 3);
    const out = resolveRound(match, [planOf(CONTROLLER, [onTile(HEAVY_METAL, { col: 13, row: 3 })], [PITCH[0]!])]);
    expect(out.match.scrapFields).toEqual([]);
    expect(out.events).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: CONTROLLER }]);
    const view = buildSquadView(match, SquadId.Left);
    expect(validatePlan(view, planOf(CONTROLLER, [primary(HEAVY_METAL, ENEMY)], [PITCH[0]!])).map(({ kind }) => kind)).toEqual([PlanIssueKind.BadTarget]);
  });
});
