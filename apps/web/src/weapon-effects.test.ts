import { AttackFailReason, EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames } from "./playback";
import { crossfireAt, cueEndMs, effectCuesOf, flightMs, flightProgress, impactMs, numberAt, reticleAt, shakeAt, weaponOf } from "./weapon-effects";

const hit = (extra: Partial<MatchEvent>): MatchEvent => ({ kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", ...extra });
const fireOf = (_heroId: string, card: string | undefined) => (card === "Long Shot" ? 1650 : 620);

describe("the flight of a projectile", () => {
  it("flies at the speed of its weapon over the tiles of the Range", () => {
    // 4 tiles of 24 px: the slug at 0.10 px/ms, the tracer at 0.30.
    expect(flightMs("Slam Shot", 4)).toBe(960);
    expect(flightMs("Precision Shot", 4)).toBe(320);
  });

  it("has no flight for the Long Shot: the line is there at once", () => {
    expect(flightMs("Long Shot", 7)).toBe(0);
    expect(impactMs("Long Shot", 7, 1650)).toBe(1650);
  });

  it("lands the impact at the fire beat plus the flight", () => {
    expect(impactMs("Slam Shot", 3, 620)).toBe(620 + 720);
  });

  it("maps the cards of a class to its weapon", () => {
    expect(["Concussion Round", "Ghost Shot", "Tag Round", "Breach Charge"].map(weaponOf)).toEqual(["slam", "precision", "tag", undefined]);
  });

  it("moves the projectile in proportion to the time since the fire beat", () => {
    expect(flightProgress(-10, 500)).toBe(0);
    expect(flightProgress(250, 500)).toBe(0.5);
    expect(flightProgress(900, 500)).toBe(1);
  });
});

describe("the cues of the events", () => {
  it("makes a shot and a red number for a hit, the number 20 ms after the impact", () => {
    const cues = effectCuesOf([hit({ card: "Slam Shot", damage: 2, distance: 3 })], fireOf);
    expect(cues).toEqual([
      { kind: "shot", weapon: "slam", fromId: "a", toId: "t", fireMs: 620, flightMs: 720, overdrive: false },
      { kind: "number", toId: "t", startMs: 620 + 720 + 20, text: "-2", style: "damage" },
    ]);
  });

  it("shows the long-range bonus of the Long Shot in gold, and a Shot closer by in red", () => {
    const far = effectCuesOf([hit({ card: "Long Shot", damage: 4, distance: 6 })], fireOf);
    expect(far.at(-1)).toMatchObject({ text: "-4", style: "bonus", startMs: 1670 });
    const near = effectCuesOf([hit({ card: "Long Shot", damage: 2, distance: 5 })], fireOf);
    expect(near.at(-1)).toMatchObject({ text: "-2", style: "damage" });
  });

  it("shows the Shield that absorbed in blue, before the Deck Damage", () => {
    const numbers = effectCuesOf([hit({ card: "Pulse Bolt", damage: 1, absorbed: 1, distance: 2 })], fireOf).filter((cue) => cue.kind === "number");
    expect(numbers.map((cue) => (cue.kind === "number" ? [cue.text, cue.style] : []))).toEqual([["Shield -1", "shield"], ["-1", "damage"]]);
  });

  it("adds a CROSSFIRE cue to a hit with Crossfire and stacks a second one on the same target", () => {
    const crossfire = (cues: ReturnType<typeof effectCuesOf>) => cues.filter((cue) => cue.kind === "crossfire");
    expect(crossfire(effectCuesOf([hit({ card: "Slam Shot", damage: 2, distance: 3 })], fireOf))).toEqual([]);
    const cues = effectCuesOf([hit({ card: "Slam Shot", damage: 3, crossfire: 1, distance: 3 }), hit({ heroId: "b", card: "Slam Shot", damage: 3, crossfire: 2, distance: 3 })], fireOf);
    expect(crossfire(cues).map((cue) => (cue.kind === "crossfire" ? [cue.amount, cue.stack] : []))).toEqual([[1, 0], [2, 1]]);
    expect(cueEndMs(crossfire(cues)[0]!)).toBe(crossfire(cues)[0]!.startMs + 700);
  });

  it("names a failed Attack by its reason: Out of range, Not visible, or Blocked", () => {
    const failed = (reason: AttackFailReason): MatchEvent => ({ kind: EventKind.AttackFailed, tick: 1, heroId: "a", targetId: "t", card: "Slam Shot", reason });
    expect(effectCuesOf([failed(AttackFailReason.NoLineOfSight)], fireOf)).toEqual([{ kind: "number", toId: "t", startMs: 640, text: "Blocked", style: "failed" }]);
    expect(effectCuesOf([failed(AttackFailReason.FullCover)], fireOf)[0]).toMatchObject({ text: "Blocked" });
    expect(effectCuesOf([failed(AttackFailReason.OutOfRange)], fireOf)[0]).toMatchObject({ text: "Out of range" });
    expect(effectCuesOf([failed(AttackFailReason.NotVisible)], fireOf)[0]).toMatchObject({ text: "Not visible" });
  });

  it("locks Marked on when the dart lands and Slow at the field beat", () => {
    const cues = effectCuesOf(
      [hit({ card: "Tag Round", damage: 1, distance: 2 }), { kind: EventKind.MarkedApplied, tick: 1, heroId: "a", targetId: "t" }, { kind: EventKind.SlowApplied, tick: 1, heroId: "a", targetId: "t" }],
      fireOf,
    );
    expect(cues.filter((cue) => cue.kind === "marked" || cue.kind === "slow")).toEqual([
      { kind: "marked", toId: "t", startMs: 730 + 160 },
      { kind: "slow", toId: "t", startMs: 1200 },
    ]);
  });

  it("lets the frame last until the slowest effect is over", () => {
    const [shot, number] = effectCuesOf([hit({ card: "Slam Shot", damage: 2, distance: 3 })], fireOf);
    expect(cueEndMs(shot!)).toBe(620 + 720 + 500);
    expect(cueEndMs(number!)).toBe(620 + 720 + 20 + 800);
  });

  it("is part of the frames of the playback", () => {
    const classOf = (id: string) => (id === "a" ? HeroClass.Bruiser : HeroClass.Assassin);
    const [frame] = buildPlaybackFrames([hit({ card: "Slam Shot", damage: 2, distance: 3 })], classOf);
    expect(frame!.effects).toHaveLength(2);
  });
});

describe("the curves", () => {
  it("rises a number 14 px over 800 ms while it fades out", () => {
    expect(numberAt(0)).toEqual({ rise: 0, alpha: 1 });
    expect(numberAt(400).rise).toBe(7);
    expect(numberAt(800)).toEqual({ rise: 14, alpha: 0 });
  });

  it("rises the CROSSFIRE label 8 px over 700 ms while it fades out", () => {
    expect(crossfireAt(0)).toEqual({ rise: 0, alpha: 1 });
    expect(crossfireAt(350).rise).toBe(4);
    expect(crossfireAt(700)).toEqual({ rise: 8, alpha: 0 });
  });

  it("locks the reticle on from 2.4 x to 1 x, turning 45 degrees", () => {
    expect(reticleAt(0).scale).toBeCloseTo(2.4);
    expect(reticleAt(300)).toEqual({ scale: 1, rotation: 45, alpha: 1 });
  });

  it("shakes the Long Shot for 150 ms by at most 1.5 px", () => {
    expect(shakeAt(-1)).toEqual({ x: 0, y: 0 });
    expect(shakeAt(150)).toEqual({ x: 0, y: 0 });
    const early = shakeAt(10);
    expect(Math.hypot(early.x, early.y)).toBeLessThanOrEqual(1.5 * Math.SQRT2);
    expect(early.y).toBeGreaterThan(1);
  });
});
