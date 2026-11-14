import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { ClipPlayer } from "./clip-player";
import { clipOf, ease, sampleClip } from "./hero-clips";
import { buildPlaybackFrames, STEP_MS } from "./playback";

describe("sampleClip", () => {
  it("lifts the torso at the breath peak of Idle (1000 ms), and rests at the ends", () => {
    const idle = clipOf(HeroClass.Bruiser, "idle");
    expect(sampleClip(idle, 1000).torso).toMatchObject({ x: expect.closeTo(0.8, 5), y: expect.closeTo(-2, 5), scaleY: expect.closeTo(1.05, 5) });
    expect(sampleClip(idle, 0).torso.y).toBe(0);
    expect(sampleClip(idle, 2000).torso.y).toBeCloseTo(0);
    expect(sampleClip(idle, 1000).armF.rotation).toBeCloseTo(-40);
  });

  it("swings the legs of Walk from -30/30 degrees to 30/-30 in half a cycle", () => {
    const walk = clipOf(HeroClass.Bruiser, "walk");
    expect(sampleClip(walk, 0).legL.rotation).toBe(-30);
    expect(sampleClip(walk, 0).legR.rotation).toBe(30);
    expect(sampleClip(walk, 320).legL.rotation).toBe(30);
    expect(sampleClip(walk, 320).legR.rotation).toBe(-30);
    expect(sampleClip(walk, 160).legL.rotation).toBeCloseTo(0);
    expect(sampleClip(walk, 640 + 160).legL.rotation).toBeCloseTo(0);
  });

  it("turns the head of Wait left at 830 ms and right at 2240 ms (70 %), and shows the II mark", () => {
    const wait = clipOf(HeroClass.Controller, "wait");
    expect(sampleClip(wait, 830).head.rotation).toBeCloseTo(-14, 1);
    expect(sampleClip(wait, 2240).head.rotation).toBeCloseTo(14, 1);
    expect(sampleClip(wait, 800).pause.alpha).toBeCloseTo(0.45, 1);
    expect(sampleClip(clipOf(HeroClass.Controller, "idle"), 500).pause.alpha).toBe(0);
  });

  it("gives the Assassin a quicker stride and a moving cape; the others share the same clips", () => {
    expect(clipOf(HeroClass.Assassin, "walk").durationMs).toBe(500);
    expect(clipOf(HeroClass.Bruiser, "walk").durationMs).toBe(640);
    expect(clipOf(HeroClass.Controller, "walk")).toBe(clipOf(HeroClass.Bruiser, "walk"));
    expect(sampleClip(clipOf(HeroClass.Assassin, "walk"), 250).legL.rotation).toBe(30);
    expect(sampleClip(clipOf(HeroClass.Assassin, "walk"), 0).cape.rotation).toBe(-16);
    expect(sampleClip(clipOf(HeroClass.Bruiser, "walk"), 0).cape.rotation).toBe(0);
  });

  it("is the same every time", () => {
    const walk = clipOf(HeroClass.Bruiser, "walk");
    expect(sampleClip(walk, 123)).toEqual(sampleClip(walk, 123));
  });
});

describe("ease", () => {
  it("follows the CSS curves", () => {
    expect(ease("linear", 0.3)).toBe(0.3);
    expect(ease("ease-in-out", 0.5)).toBeCloseTo(0.5, 3);
    expect(ease("ease-in-out", 0.25)).toBeCloseTo(0.129, 2);
    expect(ease("ease-in", 0.5)).toBeLessThan(0.5);
    expect(ease("ease-out", 0.5)).toBeGreaterThan(0.5);
  });
});

describe("ClipPlayer", () => {
  it("idles until told otherwise", () => {
    const player = new ClipPlayer(HeroClass.Bruiser, 0, 1);
    expect(player.playing).toBe("idle");
    expect(player.clipTimeMs(1000)).toBeCloseTo(1000);
  });

  it("runs a Walk at half a cycle per playback step, and goes on across steps", () => {
    const player = new ClipPlayer(HeroClass.Bruiser, 0);
    player.play("walk", 0);
    const walk = clipOf(HeroClass.Bruiser, "walk");
    expect(player.clipTimeMs(STEP_MS)).toBeCloseTo(walk.durationMs / 2);
    // Asking again does not restart it.
    player.play("walk", STEP_MS);
    expect(player.clipTimeMs(2 * STEP_MS)).toBeCloseTo(walk.durationMs);
  });

  it("multiplies the time by the speed", () => {
    const player = new ClipPlayer(HeroClass.Bruiser, 0, 2);
    expect(player.clipTimeMs(500)).toBeCloseTo(1000);
  });
});

describe("the clips of a playback frame", () => {
  const event = (kind: EventKind, tick: number, heroId: string, col = 1): MatchEvent => ({ kind, tick, heroId, from: { col: col - 1, row: 0 }, to: { col, row: 0 } });

  it("walks a Hero for its Step and idles the others", () => {
    const frames = buildPlaybackFrames([event(EventKind.Step, 1, "a", 1), event(EventKind.Step, 1, "a", 2)]);
    expect(frames.map((frame) => frame.clips)).toEqual([{ a: "walk" }, { a: "walk" }]);
  });

  it("lets a Wait last the whole Tick, but a Step wins in its own frame", () => {
    const frames = buildPlaybackFrames([
      event(EventKind.Step, 1, "a", 1),
      event(EventKind.Step, 1, "a", 2),
      { kind: EventKind.Wait, tick: 1, heroId: "b" },
      { kind: EventKind.Wait, tick: 2, heroId: "a" },
    ]);
    expect(frames.map((frame) => frame.clips)).toEqual([{ a: "walk", b: "wait" }, { a: "walk", b: "wait" }, { a: "wait" }]);
  });
});
