import { findTiles, REACTOR_DECK, SquadId, TileKind } from "game-core";
import { describe, expect, it } from "vitest";
import { LASER_FLICKER_MS, laserWallAlpha, primeCallouts, primeScore, zoneOccupancy, zoneTint } from "./prime-zone";

const L = SquadId.Left;
const R = SquadId.Right;
const counts = (left: number, right: number) => ({ [L]: left, [R]: right });
const texts = (before: [number, number], after: [number, number], you = L) => primeCallouts(counts(...before), counts(...after), you).map((c) => `${c.text}|${c.tone}`);

describe("primeCallouts", () => {
  it("counts up while the own Squad holds the zone", () => {
    expect(texts([0, 0], [1, 0])).toEqual(["PRIME ZONE 1 / 3|teal"]);
    expect(texts([1, 0], [2, 0])).toEqual(["PRIME ZONE 2 / 3|teal"]);
  });

  it("follows the third Resolution with VICTORY, or DEFEAT for the enemy's", () => {
    expect(texts([2, 0], [3, 0])).toEqual(["PRIME ZONE 3 / 3|teal", "VICTORY|gold"]);
    expect(texts([0, 2], [0, 3])).toEqual(["PRIME ZONE 3 / 3|red", "DEFEAT|red"]);
  });

  it("shows the enemy's count in red", () => {
    expect(texts([0, 0], [0, 1])).toEqual(["PRIME ZONE 1 / 3|red"]);
  });

  it("shows CONTESTED when a count falls back to 0", () => {
    expect(texts([2, 0], [0, 0])).toEqual(["CONTESTED|amber"]);
    expect(texts([0, 1], [0, 0])).toEqual(["CONTESTED|amber"]);
  });

  it("shows only the new count when control changes hands", () => {
    expect(texts([2, 0], [0, 1])).toEqual(["PRIME ZONE 1 / 3|red"]);
  });

  it("shows nothing when nothing changed", () => {
    expect(texts([0, 0], [0, 0])).toEqual([]);
  });
});

describe("primeScore", () => {
  it("is neutral with empty pips while nobody holds the zone", () => {
    expect(primeScore(counts(0, 0), L, false)).toEqual({ filled: 0, state: "neutral", label: "PRIME ZONE" });
  });

  it("shows the own count in teal pips", () => {
    expect(primeScore(counts(2, 0), L, false)).toEqual({ filled: 2, state: "own", label: "PRIME ZONE" });
  });

  it("says ENEMY HOLDS when the enemy holds the count", () => {
    expect(primeScore(counts(0, 1), L, false)).toEqual({ filled: 1, state: "enemy", label: "ENEMY HOLDS" });
  });

  it("shows the contested state with empty pips", () => {
    expect(primeScore(counts(2, 0), L, true)).toEqual({ filled: 0, state: "contested", label: "CONTESTED" });
  });
});

describe("zoneOccupancy and zoneTint", () => {
  const zone = findTiles(REACTOR_DECK, TileKind.PrimeZone)[0]!;
  const away = { col: 0, row: 0 };

  it("finds the Squads that stand in the zone, ignoring Exhausted Heroes and Ghosts", () => {
    expect(zoneOccupancy([{ position: zone, exhausted: false }], [{ position: away, exhausted: false }])).toEqual({ own: true, enemy: false, occupied: true, contested: false });
    expect(zoneOccupancy([{ position: zone, exhausted: true }], [{ position: zone, exhausted: false, ghost: true }]).occupied).toBe(false);
    expect(zoneOccupancy([{ position: zone, exhausted: false }], [{ position: zone, exhausted: false }]).contested).toBe(true);
  });

  it("looks teal when own, gold at the third Resolution, amber when contested, red when the enemy holds it, white otherwise", () => {
    expect(zoneTint(primeScore(counts(1, 0), L, false))).toEqual({ color: 0x2ec4b6, alpha: 0.35, emblemAlpha: 0.8, pulse: true, ring: true });
    expect(zoneTint(primeScore(counts(2, 0), L, false)).alpha).toBe(0.45);
    expect(zoneTint(primeScore(counts(3, 0), L, false))).toEqual({ color: 0xffd24a, alpha: 0.5, emblemAlpha: 0.9, pulse: true, ring: false });
    expect(zoneTint(primeScore(counts(1, 0), L, true))).toEqual({ color: 0xffb347, alpha: 0.4, emblemAlpha: 0.8, pulse: true, ring: false });
    expect(zoneTint(primeScore(counts(0, 1), L, false))).toEqual({ color: 0xe5484d, alpha: 0.35, emblemAlpha: 0.8, pulse: true, ring: false });
    expect(zoneTint(primeScore(counts(0, 0), L, false))).toEqual({ color: 0xe8eef5, alpha: 0.12, emblemAlpha: 0.5, pulse: true, ring: false });
  });

  it("does not turn contested or enemy for an enemy Hero in the zone outside our Line of Sight", () => {
    // Outside our sight the enemy is not in the list (or only as a Ghost), so the zone stays neutral.
    const unseen = zoneOccupancy([{ position: zone, exhausted: false }], [{ position: zone, exhausted: false, ghost: true }]);
    expect(unseen.contested).toBe(false);
    expect(unseen.enemy).toBe(false);
    expect(zoneTint(primeScore(counts(0, 0), L, unseen.contested)).color).toBe(0xe8eef5);
    expect(zoneTint(primeScore(counts(0, 0), L, zoneOccupancy([], []).contested)).color).toBe(0xe8eef5);
  });
});

describe("laser walls", () => {
  it("stand at the start of the flicker, drop out one by one, and are gone at its end", () => {
    expect(laserWallAlpha(0, 3)).toBe(1);
    expect(laserWallAlpha(LASER_FLICKER_MS, 3)).toBe(0);
    const on = (ms: number) => Array.from({ length: 20 }, (_, index) => laserWallAlpha(ms, index)).filter((alpha) => alpha > 0).length;
    expect(on(150)).toBeGreaterThan(on(950));
  });

  it("flickers the same way every time", () => {
    expect(laserWallAlpha(400, 7)).toBe(laserWallAlpha(400, 7));
  });
});
