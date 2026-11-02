import { describe, expect, it } from "vitest";
import { MatchEndReason, ROUND_LIMIT, SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { resolveRound } from "./resolution";

/** Prime Zone tiles used by each Squad, so that the two Squads never share a tile. */
const ZONE_TILES = {
  [SquadId.Left]: [
    { col: 14, row: 7 },
    { col: 14, row: 8 },
    { col: 14, row: 9 },
  ],
  [SquadId.Right]: [
    { col: 16, row: 7 },
    { col: 16, row: 8 },
    { col: 16, row: 9 },
  ],
};

/** A Round-1 match where the given number of Heroes per Squad stand in the Prime Zone and the rest far away. */
function matchWithHeroesInZone(left: number, right: number): MatchState {
  const match = startRound(createMatch(5));
  for (const squad of [SquadId.Left, SquadId.Right]) {
    const count = squad === SquadId.Left ? left : right;
    match.heroes
      .filter((hero) => hero.squad === squad)
      .forEach((hero, i) => {
        hero.position = i < count ? ZONE_TILES[squad][i]! : { col: squad === SquadId.Left ? 1 : 29, row: 1 + i };
      });
  }
  return match;
}

const resolveEmpty = (match: MatchState) => resolveRound(match, []).match;

describe("Prime Zone control", () => {
  it("is held by the Squad with more non-exhausted Heroes in the Zone", () => {
    const after = resolveEmpty(matchWithHeroesInZone(2, 1));
    expect(after.primeZone).toEqual({ controller: SquadId.Left, progress: 1 });
  });

  it("does not count Exhausted Heroes", () => {
    const match = matchWithHeroesInZone(2, 1);
    for (const hero of match.heroes.filter((candidate) => candidate.squad === SquadId.Left).slice(0, 2)) {
      hero.exhausted = true;
      hero.deck = [0];
    }
    const after = resolveEmpty(match);
    expect(after.primeZone.controller).toBe(SquadId.Right);
  });

  it("is kept by the previous controller on a tie", () => {
    const match = matchWithHeroesInZone(1, 1);
    match.primeZone = { controller: SquadId.Right, progress: 1 };
    expect(resolveEmpty(match).primeZone).toEqual({ controller: SquadId.Right, progress: 2 });
  });

  it("is controlled by nobody on a tie without a previous controller", () => {
    expect(resolveEmpty(matchWithHeroesInZone(0, 0)).primeZone).toEqual({ progress: 0 });
    expect(resolveEmpty(matchWithHeroesInZone(1, 1)).primeZone).toEqual({ progress: 0 });
  });

  it("resets progress when control changes", () => {
    const match = matchWithHeroesInZone(1, 2);
    match.primeZone = { controller: SquadId.Left, progress: 2 };
    const after = resolveEmpty(match);
    expect(after.primeZone).toEqual({ controller: SquadId.Right, progress: 1 });
    expect(after.result).toBeUndefined();
  });

  it("wins after three consecutive Resolutions and ends the match immediately", () => {
    let match = matchWithHeroesInZone(2, 0);
    match = resolveEmpty(match);
    match = resolveEmpty(match);
    expect(match.result).toBeUndefined();
    match = resolveEmpty(match);
    expect(match.result).toMatchObject({ winner: SquadId.Left, reason: MatchEndReason.PrimeZoneHeld, round: 1 });
  });

  it("shows progress per Squad in the Squad View", () => {
    const match = resolveEmpty(matchWithHeroesInZone(2, 0));
    const view = buildSquadView(match, SquadId.Right);
    expect(view.primeProgress).toEqual({ [SquadId.Left]: 1, [SquadId.Right]: 0 });
  });
});

describe("Squad loss", () => {
  it("loses when all three Heroes are Exhausted", () => {
    const match = matchWithHeroesInZone(0, 0);
    for (const hero of match.heroes.filter((candidate) => candidate.squad === SquadId.Right)) hero.deck = [];
    const after = resolveEmpty(match);
    expect(after.result).toMatchObject({ winner: SquadId.Left, reason: MatchEndReason.AllHeroesExhausted });
  });

  it("does not end while one Hero is left", () => {
    const match = matchWithHeroesInZone(0, 0);
    for (const hero of match.heroes.filter((candidate) => candidate.squad === SquadId.Right).slice(0, 2)) hero.deck = [];
    expect(resolveEmpty(match).result).toBeUndefined();
  });

  it("is a draw when both Squads are Exhausted in the same Resolution", () => {
    const match = matchWithHeroesInZone(0, 0);
    for (const hero of match.heroes) hero.deck = [];
    const result = resolveEmpty(match).result!;
    expect(result.reason).toBe(MatchEndReason.AllHeroesExhausted);
    expect(result.winner).toBeUndefined();
  });

  it("is not saved by keeping control on a tie", () => {
    const match = matchWithHeroesInZone(0, 0);
    match.primeZone = { controller: SquadId.Left, progress: 2 };
    for (const hero of match.heroes.filter((candidate) => candidate.squad === SquadId.Left)) hero.deck = [];
    expect(resolveEmpty(match).result).toMatchObject({ winner: SquadId.Right, reason: MatchEndReason.AllHeroesExhausted });
  });
});

describe("Round Limit", () => {
  it("does not end the match before the limit", () => {
    const match = matchWithHeroesInZone(0, 0);
    match.round = ROUND_LIMIT - 1;
    expect(resolveEmpty(match).result).toBeUndefined();
  });

  it("is won by the Squad with more cards in all Decks", () => {
    const match = matchWithHeroesInZone(0, 0);
    match.round = ROUND_LIMIT;
    match.heroes.find((hero) => hero.id === "right-bruiser")!.deck.pop();
    const result = resolveEmpty(match).result!;
    expect(result.reason).toBe(MatchEndReason.RoundLimit);
    expect(result.winner).toBe(SquadId.Left);
    expect(result.round).toBe(ROUND_LIMIT);
    expect(result.deckTotals[SquadId.Left]).toBeGreaterThan(result.deckTotals[SquadId.Right]);
  });

  it("is a draw on equal totals", () => {
    const match = matchWithHeroesInZone(0, 0);
    match.round = ROUND_LIMIT;
    const result = resolveEmpty(match).result!;
    expect(result.reason).toBe(MatchEndReason.RoundLimit);
    expect(result.winner).toBeUndefined();
  });

  it("lets a Prime Zone win on the last Round take precedence", () => {
    const match = matchWithHeroesInZone(2, 0);
    match.round = ROUND_LIMIT;
    match.primeZone = { controller: SquadId.Left, progress: 2 };
    expect(resolveEmpty(match).result).toMatchObject({ winner: SquadId.Left, reason: MatchEndReason.PrimeZoneHeld });
  });
});
