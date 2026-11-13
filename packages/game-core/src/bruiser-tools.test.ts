import { afterAll, describe, expect, it } from "vitest";
import { type CardDefinition, charge, HERO_DECKS, HeroClass, pull, wreckingBlow } from "./cards";
import { withFullCover } from "./full-cover-fixture";
import { AttackFailReason, EventKind, SquadId, Visibility } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan } from "./plan";
import { CoverKind, coverAt, type GridPosition, TileKind, tileAt } from "./reactor-deck";
import { getSquadEvents, resolveRound } from "./resolution";

// Charge, Pull and Wrecking Blow are not in a Deck yet (the deck ticket), so the tests append them to the Bruiser's list.
const BRUISER_DECK = HERO_DECKS[HeroClass.Bruiser] as CardDefinition[];
const DECK_SIZE = BRUISER_DECK.length;
afterAll(() => {
  BRUISER_DECK.length = DECK_SIZE;
});
function withTestCards(): { charge: number; pull: number; wreckingBlow: number } {
  if (BRUISER_DECK.length === DECK_SIZE) BRUISER_DECK.push(charge, pull, wreckingBlow);
  return { charge: DECK_SIZE, pull: DECK_SIZE + 1, wreckingBlow: DECK_SIZE + 2 };
}

const BRUISER = "left-bruiser";
const ENEMY = "right-bruiser";
const BLOCKER = "right-controller";
const SLAM_SHOT = 0;
const SECOND_SLAM_SHOT = 1;
const PITCH = [2, 3, 6];

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;

/** A Round with the Bruiser and the enemy Bruiser placed; the other Heroes stay at their spawn, out of sight. */
function setup(bruiser: GridPosition, enemy: GridPosition): MatchState {
  const match = startRound(createMatch(5));
  hero(match, BRUISER).position = bruiser;
  hero(match, ENEMY).position = enemy;
  return match;
}

/** The Bruiser plays the actions in order, paying with pitched cards. */
function bruiserPlan(match: MatchState, cards: number[], queue: QueuedAction[]): SquadPlan {
  hero(match, BRUISER).hand = [...cards, ...PITCH];
  return { squad: SquadId.Left, heroes: [{ heroId: BRUISER, queue, pitched: PITCH.slice(0, queue.length) }] };
}

const use = (card: number, target = ENEMY): QueuedAction => ({ kind: ActionKind.Primary, card, target });
const hits = <T extends { kind: EventKind }>(events: readonly T[]) => events.filter(({ kind }) => kind === EventKind.AttackHit);
/** Deck Damage the enemy took. */
const damageTaken = (before: MatchState, after: MatchState) => hero(before, ENEMY).deck.length - hero(after, ENEMY).deck.length;

describe("Charge", () => {
  it("moves up to 3 tiles toward the enemy and ends next to it", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 5, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [cards.charge], [use(cards.charge)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 4, row: 1 });
    expect(events.filter(({ kind }) => kind === EventKind.Step)).toHaveLength(2);
    expect(events.some(({ kind }) => kind === EventKind.Charged)).toBe(true);
  });

  it("covers at most 3 tiles when the enemy is further away", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 8, row: 1 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.charge], [use(cards.charge)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 5, row: 1 });
  });

  it("stops early before a Hero in the way", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    hero(match, BLOCKER).position = { col: 4, row: 1 };
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.charge], [use(cards.charge)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 3, row: 1 });
  });

  it("stops early before a Full Cover tile and still gives its Shield", () => {
    const cards = withTestCards();
    const match = withFullCover(setup({ col: 2, row: 1 }, { col: 6, row: 2 }), { col: 3, row: 2 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [cards.charge], [use(cards.charge)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 2, row: 1 });
    expect(events.some(({ kind }) => kind === EventKind.ShieldGained)).toBe(true);
  });

  it("does not cut a corner of the wall at (10, 4)", () => {
    const cards = withTestCards();
    const match = setup({ col: 9, row: 4 }, { col: 12, row: 1 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.charge], [use(cards.charge)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 9, row: 4 });
  });

  it("gives Shield 1 that is gone at the end of the Round", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 5, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [cards.charge], [use(cards.charge)])]);
    expect(events.find(({ kind }) => kind === EventKind.ShieldGained)).toMatchObject({ heroId: BRUISER, amount: 1, card: "Charge" });
    expect(hero(after, BRUISER).shield).toBe(0);
    expect(hero(after, BRUISER).chargeBonus).toBeUndefined();
  });

  it("makes the next Attack at Range 1 deal +1, once: a Slam Shot after a Charge deals 4, the next one 3", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 5, row: 1 });
    const plan = bruiserPlan(match, [cards.charge, SLAM_SHOT, SECOND_SLAM_SHOT], [use(cards.charge), use(SLAM_SHOT), use(SECOND_SLAM_SHOT)]);
    const { events } = resolveRound(match, [plan]);
    expect(hits(events).map(({ damage }) => damage)).toEqual([4, 3]);
  });

  it("does not spend the bonus on an Attack at Range 2", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 7, row: 1 });
    const plan = bruiserPlan(match, [cards.charge, SLAM_SHOT], [use(cards.charge), use(SLAM_SHOT)]);
    const { match: after } = resolveRound(match, [plan]);
    // The Charge ends at Range 2 from the enemy; the Slam Shot there deals 2.
    expect(hero(after, BRUISER).position).toEqual({ col: 5, row: 1 });
    expect(damageTaken(match, after)).toBe(2);
  });

  it("misses an enemy that is not visible", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 12, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [cards.charge], [use(cards.charge)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 2, row: 1 });
    expect(events.some(({ kind }) => kind === EventKind.ActionFailed)).toBe(true);
    expect(events.some(({ kind }) => kind === EventKind.ShieldGained)).toBe(false);
  });
});

