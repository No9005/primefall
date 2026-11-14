import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames, utilityClipName } from "./playback";

describe("the playback plays the gestures from the events", () => {
  const event = (kind: EventKind, heroId: string, extra: Partial<MatchEvent> = {}): MatchEvent => ({ kind, tick: 1, heroId, ...extra });
  const classOf = (id: string) => (id === "assassin" ? HeroClass.Assassin : HeroClass.Controller);

  it("maps the events to the clips of the Hero that played the card", () => {
    expect(utilityClipName(event(EventKind.AreaRevealed, "c", { card: "Scout Drone" }))).toEqual({ heroId: "c", clip: "scoutDrone" });
    expect(utilityClipName(event(EventKind.CoverPlaced, "c", { card: "Fortify" }))).toEqual({ heroId: "c", clip: "deploy" });
    expect(utilityClipName(event(EventKind.HiddenGained, "a", { card: "Hidden" }))).toEqual({ heroId: "a", clip: "hidden" });
    expect(utilityClipName(event(EventKind.ShieldGained, "ally", { card: "Hard Hat", casterId: "ally" }))).toEqual({ heroId: "ally", clip: "block" });
  });

  it("a Tick lasts until the slowest gesture has reached its active end", () => {
    const [frame] = buildPlaybackFrames([event(EventKind.AreaRevealed, "c", { to: { col: 3, row: 3 } })], classOf);
    expect(frame?.clips).toEqual({ c: "scoutDrone" });
    expect(frame?.holdMs).toBe(3380);
    const [hidden] = buildPlaybackFrames([event(EventKind.HiddenGained, "assassin")], classOf);
    expect(hidden?.holdMs).toBe(4200);
  });

});
