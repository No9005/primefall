import { describe, expect, it } from "vitest";
import { playAiMatch } from "./ai-match";
import { DEFENDER_ROUND_LIMIT, MatchEndReason, MatchMode, type MatchModeSetting, SquadId } from "./host";
import { createLocalHost, restoreLocalHost, SNAPSHOT_VERSION } from "./local-host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { findTiles, TileKind } from "./reactor-deck";
import { resolveRound } from "./resolution";

const mode = (defender: SquadId): MatchModeSetting => ({ kind: MatchMode.AttackAndDefend, defender });
const zoneTiles = findTiles(createMatch(1).grid, TileKind.PrimeZone);
const FAR = (squad: SquadId, i: number) => ({ col: squad === SquadId.Left ? 1 : 29, row: 1 + i });

/** A Round-1 match (Defender: Left) with the given numbers of Heroes of each Squad standing in the Zone, the rest far away. */
function matchWith(attackers: number, defenders: number, defender = SquadId.Left): MatchState {
  const match = startRound(createMatch(5, mode(defender)));
  const attacker = defender === SquadId.Left ? SquadId.Right : SquadId.Left;
  const place = (squad: SquadId, count: number, tiles: typeof zoneTiles) =>
    match.heroes
      .filter((hero) => hero.squad === squad)
      .forEach((hero, i) => (hero.position = i < count ? { ...tiles[i]! } : FAR(squad, i)));
  place(defender, defenders, zoneTiles.filter(({ col }) => col === 14));
  place(attacker, attackers, zoneTiles.filter(({ col }) => col === 16));
  return match;
}

const resolveEmpty = (match: MatchState) => resolveRound(match, []).match;

describe("Attack and Defend: start positions", () => {
  it.each([
    [SquadId.Left, 14],
    [SquadId.Right, 16],
  ])("puts a %s Defender on the Zone tiles of column %i, rows 7 to 9", (defender, col) => {
    const match = createMatch(7, mode(defender));
    const squad = match.heroes.filter((hero) => hero.squad === defender);
    expect(squad.map((hero) => hero.position)).toEqual([7, 8, 9].map((row) => ({ col, row })));
  });

  it("starts the Attacker on its Spawn tiles, as in the classic mode", () => {
    const classic = createMatch(7);
    const match = createMatch(7, mode(SquadId.Left));
    const positions = (state: MatchState) => state.heroes.filter((hero) => hero.squad === SquadId.Right).map((hero) => hero.position);
    expect(positions(match)).toEqual(positions(classic));
  });
});

describe("Attack and Defend: control of the Zone", () => {
  it("goes to the Attacker on a tie", () => {
    expect(resolveEmpty(matchWith(1, 1)).primeZone).toEqual({ controller: SquadId.Right, progress: 1 });
  });

  it("goes to the Attacker with more Heroes", () => {
    expect(resolveEmpty(matchWith(2, 1)).primeZone).toEqual({ controller: SquadId.Right, progress: 1 });
  });

  it("does not go to the Attacker without a Hero in the Zone", () => {
    expect(resolveEmpty(matchWith(0, 3)).primeZone.controller).not.toBe(SquadId.Right);
    expect(resolveEmpty(matchWith(0, 3)).result).toBeUndefined();
  });

  it("stays with the Defender when it has more Heroes in the Zone", () => {
    const held = resolveEmpty(matchWith(1, 2));
    expect(held.primeZone.controller).toBe(SquadId.Left);
    expect(held.primeZone.controller).not.toBe(SquadId.Right);
  });

  it("is never a win for the Defender, however long it holds the Zone", () => {
    let match = matchWith(0, 3);
    for (let i = 0; i < 5; i++) match = resolveEmpty(match);
    expect(match.result).toBeUndefined();
  });

  it("does not count Exhausted Attacker Heroes", () => {
    const match = matchWith(1, 1);
    match.heroes.find((hero) => hero.squad === SquadId.Right && hero.position.col === 16)!.exhausted = true;
    expect(resolveEmpty(match).primeZone.controller).not.toBe(SquadId.Right);
  });
});

