import { describe, expect, it } from "vitest";
import { cardIndex, HeroClass } from "./cards";
import { EventKind, SquadId, Visibility } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan } from "./plan";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";
const RIGHT_BRUISER = "right-bruiser";
// Bruiser cards: 0 Handle With Care, Time for Coffee (1 damage, Slow).
const SLAM_SHOT = 0;
const CONCUSSION_ROUND = cardIndex(HeroClass.Bruiser, "Time for Coffee");
const CONTROLLER = "left-controller";

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const use = (card: number, target: string): QueuedAction => ({ kind: ActionKind.Primary, card, target });
const move = (card: number, col: number, row: number): QueuedAction => ({
  kind: ActionKind.Move,
  card,
  destination: { col, row },
});
const rightPlan = (queue: QueuedAction[], pitched: number[] = []): SquadPlan => ({
  squad: SquadId.Right,
  heroes: [{ heroId: RIGHT_BRUISER, queue, pitched }],
});
const leftPlan = (queue: QueuedAction[], pitched: number[] = []): SquadPlan => ({
  squad: SquadId.Left,
  heroes: [{ heroId: BRUISER, queue, pitched }],
});

function duel(): MatchState {
  const match = startRound(createMatch(5));
  hero(match, BRUISER).position = { col: 8, row: 3 };
  hero(match, RIGHT_BRUISER).position = { col: 11, row: 3 };
  hero(match, BRUISER).hand = [CONCUSSION_ROUND, SLAM_SHOT, 1, 3];
  hero(match, CONTROLLER).position = { col: 8, row: 4 };
  hero(match, CONTROLLER).hand = [0, 1, 2, 3];
  hero(match, RIGHT_BRUISER).hand = [0, 1, 2, 3];
  return match;
}

/** The enemy Bruiser slowed by a Time for Coffee, as the state after that Resolution. */
function slowedByConcussion(): MatchState {
  return resolveRound(duel(), [leftPlan([use(CONCUSSION_ROUND, RIGHT_BRUISER)], [SLAM_SHOT])]).match;
}

describe("Slow", () => {
  it("Time for Coffee deals 1 damage and then Slows the target", () => {
    const match = duel();
    const deckSize = hero(match, RIGHT_BRUISER).deck.length;
    const { match: after, events } = resolveRound(match, [leftPlan([use(CONCUSSION_ROUND, RIGHT_BRUISER)], [SLAM_SHOT])]);
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.AttackHit, EventKind.SlowApplied]);
    expect(events[1]).toMatchObject({ tick: 1, heroId: BRUISER, targetId: RIGHT_BRUISER });
    expect(hero(after, RIGHT_BRUISER).deck).toHaveLength(deckSize - 1);
  });

  it("a failed Time for Coffee does not Slow", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).position = { col: 14, row: 3 };
    const { match: after, events } = resolveRound(match, [leftPlan([use(CONCUSSION_ROUND, RIGHT_BRUISER)], [SLAM_SHOT])]);
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.AttackFailed]);
    expect(hero(after, RIGHT_BRUISER).slow).toBe(0);
  });

  it("a Slowed Hero's Move 3 becomes a Move 1 (half, rounded down) and uses the Slow up", () => {
    // The first Move covers 1 tile (3 / 2 rounded down) to col 12, the second one the full 3 tiles to col 15.
    const { match: after, events } = resolveRound(slowedByConcussion(), [rightPlan([move(0, 14, 3), move(1, 15, 3)])]);
    expect(hero(after, RIGHT_BRUISER).position).toEqual({ col: 15, row: 3 });
    expect(events.filter(({ kind }) => kind === EventKind.SlowUsed)).toEqual([
      { kind: EventKind.SlowUsed, tick: 1, heroId: RIGHT_BRUISER },
    ]);
    expect(hero(after, RIGHT_BRUISER).slow).toBe(0);
  });

  it("Slow also applies to a Move planned in the Resolution that Slows, after the Slow", () => {
    const { match: after } = resolveRound(duel(), [
      leftPlan([use(CONCUSSION_ROUND, RIGHT_BRUISER)], [SLAM_SHOT]),
      rightPlan([{ kind: ActionKind.Wait }, move(1, 13, 3)]),
    ]);
    expect(hero(after, RIGHT_BRUISER).position).toEqual({ col: 12, row: 3 });
  });

  it("Slow lasts until the end of the next Resolution when no Move uses it", () => {
    const afterApplied = slowedByConcussion();
    expect(hero(afterApplied, RIGHT_BRUISER).slow).toBeGreaterThan(0);
    const afterNext = resolveRound(afterApplied, [rightPlan([{ kind: ActionKind.Wait }])]).match;
    expect(hero(afterNext, RIGHT_BRUISER).slow).toBe(0);
    const { match: moved } = resolveRound(afterNext, [rightPlan([move(1, 13, 3)])]);
    expect(hero(moved, RIGHT_BRUISER).position).toEqual({ col: 13, row: 3 });
  });
});

describe("Slow in the Squad View (Fog of War)", () => {
  it("shows Slow on a Visible enemy and on own Heroes", () => {
    const after = slowedByConcussion();
    const left = buildSquadView(after, SquadId.Left).enemies.find(({ id }) => id === RIGHT_BRUISER)!;
    expect(left).toMatchObject({ visibility: Visibility.Visible, slowed: true });
    expect(buildSquadView(after, SquadId.Right).heroes.find(({ id }) => id === RIGHT_BRUISER)?.slowed).toBe(true);
  });

  it("tells nothing about Slow once the enemy is out of sight", () => {
    const after = slowedByConcussion();
    hero(after, RIGHT_BRUISER).position = { col: 19, row: 3 };
    const enemy = buildSquadView(after, SquadId.Left).enemies.find(({ id }) => id === RIGHT_BRUISER)!;
    expect(enemy.visibility).toBe(Visibility.Ghost);
    expect(enemy).not.toHaveProperty("slowed");
  });
});
