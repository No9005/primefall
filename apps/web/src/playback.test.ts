import { EventKind, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames, describeEvent, tickCountOf } from "./playback";

const step = (tick: number, heroId: string, col: number): MatchEvent => ({
  kind: EventKind.Step,
  tick,
  heroId,
  from: { col: col - 1, row: 0 },
  to: { col, row: 0 },
});

describe("buildPlaybackFrames", () => {
  it("plays one step at a time, with Heroes of the same Tick side by side", () => {
    const frames = buildPlaybackFrames([step(1, "a", 1), step(1, "b", 5), step(1, "a", 2), step(2, "a", 3)]);
    expect(frames.map((frame) => [frame.tick, Object.keys(frame.moves)])).toEqual([
      [1, ["a", "b"]],
      [1, ["a"]],
      [2, ["a"]],
    ]);
    expect(frames[1]!.moves.a).toEqual({ col: 2, row: 0 });
  });

  it("keeps a frame for a Tick in which every move was blocked", () => {
    const blocked: MatchEvent = { kind: EventKind.MoveBlocked, tick: 1, heroId: "a", from: { col: 1, row: 0 } };
    expect(buildPlaybackFrames([blocked])).toMatchObject([{ tick: 1, moves: {}, shields: {}, hits: [], exhausted: [] }]);
  });

  it("shows Deck Damage and Exhaustion in the frame of their event", () => {
    const hit: MatchEvent = { kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "b", absorbed: 1, damage: 1 };
    const exhausted: MatchEvent = { kind: EventKind.Exhausted, tick: 1, heroId: "b" };
    const [frame] = buildPlaybackFrames([hit, exhausted]);
    expect(frame!.hits).toEqual([{ targetId: "b", damage: 1, absorbed: 1 }]);
    expect(frame!.exhausted).toEqual(["b"]);
  });

  it("describes hits, failed Attacks and Exhaustion for the log", () => {
    const name = (id: string) => id.toUpperCase();
    const hit: MatchEvent = { kind: EventKind.AttackHit, tick: 2, heroId: "a", targetId: "b", absorbed: 1, damage: 1 };
    expect(describeEvent(hit, name)).toBe("Tick 2: A hits B: Deck Damage 1, Shield absorbed 1");
    expect(describeEvent({ kind: EventKind.AttackFailed, tick: 1, heroId: "a", targetId: "b" }, name)).toContain("fails");
    expect(describeEvent({ kind: EventKind.Exhausted, tick: 1, heroId: "b" }, name)).toBe("B is Exhausted");
    expect(describeEvent(step(1, "a", 1), name)).toBeUndefined();
  });

  it("shows Shield in the frame of the Tick in which it was gained", () => {
    const shield: MatchEvent = { kind: EventKind.ShieldGained, tick: 2, heroId: "a", amount: 2 };
    expect(buildPlaybackFrames([step(1, "a", 1), shield])).toMatchObject([
      { tick: 1, moves: { a: { col: 1, row: 0 } }, shields: {} },
      { tick: 2, moves: {}, shields: { a: 2 } },
    ]);
  });

  it("has no frames and no Ticks without events", () => {
    expect(buildPlaybackFrames([])).toEqual([]);
    expect(tickCountOf([])).toBe(0);
    expect(tickCountOf([step(1, "a", 1), step(3, "a", 2)])).toBe(3);
  });
});
