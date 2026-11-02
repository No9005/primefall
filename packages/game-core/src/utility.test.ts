import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan } from "./plan";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";
const CONTROLLER = "left-controller";
const RIGHT_BRUISER = "right-bruiser";
// Bruiser cards: 0 Slam Shot (Attack), 6 Bulwark (Shield 3 on self), 10 Reinforce (Shield 2 on an ally),
// 8 Forward Deploy.
const SLAM_SHOT = 0;
const BULWARK = 6;
const FORWARD_DEPLOY = 8;
const REINFORCE = 10;

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const use = (card: number, target: string): QueuedAction => ({ kind: ActionKind.Primary, card, target });
const planOf = (heroId: string, queue: QueuedAction[], pitched: number[], squad = SquadId.Left): SquadPlan => ({
  squad,
  heroes: [{ heroId, queue, pitched }],
});

function duel(): MatchState {
  const match = startRound(createMatch(5));
  hero(match, BRUISER).position = { col: 8, row: 5 };
  hero(match, RIGHT_BRUISER).position = { col: 10, row: 5 };
  hero(match, BRUISER).hand = [SLAM_SHOT, BULWARK, REINFORCE, FORWARD_DEPLOY];
  hero(match, RIGHT_BRUISER).hand = [0, 1, 2, 3];
  return match;
}

describe("Utility cards: Shield", () => {
  it("Bulwark gives this Hero Shield 3 in its Tick, which absorbs damage and expires with the Round", () => {
    const match = duel();
    const deckSize = hero(match, BRUISER).deck.length;
    const { match: after, events } = resolveRound(match, [
      planOf(BRUISER, [use(BULWARK, BRUISER)], [SLAM_SHOT]),
      planOf(RIGHT_BRUISER, [use(0, BRUISER)], [1], SquadId.Right),
    ]);
    expect(events).toContainEqual({ kind: EventKind.ShieldGained, tick: 1, heroId: BRUISER, amount: 3 });
    expect(events.find(({ kind }) => kind === EventKind.AttackHit)).toMatchObject({ absorbed: 2, damage: 0 });
    expect(hero(after, BRUISER).deck).toHaveLength(deckSize);
    expect(after.heroes.every((candidate) => candidate.shield === 0)).toBe(true);
    expect(hero(after, BRUISER).discard).toEqual([SLAM_SHOT, BULWARK]);
  });

  it("Reinforce gives an allied Hero Shield 2", () => {
    const { match: after, events } = resolveRound(duel(), [planOf(BRUISER, [use(REINFORCE, CONTROLLER)], [SLAM_SHOT])]);
    expect(events).toEqual([{ kind: EventKind.ShieldGained, tick: 1, heroId: CONTROLLER, amount: 2 }]);
    expect(after.heroes.every((candidate) => candidate.shield === 0)).toBe(true);
  });

  it("fails when the target is not an allowed Hero", () => {
    const failed = (card: number, target: string) =>
      resolveRound(duel(), [planOf(BRUISER, [use(card, target)], [SLAM_SHOT])]).events;
    const action = [{ kind: EventKind.ActionFailed, tick: 1, heroId: BRUISER }];
    expect(failed(BULWARK, CONTROLLER)).toEqual(action);
    expect(failed(REINFORCE, BRUISER)).toEqual(action);
    expect(failed(REINFORCE, RIGHT_BRUISER)).toEqual(action);
  });

  it("fails for Forward Deploy without a destination tile", () => {
    const events = resolveRound(duel(), [planOf(BRUISER, [use(FORWARD_DEPLOY, CONTROLLER)], [SLAM_SHOT])]).events;
    expect(events).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: BRUISER }]);
  });
});
