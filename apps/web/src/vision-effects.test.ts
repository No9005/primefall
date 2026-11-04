import { describe, expect, it } from "vitest";
import { CLIP_SPEED } from "./clip-player";
import { areaContains, areaLift, areaRing, enemyFade, finished, GHOST_ALPHA, GHOST_FADE_MS, zoneRingAt } from "./vision-effects";

describe("Scout Drone area", () => {
  it("lifts the tiles from the middle outwards", () => {
    expect(areaLift(0, 0)).toBe(0);
    expect(areaLift(150, 0)).toBeCloseTo(0.5);
    expect(areaLift(300, 0)).toBe(1);
    expect(areaLift(140, 1)).toBe(0);
    expect(areaLift(440, 1)).toBe(1);
    expect(areaLift(300, 2)).toBeLessThan(areaLift(300, 1));
  });

  it("counts the ring of a tile around the centre", () => {
    const center = { col: 5, row: 5 };
    expect(areaRing(center, center)).toBe(0);
    expect(areaRing(center, { col: 6, row: 4 })).toBe(1);
    expect(areaRing(center, { col: 3, row: 5 })).toBe(2);
  });
});

describe("fog and Ghost", () => {
  it("fades an enemy to a 45 % Ghost and back", () => {
    expect(enemyFade("toGhost", 0)).toBe(1);
    expect(enemyFade("toGhost", GHOST_FADE_MS)).toBeCloseTo(GHOST_ALPHA);
    expect(enemyFade("toSeen", 0)).toBe(GHOST_ALPHA);
    expect(enemyFade("toSeen", GHOST_FADE_MS * 2)).toBe(1);
  });

  it("fades an enemy in when it appears in a Scout Drone area", () => {
    expect(enemyFade("appear", 0)).toBe(0);
    expect(enemyFade("appear", GHOST_FADE_MS / CLIP_SPEED / 2)).toBeCloseTo(0.5);
    expect(enemyFade("appear", GHOST_FADE_MS * 2)).toBe(1);
  });

  it("scales every duration with CLIP_SPEED", () => {
    expect(areaLift(150 / CLIP_SPEED, 0)).toBeCloseTo(0.5);
    expect(zoneRingAt(800 / CLIP_SPEED).alpha).toBeCloseTo(0.4);
    expect(finished(GHOST_FADE_MS / CLIP_SPEED, GHOST_FADE_MS)).toBe(true);
    expect(finished(GHOST_FADE_MS / CLIP_SPEED - 1, GHOST_FADE_MS)).toBe(false);
  });

  it("knows which tiles lie in an area", () => {
    expect(areaContains({ col: 5, row: 5 }, 3, { col: 6, row: 4 })).toBe(true);
    expect(areaContains({ col: 5, row: 5 }, 3, { col: 7, row: 5 })).toBe(false);
  });
});

describe("Prime Zone ring", () => {
  it("runs once per Resolution: grows, fades and stays gone", () => {
    expect(zoneRingAt(0)).toEqual({ scale: 0.4, alpha: 0.8 });
    expect(zoneRingAt(800 / CLIP_SPEED).alpha).toBeCloseTo(0.4);
    expect(zoneRingAt(1600 / CLIP_SPEED)).toEqual({ scale: 1.4, alpha: 0 });
    expect(zoneRingAt(5000)).toEqual({ scale: 1.4, alpha: 0 });
  });
});
