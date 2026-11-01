import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, recordSightings, SIGHT_RANGE, startRound } from "./match";
import { ActionKind, PlanIssueKind, type QueuedAction, type SquadPlan, validatePlan } from "./plan";
import { resolveRound } from "./resolution";
import { Visibility } from "./host";

const ASSASSIN = "left-assassin";
const ENEMY = "right-bruiser";
// Assassin cards: 0 Precision Shot, 2 Piercing Round, 4 Long Shot, 6 Ghost Shot, 7 Execution Round,
// 8 Vanish, 10 Mark Target, 11 Reposition; card 1 (Precision Shot) serves as Pitch.
const PIERCING_ROUND = 2;
const GHOST_SHOT = 6;
const EXECUTION_ROUND = 7;
const VANISH = 8;
const MARK_TARGET = 10;
const REPOSITION = 11;
const PITCH = 1;

// Tiles on row 5 (the middle row): column 5 is Half Cover (H), (4, 4) is a Wall, row 1 is open floor.
const OPEN = { col: 2, row: 1 };
const HALF_COVER = { col: 5, row: 5 };
const OVERWATCH_NEST = { col: 10, row: 1 };

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const primary = (card: number, target: string, overdrive?: boolean): QueuedAction => ({
  kind: ActionKind.Primary,
  card,
  target,
  ...(overdrive ? { overdrive } : {}),
});
const plan = (queue: QueuedAction[], pitched: number[] = [PITCH], squad = SquadId.Left, heroId = ASSASSIN): SquadPlan => ({
  squad,
  heroes: [{ heroId, queue, pitched }],
});

/** The Assassin at `from` with the given cards in the Hand and the enemy Bruiser at `enemyAt`. */
function scene(from = OPEN, enemyAt = { col: from.col + 3, row: from.row }, hand = [PITCH, VANISH, MARK_TARGET, REPOSITION]) {
  const match = startRound(createMatch(5));
  hero(match, ASSASSIN).position = { ...from };
  hero(match, ASSASSIN).hand = hand;
  hero(match, ENEMY).position = { ...enemyAt };
  recordSightings(match);
  return match;
}

const deckLoss = (before: MatchState, after: MatchState, id = ENEMY) => hero(before, id).deck.length - hero(after, id).deck.length;

describe("Precision Shot, Piercing Round and Execution Round", () => {
  it("Execution Round deals 3 damage for 2 Energy", () => {
    const match = scene(OPEN, undefined, [PITCH, 0, EXECUTION_ROUND, REPOSITION]);
    const { match: after } = resolveRound(match, [plan([primary(EXECUTION_ROUND, ENEMY)], [PITCH, 0])]);
    expect(deckLoss(match, after)).toBe(3);
  });

  it("Piercing Round ignores Half Cover while a Precision Shot is reduced by it", () => {
    const attacker = { col: 2, row: 5 };
    const hand = [PITCH, PIERCING_ROUND, 0, REPOSITION];
    const match = scene(attacker, HALF_COVER, hand);
    const piercing = resolveRound(match, [plan([primary(PIERCING_ROUND, ENEMY)])]).match;
    const precision = resolveRound(match, [plan([primary(0, ENEMY)])]).match;
    expect([deckLoss(match, piercing), deckLoss(match, precision)]).toEqual([2, 1]);
  });
});