describe("Attack and Defend: match end", () => {
  it("is won by the Attacker with three consecutive controlled Resolutions", () => {
    let match = matchWith(2, 1);
    match = resolveEmpty(match);
    match = resolveEmpty(startRound(match));
    expect(match.result).toBeUndefined();
    match = resolveEmpty(startRound(match));
    expect(match.result).toMatchObject({ winner: SquadId.Right, reason: MatchEndReason.PrimeZoneHeld });
  });

  it("resets the Attacker's progress when the Defender takes the Zone back", () => {
    let match = resolveEmpty(matchWith(2, 1));
    match = resolveEmpty(startRound(match));
    expect(match.primeZone.progress).toBe(2);
    match.heroes.filter((hero) => hero.squad === SquadId.Right).forEach((hero, i) => (hero.position = FAR(SquadId.Right, i)));
    match = resolveEmpty(startRound(match));
    expect(match.primeZone.controller).toBe(SquadId.Left);
    expect(match.result).toBeUndefined();
  });

  it("is won by the Attacker when all Defender Heroes are Exhausted", () => {
    const match = matchWith(0, 0);
    match.heroes.filter((hero) => hero.squad === SquadId.Left).forEach((hero) => (hero.exhausted = true));
    expect(resolveEmpty(match).result).toMatchObject({ winner: SquadId.Right, reason: MatchEndReason.AllHeroesExhausted });
  });

  it("is won by the Defender with Defence Held after the Round limit of the mode", () => {
    const match = matchWith(0, 3);
    match.round = DEFENDER_ROUND_LIMIT - 1;
    expect(resolveEmpty(match).result).toBeUndefined();
    match.round = DEFENDER_ROUND_LIMIT;
    expect(resolveEmpty(match).result).toMatchObject({ winner: SquadId.Left, reason: MatchEndReason.DefenceHeld, round: DEFENDER_ROUND_LIMIT });
  });

  it("lets an Attacker win in the last Round win over Defence Held", () => {
    const match = matchWith(2, 1);
    match.round = DEFENDER_ROUND_LIMIT;
    match.primeZone = { controller: SquadId.Right, progress: 2 };
    expect(resolveEmpty(match).result).toMatchObject({ winner: SquadId.Right, reason: MatchEndReason.PrimeZoneHeld });
  });

  it("does not apply the 30 Round limit", () => {
    const match = matchWith(0, 3);
    match.round = 29;
    expect(resolveEmpty(match).result?.reason).toBe(MatchEndReason.DefenceHeld);
  });
});

describe("Attack and Defend: Squad View and host", () => {
  it("shows the mode, the Defender and the Rounds left to both Squads", () => {
    const match = startRound(createMatch(3, mode(SquadId.Right)));
    for (const squad of [SquadId.Left, SquadId.Right]) {
      const view = buildSquadView(match, squad);
      expect(view.roundLimit).toBe(DEFENDER_ROUND_LIMIT);
      expect(view.attackAndDefend).toEqual({ defender: SquadId.Right, roundsLeft: DEFENDER_ROUND_LIMIT });
    }
    expect(buildSquadView(createMatch(3), SquadId.Left).attackAndDefend).toBeUndefined();
  });

  it("saves and restores the mode", async () => {
    const host = createLocalHost(9, mode(SquadId.Right));
    await host.submitPlan({ squad: SquadId.Left, heroes: [] });
    const resumed = restoreLocalHost(host.snapshot())!;
    expect(await resumed.getSquadView(SquadId.Left)).toEqual(await host.getSquadView(SquadId.Left));
    expect((await resumed.getSquadView(SquadId.Left)).attackAndDefend?.defender).toBe(SquadId.Right);
  });

  it("restores a snapshot of version 1 as a classic match", async () => {
    const saved = JSON.parse(createLocalHost(4).snapshot());
    delete saved.match.mode;
    const resumed = restoreLocalHost(JSON.stringify({ ...saved, version: 1 }))!;
    expect(SNAPSHOT_VERSION).toBeGreaterThan(1);
    expect((await resumed.getSquadView(SquadId.Left)).attackAndDefend).toBeUndefined();
    expect((await resumed.getSquadView(SquadId.Left)).roundLimit).toBe(30);
  });

  it("is deterministic, whatever the order of the plans", () => {
    const match = matchWith(2, 1);
    const plans = [SquadId.Left, SquadId.Right].map((squad) => ({ squad, heroes: [] }));
    const forward = resolveRound(match, plans);
    const backward = resolveRound(match, [...plans].reverse());
    expect(backward.match).toEqual(forward.match);
    expect(resolveRound(match, plans).match).toEqual(forward.match);
  });
});

describe("the classic mode", () => {
  // Recorded from the classic path before and after this change (AI against AI, 60 Rounds at most).
  const recorded = [
    { seed: 3, round: 6, winner: SquadId.Right, deckTotals: { left: 11, right: 15 }, positions: "14,7:4 13,6:1 13,7:6 16,7:3 15,7:6 17,7:6", rng: 3520096635 },
    { seed: 11, round: 6, winner: SquadId.Right, deckTotals: { left: 11, right: 17 }, positions: "14,7:4 13,6:1 13,7:6 16,7:4 15,7:7 16,8:6", rng: 424859490 },
    { seed: 42, round: 6, winner: SquadId.Right, deckTotals: { left: 11, right: 15 }, positions: "14,7:4 13,6:1 13,7:6 16,7:4 15,7:5 16,8:6", rng: 424859521 },
  ];

  it.each(recorded)("plays seed $seed exactly as recorded", ({ seed, round, winner, deckTotals, positions, rng }) => {
    const { match } = playAiMatch(seed, 60);
    expect(match.result).toEqual({ winner, reason: MatchEndReason.PrimeZoneHeld, round, deckTotals });
    expect(match.heroes.map((hero) => `${hero.position.col},${hero.position.row}:${hero.deck.length}`).join(" ")).toBe(positions);
    expect(match.rngState).toBe(rng);
  });
});
