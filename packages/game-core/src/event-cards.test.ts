import { describe, expect, it } from "vitest";
import { cardIndex, HeroClass } from "./cards";
import { AttackFailReason, EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan } from "./plan";
import type { GridPosition } from "./notstrom-map";
import { resolveRound } from "./resolution";

const ASSASSIN = "left-assassin";
const BRUISER = "left-bruiser";
const ENEMY = "right-bruiser";
// Assassin: Long Shot (0 to 2). Bruiser: Handle With Care, Hard Hat.
const LONG_SHOT = cardIndex(HeroClass.Assassin, "Long Shot", 1);
const SLAM_SHOT = cardIndex(HeroClass.Bruiser, "Handle With Care");
const BULWARK = cardIndex(HeroClass.Bruiser, "Hard Hat");

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;

function scene(positions: Record<string, GridPosition>): MatchState {
  const match = startRound(createMatch(5));
  hero(match, ASSASSIN).hand = [LONG_SHOT, 0, 1, 3];
  hero(match, BRUISER).hand = [SLAM_SHOT, 1, 2, 3, BULWARK];
  for (const [id, position] of Object.entries(positions)) hero(match, id).position = position;
  return match;
}

const plan = (heroId: string, action: QueuedAction, pitched: number[]): SquadPlan => ({
  squad: SquadId.Left,
  heroes: [{ heroId, queue: [action], pitched }],
});

describe("Events carry the card that caused them", () => {
  it("tags an Attack with the card, the Range", () => {
    const match = scene({ [ASSASSIN]: { col: 2, row: 1 }, [ENEMY]: { col: 8, row: 1 } });
    const { events } = resolveRound(match, [plan(ASSASSIN, { kind: ActionKind.Primary, card: LONG_SHOT, target: ENEMY }, [0])]);
    expect(events).toEqual([
      { kind: EventKind.AttackHit, tick: 1, heroId: ASSASSIN, targetId: ENEMY, absorbed: 0, damage: 3, crossfire: 0, card: "Long Shot", distance: 6 },
    ]);
  });

  it("tags a failed Attack too, with the Range to the target", () => {
    const match = scene({ [ASSASSIN]: { col: 2, row: 1 }, [ENEMY]: { col: 12, row: 1 } });
    // A Marked enemy is seen from any distance, so the shot misses on Range, not on visibility.
    hero(match, ENEMY).marked = 2;
    const { events } = resolveRound(match, [plan(ASSASSIN, { kind: ActionKind.Primary, card: LONG_SHOT, target: ENEMY }, [0])]);
    expect(events).toEqual([
      { kind: EventKind.AttackFailed, tick: 1, heroId: ASSASSIN, targetId: ENEMY, card: "Long Shot", distance: 10, reason: AttackFailReason.OutOfRange },
    ]);
  });

  it("tags the Shield of a Utility card", () => {
    const match = scene({ [BRUISER]: { col: 8, row: 3 } });
    const utility = resolveRound(match, [plan(BRUISER, { kind: ActionKind.Primary, card: BULWARK, target: BRUISER }, [1])]);
    expect(utility.events).toEqual([
      { kind: EventKind.ShieldGained, tick: 1, heroId: BRUISER, amount: 2, card: "Hard Hat", casterId: BRUISER },
    ]);
  });
});
