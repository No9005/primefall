import { describe, expect, it } from "vitest";
import { cardIndex, HeroClass } from "./cards";
import { withFullCover } from "./full-cover-fixture";
import { AttackFailReason, EventKind, SquadId, Visibility } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, PlanIssueKind, type QueuedAction, type SquadPlan, validatePlan } from "./plan";
import { type GridPosition, TileKind, tileAt } from "./notstrom-map";
import { getSquadEvents, resolveRound } from "./resolution";

const BRUISER = "left-bruiser";
const ENEMY = "right-bruiser";
const BLOCKER = "right-controller";
const CHARGE = cardIndex(HeroClass.Bruiser, "Express Delivery");
const PULL = cardIndex(HeroClass.Bruiser, "Cargo Hook");
const SLAM_SHOT = 0;
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

describe("Express Delivery", () => {
  it("moves up to 5 tiles toward the enemy and ends next to it", () => {
    const match = setup({ col: 2, row: 1 }, { col: 5, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [CHARGE], [use(CHARGE)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 4, row: 1 });
    expect(events.filter(({ kind }) => kind === EventKind.Step)).toHaveLength(2);
    expect(events.some(({ kind }) => kind === EventKind.Charged)).toBe(true);
  });

  it("covers at most 5 tiles when the enemy is further away", () => {
    const match = setup({ col: 2, row: 1 }, { col: 9, row: 1 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [CHARGE], [use(CHARGE)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 7, row: 1 });
  });

  it("stops early before a Hero in the way", () => {
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    hero(match, BLOCKER).position = { col: 4, row: 1 };
    const { match: after } = resolveRound(match, [bruiserPlan(match, [CHARGE], [use(CHARGE)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 3, row: 1 });
  });

  it("stops early before a Full Cover tile and still gives its Shield", () => {
    const match = withFullCover(setup({ col: 2, row: 1 }, { col: 6, row: 2 }), { col: 3, row: 2 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [CHARGE], [use(CHARGE)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 2, row: 1 });
    expect(events.some(({ kind }) => kind === EventKind.ShieldGained)).toBe(true);
  });

  it("does not cut a corner of the wall at (10, 4)", () => {
    const match = setup({ col: 9, row: 4 }, { col: 12, row: 1 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [CHARGE], [use(CHARGE)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 9, row: 4 });
  });

  it("gives Shield 2 before it moves, and the Shield is gone at the end of the Round", () => {
    const match = setup({ col: 2, row: 1 }, { col: 5, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [CHARGE], [use(CHARGE)])]);
    expect(events.find(({ kind }) => kind === EventKind.ShieldGained)).toMatchObject({ heroId: BRUISER, amount: 2, card: "Express Delivery" });
    expect(events.findIndex(({ kind }) => kind === EventKind.ShieldGained)).toBeLessThan(events.findIndex(({ kind }) => kind === EventKind.Step));
    expect(hero(after, BRUISER).shield).toBe(0);
  });

  it("cannot be used as a Move: it needs a visible enemy Hero as its target", () => {
    const match = setup({ col: 2, row: 1 }, { col: 12, row: 1 });
    const plan = bruiserPlan(match, [CHARGE], [{ kind: ActionKind.Primary, card: CHARGE, target: BRUISER }]);
    const view = buildSquadView(match, SquadId.Left);
    expect(validatePlan(view, plan).map(({ kind }) => kind)).toEqual([PlanIssueKind.BadTarget]);
  });

  it("misses an enemy that is not visible", () => {
    const match = setup({ col: 2, row: 1 }, { col: 12, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [CHARGE], [use(CHARGE)])]);
    expect(hero(after, BRUISER).position).toEqual({ col: 2, row: 1 });
    expect(events.some(({ kind }) => kind === EventKind.ActionFailed)).toBe(true);
    expect(events.some(({ kind }) => kind === EventKind.ShieldGained)).toBe(false);
  });
});

describe("Cargo Hook", () => {
  it("moves the enemy all the way next to the Bruiser", () => {
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 3, row: 1 });
    expect(events.filter(({ kind }) => kind === EventKind.Pull)).toHaveLength(3);
  });

  it("only reaches an enemy within Range 7", () => {
    const match = setup({ col: 2, row: 1 }, { col: 10, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 10, row: 1 });
    expect(events.some(({ kind }) => kind === EventKind.ActionFailed)).toBe(true);
  });

  it("stops next to the Bruiser", () => {
    const match = setup({ col: 2, row: 1 }, { col: 4, row: 1 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 3, row: 1 });
  });

  it("stops before another Hero", () => {
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    hero(match, BLOCKER).position = { col: 4, row: 1 };
    const { match: after } = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 5, row: 1 });
  });

  it("stops before a Full Cover tile", () => {
    const match = withFullCover(setup({ col: 2, row: 1 }, { col: 6, row: 2 }), { col: 5, row: 1 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 6, row: 2 });
  });

  it("does not slide the enemy around a corner of the wall at (10, 4)", () => {
    const match = setup({ col: 12, row: 1 }, { col: 9, row: 4 });
    const { match: after } = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 9, row: 4 });
  });

  it("can pull an enemy out of the Prime Zone", () => {
    const match = setup({ col: 17, row: 13 }, { col: 20, row: 13 });
    expect(tileAt(match.grid, hero(match, ENEMY).position)).toBe(TileKind.PrimeZone);
    const { match: after } = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 18, row: 13 });
    expect(tileAt(after.grid, hero(after, ENEMY).position)).not.toBe(TileKind.PrimeZone);
  });
});

