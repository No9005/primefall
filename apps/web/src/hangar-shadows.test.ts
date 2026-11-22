import { describe, expect, it } from "vitest";
import { clipShadow } from "./hangar-scene";
import { BRIDGES, CLIPS, HANGAR_HEROES } from "./hangar-select";
import { BRIDGE_SHADOWS, CLIP_SHADOWS } from "./hangar-shadows";

describe("contact shadows of the Heroes", () => {
  it("has shadows for every clip and a spot for every frame of every bridge", () => {
    for (const hero of HANGAR_HEROES) {
      for (const [clip, { frames }] of Object.entries(CLIPS[hero])) {
        const runs = CLIP_SHADOWS[`${hero}-${clip}`];
        expect(runs, `${hero} ${clip}`).toBeTruthy();
        expect(runs?.[0]?.[0], `${hero} ${clip} starts at frame 0`).toBe(0);
        expect(Math.max(...(runs ?? []).map((run) => run[0])), `${hero} ${clip} stays inside the clip`).toBeLessThan(frames);
      }
      for (const [source, bridge] of Object.entries(BRIDGES[hero])) expect(BRIDGE_SHADOWS[`${hero}-${source}`]?.length, `${hero} bridge ${source}`).toBe(bridge.frames);
    }
  });

  it("puts Kit's shadow on the crate while he sits, takes it away while he jumps and puts it on the floor when his feet are down", () => {
    const seated = clipShadow("kit-select", 0);
    expect(seated).toBeDefined();
    expect(clipShadow("kit-select", 2)).toBeUndefined();
    const landed = clipShadow("kit-select", 16);
    expect(landed![1]).toBeGreaterThan(seated![1] + 50);
    // Taken back: gone during the jump up, on the crate when he sits again.
    expect(clipShadow("kit-desel", 7)).toBeUndefined();
    expect(clipShadow("kit-desel", 13)![1]).toBeCloseTo(seated![1], 1);
  });

  it("shows Kit's shadow on the crate when idle and on the floor when chosen (the first frames, which reduced motion holds)", () => {
    const idle = clipShadow("kit-idle", 0)!;
    const hold = clipShadow("kit-hold", 0)!;
    expect(hold[1]).toBeGreaterThan(idle[1] + 50);
    for (const key of ["max-idle", "tilly-idle", "max-hold", "tilly-hold"]) expect(clipShadow(key, 0), key).toBeDefined();
  });

  it("takes the shadow away while Max is off the ground", () => {
    const frames = Array.from({ length: CLIPS.max.act!.frames }, (_, frame) => clipShadow("max-act", frame));
    expect(frames.some((shadow) => shadow === undefined)).toBe(false);
    expect(new Set(frames.map((shadow) => shadow?.[2])).size).toBeGreaterThan(1);
  });
});
