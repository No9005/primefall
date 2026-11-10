import { SquadId, ZoneKind, type ZoneView } from "game-core";
import { describe, expect, it } from "vitest";
import { matchEndCallouts, primeCountdown, zoneCallouts, zoneDots } from "./prime-zone";

const L = SquadId.Left;
const R = SquadId.Right;

const zone = (kind: ZoneKind, over: Partial<ZoneView> = {}): ZoneView => ({
  kind,
  tiles: [],
  value: kind === ZoneKind.PrimeZone ? 2 : 1,
  unlockRound: kind === ZoneKind.PrimeZone ? 4 : 1,
  active: true,
  contested: false,
  ...over,
});
const zonesOf = (outpostA: Partial<ZoneView> = {}, prime: Partial<ZoneView> = {}, outpostB: Partial<ZoneView> = {}) => [
  zone(ZoneKind.Outpost, outpostA),
  zone(ZoneKind.PrimeZone, prime),
  zone(ZoneKind.Outpost, outpostB),
];

describe("zoneDots", () => {
  it("shows nobody, own, enemy and Contested zones", () => {
    const dots = zoneDots(zonesOf({ controller: L }, { contested: true }, { controller: R }), L);
    expect(dots.map((dot) => dot.state)).toEqual(["own", "contested", "enemy"]);
    expect(zoneDots(zonesOf(), L).map((dot) => dot.state)).toEqual(["nobody", "nobody", "nobody"]);
  });

  it("puts the Prime Zone between the Outposts when the Squad View lists it first", () => {
    const [outpostA, prime, outpostB] = zonesOf({ controller: L }, {}, { controller: R });
    expect(zoneDots([prime!, outpostA!, outpostB!], L).map((dot) => dot.state)).toEqual(["own", "nobody", "enemy"]);
  });

  it("sees the enemy's zones from the other Squad", () => {
    expect(zoneDots(zonesOf({ controller: L }), R)[0]!.state).toBe("enemy");
  });

  it("marks an inactive Prime Zone with its unlock Round", () => {
    const dots = zoneDots(zonesOf({}, { active: false }), L);
    expect(dots[1]).toMatchObject({ state: "inactive", unlockRound: 4 });
  });
});

describe("primeCountdown", () => {
  it("counts the Rounds until the Prime Zone is active", () => {
    expect(primeCountdown(zonesOf({}, { active: false }), 1)).toBe(3);
    expect(primeCountdown(zonesOf({}, { active: false }), 3)).toBe(1);
  });

  it("is undefined once it is active", () => {
    expect(primeCountdown(zonesOf(), 4)).toBeUndefined();
  });
});

describe("zoneCallouts", () => {
  const shown = (before: ZoneView[], after: ZoneView[], you = L) => zoneCallouts(before, after, you).map((c) => `${c.text}|${c.detail ?? ""}|${c.tone}`);

  it("shows the Victory Points of an Outpost, mine and the enemy's", () => {
    expect(shown(zonesOf(), zonesOf({ controller: L }))).toEqual(["OUTPOST +1||teal"]);
    expect(shown(zonesOf(), zonesOf({}, {}, { controller: R }))).toEqual(["ENEMY OUTPOST +1||red"]);
  });

  it("shows the Prime Zone with its value", () => {
    expect(shown(zonesOf(), zonesOf({}, { controller: L }))).toEqual(["PRIME ZONE +2||teal"]);
    expect(shown(zonesOf(), zonesOf({}, { controller: R }))).toEqual(["ENEMY PRIME ZONE +2||red"]);
  });

  it("shows CONTESTED with the zone name", () => {
    expect(shown(zonesOf(), zonesOf({}, { contested: true }))).toEqual(["CONTESTED|PRIME ZONE|amber"]);
  });

  it("announces the Prime Zone when it unlocks", () => {
    expect(shown(zonesOf({}, { active: false }), zonesOf())).toEqual(["PRIME ZONE ACTIVE|2 VP per Resolution|gold"]);
  });

  it("shows nothing when nothing scored", () => {
    expect(shown(zonesOf(), zonesOf())).toEqual([]);
    expect(shown(zonesOf({}, { active: false }), zonesOf({}, { active: false }))).toEqual([]);
  });
});

describe("matchEndCallouts", () => {
  it("gives VICTORY or DEFEAT only for a decided match", () => {
    expect(matchEndCallouts({ winner: L }, L)[0]!.text).toBe("VICTORY");
    expect(matchEndCallouts({ winner: R }, L)[0]!.text).toBe("DEFEAT");
    expect(matchEndCallouts({}, L)).toEqual([]);
    expect(matchEndCallouts(undefined, L)).toEqual([]);
  });
});