describe("Pull", () => {
  it("moves the enemy 2 tiles toward the Bruiser", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [cards.pull], [use(cards.pull)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 4, row: 1 });
    expect(events.filter(({ kind }) => kind === EventKind.Pull)).toHaveLength(2);
  });

  it("only reaches an enemy within Range 4", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 7, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [cards.pull], [use(cards.pull)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 7, row: 1 });
    expect(events.some(({ kind }) => kind === EventKind.ActionFailed)).toBe(true);
  });

  it("stops next to the Bruiser", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 4, row: 1 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.pull], [use(cards.pull)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 3, row: 1 });
  });

  it("stops before another Hero", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    hero(match, BLOCKER).position = { col: 4, row: 1 };
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.pull], [use(cards.pull)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 5, row: 1 });
  });

  it("stops before a Full Cover tile", () => {
    const cards = withTestCards();
    const match = withFullCover(setup({ col: 2, row: 1 }, { col: 6, row: 2 }), { col: 5, row: 1 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.pull], [use(cards.pull)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 6, row: 2 });
  });

  it("does not slide the enemy around a corner of the wall at (10, 4)", () => {
    const cards = withTestCards();
    const match = setup({ col: 12, row: 1 }, { col: 9, row: 4 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.pull], [use(cards.pull)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 9, row: 4 });
  });

  it("can pull an enemy out of the Prime Zone", () => {
    const cards = withTestCards();
    const match = setup({ col: 17, row: 13 }, { col: 20, row: 13 });
    expect(tileAt(match.grid, hero(match, ENEMY).position)).toBe(TileKind.PrimeZone);
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.pull], [use(cards.pull)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 18, row: 13 });
    expect(tileAt(after.grid, hero(after, ENEMY).position)).not.toBe(TileKind.PrimeZone);
  });
});

describe("Slam Shot at Range 1 to 2", () => {
  it("deals 3 at Range 1 and 2 at Range 2", () => {
    const close = setup({ col: 2, row: 1 }, { col: 3, row: 1 });
    const closeResult = resolveRound(close, [bruiserPlan(close, [SLAM_SHOT], [use(SLAM_SHOT)])]);
    expect(damageTaken(close, closeResult.match)).toBe(3);
    const far = setup({ col: 2, row: 1 }, { col: 4, row: 1 });
    const farResult = resolveRound(far, [bruiserPlan(far, [SLAM_SHOT], [use(SLAM_SHOT)])]);
    expect(damageTaken(far, farResult.match)).toBe(2);
  });

  it("does not reach Range 3", () => {
    const match = setup({ col: 2, row: 1 }, { col: 5, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [SLAM_SHOT], [use(SLAM_SHOT)])]);
    expect(damageTaken(match, after)).toBe(0);
    expect(events.find(({ kind }) => kind === EventKind.AttackFailed)?.reason).toBe(AttackFailReason.OutOfRange);
  });
});

describe("Wrecking Blow", () => {
  it("deals 2 damage and destroys Half Cover on the target tile", () => {
    const cards = withTestCards();
    // (7,2) is Half Cover on the Reactor Deck.
    const match = setup({ col: 5, row: 2 }, { col: 7, row: 2 });
    expect(coverAt(match.grid, { col: 7, row: 2 })).toBe(CoverKind.Half);
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [cards.wreckingBlow], [use(cards.wreckingBlow)])]);
    // The Cover protected against the damage in its Tick (2 - 1).
    expect(damageTaken(match, after)).toBe(1);
    expect(coverAt(after.grid, { col: 7, row: 2 })).toBe(CoverKind.None);
    expect(events.find(({ kind }) => kind === EventKind.CoverDestroyed)).toMatchObject({ to: { col: 7, row: 2 }, card: "Wrecking Blow" });
  });

  it("destroys Full Cover on the target tile", () => {
    const cards = withTestCards();
    const match = withFullCover(setup({ col: 3, row: 1 }, { col: 4, row: 1 }), { col: 4, row: 1 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.wreckingBlow], [use(cards.wreckingBlow)])]);
    expect(damageTaken(match, after)).toBe(2);
    expect(coverAt(after.grid, { col: 4, row: 1 })).toBe(CoverKind.None);
  });

  it("destroys Placed Cover and frees its place for the Squad", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 4, row: 1 });
    match.grid = { ...match.grid, tiles: match.grid.tiles.map((line, row) => line.map((tile, col) => (row === 1 && col === 4 ? TileKind.HalfCover : tile))) };
    match.placedCover.push({ squad: SquadId.Right, position: { col: 4, row: 1 } });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [cards.wreckingBlow], [use(cards.wreckingBlow)])]);
    expect(after.placedCover).toHaveLength(0);
  });
});

