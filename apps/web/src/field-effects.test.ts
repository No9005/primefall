import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames } from "./playback";
import {
  BLOCK_RUBIES_MS,
  bubbleFormAt,
  chargeAt,
  chunkAt,
  coverEditsOf,
  coverDropAt,
  cueEndMs,
  effectCuesOf,
  fireballAt,
  rippleAt,
  rubyBurstAt,
  rubyPopAt,
  shardAt,
  slideProgress,
} from "./weapon-effects";

const fireOf = () => 620;
const at = (col: number, row: number) => ({ col, row });

describe("Pull slide", () => {
  it("slides a tile in 300 ms, fast first and easing out", () => {
    expect(slideProgress(0)).toBe(0);
    expect(slideProgress(150)).toBe(0.75);
    expect(slideProgress(300)).toBe(1);
    expect(slideProgress(900)).toBe(1);
  });
});

describe("Urban Renewal", () => {
  const destroyed: MatchEvent = { kind: EventKind.CoverDestroyed, tick: 1, heroId: "a", to: at(5, 2), card: "Urban Renewal" };
  const blasted: MatchEvent = { kind: EventKind.AreaBlasted, tick: 1, heroId: "a", to: at(5, 2), amount: 3, card: "Urban Renewal" };

  it("flies the bomb for 340 ms and blows the Cover up where it lands", () => {
    const [cue] = effectCuesOf([destroyed], fireOf);
    expect(cue).toEqual({ kind: "breach", casterId: "a", tile: at(5, 2), fireMs: 620, flightMs: 340, cover: true, size: 1 });
    expect(coverEditsOf([cue!])).toEqual([{ kind: "destroyed", tile: at(5, 2), atMs: 960 }]);
    expect(cueEndMs(cue!)).toBe(960 + 1464);
  });

  it("blasts the whole area once, with or without Cover in it, and keeps one cue for the blast and the Cover", () => {
    expect(effectCuesOf([blasted], fireOf)).toEqual([{ kind: "breach", casterId: "a", tile: at(5, 2), fireMs: 620, flightMs: 340, cover: false, size: 3 }]);
    expect(effectCuesOf([blasted, destroyed], fireOf)).toEqual([{ kind: "breach", casterId: "a", tile: at(5, 2), fireMs: 620, flightMs: 340, cover: true, size: 1 }]);
  });

  it("lifts the bomb 26 px at the top of its arc and drops it back to the ground", () => {
    expect(chargeAt(0)).toEqual({ progress: 0, lift: 0 });
    expect(chargeAt(170).lift).toBe(26);
    expect(chargeAt(340)).toEqual({ progress: 1, lift: 0 });
  });

  it("grows the fireball to 1 x at 120 ms and throws the chunks away from the wall", () => {
    expect(fireballAt(120)).toEqual({ scale: 1, alpha: 1 });
    expect(chunkAt(48, 0).alpha).toBe(1);
    expect(chunkAt(48, 0).y).toBeCloseTo(0);
    expect(chunkAt(456, 0)).toMatchObject({ x: -22, y: -22 });
    expect(chunkAt(1250, 1)).toMatchObject({ x: 20, y: 4 });
  });
});

