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
    // The Shield is on the ally; the gesture is the caster's.
    expect(utilityClipName(event(EventKind.ShieldGained, "ally", { card: "Aegis Protocol", casterId: "c" }))).toEqual({ heroId: "c", clip: "aegis" });
    expect(utilityClipName(event(EventKind.ShieldGained, "ally", { card: "Bulwark" }))).toBeUndefined();
  });

  it("a Tick lasts until the slowest gesture has reached its active end", () => {
    const [frame] = buildPlaybackFrames([event(EventKind.AreaRevealed, "c", { to: { col: 3, row: 3 } })], classOf);
    expect(frame?.clips).toEqual({ c: "scoutDrone" });
    expect(frame?.holdMs).toBe(3380);
    const [hidden] = buildPlaybackFrames([event(EventKind.HiddenGained, "assassin")], classOf);
    expect(hidden?.holdMs).toBe(4200);
  });

  it("the Aegis gesture does not move the receiver of the Shield, which still gains it", () => {
    const [frame] = buildPlaybackFrames([event(EventKind.ShieldGained, "ally", { card: "Aegis Protocol", casterId: "c", amount: 3 })], classOf);
    expect(frame?.clips).toEqual({ c: "aegis" });
    expect(frame?.shields).toEqual({ ally: 3 });
  });
});
