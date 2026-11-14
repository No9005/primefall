import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { ClipPlayer } from "./clip-player";
import { clipOf } from "./hero-clips";
import { buildPlaybackFrames, STEP_MS } from "./playback";

describe("the timeline of the clips", () => {
  const beats = (heroClass: HeroClass, name: Parameters<typeof clipOf>[1]) => {
    const { durationMs, activeEndMs, fireMs } = clipOf(heroClass, name);
    return { durationMs, activeEndMs, fireMs };
  };

  it("gives the attacks their length, the beat where the shot leaves and the beat where the Hero is at rest again", () => {
    expect(beats(HeroClass.Bruiser, "attack")).toEqual({ durationMs: 2400, activeEndMs: 1540, fireMs: 620 });
    expect(beats(HeroClass.Assassin, "attack")).toEqual({ durationMs: 2200, activeEndMs: 1450, fireMs: 570 });
    expect(beats(HeroClass.Assassin, "longShot")).toEqual({ durationMs: 3600, activeEndMs: 3170, fireMs: 1650 });
    expect(beats(HeroClass.Controller, "attack")).toEqual({ durationMs: 2400, activeEndMs: 1630, fireMs: 620 });
    expect(beats(HeroClass.Controller, "tagRound")).toEqual({ durationMs: 2800, activeEndMs: 1400, fireMs: 730 });
    expect(beats(HeroClass.Controller, "slowPulse")).toEqual({ durationMs: 2600, activeEndMs: 2180, fireMs: 680 });
  });

  it("gives the gestures, the reactions and the fall their length", () => {
    expect(beats(HeroClass.Controller, "scoutDrone")).toMatchObject({ durationMs: 3600, activeEndMs: 3380 });
    expect(beats(HeroClass.Controller, "aegis")).toMatchObject({ durationMs: 3200, activeEndMs: 2560 });
    expect(beats(HeroClass.Controller, "deploy")).toMatchObject({ durationMs: 3400, activeEndMs: 2720 });
    expect(beats(HeroClass.Assassin, "hidden")).toMatchObject({ durationMs: 4200, activeEndMs: 4200 });
    expect(beats(HeroClass.Bruiser, "hit")).toMatchObject({ durationMs: 2600, activeEndMs: 1350 });
    expect(beats(HeroClass.Bruiser, "absorb")).toMatchObject({ durationMs: 2600, activeEndMs: 830 });
    expect(beats(HeroClass.Bruiser, "block")).toMatchObject({ durationMs: 3200, activeEndMs: 2900 });
    for (const heroClass of Object.values(HeroClass)) expect(beats(heroClass, "exhausted")).toMatchObject({ durationMs: 5400, activeEndMs: 4860 });
  });

  it("loops the cover clips: a Take cover is at rest at 24 % (22 % for Full Cover) of its loop, the Assassin is quicker", () => {
    expect(clipOf(HeroClass.Bruiser, "takeCover")).toMatchObject({ loop: true, durationMs: 4400, activeEndMs: 1056 });
    expect(clipOf(HeroClass.Bruiser, "takeCoverFull")).toMatchObject({ loop: true, durationMs: 4800, activeEndMs: 1056 });
    expect([HeroClass.Bruiser, HeroClass.Controller].map((heroClass) => [clipOf(heroClass, "inCover").durationMs, clipOf(heroClass, "inCoverFull").durationMs])).toEqual([[3400, 3600], [3400, 3600]]);
    expect([clipOf(HeroClass.Assassin, "inCover").durationMs, clipOf(HeroClass.Assassin, "inCoverFull").durationMs]).toEqual([2400, 4400]);
  });

  it("gives the Assassin and the Controller their own stride", () => {
    expect([HeroClass.Bruiser, HeroClass.Controller, HeroClass.Assassin].map((heroClass) => clipOf(heroClass, "walk").durationMs)).toEqual([640, 640, 500]);
    expect(clipOf(HeroClass.Bruiser, "walk").perStep).toBe(true);
    expect(clipOf(HeroClass.Bruiser, "idle").perStep).toBe(false);
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
