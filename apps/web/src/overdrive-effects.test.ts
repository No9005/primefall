import { EventKind, type MatchEvent } from "game-core";
import { CLIP_SPEED } from "./clip-player";
import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { attackBadge, EffectsLayer, type EffectsWorld } from "./effects-layer";
import {
  aegisBeamAt,
  auraGlowAt,
  auraRingAt,
  badgeAt,
  coverEditsOf,
  cueEndMs,
  type EffectCue,
  effectCuesOf,
  overdriveTagAt,
  surgeBeamAt,
} from "./weapon-effects";

const at = (col: number, row: number) => ({ col, row });
const fireOf = (_heroId: string, card: string | undefined) => (card === "Long Shot" ? 1650 : 620);
const od = (extra: Partial<MatchEvent> & Pick<MatchEvent, "kind">): MatchEvent => ({ tick: 1, heroId: "a", overdrive: true, ...extra });

describe("the Overdrive aura", () => {
  it("is caused by any Overdrive event, once per acting Hero, and by no normal one", () => {
    const events = [od({ kind: EventKind.AttackHit, targetId: "t", card: "Mark Target", damage: 1, distance: 3 }), od({ kind: EventKind.MarkedApplied, targetId: "t", card: "Mark Target" })];
    expect(effectCuesOf(events, fireOf).filter((cue) => cue.kind === "aura")).toEqual([{ kind: "aura", heroId: "a", endMs: 1200 }]);
    expect(effectCuesOf([{ ...events[0]!, overdrive: false }], fireOf).some((cue) => cue.kind === "aura")).toBe(false);
  });

  it("lasts until the shot has left, and keeps the frame open that long", () => {
    const [aura] = effectCuesOf([od({ kind: EventKind.AttackHit, targetId: "t", card: "Long Shot", damage: 4, distance: 7 })], fireOf).filter((cue) => cue.kind === "aura");
    expect(aura).toEqual({ kind: "aura", heroId: "a", endMs: 2050 });
    expect(cueEndMs(aura!)).toBe(2050);
  });

  it("fades the glow in over 150 ms and out over the last 300 ms", () => {
    expect(auraGlowAt(0, 1200)).toBe(0);
    expect(auraGlowAt(150, 1200)).toBe(1);
    expect(auraGlowAt(900, 1200)).toBe(1);
    expect(auraGlowAt(1050, 1200)).toBe(0.5);
    expect(auraGlowAt(1200, 1200)).toBe(0);
  });

  it("lets two gold rings rise in a 1200 ms loop, half a loop apart", () => {
    expect(auraRingAt(0, 0)).toEqual({ rise: 0, scale: 0.5, alpha: 0 });
    expect(auraRingAt(240, 0)?.alpha).toBe(0.9);
    expect(auraRingAt(600, 0)?.rise).toBe(17);
    expect(auraRingAt(1200, 0)?.rise).toBe(0);
    expect(auraRingAt(300, 1)).toBeUndefined();
    expect(auraRingAt(600, 1)?.rise).toBe(0);
  });

  it("fades the OVERDRIVE tag in by 150 ms and out by 800 ms", () => {
    expect(overdriveTagAt(0).alpha).toBe(0);
    expect(overdriveTagAt(150).alpha).toBe(1);
    expect(overdriveTagAt(800)).toEqual({ rise: 10, alpha: 0 });
  });
});

