import { CoverKind, EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { restClipName, takeCoverClipName } from "./hero-clips";
import { buildPlaybackFrames } from "./playback";

describe("the cover clips", () => {
  it("chooses the cover clips by Cover kind", () => {
    expect([takeCoverClipName(CoverKind.Half), takeCoverClipName(CoverKind.Full)]).toEqual(["takeCover", "takeCoverFull"]);
    expect([restClipName(CoverKind.None), restClipName(CoverKind.Half), restClipName(CoverKind.Full)]).toEqual(["idle", "inCover", "inCoverFull"]);
  });
});

describe("the playback of cover and Exhaustion", () => {
  const step = (tick: number, heroId: string, col: number): MatchEvent => ({ kind: EventKind.Step, tick, heroId, to: { col, row: 0 } });
  const coverOf = (tile: { col: number }) => (tile.col === 3 ? CoverKind.Half : tile.col === 5 ? CoverKind.Full : CoverKind.None);

  it("takes cover when a Move ends on Cover, and only then", () => {
    const frames = buildPlaybackFrames([step(1, "a", 2), step(1, "a", 3), step(1, "a", 4)], undefined, coverOf);
    // Walking over the Half Cover tile is not taking cover: the Move ends on the next tile.
    expect(frames.map((frame) => frame.clips.a)).toEqual(["walk", "walk", "walk"]);
    const ending = buildPlaybackFrames([step(1, "a", 2), step(1, "a", 3)], undefined, coverOf);
    expect(ending.map((frame) => frame.clips.a)).toEqual(["walk", "takeCover"]);
    const full = buildPlaybackFrames([step(1, "a", 5)], undefined, coverOf);
    expect(full[0]!.clips.a).toBe("takeCoverFull");
  });

  it("walks as before when the board knows no Cover", () => {
    expect(buildPlaybackFrames([step(1, "a", 3)])[0]!.clips.a).toBe("walk");
  });

  it("plays Exhausted for the Exhausted Hero, with the hit flash landing at the impact of the shot that took the last card", () => {
    const classOf = (id: string) => (id === "a" ? HeroClass.Bruiser : HeroClass.Assassin);
    const events: MatchEvent[] = [
      { kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", card: "Slam Shot", damage: 2, distance: 3 },
      { kind: EventKind.Exhausted, tick: 1, heroId: "t" },
    ];
    const [frame] = buildPlaybackFrames(events, classOf);
    expect(frame!.clips.t).toBe("exhausted");
    // The slug flies 3 tiles (72 px) at 0.10 px/ms: 720 ms after the fire beat.
    expect(frame!.delays.t).toBe(620 + 720 - 650);
    expect(frame!.exhausted).toEqual(["t"]);
    // The Tick lasts until the slab has formed.
    expect(frame!.holdMs).toBe(620 + 720 - 650 + 4860);
  });

  it("starts the Exhausted clip at once when nothing hit the Hero in the frame", () => {
    const [frame] = buildPlaybackFrames([{ kind: EventKind.Exhausted, tick: 1, heroId: "t" }], () => HeroClass.Controller);
    expect(frame!.clips.t).toBe("exhausted");
    expect(frame!.delays.t).toBeUndefined();
    expect(frame!.holdMs).toBe(4860);
  });
});
