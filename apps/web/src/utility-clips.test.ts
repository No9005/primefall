import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { clipOf, sampleClip } from "./hero-clips";
import { buildPlaybackFrames, utilityClipName } from "./playback";

/** Values rounded to 1/100: the easing curves leave float dust. */
const r = (...values: number[]) => values.map((value) => Math.round(value * 100) / 100 + 0);

describe("the Utility gestures, sampled at the beats of the reference", () => {
  it("Scout Drone: lifts off 500-800 ms, flies out to 88 px by 1650 ms, hovers, returns by 3380 ms", () => {
    const clip = clipOf(HeroClass.Controller, "scoutDrone");
    expect([clip.durationMs, clip.loop, clip.activeEndMs]).toEqual([3600, false, 3380]);
    expect(r(sampleClip(clip, 0).drone.x, sampleClip(clip, 0).drone.y)).toEqual([0, 0]);
    expect(r(sampleClip(clip, 792).drone.y)).toEqual([-12]);
    expect(r(sampleClip(clip, 1656).drone.x, sampleClip(clip, 1656).drone.y)).toEqual([88, -22]);
    expect(r(sampleClip(clip, 2232).drone.y)).toEqual([-23]);
    expect(r(sampleClip(clip, 3384).drone.x, sampleClip(clip, 3384).drone.y)).toEqual([0, 0]);
    // The Controller taps the wrist console (back arm up) at 14 % to 22 %.
    expect(sampleClip(clip, 504).armB.rotation).toBeCloseTo(-120);
    // The drone is stowed again once the clip is over.
    expect(sampleClip(clip, 3600).drone.alpha).toBe(0);
    expect(sampleClip(clip, 1000).drone.alpha).toBe(1);
  });

  it("Scout Drone: the rotor flickers between full width and a third of it", () => {
    const clip = clipOf(HeroClass.Controller, "scoutDrone");
    expect(r(sampleClip(clip, 0).rotor.scaleX, sampleClip(clip, 100).rotor.scaleX, sampleClip(clip, 200).rotor.scaleX)).toEqual([1, 0.3, 1]);
  });

  it("Aegis Protocol: points at the ally between 380 and 700 ms and holds to 2560 ms", () => {
    const clip = clipOf(HeroClass.Controller, "aegis");
    expect([clip.durationMs, clip.activeEndMs]).toEqual([3200, 2560]);
    expect(sampleClip(clip, 0).armF.rotation).toBe(-30);
    expect(r(sampleClip(clip, 704).armF.rotation, sampleClip(clip, 1600).armF.rotation, sampleClip(clip, 1600).torso.rotation)).toEqual([-90, -90, 3]);
  });

  it("Deploy Cover: slams the deployer down at 750-950 ms", () => {
    const clip = clipOf(HeroClass.Controller, "deploy");
    expect([clip.durationMs, clip.activeEndMs]).toEqual([3400, 2720]);
    expect(r(sampleClip(clip, 748).armF.rotation)).toEqual([-120]);
    const slam = sampleClip(clip, 952);
    expect(r(slam.armF.rotation, slam.torso.y, slam.torso.rotation)).toEqual([-20, 3, 14]);
  });

  it("Hidden: cloak sweep, cyan flash at 920 ms, a faint ghost (alpha 0.22 to 0.38), the return flash at 3860 ms", () => {
    const clip = clipOf(HeroClass.Assassin, "hidden");
    expect([clip.durationMs, clip.loop]).toEqual([4200, false]);
    expect(sampleClip(clip, 0).rig.alpha).toBe(1);
    expect(r(sampleClip(clip, 672).armB.rotation, sampleClip(clip, 1008).armB.rotation)).toEqual([-112, -112]);
    expect(r(sampleClip(clip, 924).cloak.alpha, sampleClip(clip, 924).rig.alpha)).toEqual([0.7, 1]);
    for (let ms = 1260; ms <= 3600; ms += 60) {
      const alpha = sampleClip(clip, ms).rig.alpha;
      expect(alpha).toBeGreaterThanOrEqual(0.2);
      expect(alpha).toBeLessThanOrEqual(0.4);
    }
    expect(r(sampleClip(clip, 1680).rig.alpha, sampleClip(clip, 2100).rig.alpha)).toEqual([0.22, 0.38]);
    expect(r(sampleClip(clip, 1260).teamRing.alpha)).toEqual([0.25]);
    expect(r(sampleClip(clip, 3864).cloak.alpha, sampleClip(clip, 3864).rig.alpha)).toEqual([0.7, 1]);
    expect(sampleClip(clip, 4200).rig.alpha).toBe(1);
  });
});

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