describe("the nine Overdrive effects", () => {
  it("makes a Long Shot at long range gold, and at short range look like the normal shot", () => {
    const shotAt = (distance: number) => effectCuesOf([od({ kind: EventKind.AttackHit, targetId: "t", card: "Long Shot", damage: 2, distance })], fireOf).find((cue) => cue.kind === "shot");
    expect(shotAt(7)).toMatchObject({ overdrive: true });
    expect(shotAt(4)).toMatchObject({ overdrive: false });
  });

  it("adds a white ring and the shake to the Shockwave, and a heavier slide", () => {
    const cues = effectCuesOf(
      [od({ kind: EventKind.AttackHit, targetId: "t", card: "Shockwave", damage: 3, distance: 1 }), od({ kind: EventKind.Knockback, heroId: "t", from: at(1, 1), to: at(2, 1), card: "Shockwave" })],
      fireOf,
    );
    expect(cues.find((cue) => cue.kind === "shockwave")).toMatchObject({ overdrive: true });
    expect(cues.find((cue) => cue.kind === "knockback")).toMatchObject({ overdrive: true });
    expect(cues.find((cue) => cue.kind === "number")).toMatchObject({ text: "-3" });
  });

  it("blows up Breach Charge on its tile with one gold blast, with or without Cover, however many Heroes it hits", () => {
    const blast = (targetId: string) => od({ kind: EventKind.AttackHit, targetId, card: "Breach Charge", damage: 2, distance: 3, tile: at(5, 2) });
    const events = [blast("t"), blast("u"), blast("a")];
    const breaches = effectCuesOf(events, fireOf).filter((cue) => cue.kind === "breach");
    expect(breaches).toEqual([{ kind: "breach", casterId: "a", tile: at(5, 2), fireMs: 620, flightMs: 480, cover: false, overdrive: true }]);
    expect(coverEditsOf(breaches)).toEqual([]);
    // Every Hero in the blast gets its own number, allies and the Hero itself too.
    expect(effectCuesOf(events, fireOf).filter((cue) => cue.kind === "number").map((cue) => cue.kind === "number" && cue.toId)).toEqual(["t", "u", "a"]);
    const withCover = effectCuesOf([...events, od({ kind: EventKind.CoverDestroyed, to: at(5, 2), card: "Breach Charge" })], fireOf).filter((cue) => cue.kind === "breach");
    expect(withCover).toEqual([{ kind: "breach", casterId: "a", tile: at(5, 2), fireMs: 620, flightMs: 480, cover: true, overdrive: true }]);
    expect(coverEditsOf(withCover)).toHaveLength(1);
  });

  it("beams Adrenal Surge from the caster to the ally, and lets both glow", () => {
    const cues = effectCuesOf(
      [od({ kind: EventKind.AttackBonusGained, heroId: "a", amount: 1, card: "Adrenal Surge" }), od({ kind: EventKind.AttackBonusGained, heroId: "b", amount: 1, card: "Adrenal Surge" })],
      fireOf,
    );
    expect(cues.filter((cue) => cue.kind === "surge")).toEqual([
      { kind: "surge", casterId: "a", toId: "a", startMs: 384 },
      { kind: "surge", casterId: "a", toId: "b", startMs: 384 },
    ]);
    expect(cues.filter((cue) => cue.kind === "aura")).toEqual([{ kind: "aura", heroId: "a", endMs: 1200 }]);
  });

  it("grows the Adrenal Surge beam in 192 ms and drops the badge in from 2 x", () => {
    expect(surgeBeamAt(0).length).toBe(0);
    expect(surgeBeamAt(192)).toEqual({ length: 1, alpha: 1 });
    expect(surgeBeamAt(672).alpha).toBe(0);
    expect(badgeAt(0)).toEqual({ scale: 2, alpha: 0 });
    expect(badgeAt(192)).toEqual({ scale: 1, alpha: 1 });
    expect(badgeAt(100000)).toEqual({ scale: 1, alpha: 1 });
  });

  it("throws the Mark Target dart with a gold reticle, and applies Marked and Slow of Tag Round together", () => {
    const mark = effectCuesOf(
      [od({ kind: EventKind.AttackHit, targetId: "t", card: "Mark Target", damage: 1, distance: 3 }), od({ kind: EventKind.MarkedApplied, targetId: "t", card: "Mark Target" })],
      fireOf,
    );
    expect(mark.find((cue) => cue.kind === "shot")).toMatchObject({ weapon: "tag", overdrive: true });
    expect(mark.find((cue) => cue.kind === "marked")).toMatchObject({ overdrive: true, startMs: 620 + 240 });
    const tag = effectCuesOf(
      [
        od({ kind: EventKind.AttackHit, targetId: "t", card: "Tag Round", damage: 1, distance: 3 }),
        od({ kind: EventKind.MarkedApplied, targetId: "t", card: "Tag Round" }),
        od({ kind: EventKind.SlowApplied, targetId: "t", card: "Tag Round" }),
      ],
      fireOf,
    );
    expect(tag.find((cue) => cue.kind === "marked")).toMatchObject({ startMs: 730 + 240 });
    expect(tag.find((cue) => cue.kind === "slow")).toMatchObject({ startMs: 730 + 240 });
  });

  it("sends the Ghost Shot to the Ghost's tile: nobody there gives a puff and a grey label, an enemy there is hit", () => {
    const miss = effectCuesOf([od({ kind: EventKind.AttackFailed, targetId: "g", card: "Ghost Shot", distance: 4 })], fireOf);
    expect(miss.find((cue) => cue.kind === "shot")).toMatchObject({ miss: true, overdrive: true, toId: "g" });
    expect(miss.find((cue) => cue.kind === "number")).toMatchObject({ text: "nobody there", style: "failed", startMs: 620 + 320 + 20 });
    const hit = effectCuesOf([od({ kind: EventKind.AttackHit, targetId: "g", card: "Ghost Shot", damage: 2, distance: 4 })], fireOf);
    expect(hit.find((cue) => cue.kind === "shot")).toMatchObject({ overdrive: true });
    expect(hit.find((cue) => cue.kind === "shot")).not.toHaveProperty("miss");
    expect(hit.find((cue) => cue.kind === "number")).toMatchObject({ text: "-2" });
  });

  it("beams Aegis Protocol to both allies, three rubies each", () => {
    const cues = effectCuesOf(
      [od({ kind: EventKind.ShieldGained, heroId: "b", casterId: "c", amount: 3, card: "Aegis Protocol" }), od({ kind: EventKind.ShieldGained, heroId: "d", casterId: "c", amount: 3, card: "Aegis Protocol" })],
      fireOf,
    );
    expect(cues.filter((cue) => cue.kind === "aegisBeam").map((cue) => cue.kind === "aegisBeam" && cue.toId)).toEqual(["b", "d"]);
    expect(cues.filter((cue) => cue.kind === "shieldGain")).toHaveLength(2);
    expect(cues.filter((cue) => cue.kind === "aura")).toEqual([{ kind: "aura", heroId: "c", endMs: 1200 }]);
    expect(aegisBeamAt(256)).toEqual({ length: 1, alpha: 1 });
    expect(aegisBeamAt(1024).alpha).toBe(0);
  });
});

