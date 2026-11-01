import { EventKind, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames, tickCountOf } from "./playback";

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
    expect(buildPlaybackFrames([blocked])).toEqual([{ tick: 1, moves: {} }]);
  });

  it("has no frames and no Ticks without events", () => {
    expect(buildPlaybackFrames([])).toEqual([]);
    expect(tickCountOf([])).toBe(0);
    expect(tickCountOf([step(1, "a", 1), step(3, "a", 2)])).toBe(3);
  });
});
