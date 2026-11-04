import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames } from "./playback";
import {
  AEGIS_RUBIES_MS,
  BLOCK_RUBIES_MS,
  bubbleFormAt,
  chargeAt,
  chunkAt,
  coverEditsOf,
  coverWallAt,
  cueEndMs,
  effectCuesOf,
  fireballAt,
  rippleAt,
  rubyBurstAt,
  rubyPopAt,
  shardAt,
  shockRingAt,
  slideProgress,
} from "./weapon-effects";

const fireOf = () => 620;
const at = (col: number, row: number) => ({ col, row });

describe("Shockwave and Knockback", () => {
  const events: MatchEvent[] = [
    { kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", card: "Shockwave", damage: 2, distance: 1 },
    { kind: EventKind.Knockback, tick: 1, heroId: "t", from: at(3, 3), to: at(4, 3), card: "Shockwave" },
  ];

  it("makes one ring-and-dust cue for the caster and a slide with a Knockback 2 tag for the pushed Hero", () => {
    const cues = effectCuesOf(events, fireOf);
    expect(cues.filter((cue) => cue.kind === "shockwave")).toEqual([{ kind: "shockwave", casterId: "a", startMs: 620 }]);
    expect(cues.filter((cue) => cue.kind === "knockback")).toEqual([
      { kind: "knockback", toId: "t", from: at(3, 3), to: at(4, 3), startMs: 620, tag: "Knockback 2" },
    ]);
  });

  it("has only one Shockwave cue when it hits two enemies in the same frame", () => {
    const second: MatchEvent = { ...events[0]!, targetId: "u" };
    expect(effectCuesOf([events[0]!, second], fireOf).filter((cue) => cue.kind === "shockwave")).toHaveLength(1);
  });

  it("expands three rings from 0.5 x to 3 x over 580 ms, one every 100 ms", () => {
    expect(shockRingAt(0, 0)).toEqual({ scale: 0.5, alpha: 1 });
    expect(shockRingAt(580, 0)).toBeUndefined();
    expect(shockRingAt(50, 1)).toBeUndefined();
    expect(shockRingAt(390, 1)?.scale).toBeCloseTo(0.5 + 2.5 * (290 / 580));
  });

  it("slides a tile in 300 ms, fast first and easing out", () => {
    expect(slideProgress(0)).toBe(0);
    expect(slideProgress(150)).toBe(0.75);
    expect(slideProgress(300)).toBe(1);
    expect(slideProgress(900)).toBe(1);
  });
});

describe("Breach Charge", () => {
  const destroyed: MatchEvent = { kind: EventKind.CoverDestroyed, tick: 1, heroId: "a", to: at(5, 2), card: "Breach Charge" };

  it("flies the charge for 480 ms and blows the Cover up where it lands", () => {
    const [cue] = effectCuesOf([destroyed], fireOf);
    expect(cue).toEqual({ kind: "breach", casterId: "a", tile: at(5, 2), fireMs: 620, flightMs: 480 });
    expect(coverEditsOf([cue!])).toEqual([{ kind: "destroyed", tile: at(5, 2), atMs: 1100 }]);
    expect(cueEndMs(cue!)).toBe(1100 + 1464);
  });

  it("lifts the charge 26 px at the top of its arc and drops it back to the ground", () => {
    expect(chargeAt(0)).toEqual({ progress: 0, lift: 0 });
    expect(chargeAt(240).lift).toBe(26);
    expect(chargeAt(480)).toEqual({ progress: 1, lift: 0 });
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
  it("flashes the tile at the slam and has the wall up 480 ms later, when the terrain gets it", () => {
    const [cue] = effectCuesOf([{ kind: EventKind.CoverPlaced, tick: 1, heroId: "c", to: at(2, 2), card: "Deploy Cover" }], fireOf);
    expect(cue).toEqual({ kind: "coverPlaced", casterId: "c", tile: at(2, 2), startMs: 950 });
    expect(coverEditsOf([cue!])).toEqual([{ kind: "placed", tile: at(2, 2), atMs: 950 + 480 }]);
    expect(cueEndMs(cue!)).toBe(2720);
  });

  it("raises the wall from 0 to 1.15 x and settles at 1 x", () => {
    expect(coverWallAt(0).scaleY).toBe(0);
    expect(coverWallAt(480).scaleY).toBe(1.15);
    expect(coverWallAt(630).scaleY).toBe(1);
  });

  it("sends the projectile into the wall and tags the reduced number Half Cover", () => {
    const cues = effectCuesOf([{ kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", card: "Slam Shot", damage: 1, distance: 3, halfCover: true }], fireOf);
    expect(cues[0]).toMatchObject({ kind: "shot", halfCover: true });
    expect(cues.filter((cue) => cue.kind === "number").map((cue) => (cue.kind === "number" ? [cue.text, cue.style] : []))).toEqual([["-1", "damage"], ["Half Cover", "failed"]]);
  });

  it("shows an unreduced hit without the wall", () => {
    const [shot] = effectCuesOf([{ kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", card: "Slam Shot", damage: 2, distance: 3 }], fireOf);
    expect(shot).not.toHaveProperty("halfCover");
  });
});

describe("Shield", () => {
  it("pops the rubies at the Block's crouch and at the dome of Aegis Protocol", () => {
    const block = effectCuesOf([{ kind: EventKind.ShieldGained, tick: 1, heroId: "a", amount: 2 }], fireOf);
    expect(block).toEqual([{ kind: "shieldGain", toId: "a", startMs: BLOCK_RUBIES_MS, amount: 2 }]);
    const aegis = effectCuesOf([{ kind: EventKind.ShieldGained, tick: 1, heroId: "b", amount: 3, card: "Aegis Protocol" }], fireOf);
    expect(aegis[0]).toMatchObject({ toId: "b", startMs: AEGIS_RUBIES_MS, amount: 3 });
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
    const cues = effectCuesOf([{ kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", card: "Pulse Bolt", absorbed: 1, damage: 0, distance: 2 }], fireOf);
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
  it("lets a Shockwave frame last until its rings and the Knockback tag are over, and reports no Cover edits", () => {
    const classOf = (id: string) => (id === "a" ? HeroClass.Bruiser : HeroClass.Assassin);
    const frames = buildPlaybackFrames(
      [
        { kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "t", card: "Shockwave", damage: 2, distance: 1 },
        { kind: EventKind.Knockback, tick: 1, heroId: "t", from: at(3, 3), to: at(4, 3), card: "Shockwave" },
      ],
      classOf,
    );
    expect(frames[0]!.moves).toEqual({ t: at(4, 3) });
    expect(frames[0]!.effects.map((cue) => cue.kind)).toContain("knockback");
    expect(frames[0]!.coverEdits).toEqual([]);
  });

  it("takes the Cover edit of a Breach Charge from its cue", () => {
    const frames = buildPlaybackFrames([{ kind: EventKind.CoverDestroyed, tick: 1, heroId: "a", to: at(5, 2), card: "Breach Charge" }], () => HeroClass.Bruiser);
    expect(frames[0]!.coverEdits).toHaveLength(1);
    expect(frames[0]!.holdMs).toBeGreaterThanOrEqual(1100 + 1464);
  });
});
