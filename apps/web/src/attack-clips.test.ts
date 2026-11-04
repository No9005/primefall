import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { ClipPlayer } from "./clip-player";
import { attackClipName, clipOf, sampleClip } from "./hero-clips";
import { buildPlaybackFrames, IMPACT_AFTER_FIRE_MS, STEP_MS } from "./playback";

describe("the attack clips, sampled at the beats of the reference", () => {
  it("Bruiser Slam Shot: 2400 ms, fires at 620 ms, back at rest by 1540 ms", () => {
    const slam = clipOf(HeroClass.Bruiser, "attack");
    expect([slam.durationMs, slam.fireMs, slam.activeEndMs, slam.loop]).toEqual([2400, 620, 1540, false]);
    expect(sampleClip(slam, 0).armF.rotation).toBe(-30);
    expect(sampleClip(slam, 624).armF.rotation).toBeCloseTo(-108);
    expect(sampleClip(slam, 624).torso).toMatchObject({ x: expect.closeTo(-3, 5), rotation: expect.closeTo(-9, 5) });
    expect(sampleClip(slam, 1584).armF.rotation).toBeCloseTo(-30);
    expect(sampleClip(slam, 9999).armF.rotation).toBe(-30);
  });

  it("Assassin Precision Shot (2200 ms, fire 570) and Long Shot (3600 ms: kneels, fire 1650)", () => {
    const precision = clipOf(HeroClass.Assassin, "attack");
    expect([precision.durationMs, precision.fireMs, precision.activeEndMs]).toEqual([2200, 570, 1450]);
    expect(sampleClip(precision, 572).armF.rotation).toBeCloseTo(-98);
    const long = clipOf(HeroClass.Assassin, "longShot");
    expect([long.durationMs, long.fireMs, long.activeEndMs]).toEqual([3600, 1650, 3170]);
    // Kneeling: the rear leg folds back and the torso drops while the scope is held.
    expect(sampleClip(long, 792).legR.rotation).toBeCloseTo(-75);
    expect(sampleClip(long, 1000).torso.y).toBeCloseTo(4);
    expect(sampleClip(long, 1656).armF.rotation).toBeCloseTo(-100);
    expect(sampleClip(long, 3400).torso.y).toBe(0);
  });

  it("Controller Pulse Bolt (2400 ms), Tag Round (2800 ms) and Slow pulse (2600 ms) raise the arm and fire at 26 %", () => {
    const bolt = clipOf(HeroClass.Controller, "attack");
    expect([bolt.durationMs, bolt.fireMs, bolt.activeEndMs]).toEqual([2400, 620, 1630]);
    expect(sampleClip(bolt, 624).armF.rotation).toBeCloseTo(-100);
    expect(clipOf(HeroClass.Controller, "tagRound")).toMatchObject({ durationMs: 2800, fireMs: 730 });
    expect(clipOf(HeroClass.Controller, "slowPulse")).toMatchObject({ durationMs: 2600, fireMs: 680 });
  });

  it("gives every card without a clip of its own the basic attack of its class", () => {
    expect(attackClipName("Concussion Round")).toBe("attack");
    expect(attackClipName("Ghost Shot")).toBe("attack");
    expect(attackClipName("Long Shot")).toBe("longShot");
    expect(attackClipName("Tag Round")).toBe("tagRound");
    expect(clipOf(HeroClass.Bruiser, "longShot")).toBe(clipOf(HeroClass.Bruiser, "attack"));
  });
});

describe("the Hit, Shield-absorbs and Block clips", () => {
  it("Hit: flash at 364 ms, knocked back, head snaps, ring red, at rest by 1350 ms", () => {
    const hit = clipOf(HeroClass.Controller, "hit");
    expect([hit.durationMs, hit.activeEndMs]).toEqual([2600, 1350]);
    const impact = sampleClip(hit, 364);
    expect(impact.rig.x).toBeCloseTo(-5);
    expect(impact.flash.alpha).toBeCloseTo(1);
    expect(impact.ring.alpha).toBeCloseTo(1);
    expect(impact.head.rotation).toBeCloseTo(-22);
    expect(sampleClip(hit, 0).flash.alpha).toBe(0);
    expect(sampleClip(hit, 468).flash.alpha).toBeLessThan(0.01);
    const rest = sampleClip(hit, 1352);
    expect(rest.rig.x).toBeCloseTo(0);
    expect(rest.torso.rotation).toBeCloseTo(0);
    expect(rest.ring.alpha).toBeCloseTo(0);
  });

  it("Hit, Shield absorbs: a 1.5 px shake, no flash, no knock-back", () => {
    const absorb = clipOf(HeroClass.Bruiser, "absorb");
    expect(sampleClip(absorb, 338).rig.x).toBeCloseTo(-1.5);
    for (const ms of [0, 338, 468, 1000]) {
      expect(sampleClip(absorb, ms).flash.alpha).toBe(0);
      expect(Math.abs(sampleClip(absorb, ms).rig.x)).toBeLessThanOrEqual(1.5);
    }
  });

  it("Block: crouches by 572 ms, holds, releases by 2900 ms (the Assassin's cape flares)", () => {
    for (const heroClass of [HeroClass.Bruiser, HeroClass.Assassin, HeroClass.Controller]) {
      const block = clipOf(heroClass, "block");
      expect([block.durationMs, block.activeEndMs]).toEqual([3200, 2900]);
      expect(sampleClip(block, 1600).armF.rotation).toBeCloseTo(-125);
      expect(sampleClip(block, 1600).torso.y).toBeCloseTo(3);
      expect(sampleClip(block, 2900).torso.y).toBeCloseTo(0);
    }
    expect(sampleClip(clipOf(HeroClass.Assassin, "block"), 1600).cape.rotation).toBeCloseTo(22);
    expect(sampleClip(clipOf(HeroClass.Bruiser, "block"), 1600).cape.rotation).toBe(0);
  });
});

