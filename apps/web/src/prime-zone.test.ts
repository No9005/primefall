import { findTiles, NOTSTROM_MAP, SquadId, TileKind, ZoneKind, type ZoneView } from "game-core";
import { describe, expect, it } from "vitest";
import { LASER_FLICKER_MS, laserWallAlpha, type PrimeScore, type PrimeState, zoneCallouts, zoneOccupancy, zoneTint } from "./prime-zone";

const scoreOf = (state: PrimeState): PrimeScore => ({ filled: 0, state, label: "CR" });

describe("zoneOccupancy and zoneTint", () => {
  const zone = findTiles(NOTSTROM_MAP, TileKind.PrimeZone)[0]!;
  const away = { col: 0, row: 0 };

  it("finds the Squads that stand in the zone, ignoring Exhausted Heroes and Ghosts", () => {
    expect(zoneOccupancy([{ position: zone, exhausted: false }], [{ position: away, exhausted: false }])).toEqual({ own: true, enemy: false, occupied: true, contested: false });
    expect(zoneOccupancy([{ position: zone, exhausted: true }], [{ position: zone, exhausted: false, ghost: true }]).occupied).toBe(false);
    expect(zoneOccupancy([{ position: zone, exhausted: false }], [{ position: zone, exhausted: false }]).contested).toBe(true);
  });

  it("looks teal when own, amber when contested, red when the enemy holds it, white otherwise", () => {
    expect(zoneTint(scoreOf("own")).color).toBe(0x2ec4b6);
    expect(zoneTint(scoreOf("contested")).color).toBe(0xffb347);
    expect(zoneTint(scoreOf("enemy")).color).toBe(0xe5484d);
    expect(zoneTint(scoreOf("neutral")).color).toBe(0xe8eef5);
  });

  it("does not turn contested or enemy for an enemy Hero in the zone outside our Line of Sight", () => {
    // Outside our sight the enemy is not in the list (or only as a Ghost), so the zone stays neutral.
    const unseen = zoneOccupancy([{ position: zone, exhausted: false }], [{ position: zone, exhausted: false, ghost: true }]);
    expect(unseen.contested).toBe(false);
    expect(unseen.enemy).toBe(false);
    expect(zoneTint(scoreOf(unseen.contested ? "contested" : "neutral")).color).toBe(0xe8eef5);
    expect(zoneTint(scoreOf(zoneOccupancy([], []).contested ? "contested" : "neutral")).color).toBe(0xe8eef5);
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

describe("the sounds of the callouts", () => {
  it("plays a zone taken and Credits for the player's Squad when the zone changes hands, only Credits when it holds it", () => {
    const zone = (controller: SquadId | undefined) => ({ kind: ZoneKind.PrimeZone, active: true, controller, value: 2, tiles: [] }) as unknown as ZoneView;
    const taken = zoneCallouts([zone(undefined)], [zone(SquadId.Left)], SquadId.Left);
    expect(taken[0]!.sounds).toEqual(["zoneTaken", "score"]);
    const held = zoneCallouts([zone(SquadId.Left)], [zone(SquadId.Left)], SquadId.Left);
    expect(held[0]!.sounds).toEqual(["score"]);
  });

  it("makes no sound for the enemy taking the zone", () => {
    const zone = (controller: SquadId | undefined) => ({ kind: ZoneKind.PrimeZone, active: true, controller, value: 2, tiles: [] }) as unknown as ZoneView;
    expect(zoneCallouts([zone(undefined)], [zone(SquadId.Right)], SquadId.Left)[0]!.sounds).toBeUndefined();
  });
});
