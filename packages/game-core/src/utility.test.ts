import { describe, expect, it } from "vitest";
import { cardIndex, HeroClass } from "./cards";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan } from "./plan";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";
const RIGHT_BRUISER = "right-bruiser";
const CONTROLLER_ID = "left-controller";
// Bruiser cards: 0 Handle With Care (Attack), Hard Hat (Shield 2 on self).
const SLAM_SHOT = 0;
const BULWARK = cardIndex(HeroClass.Bruiser, "Hard Hat");

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
  hero(match, BRUISER).hand = [SLAM_SHOT, BULWARK, 1, 2];
  hero(match, RIGHT_BRUISER).hand = [0, 1, 2, 3];
  return match;
}

describe("Utility cards: Shield", () => {
  it("Hard Hat gives this Hero Shield 2 in its Tick, which absorbs damage and expires with the Round", () => {
    const match = duel();
    const deckSize = hero(match, BRUISER).deck.length;
    const { match: after, events } = resolveRound(match, [
      planOf(BRUISER, [use(BULWARK, BRUISER)], [SLAM_SHOT]),
      planOf(RIGHT_BRUISER, [use(0, BRUISER)], [1], SquadId.Right),
    ]);
    expect(events).toContainEqual({ kind: EventKind.ShieldGained, tick: 1, heroId: BRUISER, amount: 2, card: "Hard Hat", casterId: BRUISER });
    expect(events.find(({ kind }) => kind === EventKind.AttackHit)).toMatchObject({ absorbed: 2, damage: 0 });
    expect(hero(after, BRUISER).deck).toHaveLength(deckSize);
    expect(after.heroes.every((candidate) => candidate.shield === 0)).toBe(true);
    expect(hero(after, BRUISER).discard).toEqual([SLAM_SHOT, BULWARK]);
  });

  it("fails when the target is not the casting Hero", () => {
    const failed = resolveRound(duel(), [planOf(BRUISER, [use(BULWARK, CONTROLLER_ID)], [SLAM_SHOT])]).events;
    expect(failed).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: BRUISER }]);
  });
});