describe("the ClipPlayer with attacks", () => {
  it("starts a delayed clip at its time, and again for the same clip in a new frame", () => {
    const player = new ClipPlayer(HeroClass.Bruiser, 0);
    const first = {};
    player.play("hit", 0, 1100, first);
    expect(player.playing).toBe("idle");
    player.sample(1099);
    expect(player.playing).toBe("idle");
    player.play("hit", 1099, 1100, first);
    player.sample(1100);
    expect(player.playing).toBe("hit");
    player.play("attack", 2000, 0, {});
    player.play("attack", 2000, 0, first);
    expect(player.sample(2624).armF.rotation).toBeCloseTo(-108);
    // The same card in the next frame plays again from its start.
    player.play("attack", 5000, 0, {});
    expect(player.sample(5624).armF.rotation).toBeCloseTo(-108);
  });

  it("shortens the delay with the clip speed", () => {
    const player = new ClipPlayer(HeroClass.Bruiser, 0, 2);
    player.play("hit", 0, 1000);
    player.sample(500);
    expect(player.playing).toBe("hit");
  });
});

describe("the playback of attacks", () => {
  const attack = (kind: EventKind, extra: Partial<MatchEvent> = {}): MatchEvent => ({ kind, tick: 1, heroId: "a", targetId: "t", ...extra });
  const classOf = (id: string) => (id === "a" ? HeroClass.Assassin : HeroClass.Bruiser);

  it("plays the attacker's clip by card and the target's Hit at the impact beat", () => {
    const [frame] = buildPlaybackFrames([attack(EventKind.AttackHit, { card: "Long Shot", damage: 2 })], classOf);
    expect(frame!.clips).toEqual({ a: "longShot", t: "hit" });
    expect(frame!.delays).toEqual({ t: 1650 + IMPACT_AFTER_FIRE_MS });
    // The Tick lasts until the slowest clip has reached its active end: the Hit ends 1350 ms after the impact.
    expect(frame!.holdMs).toBe(1650 + IMPACT_AFTER_FIRE_MS + 1350);
  });

  it("shows the absorb reaction when the Shield took the whole damage, and the Hit otherwise", () => {
    const [absorbed] = buildPlaybackFrames([attack(EventKind.AttackHit, { damage: 0, absorbed: 2 })], classOf);
    expect(absorbed!.clips.t).toBe("absorb");
    const [partly] = buildPlaybackFrames([attack(EventKind.AttackHit, { damage: 1, absorbed: 1 })], classOf);
    expect(partly!.clips.t).toBe("hit");
  });

  it("plays the attacker's clip and nothing on the target for a failed Attack", () => {
    const [frame] = buildPlaybackFrames([attack(EventKind.AttackFailed)], classOf);
    expect(frame!.clips).toEqual({ a: "attack" });
    expect(frame!.holdMs).toBe(1450);
  });

  it("plays Block for a Shield without a card, and not for the Shield of a card", () => {
    const [block] = buildPlaybackFrames([{ kind: EventKind.ShieldGained, tick: 1, heroId: "a", amount: 2 }], classOf);
    expect(block!.clips).toEqual({ a: "block" });
    expect(block!.holdMs).toBe(2900);
    const [aegis] = buildPlaybackFrames([{ kind: EventKind.ShieldGained, tick: 1, heroId: "a", amount: 2, card: "Aegis Protocol" }], classOf);
    expect(aegis!.clips).toEqual({});
  });

  it("keeps one step for a frame with only steps, whatever the classes", () => {
    const [frame] = buildPlaybackFrames([{ kind: EventKind.Step, tick: 1, heroId: "a", to: { col: 1, row: 0 } }], classOf);
    expect(frame!.holdMs).toBe(STEP_MS);
  });
});
