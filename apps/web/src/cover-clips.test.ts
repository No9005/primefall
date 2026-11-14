import { CoverKind, EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { clipOf, restClipName, sampleClip, takeCoverClipName } from "./hero-clips";
import { buildPlaybackFrames } from "./playback";

/** Values rounded to 1/100: the easing curves leave float dust. */
const r = (...values: number[]) => values.map((value) => Math.round(value * 100) / 100);

describe("the cover clips, sampled at the beats of the reference", () => {
  it("Take cover (Half Cover): the Hero ducks by 24 % of 4400 ms and stands up again", () => {
    const take = clipOf(HeroClass.Bruiser, "takeCover");
    expect([take.durationMs, take.loop]).toEqual([4400, true]);
    expect(sampleClip(take, 0).torso.y).toBe(0);
    const ducked = sampleClip(take, 1056);
    expect(r(ducked.torso.y, ducked.armF.rotation, ducked.armB.rotation, ducked.legL.scaleY, ducked.legR.rotation)).toEqual([5, -125, -100, 0.5, 14]);
    expect(sampleClip(take, 3600).torso.y).toBeCloseTo(0);
  });

  it("Take cover (Full Cover): slides in against the wall (13 px to -2 px) with the weapon upright", () => {
    const take = clipOf(HeroClass.Controller, "takeCoverFull");
    expect(take.durationMs).toBe(4800);
    expect(sampleClip(take, 0).rig.x).toBe(13);
    expect(r(sampleClip(take, 1056).rig.x)).toEqual([-2]);
    // The weapon is upright at 30 % and the Hero leans out around the edge at 48 % to 60 %.
    const upright = sampleClip(take, 1440);
    expect(r(upright.armF.rotation, upright.armB.rotation)).toEqual([-168, 82]);
    const leaning = sampleClip(take, 2304);
    expect(r(leaning.torso.x, leaning.torso.rotation)).toEqual([3, 9]);
  });

  it("In cover: the Bruiser and the Controller loop 3400 / 3600 ms, the Assassin is quick (2400 ms)", () => {
    expect([clipOf(HeroClass.Bruiser, "inCover").durationMs, clipOf(HeroClass.Bruiser, "inCoverFull").durationMs]).toEqual([3400, 3600]);
    expect(clipOf(HeroClass.Controller, "inCover").durationMs).toBe(3400);
    expect(clipOf(HeroClass.Assassin, "inCover").durationMs).toBe(2400);
    const half = sampleClip(clipOf(HeroClass.Bruiser, "inCover"), 0);
    expect(r(half.torso.y, half.armF.rotation, half.legL.scaleY)).toEqual([5, -125, 0.5]);
    // A peek at 46 % of the loop: the head comes up and turns.
    const peek = sampleClip(clipOf(HeroClass.Bruiser, "inCover"), 1564).head;
    expect(r(peek.x, peek.y, peek.rotation)).toEqual([1, -3, -12]);
  });

  it("In cover (Full Cover): the Assassin kneels and scans through the scope for 4400 ms", () => {
    const scan = clipOf(HeroClass.Assassin, "inCoverFull");
    expect([scan.durationMs, scan.loop]).toEqual([4400, true]);
    expect(sampleClip(scan, 0).legR.rotation).toBe(0);
    const kneeling = sampleClip(scan, 968);
    expect(r(kneeling.legR.rotation, kneeling.torso.y, kneeling.armF.rotation)).toEqual([-75, 5, -91]);
    // The scope swings to one side at 46 % to 50 % and back at 62 %.
    expect(sampleClip(scan, 2024).armF.rotation).toBeCloseTo(-99);
    expect(sampleClip(scan, 2728).armF.rotation).toBeCloseTo(-84);
    // The Bruiser, by contrast, only glances: its weapon stays upright.
    expect(sampleClip(clipOf(HeroClass.Bruiser, "inCoverFull"), 1000).armF.rotation).toBe(-168);
  });

  it("chooses the cover clips by Cover kind", () => {
    expect([takeCoverClipName(CoverKind.Half), takeCoverClipName(CoverKind.Full)]).toEqual(["takeCover", "takeCoverFull"]);
    expect([restClipName(CoverKind.None), restClipName(CoverKind.Half), restClipName(CoverKind.Full)]).toEqual(["idle", "inCover", "inCoverFull"]);
  });
});

describe("the Exhausted clips", () => {
  it("Bruiser: hit flash at 650 ms, falls backwards, goes grey, the figure is gone for the slab", () => {
    const exhausted = clipOf(HeroClass.Bruiser, "exhausted");
    expect([exhausted.durationMs, exhausted.loop, exhausted.activeEndMs]).toEqual([5400, false, 4860]);
    const flash = sampleClip(exhausted, 648);
    expect(r(flash.flash.alpha, flash.rig.x)).toEqual([1, -4]);
    expect(sampleClip(exhausted, 0).grey.alpha).toBe(0);
    const fallen = sampleClip(exhausted, 3348);
    expect(r(fallen.rig.rotation, fallen.rig.x, fallen.rig.y, fallen.grey.alpha)).toEqual([-90, -14, 3, 1]);
    expect(sampleClip(exhausted, 4100).rig.alpha).toBe(0);
    expect(sampleClip(exhausted, 4100).teamRing.alpha).toBe(0);
  });

  it("Controller topples forward and its backpack sparks while the beacon goes red and then out", () => {
    const exhausted = clipOf(HeroClass.Controller, "exhausted");
    const toppled = sampleClip(exhausted, 3348).rig;
    expect(r(toppled.rotation, toppled.x)).toEqual([90, 18]);
    expect(sampleClip(exhausted, 0).sparks.alpha).toBe(0);
    expect(sampleClip(exhausted, 1500).sparks.alpha).toBe(1);
    expect(sampleClip(exhausted, 2600).sparks.alpha).toBe(0);
    expect(sampleClip(exhausted, 100)).toMatchObject({ beacon: { alpha: 1 }, beaconRed: { alpha: 0 } });
    expect(sampleClip(exhausted, 1500)).toMatchObject({ beacon: { alpha: 0 }, beaconRed: { alpha: 1 } });
    expect(sampleClip(exhausted, 3500).beaconRed.alpha).toBe(0);
  });

  it("Assassin falls faster and flings the rifle forward, where it lies", () => {
    const exhausted = clipOf(HeroClass.Assassin, "exhausted");
    // Already on the ground at 50 % (2700 ms); the Bruiser is still falling then.
    expect(r(sampleClip(exhausted, 2700).rig.rotation)).toEqual([-90]);
    expect(sampleClip(clipOf(HeroClass.Bruiser, "exhausted"), 2700).rig.rotation).toBeGreaterThan(-90);
    expect(sampleClip(exhausted, 1000).gun.alpha).toBe(1);
    expect(sampleClip(exhausted, 1000).dropGun.alpha).toBe(0);
    expect(sampleClip(exhausted, 1400).dropGun.alpha).toBe(0);
    expect(sampleClip(exhausted, 2000).gun.alpha).toBe(0);
    expect(sampleClip(exhausted, 2000).dropGun.alpha).toBe(1);
    const lying = sampleClip(exhausted, 3000).dropGun;
    expect(r(lying.x, lying.y, lying.rotation)).toEqual([32, 22, -270]);
  });

  it("is a pure function of the time", () => {
    const exhausted = clipOf(HeroClass.Assassin, "exhausted");
    expect(sampleClip(exhausted, 2345)).toEqual(sampleClip(exhausted, 2345));
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