describe("Cargo Hook on a Ghost", () => {
  /** The enemy Bruiser is Hidden (the Squad cannot see it) and the Squad remembers it at `remembered`. */
  function hiddenEnemy(enemyAt: GridPosition, remembered: GridPosition): MatchState {
    const match = setup({ col: 2, row: 1 }, enemyAt);
    hero(match, ENEMY).hidden = 2;
    match.ghosts[SquadId.Left][ENEMY] = { position: { ...remembered }, deckCount: 5, discardCount: 0, exileCount: 0, lastSeenRound: 1 };
    return match;
  }

  it("pulls an enemy that still stands on the tile where the Squad last saw it", () => {
    const match = hiddenEnemy({ col: 6, row: 1 }, { col: 6, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 3, row: 1 });
    expect(events.filter(({ kind }) => kind === EventKind.Pull)).toHaveLength(3);
  });

  it("does nothing when the enemy has left that tile", () => {
    const match = hiddenEnemy({ col: 6, row: 2 }, { col: 6, row: 1 });
    const { match: after, events } = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(after, ENEMY).position).toEqual({ col: 6, row: 2 });
    expect(events.some(({ kind }) => kind === EventKind.ActionFailed)).toBe(true);
  });

  it("can be planned on a Ghost, but not on an Unknown enemy", () => {
    const match = hiddenEnemy({ col: 6, row: 1 }, { col: 6, row: 1 });
    const plan = bruiserPlan(match, [PULL], [use(PULL)]);
    const view = buildSquadView(match, SquadId.Left);
    expect(view.enemies.find(({ id }) => id === ENEMY)?.visibility).toBe(Visibility.Ghost);
    expect(validatePlan(view, plan)).toEqual([]);
    delete match.ghosts[SquadId.Left][ENEMY];
    expect(validatePlan(buildSquadView(match, SquadId.Left), plan).map(({ kind }) => kind)).toEqual([PlanIssueKind.BadTarget]);
  });
});

describe("Handle With Care at Range 1 to 2", () => {
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

describe("What the events of a Cargo Hook, an Express Delivery and a hit tell a Squad", () => {
  const pulls = (squad: SquadId, resolution: ReturnType<typeof resolveRound>) => getSquadEvents(squad, resolution).filter(({ kind }) => kind === EventKind.Pull);

  it("names the Hero that pulled and both tiles of every slide to both Squads when the Bruiser is in sight", () => {
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    const resolution = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    for (const squad of [SquadId.Left, SquadId.Right]) {
      expect(pulls(squad, resolution)).toEqual([
        expect.objectContaining({ heroId: ENEMY, casterId: BRUISER, from: { col: 6, row: 1 }, to: { col: 5, row: 1 } }),
        expect.objectContaining({ heroId: ENEMY, casterId: BRUISER, from: { col: 5, row: 1 }, to: { col: 4, row: 1 } }),
        expect.objectContaining({ heroId: ENEMY, casterId: BRUISER, from: { col: 4, row: 1 }, to: { col: 3, row: 1 } }),
      ]);
    }
  });

  it("does not tell the Squad of the pulled Hero who pulled it when it cannot see that Hero, but still shows the slide", () => {
    const match = setup({ col: 2, row: 1 }, { col: 6, row: 1 });
    // A Hidden Bruiser is not seen on a tile in sight (it is only shown inside a Site Survey area).
    hero(match, BRUISER).hidden = 2;
    const resolution = resolveRound(match, [bruiserPlan(match, [PULL], [use(PULL)])]);
    expect(hero(resolution.match, BRUISER).hidden).toBeGreaterThan(0);
    const toVictim = pulls(SquadId.Right, resolution);
    expect(toVictim).toHaveLength(3);
    for (const event of toVictim) {
      expect(event.casterId).toBeUndefined();
      expect(event.from).toBeDefined();
      expect(event.to).toBeDefined();
    }
    // The Squad of the Bruiser knows its own Hero.
    expect(pulls(SquadId.Left, resolution).every(({ casterId }) => casterId === BRUISER)).toBe(true);
  });

  it("names the extra damage of a hit: CLOSE +1 of Handle With Care at Range 1", () => {
    const match = setup({ col: 2, row: 1 }, { col: 5, row: 1 });
    // Express Delivery first (Tick 1), then Handle With Care at Range 1 (Tick 2).
    const plan = bruiserPlan(match, [CHARGE, SLAM_SHOT], [use(CHARGE), use(SLAM_SHOT)]);
    const [first] = hits(resolveRound(match, [plan]).events);
    expect(first).toEqual(expect.objectContaining({ closeBonus: 1 }));
  });

  it("names no bonus on a hit from Range 2", () => {
    const match = setup({ col: 2, row: 1 }, { col: 4, row: 1 });
    const [hit] = hits(resolveRound(match, [bruiserPlan(match, [SLAM_SHOT], [use(SLAM_SHOT)])]).events);
    expect(hit?.closeBonus).toBeUndefined();
  });

  it("marks a Hidden enemy that a Site Survey area shows as Hidden in the Squad View, and a normal one as not", () => {
    const match = setup({ col: 16, row: 6 }, { col: 18, row: 6 });
    const seen = () => buildSquadView(match, SquadId.Left).enemies.find(({ id }) => id === ENEMY);
    expect(seen()).toEqual(expect.objectContaining({ visibility: Visibility.Visible, hidden: false }));
    hero(match, ENEMY).hidden = 2;
    expect(seen()?.visibility).not.toBe(Visibility.Visible);
    match.revealedAreas.push({ squad: SquadId.Left, center: { col: 18, row: 6 }, size: 3, remaining: 2 });
    expect(seen()).toEqual(expect.objectContaining({ visibility: Visibility.Visible, hidden: true }));
  });
});
