import { describe, expect, it } from "vitest";
import { AttackFailReason, EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan } from "./plan";
import type { GridPosition } from "./reactor-deck";
import { getSquadEvents, resolveRound } from "./resolution";

const ASSASSIN = "left-assassin";
const BRUISER = "left-bruiser";
const ENEMY = "right-bruiser";
const OTHER_ENEMY = "right-controller";
// Assassin: 0 Precision Shot, 4 Long Shot (Overdrive 4 at Range 6 or more). Bruiser: 0 Slam Shot, 4 Breach Charge,
// 5 Shockwave, 6 Bulwark.
const LONG_SHOT = 4;
const SLAM_SHOT = 0;
const BREACH_CHARGE = 4;
const SHOCKWAVE = 5;
const BULWARK = 6;

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;

function scene(positions: Record<string, GridPosition>): MatchState {
  const match = startRound(createMatch(5));
  hero(match, ASSASSIN).hand = [LONG_SHOT, 0, 1, 2];
  hero(match, BRUISER).hand = [SLAM_SHOT, 1, 2, 3, BREACH_CHARGE, SHOCKWAVE, BULWARK];
  for (const [id, position] of Object.entries(positions)) hero(match, id).position = position;
  return match;
}

const plan = (heroId: string, action: QueuedAction, pitched: number[]): SquadPlan => ({
  squad: SquadId.Left,
  heroes: [{ heroId, queue: [action], pitched }],
});

describe("Events carry the card that caused them", () => {
  it("tags an Attack with the card, the Range and no Overdrive flag in its standard mode", () => {
    const match = scene({ [ASSASSIN]: { col: 2, row: 1 }, [ENEMY]: { col: 8, row: 1 } });
    const { events } = resolveRound(match, [plan(ASSASSIN, { kind: ActionKind.Primary, card: LONG_SHOT, target: ENEMY }, [0])]);
    expect(events).toEqual([
      { kind: EventKind.AttackHit, tick: 1, heroId: ASSASSIN, targetId: ENEMY, absorbed: 0, damage: 2, crossfire: 0, card: "Long Shot", distance: 6 },
    ]);
  });

  it("tells the Long Shot Overdrive from a normal shot by the flag and the Range", () => {
    const match = scene({ [ASSASSIN]: { col: 2, row: 1 }, [ENEMY]: { col: 8, row: 1 } });
    const { events } = resolveRound(match, [
      plan(ASSASSIN, { kind: ActionKind.Primary, card: LONG_SHOT, target: ENEMY, overdrive: true }, [0]),
    ]);
    expect(events[0]).toMatchObject({ kind: EventKind.AttackHit, damage: 4, card: "Long Shot", overdrive: true, distance: 6 });
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

  it("puts the card on every target's event of an area card, Knockback included, and keeps it in the Squad's events", () => {
    const match = scene({ [BRUISER]: { col: 8, row: 5 }, [ENEMY]: { col: 9, row: 5 }, [OTHER_ENEMY]: { col: 9, row: 6 } });
    const resolution = resolveRound(match, [plan(BRUISER, { kind: ActionKind.Primary, card: SHOCKWAVE, target: BRUISER }, [0, 1])]);
    const events = getSquadEvents(SquadId.Right, resolution).filter(({ kind }) => kind === EventKind.AttackHit || kind === EventKind.Knockback);
    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events.every(({ card }) => card === "Shockwave")).toBe(true);
    expect(events.filter(({ kind }) => kind === EventKind.AttackHit).map(({ targetId }) => targetId).sort()).toEqual([ENEMY, OTHER_ENEMY]);
  });

  it("tags the blast and the destroyed Cover of Breach Charge", () => {
    const match = scene({ [BRUISER]: { col: 8, row: 5 }, [ENEMY]: { col: 11, row: 5 } });
    const tile = { col: 11, row: 5 };
    const { events } = resolveRound(match, [
      plan(BRUISER, { kind: ActionKind.Primary, card: BREACH_CHARGE, target: ENEMY, tile, overdrive: true }, [1, 2]),
    ]);
    const tagged = events.filter(({ kind }) => kind === EventKind.AttackHit || kind === EventKind.CoverDestroyed);
    expect(tagged.length).toBeGreaterThan(0);
    expect(tagged.every(({ card, overdrive }) => card === "Breach Charge" && overdrive === true)).toBe(true);
  });

  it("tags the Shield of a Utility card but not the Shield of a Block", () => {
    const match = scene({ [BRUISER]: { col: 8, row: 5 } });
    const utility = resolveRound(match, [plan(BRUISER, { kind: ActionKind.Primary, card: BULWARK, target: BRUISER }, [1])]);
    expect(utility.events).toEqual([
      { kind: EventKind.ShieldGained, tick: 1, heroId: BRUISER, amount: 3, card: "Bulwark", casterId: BRUISER },
    ]);
    const block = resolveRound(match, [plan(BRUISER, { kind: ActionKind.Block, card: SLAM_SHOT }, [1])]);
    expect(block.events).toEqual([{ kind: EventKind.ShieldGained, tick: 1, heroId: BRUISER, amount: expect.any(Number) }]);
    expect(block.events[0]).not.toHaveProperty("card");
    expect(block.events[0]).not.toHaveProperty("overdrive");
  });
});