describe("Mark Target", () => {
  it("Marks an enemy in sight, so the Squad sees it until the end of the next Resolution", () => {
    const match = scene(OPEN, { col: 2 + SIGHT_RANGE, row: 1 });
    const { match: after, events } = resolveRound(match, [plan([primary(MARK_TARGET, ENEMY)])]);
    expect(events).toContainEqual({ kind: EventKind.MarkedApplied, tick: 1, heroId: ASSASSIN, targetId: ENEMY });
    expect(hero(after, ENEMY).marked).toBe(1);
    // The Assassin walks out of sight but still sees the Marked enemy.
    hero(after, ASSASSIN).position = { col: 1, row: 9 };
    expect(buildSquadView(after, SquadId.Left).enemies.find(({ id }) => id === ENEMY)?.visibility).toBe(Visibility.Visible);
    const next = resolveRound(startRound(after), []).match;
    expect(hero(next, ENEMY).marked).toBe(0);
  });

  it("Overdrive also deals 1 damage within Range 5, and only the Mark further away; the card is Exiled", () => {
    const hand = [PITCH, MARK_TARGET, 0, REPOSITION];
    const near = scene(OPEN, { col: 7, row: 1 }, hand);
    const far = scene(OPEN, { col: 9, row: 1 }, hand);
    const nearAfter = resolveRound(near, [plan([primary(MARK_TARGET, ENEMY, true)])]).match;
    const farAfter = resolveRound(far, [plan([primary(MARK_TARGET, ENEMY, true)])]).match;
    expect([deckLoss(near, nearAfter), deckLoss(far, farAfter)]).toEqual([1, 0]);
    expect(hero(farAfter, ENEMY).marked).toBeGreaterThan(0);
    expect(hero(nearAfter, ASSASSIN).exile).toEqual([MARK_TARGET]);
  });

  it("fails against an enemy outside the sight range", () => {
    const match = scene(OPEN, { col: 2 + SIGHT_RANGE + 1, row: 1 });
    const { events } = resolveRound(match, [plan([primary(MARK_TARGET, ENEMY)])]);
    expect(events).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: ASSASSIN }]);
  });
});

describe("Reposition", () => {
  const destination = (col: number) => ({ kind: ActionKind.Move as const, card: 0, destination: { col, row: 1 } });
  const hand = [PITCH, REPOSITION, 0, VANISH];

  it("turns the next Move into Move 3", () => {
    const match = scene(OPEN, { col: 15, row: 1 }, hand);
    const { match: after } = resolveRound(match, [plan([primary(REPOSITION, ASSASSIN), destination(5)])]);
    expect(hero(after, ASSASSIN).position).toEqual({ col: 5, row: 1 });
  });

  it("does not stretch a second Move", () => {
    const match = scene(OPEN, { col: 15, row: 1 }, [PITCH, REPOSITION, 0, 3]);
    const queue = [primary(REPOSITION, ASSASSIN), destination(5), { ...destination(8), card: 3 }];
    const { match: after } = resolveRound(match, [plan(queue)]);
    expect(hero(after, ASSASSIN).position).toEqual({ col: 7, row: 1 });
  });

  it("is accepted by planning only for the Move that follows it", () => {
    const match = scene(OPEN, { col: 15, row: 1 }, hand);
    const view = buildSquadView(match, SquadId.Left);
    const issues = (queue: QueuedAction[]) =>
      validatePlan(view, plan(queue)).filter(({ kind }) => kind === PlanIssueKind.BadDestination);
    expect(issues([primary(REPOSITION, ASSASSIN), destination(5)])).toEqual([]);
    expect(issues([destination(5)])).toHaveLength(1);
  });
});

