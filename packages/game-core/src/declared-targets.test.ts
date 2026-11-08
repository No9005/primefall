import { describe, expect, it } from "vitest";
import { withFullCover } from "./full-cover-fixture";
import { AttackFailReason, EventKind, SquadId, Visibility } from "./host";
import { buildSquadView, createMatch, type MatchState, recordSightings, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan } from "./plan";
import type { GridPosition } from "./reactor-deck";
import { getSquadEvents, resolveRound } from "./resolution";

const LEFT = "left-bruiser";
const RIGHT = "right-bruiser";
// Bruiser cards 0 and 1 are Slam Shot (damage 2, Range 3); cards 2 and 3 serve as Moves.
const SLAM_SHOT = 0;

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const move = (card: number, col: number, row: number): QueuedAction => ({ kind: ActionKind.Move, card, destination: { col, row } });
const wait: QueuedAction = { kind: ActionKind.Wait };
const shoot = (target = RIGHT): QueuedAction => ({ kind: ActionKind.Primary, card: SLAM_SHOT, target });
const planOf = (squad: SquadId, heroId: string, queue: QueuedAction[], pitched: number[] = []): SquadPlan => ({
  squad,
  heroes: [{ heroId, queue, pitched }],
});
const leftPlan = (...queue: QueuedAction[]) => planOf(SquadId.Left, LEFT, queue, [1]);
const rightPlan = (...queue: QueuedAction[]) => planOf(SquadId.Right, RIGHT, queue);

/** Only the two Bruisers are active (the other Heroes are Exhausted, so they see nothing), standing on the given tiles. */
function scene(left: GridPosition, right: GridPosition): MatchState {
  const match = startRound(createMatch(5));
  for (const other of match.heroes) if (other.id !== LEFT && other.id !== RIGHT) other.exhausted = true;
  hero(match, LEFT).position = left;
  hero(match, RIGHT).position = right;
  for (const id of [LEFT, RIGHT]) hero(match, id).hand = [0, 1, 2, 3];
  recordSightings(match);
  return match;
}

const attackEvents = (events: readonly { kind: EventKind }[]) =>
  events.filter(({ kind }) => kind === EventKind.AttackHit || kind === EventKind.AttackFailed);

describe("Declared Target: hits when it is valid in the Tick the Attack fires", () => {
  it("hits an enemy that was out of Range at planning time once the Moves have brought the Hero close", () => {
    const match = scene({ col: 3, row: 5 }, { col: 10, row: 5 });
    const { events } = resolveRound(match, [leftPlan(move(2, 5, 5), move(3, 7, 5), wait, shoot())]);
    expect(attackEvents(events)).toMatchObject([{ kind: EventKind.AttackHit, tick: 4, heroId: LEFT, targetId: RIGHT, damage: 2 }]);
  });

  it("hits an enemy that moved into Range before the Tick", () => {
    const match = scene({ col: 4, row: 5 }, { col: 10, row: 5 });
    const { events } = resolveRound(match, [leftPlan(wait, wait, shoot()), rightPlan(move(2, 8, 5), move(3, 7, 5))]);
    expect(attackEvents(events)).toMatchObject([{ kind: EventKind.AttackHit, tick: 3, targetId: RIGHT }]);
  });

  it("hits a Hidden enemy that is Marked, because Marked is always seen", () => {
    const match = scene({ col: 5, row: 5 }, { col: 7, row: 5 });
    hero(match, RIGHT).hidden = 1;
    hero(match, RIGHT).marked = 2;
    const { events } = resolveRound(match, [leftPlan(shoot())]);
    expect(attackEvents(events)).toMatchObject([{ kind: EventKind.AttackHit }]);
  });
});

