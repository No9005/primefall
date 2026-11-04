import { describe, expect, it } from "vitest";
import { areaLift, areaRing, enemyFade, GHOST_ALPHA, GHOST_FADE_MS, zoneRingAt } from "./vision-effects";

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
});

describe("Prime Zone ring", () => {
  it("grows and fades once per loop", () => {
    expect(zoneRingAt(0)).toEqual({ scale: 0.4, alpha: 0.8 });
    expect(zoneRingAt(800).alpha).toBeCloseTo(0.4);
    expect(zoneRingAt(1600)).toEqual(zoneRingAt(0));
  });
});
