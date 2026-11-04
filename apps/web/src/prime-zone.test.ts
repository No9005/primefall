import { findTiles, REACTOR_DECK, SquadId, TileKind } from "game-core";
import { describe, expect, it } from "vitest";
import { primeCallouts, primeScore, zoneOccupancy, zoneTint } from "./prime-zone";

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
  it("is hidden while nobody stands in the zone", () => {
    expect(primeScore(counts(0, 0), L, false, false)).toBeUndefined();
  });

  it("shows the own count in teal pips", () => {
    expect(primeScore(counts(2, 0), L, true, false)).toEqual({ filled: 2, state: "own", label: "PRIME ZONE" });
  });

  it("says ENEMY HOLDS when the enemy holds the count", () => {
    expect(primeScore(counts(0, 1), L, true, false)).toEqual({ filled: 1, state: "enemy", label: "ENEMY HOLDS" });
  });

  it("shows the contested state with empty pips", () => {
    expect(primeScore(counts(2, 0), L, true, true)).toEqual({ filled: 0, state: "contested", label: "CONTESTED" });
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

  it("tints teal when own, gold at the third Resolution, amber when contested, red when the enemy holds it, grey otherwise", () => {
    expect(zoneTint(primeScore(counts(1, 0), L, true, false))).toEqual({ color: 0x2ec4b6, alpha: 0.35, pulse: true });
    expect(zoneTint(primeScore(counts(2, 0), L, true, false)).alpha).toBeCloseTo(0.45);
    expect(zoneTint(primeScore(counts(3, 0), L, true, false)).color).toBe(0xffd24a);
    expect(zoneTint(primeScore(counts(1, 0), L, true, true)).color).toBe(0xffb347);
    expect(zoneTint(primeScore(counts(0, 1), L, true, false)).color).toBe(0xe5484d);
    expect(zoneTint(undefined)).toEqual({ color: 0x8a99a8, alpha: 0.2, pulse: false });
  });
});