describe("drawing the Overdrive effects", () => {
  const world: EffectsWorld = {
    place: (id) => ({ x: id === "a" ? 0 : 128, y: id === "g" ? 40 : 0 }),
    tile: ({ col, row }) => ({ x: col * 64, y: row * 32 }),
    own: (id) => id === "a",
  };
  const cues: EffectCue[] = [
    { kind: "aura", heroId: "a", endMs: 1200 },
    { kind: "surge", casterId: "a", toId: "t", startMs: 384 },
    { kind: "surge", casterId: "a", toId: "a", startMs: 384 },
    { kind: "aegisBeam", casterId: "a", toId: "t", startMs: 640 },
    { kind: "shockwave", casterId: "a", startMs: 620, overdrive: true },
    { kind: "knockback", toId: "t", from: at(0, 0), to: at(1, 0), startMs: 620, tag: "Knockback 2", overdrive: true },
    { kind: "breach", casterId: "a", tile: at(2, 1), fireMs: 620, flightMs: 480, cover: false, overdrive: true },
    { kind: "shot", weapon: "long", fromId: "a", toId: "t", fireMs: 1650, flightMs: 0, overdrive: true },
    { kind: "shot", weapon: "precision", fromId: "a", toId: "g", fireMs: 620, flightMs: 320, overdrive: true, miss: true },
    { kind: "marked", toId: "t", startMs: 860, overdrive: true },
  ];

  it("draws every cue at any time of a frame, with and without reduced motion", () => {
    for (const reduced of [false, true]) {
      const layer = new EffectsLayer(new Container());
      layer.play(cues, 0, world, reduced);
      for (let ms = 0; ms <= 3200; ms += 50) expect(() => layer.update(ms)).not.toThrow();
    }
  });

  it("shakes the screen when an Overdrive Shockwave lands, and only then", () => {
    const layer = new EffectsLayer(new Container());
    layer.play([{ kind: "shockwave", casterId: "a", startMs: 620, overdrive: true }], 0, world, false);
    expect(layer.update(10 / CLIP_SPEED)).toEqual({ x: 0, y: 0 });
    expect(layer.update(640 / CLIP_SPEED)).not.toEqual({ x: 0, y: 0 });
    expect(layer.update(900 / CLIP_SPEED)).toEqual({ x: 0, y: 0 });
  });

  it("shows the +1 badge at once as state, and pops it in when it is gained", () => {
    const badge = attackBadge();
    badge.update(1_000_000);
    expect(badge.container.children[0]!.alpha).toBe(1);
    expect(badge.container.children[0]!.scale.x).toBe(1);
    badge.update(0);
    expect(badge.container.children[0]!.alpha).toBe(0);
  });
});