describe("What the events of a Pull, a Charge and a hit tell a Squad", () => {
  const pulls = (squad: SquadId, resolution: ReturnType<typeof resolveRound>) => getSquadEvents(squad, resolution).filter(({ kind }) => kind === EventKind.Pull);

  it("names the Hero that pulled and both tiles of every slide to both Squads when the Bruiser is in sight", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    const resolution = resolveRound(match, [bruiserPlan(match, [cards.pull], [use(cards.pull)])]);
    for (const squad of [SquadId.Left, SquadId.Right]) {
      expect(pulls(squad, resolution)).toEqual([
        expect.objectContaining({ heroId: ENEMY, casterId: BRUISER, from: { col: 6, row: 1 }, to: { col: 5, row: 1 } }),
        expect.objectContaining({ heroId: ENEMY, casterId: BRUISER, from: { col: 5, row: 1 }, to: { col: 4, row: 1 } }),
      ]);
    }
  });

  it("does not tell the Squad of the pulled Hero who pulled it when it cannot see that Hero, but still shows the slide", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    // A Hidden Bruiser is not seen on a tile in sight (it is only shown inside a Scout Drone area).
    hero(match, BRUISER).hidden = 2;
    const resolution = resolveRound(match, [bruiserPlan(match, [cards.pull], [use(cards.pull)])]);
    expect(hero(resolution.match, BRUISER).hidden).toBeGreaterThan(0);
    const toVictim = pulls(SquadId.Right, resolution);
    expect(toVictim).toHaveLength(2);
    for (const event of toVictim) {
      expect(event.casterId).toBeUndefined();
      expect(event.from).toBeDefined();
      expect(event.to).toBeDefined();
    }
    // The Squad of the Bruiser knows its own Hero.
    expect(pulls(SquadId.Left, resolution).every(({ casterId }) => casterId === BRUISER)).toBe(true);
  });

  it("names the extra damage of a hit: CLOSE +1 of Slam Shot at Range 1, and CHARGE +1 once after a Charge", () => {
    const cards = withTestCards();
    const match = setup({ col: 2, row: 1 }, { col: 5, row: 1 });
    // Charge first (Tick 1), then Slam Shot at Range 1 (Tick 2), then another Slam Shot (Tick 3).
    const plan = bruiserPlan(match, [cards.charge, SLAM_SHOT, SECOND_SLAM_SHOT], [use(cards.charge), use(SLAM_SHOT), use(SECOND_SLAM_SHOT)]);
    const [first, second] = hits(resolveRound(match, [plan]).events);
    expect(first).toEqual(expect.objectContaining({ closeBonus: 1, chargeBonus: 1 }));
    expect(second).toEqual(expect.objectContaining({ closeBonus: 1 }));
    expect(second?.chargeBonus).toBeUndefined();
  });

  it("names no bonus on a hit from Range 2", () => {
    const match = setup({ col: 2, row: 1 }, { col: 4, row: 1 });
    const [hit] = hits(resolveRound(match, [bruiserPlan(match, [SLAM_SHOT], [use(SLAM_SHOT)])]).events);
    expect(hit?.closeBonus).toBeUndefined();
    expect(hit?.chargeBonus).toBeUndefined();
  });

  it("marks a Hidden enemy that a Scout Drone area shows as Hidden in the Squad View, and a normal one as not", () => {
    const match = setup({ col: 16, row: 6 }, { col: 18, row: 6 });
    const seen = () => buildSquadView(match, SquadId.Left).enemies.find(({ id }) => id === ENEMY);
    expect(seen()).toEqual(expect.objectContaining({ visibility: Visibility.Visible, hidden: false }));
    hero(match, ENEMY).hidden = 2;
    expect(seen()?.visibility).not.toBe(Visibility.Visible);
    match.revealedAreas.push({ squad: SquadId.Left, center: { col: 18, row: 6 }, size: 3, remaining: 2 });
    expect(seen()).toEqual(expect.objectContaining({ visibility: Visibility.Visible, hidden: true }));
  });
});