describe("Cover placed and Half Cover", () => {
  it("drops the crate at the slam and has the bars up 1.17 s later, when the terrain gets them", () => {
    const [cue] = effectCuesOf([{ kind: EventKind.CoverPlaced, tick: 1, heroId: "c", to: at(2, 2), card: "Temporary Solution" }], fireOf);
    expect(cue).toEqual({ kind: "coverPlaced", casterId: "c", tile: at(2, 2), startMs: 950 });
    expect(coverEditsOf([cue!])).toEqual([{ kind: "placed", tile: at(2, 2), atMs: 950 + 1170, casterId: expect.any(String) }]);
    expect(cueEndMs(cue!)).toBe(950 + 1400);
  });

  it("drops in three phases: falls 0.45 s, lands 0.22 s, unfolds 0.5 s", () => {
    expect(coverDropAt(0)).toMatchObject({ crateHeight: 1, landing: 0, unfold: 0, crate: true });
    expect(coverDropAt(450)).toMatchObject({ crateHeight: 0, landing: 0, crate: true });
    expect(coverDropAt(450 + 110).flash).toBe(1);
    expect(coverDropAt(450 + 220)).toMatchObject({ landing: 1, unfold: 0 });
    expect(coverDropAt(450 + 220 + 250)).toMatchObject({ crate: false, unfold: 0.75 });
    expect(coverDropAt(1170).unfold).toBe(1);
  });

  it("sends the projectile into the wall and tags the reduced number Half Cover", () => {
    const cues = effectCuesOf([{ kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", card: "Handle With Care", damage: 1, distance: 3, halfCover: true }], fireOf);
    expect(cues[0]).toMatchObject({ kind: "shot", halfCover: true });
    expect(cues.filter((cue) => cue.kind === "number").map((cue) => (cue.kind === "number" ? [cue.text, cue.style] : []))).toEqual([["-1", "damage"], ["Half Cover", "failed"]]);
  });

  it("shows an unreduced hit without the wall", () => {
    const [shot] = effectCuesOf([{ kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", card: "Handle With Care", damage: 2, distance: 3 }], fireOf);
    expect(shot).not.toHaveProperty("halfCover");
  });
});

describe("Shield", () => {
  it("pops the rubies at the Shield gesture's crouch", () => {
    const gained = effectCuesOf([{ kind: EventKind.ShieldGained, tick: 1, heroId: "a", amount: 2 }], fireOf);
    expect(gained).toEqual([{ kind: "shieldGain", toId: "a", startMs: BLOCK_RUBIES_MS, amount: 2 }]);
  });

  it("pops a ruby from 0 to 1.5 x to 1 x, the next one 60 ms later", () => {
    expect(rubyPopAt(0, 0)).toBe(0);
    expect(rubyPopAt(256, 0)).toBe(1.5);
    expect(rubyPopAt(448, 0)).toBe(1);
    expect(rubyPopAt(60, 1)).toBe(0);
    expect(rubyPopAt(316, 1)).toBe(1.5);
  });

  it("forms the bubble from 0.6 x to 1.08 x to 1 x while it fades in", () => {
    expect(bubbleFormAt(0)).toEqual({ scale: 0.6, alpha: 0 });
    expect(bubbleFormAt(384)).toEqual({ scale: 1.08, alpha: 1 });
    expect(bubbleFormAt(576).scale).toBe(1);
  });

  it("ripples over the bubble and bursts one ruby for every absorbed hit, at the impact", () => {
    const cues = effectCuesOf([{ kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", card: "Handle With Care", absorbed: 1, damage: 0, distance: 2 }], fireOf);
    expect(cues).toContainEqual({ kind: "shieldHit", toId: "t", startMs: 620 + 480, absorbed: 1 });
    expect(rippleAt(100)).toBeUndefined();
    expect(rippleAt(110 + 104)?.scale).toBeCloseTo(1 + 0.7 * (104 / 990));
    expect(rippleAt(110 + 104)?.alpha).toBeCloseTo(0.9);
    expect(rubyBurstAt(-5)).toBe(1);
    expect(rubyBurstAt(210)).toBe(1.6);
    expect(rubyBurstAt(520)).toBe(0);
  });

  it("breaks the bubble into five shards that fly away and fade within 420 ms", () => {
    expect([0, 1, 2, 3, 4].every((index) => shardAt(0, index)?.alpha === 1)).toBe(true);
    expect(shardAt(420, 0)).toBeUndefined();
    expect(shardAt(210, 0)).toEqual({ x: -9, y: -7, turn: -45, alpha: 0.5 });
  });
});

describe("in the frames of the playback", () => {
  it("takes the Cover edit of an Urban Renewal from its cue", () => {
    const frames = buildPlaybackFrames([{ kind: EventKind.CoverDestroyed, tick: 1, heroId: "a", to: at(5, 2), card: "Urban Renewal" }], () => HeroClass.Bruiser);
    expect(frames[0]!.coverEdits).toHaveLength(1);
    expect(frames[0]!.holdMs).toBeGreaterThanOrEqual(960 + 1464);
  });
});
