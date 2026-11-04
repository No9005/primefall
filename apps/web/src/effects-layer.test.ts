import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { type EffectsWorld, EffectsLayer, shieldMark } from "./effects-layer";
import type { EffectCue } from "./weapon-effects";

const world: EffectsWorld = {
  place: (id) => ({ x: id === "a" ? 0 : 128, y: 0 }),
  tile: ({ col, row }) => ({ x: col * 64, y: row * 32 }),
  own: (id) => id === "a",
};
const tile = { col: 2, row: 1 };

const CUES: EffectCue[] = [
  { kind: "shockwave", casterId: "a", startMs: 100 },
  { kind: "knockback", toId: "t", from: { col: 0, row: 0 }, to: tile, startMs: 100, tag: "Knockback 2" },
  { kind: "breach", casterId: "a", tile, fireMs: 100, flightMs: 480, cover: true, overdrive: false },
  { kind: "coverPlaced", casterId: "a", tile, startMs: 100 },
  { kind: "shot", weapon: "slam", fromId: "a", toId: "t", fireMs: 100, flightMs: 300, overdrive: false, halfCover: true },
  { kind: "number", toId: "t", startMs: 400, text: "Half Cover", style: "failed", drop: 9 },
  { kind: "shieldGain", toId: "a", startMs: 700, amount: 2 },
  { kind: "shieldHit", toId: "t", startMs: 400, absorbed: 1 },
];

describe("the effects layer", () => {
  it("draws every field effect at any time of a frame, with and without reduced motion", () => {
    for (const reduced of [false, true]) {
      const layer = new EffectsLayer(new Container());
      layer.play(CUES, 0, world, reduced);
      for (let ms = 0; ms <= 3000; ms += 50) expect(() => layer.update(ms)).not.toThrow();
    }
  });

  it("draws a Shield that is gained, that absorbs a hit, and that breaks", () => {
    const marks = [
      shieldMark({ held: 2, gain: { startMs: 700, amount: 2 }, cameraScale: 1 }),
      shieldMark({ held: 1, hit: { startMs: 400, absorbed: 1 }, cameraScale: 1 }),
      shieldMark({ held: 0, hit: { startMs: 400, absorbed: 2 }, cameraScale: 1 }),
    ];
    for (const mark of marks) for (let ms = 0; ms <= 1600; ms += 50) expect(() => mark.update(ms)).not.toThrow();
    // At zero the bubble is gone after the impact; with Shield left it stays.
    const [, stays, breaks] = marks;
    stays!.update(1000);
    breaks!.update(1000);
    expect(stays!.container.children[0]!.alpha).toBe(1);
    expect(breaks!.container.children[0]!.alpha).toBe(0);
  });
});