describe("Hidden", () => {
  const vanished = (from = HALF_COVER) => {
    const match = scene(from, { col: 15, row: 1 });
    return resolveRound(match, [plan([primary(VANISH, ASSASSIN)])]);
  };

  it("Vanish makes the Hero Hidden on a Cover tile and shows it in its own Squad View", () => {
    const { match: after, events } = vanished();
    expect(events).toContainEqual({ kind: EventKind.HiddenGained, tick: 1, heroId: ASSASSIN });
    expect(buildSquadView(after, SquadId.Left).heroes.find(({ id }) => id === ASSASSIN)?.hidden).toBe(true);
  });

  it("Vanish fails outside Cover", () => {
    const { match: after, events } = vanished(OPEN);
    expect(events).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: ASSASSIN }]);
    expect(hero(after, ASSASSIN).hidden).toBe(0);
  });

  it("Suppress, played earlier in the Round, prevents it", () => {
    const match = scene(HALF_COVER, { col: 8, row: 5 }, [PITCH, VANISH, 0, REPOSITION]);
    hero(match, ENEMY).hand = [9, 0, 1, 2];
    // Tick 1: the enemy Bruiser Suppresses the Visible Assassin (Bruiser card 9); tick 2: the Assassin's Vanish.
    const block: QueuedAction = { kind: ActionKind.Block, card: 0 };
    const result = resolveRound(match, [
      plan([block, primary(VANISH, ASSASSIN)], [PITCH]),
      { squad: SquadId.Right, heroes: [{ heroId: ENEMY, queue: [primary(9, ASSASSIN)], pitched: [0] }] },
    ]);
    expect(hero(result.match, ASSASSIN).hidden).toBe(0);
    expect(result.events).toContainEqual({ kind: EventKind.ActionFailed, tick: 2, heroId: ASSASSIN });
  });

  it("lasts two Resolutions: the Hero stays Hidden through the next one", () => {
    const { match: after } = vanished();
    expect(hero(after, ASSASSIN).hidden).toBe(1);
    const second = resolveRound(startRound(after), []).match;
    expect(hero(second, ASSASSIN).hidden).toBe(0);
  });

  it("hides the Hero from enemies, also on a tile in their sight", () => {
    const match = scene(HALF_COVER, { col: 8, row: 5 });
    expect(buildSquadView(match, SquadId.Right).enemies.find(({ id }) => id === ASSASSIN)?.visibility).toBe(Visibility.Visible);
    const { match: after } = resolveRound(match, [plan([primary(VANISH, ASSASSIN)])]);
    const seen = buildSquadView(after, SquadId.Right).enemies.find(({ id }) => id === ASSASSIN);
    // The enemy keeps only the Ghost of where it last saw the Assassin.
    expect(seen?.visibility).toBe(Visibility.Ghost);
  });

  it("ends when the Hero attacks", () => {
    const match = scene(HALF_COVER, { col: 8, row: 5 }, [PITCH, VANISH, 0, REPOSITION]);
    hero(match, ASSASSIN).hidden = 2;
    // An enemy Hero cannot see a Hidden Assassin, but the Assassin sees the enemy and may attack it.
    const { match: after, events } = resolveRound(match, [plan([primary(0, ENEMY)])]);
    expect(events).toContainEqual({ kind: EventKind.HiddenEnded, tick: 1, heroId: ASSASSIN });
    expect(hero(after, ASSASSIN).hidden).toBe(0);
  });

  it("ends when the Hero is Marked", () => {
    const match = scene(HALF_COVER, { col: 8, row: 5 });
    hero(match, ASSASSIN).hidden = 2;
    const enemyPlan = { squad: SquadId.Right, heroes: [{ heroId: "right-assassin", queue: [primary(MARK_TARGET, ASSASSIN)], pitched: [PITCH] }] };
    hero(match, "right-assassin").hand = [PITCH, MARK_TARGET, 0, 3];
    hero(match, "right-assassin").position = { col: 9, row: 5 };
    const { match: after, events } = resolveRound(match, [enemyPlan]);
    expect(events).toContainEqual({ kind: EventKind.HiddenEnded, tick: 1, heroId: ASSASSIN });
    expect(hero(after, ASSASSIN).hidden).toBe(0);
  });

  it("gives a Hidden Assassin sight range 9 instead of 7", () => {
    const open = { col: 2, row: 9 };
    const enemyAt = { col: open.col + 9, row: 9 };
    const seenBy = (hidden: number) => {
      const match = scene(open, enemyAt);
      hero(match, ASSASSIN).hidden = hidden;
      return buildSquadView(match, SquadId.Left).enemies.find(({ id }) => id === ENEMY)?.visibility;
    };
    expect(seenBy(0)).toBe(Visibility.Unknown);
    expect(seenBy(2)).toBe(Visibility.Visible);
    expect([SIGHT_RANGE, 9]).toEqual([7, 9]);
  });

  it("does not leak a Hidden Hero's steps to an enemy that sees the tiles", () => {
    const match = scene(OPEN, { col: 8, row: 1 });
    hero(match, ASSASSIN).hidden = 2;
    const queue: QueuedAction[] = [{ kind: ActionKind.Move, card: PITCH, destination: { col: 4, row: 1 } }];
    const resolution = resolveRound(match, [plan(queue, [])]);
    const perceived = resolution.perceivedBy.flatMap((squads, i) => (squads.includes(SquadId.Right) ? [resolution.events[i]] : []));
    expect(perceived).toEqual([]);
  });
});

