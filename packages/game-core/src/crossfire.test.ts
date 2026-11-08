import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan } from "./plan";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";
const CONTROLLER = "left-controller";
const ASSASSIN = "left-assassin";
const TARGET = "right-bruiser";
// Card 0 of the Bruiser (Slam Shot), the Controller (Pulse Bolt) and the Assassin (Precision Shot) is a damage 2 Attack.
const ATTACK_CARD = 0;

const hero = (match: MatchState, heroId: string) => match.heroes.find((candidate) => candidate.id === heroId)!;
const wait: QueuedAction = { kind: ActionKind.Wait };
const hit = (card = ATTACK_CARD): QueuedAction => ({ kind: ActionKind.Primary, card, target: TARGET });

/** Three Left Heroes close to the Right Bruiser, all with a clear line; every Hand holds cards 0 to 3. */
function setup(): MatchState {
  const match = startRound(createMatch(5));
  hero(match, BRUISER).position = { col: 8, row: 5 };
  hero(match, CONTROLLER).position = { col: 8, row: 4 };
  hero(match, ASSASSIN).position = { col: 8, row: 3 }; // two tiles from the target (Precision Shot has a Minimum Range of 2), clear line
  hero(match, TARGET).position = { col: 10, row: 5 };
  for (const id of [BRUISER, CONTROLLER, ASSASSIN, TARGET]) hero(match, id).hand = [0, 1, 2, 3];
  return match;
}

/** Each entry is one attacker's queue; cards 2 and 3 are pitched for Energy. */
function plan(queues: Record<string, QueuedAction[]>): SquadPlan {
  return {
    squad: SquadId.Left,
    heroes: Object.entries(queues).map(([heroId, queue]) => ({ heroId, queue, pitched: [2, 3] })),
  };
}

function crossfires(match: MatchState, queues: Record<string, QueuedAction[]>): number[] {
  const { events } = resolveRound(match, [plan(queues)]);
  return events.flatMap((event) => (event.kind === EventKind.AttackHit ? [event.crossfire ?? 0] : []));
}

describe("Crossfire", () => {
  it("adds 1 damage to the second hit of two attackers in the same Tick", () => {
    const match = setup();
    const { match: after, events } = resolveRound(match, [plan({ [BRUISER]: [hit()], [CONTROLLER]: [hit()] })]);
    expect(events.filter(({ kind }) => kind === EventKind.AttackHit).map(({ damage, crossfire }) => [damage, crossfire])).toEqual([[2, 0], [3, 1]]);
    expect(hero(after, TARGET).exile).toHaveLength(5);
  });

  it("counts a hit in the Tick directly after a hit by another attacker", () => {
    expect(crossfires(setup(), { [BRUISER]: [hit()], [CONTROLLER]: [wait, hit()] })).toEqual([0, 1]);
  });

  it("ends the chain after one empty Tick", () => {
    expect(crossfires(setup(), { [BRUISER]: [hit()], [CONTROLLER]: [wait, wait, hit()] })).toEqual([0, 0]);
  });

  it("does not count the same attacker twice", () => {
    expect(crossfires(setup(), { [BRUISER]: [hit(), hit(1)] })).toEqual([0, 0]);
  });

  it("adds 1 for each further attacker in consecutive Ticks", () => {
    expect(crossfires(setup(), { [BRUISER]: [hit()], [CONTROLLER]: [wait, hit()], [ASSASSIN]: [wait, wait, hit()] })).toEqual([0, 1, 1]);
  });

  it("lets a hit that Shield absorbs completely start a chain, and Shield absorbs the bonus too", () => {
    const match = setup();
    hero(match, TARGET).shield = 3;
    const { events } = resolveRound(match, [plan({ [BRUISER]: [hit()], [CONTROLLER]: [wait, hit()] })]);
    expect(events.filter(({ kind }) => kind === EventKind.AttackHit)).toMatchObject([
      { absorbed: 2, damage: 0, crossfire: 0 },
      { absorbed: 1, damage: 2, crossfire: 1 },
    ]);
  });

  it("does not start a chain with a miss", () => {
    // Out of Range: the Bruiser's shot misses, so the Controller's hit one Tick later gets no bonus.
    const match = setup();
    hero(match, BRUISER).position = { col: 1, row: 1 };
    const { events } = resolveRound(match, [plan({ [BRUISER]: [hit()], [CONTROLLER]: [wait, hit()] })]);
    expect(events.some(({ kind }) => kind === EventKind.AttackFailed)).toBe(true);
    expect(events.filter(({ kind }) => kind === EventKind.AttackHit)).toMatchObject([{ heroId: CONTROLLER, crossfire: 0 }]);
  });

  it("gives the same result for the same Match State and plans", () => {
    const queues = { [BRUISER]: [hit()], [CONTROLLER]: [wait, hit()] };
    expect(resolveRound(setup(), [plan(queues)])).toEqual(resolveRound(setup(), [plan(queues)]));
  });
});