describe("Declared Target: a miss has one reason and does nothing", () => {
  const miss = (match: MatchState, plans: SquadPlan[]) => {
    const before = structuredClone(hero(match, RIGHT).deck);
    const { match: after, events } = resolveRound(match, plans);
    expect(attackEvents(events)).toHaveLength(1);
    expect(hero(after, RIGHT).deck).toEqual(before);
    return attackEvents(events)[0]!;
  };

  it("misses with OutOfRange when the enemy moved away", () => {
    const match = scene({ col: 6, row: 5 }, { col: 8, row: 5 });
    const event = miss(match, [leftPlan(wait, shoot()), rightPlan(move(2, 10, 5))]);
    expect(event).toMatchObject({ kind: EventKind.AttackFailed, tick: 2, reason: AttackFailReason.OutOfRange, distance: 4 });
  });

  it("misses with NoLineOfSight when a Wall stands in between (a Marked enemy is still seen)", () => {
    // The Wall at (8,6) blocks the line from (8,5) to (8,7).
    const match = scene({ col: 8, row: 5 }, { col: 8, row: 7 });
    hero(match, RIGHT).marked = 2;
    expect(miss(match, [leftPlan(shoot())])).toMatchObject({ reason: AttackFailReason.NoLineOfSight });
  });

  it("misses with FullCover when the enemy ends on Full Cover against the attacker", () => {
    const match = withFullCover(scene({ col: 15, row: 3 }, { col: 15, row: 2 }), { col: 15, row: 1 });
    expect(miss(match, [leftPlan(wait, shoot()), rightPlan(move(2, 15, 1))])).toMatchObject({
      reason: AttackFailReason.FullCover,
    });
  });

  it("misses with TargetExhausted when the target is already Exhausted", () => {
    const match = scene({ col: 5, row: 5 }, { col: 7, row: 5 });
    hero(match, RIGHT).exhausted = true;
    expect(miss(match, [leftPlan(shoot())])).toMatchObject({ reason: AttackFailReason.TargetExhausted });
  });

  it("misses with NotVisible when the target left sight, and reveals no distance", () => {
    const match = scene({ col: 3, row: 5 }, { col: 9, row: 5 });
    const event = miss(match, [leftPlan(wait, shoot()), rightPlan(move(2, 11, 5))]);
    expect(event).toMatchObject({ kind: EventKind.AttackFailed, tick: 2, reason: AttackFailReason.NotVisible });
    expect(event).not.toHaveProperty("distance");
    expect(event).not.toHaveProperty("tile");
  });

  it("misses with NotVisible when the target became Hidden", () => {
    const match = scene({ col: 5, row: 5 }, { col: 7, row: 5 });
    hero(match, RIGHT).hidden = 1;
    expect(miss(match, [leftPlan(shoot())])).toMatchObject({ reason: AttackFailReason.NotVisible });
  });

  it("still runs the later actions of the Queue after a miss", () => {
    const match = scene({ col: 3, row: 5 }, { col: 9, row: 5 });
    const { match: after } = resolveRound(match, [leftPlan(shoot(), move(2, 5, 5))]);
    expect(hero(after, LEFT).position).toEqual({ col: 5, row: 5 });
  });
});

describe("Declared Target: Fog of War holds", () => {
  const unseenMiss = () => {
    const match = scene({ col: 3, row: 5 }, { col: 9, row: 5 });
    return resolveRound(match, [leftPlan(wait, shoot()), rightPlan(move(2, 11, 5))]);
  };

  it("delivers a miss on an unseen target to the attacker only", () => {
    const resolution = unseenMiss();
    const own = getSquadEvents(SquadId.Left, resolution).filter(({ kind }) => kind === EventKind.AttackFailed);
    expect(own).toHaveLength(1);
    expect(getSquadEvents(SquadId.Right, resolution).some(({ kind }) => kind === EventKind.AttackFailed)).toBe(false);
  });

  it("does not show the real position of the unseen enemy in the attacker's view", () => {
    const { match } = unseenMiss();
    const enemy = buildSquadView(match, SquadId.Left).enemies.find(({ id }) => id === RIGHT)!;
    expect(enemy.visibility).not.toBe(Visibility.Visible);
    expect(JSON.stringify(enemy)).not.toContain(`"col":${hero(match, RIGHT).position.col}`);
  });
});

describe("Declared Target: determinism", () => {
  it("gives the same events whichever Squad plan comes first, and when resolved twice", () => {
    const match = scene({ col: 4, row: 5 }, { col: 10, row: 5 });
    const plans = [leftPlan(wait, wait, shoot()), rightPlan(move(2, 8, 5), move(3, 7, 5))];
    const first = resolveRound(match, plans);
    expect(resolveRound(match, plans)).toEqual(first);
    expect(resolveRound(match, [...plans].reverse())).toEqual(first);
  });
});