describe("Ghost Shot Overdrive", () => {
  const hand = [PITCH, GHOST_SHOT, 0, REPOSITION];

  /** The Left Squad remembers the enemy Bruiser at `ghostAt`; the enemy is now elsewhere (`standing`). */
  function ghostScene(ghostAt: { col: number; row: number }, standing: { col: number; row: number }, occupant?: { col: number; row: number }) {
    const match = scene(OPEN, standing, hand);
    match.ghosts[SquadId.Left][ENEMY] = {
      position: ghostAt, deckCount: 9, discardCount: 0, exileCount: 0, lastSeenRound: 1,
    };
    if (occupant) hero(match, "right-controller").position = occupant;
    return match;
  }
  const shoot = (match: MatchState) => resolveRound(match, [plan([primary(GHOST_SHOT, ENEMY, true)])]);

  it("hits an enemy that stands on the remembered tile", () => {
    // The Bruiser has left (it stands far away); another enemy Hero now occupies the Ghost's tile.
    const match = ghostScene({ col: 5, row: 1 }, { col: 15, row: 1 }, { col: 5, row: 1 });
    const { match: after } = shoot(match);
    expect(deckLoss(match, after, "right-controller")).toBe(2);
    expect(hero(after, ASSASSIN).exile).toEqual([GHOST_SHOT]);
  });

  it("hits the enemy that is still there", () => {
    const match = ghostScene({ col: 5, row: 1 }, { col: 5, row: 1 });
    // The enemy is Visible, so the Ghost memory is replaced when the Round starts; keep the old one.
    const { match: after } = shoot(match);
    expect(deckLoss(match, after)).toBe(2);
  });

  it("misses an empty tile", () => {
    const match = ghostScene({ col: 5, row: 1 }, { col: 15, row: 1 });
    const { match: after, events } = shoot(match);
    expect(events.map(({ kind }) => kind)).toContain(EventKind.AttackFailed);
    expect(after.heroes.map((candidate) => candidate.deck.length)).toEqual(match.heroes.map((candidate) => candidate.deck.length));
  });

  it("is blocked by Full Cover and reduced by Half Cover", () => {
    const full = ghostScene(OVERWATCH_NEST, { col: 15, row: 5 });
    hero(full, ASSASSIN).position = { col: 7, row: 1 };
    hero(full, ENEMY).position = OVERWATCH_NEST;
    expect(deckLoss(full, shoot(full).match)).toBe(0);
    const half = ghostScene(HALF_COVER, HALF_COVER);
    hero(half, ASSASSIN).position = { col: 2, row: 5 };
    expect(deckLoss(half, shoot(half).match)).toBe(1);
  });

  it("is planned against a Ghost only", () => {
    const match = ghostScene({ col: 5, row: 1 }, { col: 15, row: 1 });
    const issues = (target: string) =>
      validatePlan(buildSquadView(match, SquadId.Left), plan([primary(GHOST_SHOT, target, true)])).map(({ kind }) => kind);
    expect(issues(ENEMY)).toEqual([]);
    expect(issues("right-controller")).toEqual([PlanIssueKind.BadTarget]);
  });
});
