import { describe, expect, it } from "vitest";
import {
  MatchEndReason,
  OUTPOST_UNLOCK_ROUND,
  OUTPOST_VALUE,
  PRIME_ZONE_UNLOCK_ROUND,
  PRIME_ZONE_VALUE,
  ROUND_LIMIT,
  SquadId,
  VICTORY_POINTS_TO_WIN,
  ZoneKind,
} from "./host";
import { buildSquadView, createMatch, type MatchState, startRound, ZONES } from "./match";
import { resolveRound } from "./resolution";

const PRIME_ZONE = ZONES.findIndex((zone) => zone.kind === ZoneKind.PrimeZone);
const OUTPOSTS = ZONES.flatMap((zone, i) => (zone.kind === ZoneKind.Outpost ? [i] : []));
const FIRST_OUTPOST = OUTPOSTS[0]!;
const SECOND_OUTPOST = OUTPOSTS[1]!;

/** Tiles of a zone for one Squad, so that the two Squads never share a tile: the Left takes the first, the Right the last. */
const tilesOf = (zone: number, squad: SquadId) => (squad === SquadId.Left ? ZONES[zone]!.tiles.slice(0, 3) : ZONES[zone]!.tiles.slice(-3));

/** Puts `count` Heroes of the Squad on tiles of the zone; the rest of the Squad goes far away. */
function place(match: MatchState, squad: SquadId, count: number, zone = PRIME_ZONE) {
  match.heroes
    .filter((hero) => hero.squad === squad)
    .forEach((hero, i) => {
      hero.position = i < count ? { ...tilesOf(zone, squad)[i]! } : { col: squad === SquadId.Left ? 1 : 29, row: 1 + i };
    });
}

/** A match in the given Round where the given numbers of Heroes per Squad stand in the Prime Zone and the rest far away. */
function matchWithHeroesInZone(left: number, right: number, round = PRIME_ZONE_UNLOCK_ROUND): MatchState {
  const match = startRound(createMatch(5));
  match.round = round;
  place(match, SquadId.Left, left);
  place(match, SquadId.Right, right);
  return match;
}

const resolveEmpty = (match: MatchState) => resolveRound(match, []).match;
const scoresAfter = (match: MatchState) => resolveEmpty(match).scores;

describe("the zones", () => {
  it("are the Prime Zone and two Outposts of 3 by 2 tiles, read from the Grid", () => {
    expect(ZONES.map((zone) => [zone.kind, zone.tiles.length, zone.value, zone.unlockRound])).toEqual([
      [ZoneKind.PrimeZone, 9, PRIME_ZONE_VALUE, PRIME_ZONE_UNLOCK_ROUND],
      [ZoneKind.Outpost, 6, OUTPOST_VALUE, OUTPOST_UNLOCK_ROUND],
      [ZoneKind.Outpost, 6, OUTPOST_VALUE, OUTPOST_UNLOCK_ROUND],
    ]);
  });

  it("are listed in the Squad View with their state, and the plan is visible from the start", () => {
    const view = buildSquadView(startRound(createMatch(5)), SquadId.Left);
    expect(view.zones!.map((zone) => [zone.kind, zone.value, zone.unlockRound, zone.active, zone.contested])).toEqual([
      [ZoneKind.PrimeZone, 2, 4, false, false],
      [ZoneKind.Outpost, 1, 1, true, false],
      [ZoneKind.Outpost, 1, 1, true, false],
    ]);
    expect(view.scores).toEqual({ [SquadId.Left]: 0, [SquadId.Right]: 0 });
  });
});

describe("zone control", () => {
  it("goes to the Squad with more non-exhausted Heroes in the zone", () => {
    const after = resolveEmpty(matchWithHeroesInZone(2, 1));
    expect(after.zoneControl[PRIME_ZONE]).toEqual({ controller: SquadId.Left, contested: false });
    expect(after.scores).toEqual({ [SquadId.Left]: PRIME_ZONE_VALUE, [SquadId.Right]: 0 });
  });

  it("is Contested at 1 against 1: nobody scores", () => {
    const after = resolveEmpty(matchWithHeroesInZone(1, 1));
    expect(after.zoneControl[PRIME_ZONE]).toEqual({ contested: true });
    expect(after.scores).toEqual({ [SquadId.Left]: 0, [SquadId.Right]: 0 });
  });

  it("is Contested at 2 against 2", () => {
    expect(resolveEmpty(matchWithHeroesInZone(2, 2)).zoneControl[PRIME_ZONE]).toEqual({ contested: true });
  });

  it("is nobody's and not Contested at 0 against 0: nobody scores", () => {
    const after = resolveEmpty(matchWithHeroesInZone(0, 0));
    expect(after.zoneControl[PRIME_ZONE]).toEqual({ contested: false });
    expect(after.scores).toEqual({ [SquadId.Left]: 0, [SquadId.Right]: 0 });
  });

  it("does not count Exhausted Heroes", () => {
    const match = matchWithHeroesInZone(2, 1);
    for (const hero of match.heroes.filter((candidate) => candidate.squad === SquadId.Left).slice(0, 2)) {
      hero.exhausted = true;
      hero.deck = [0];
    }
    const after = resolveEmpty(match);
    expect(after.zoneControl[PRIME_ZONE]).toEqual({ controller: SquadId.Right, contested: false });
  });
});

describe("Victory Points", () => {
  it("give 2 for the Prime Zone", () => {
    expect(scoresAfter(matchWithHeroesInZone(1, 0))).toEqual({ [SquadId.Left]: PRIME_ZONE_VALUE, [SquadId.Right]: 0 });
  });

  it("give 1 for an Outpost", () => {
    const match = matchWithHeroesInZone(0, 0);
    place(match, SquadId.Right, 1, FIRST_OUTPOST);
    expect(scoresAfter(match)).toEqual({ [SquadId.Left]: 0, [SquadId.Right]: OUTPOST_VALUE });
  });

  it("give 4 for both Outposts and the Prime Zone", () => {
    const match = matchWithHeroesInZone(0, 0);
    const standing = [ZONES[PRIME_ZONE]!.tiles[0]!, ZONES[FIRST_OUTPOST]!.tiles[0]!, ZONES[SECOND_OUTPOST]!.tiles[0]!];
    match.heroes.filter((hero) => hero.squad === SquadId.Left).forEach((hero, i) => (hero.position = { ...standing[i]! }));
    expect(scoresAfter(match)![SquadId.Left]).toBe(PRIME_ZONE_VALUE + 2 * OUTPOST_VALUE);
  });

  it("add up over Resolutions", () => {
    const match = resolveEmpty(resolveEmpty(matchWithHeroesInZone(1, 0)));
    expect(match.scores[SquadId.Left]).toBe(2 * PRIME_ZONE_VALUE);
  });

  it("are shown in the Squad View of both Squads", () => {
    const match = resolveEmpty(matchWithHeroesInZone(2, 0));
    const view = buildSquadView(match, SquadId.Right);
    expect(view.scores).toEqual({ [SquadId.Left]: PRIME_ZONE_VALUE, [SquadId.Right]: 0 });
    expect(view.zones![PRIME_ZONE]).toMatchObject({ controller: SquadId.Left, active: true });
  });
});

describe("activation", () => {
  it("keeps the Prime Zone from scoring in Rounds 1 to 3 and scores from Round 4", () => {
    for (let round = 1; round < PRIME_ZONE_UNLOCK_ROUND; round++) {
      expect(scoresAfter(matchWithHeroesInZone(1, 0, round))![SquadId.Left]).toBe(0);
    }
    expect(scoresAfter(matchWithHeroesInZone(1, 0, PRIME_ZONE_UNLOCK_ROUND))![SquadId.Left]).toBe(PRIME_ZONE_VALUE);
  });

  it("scores an Outpost from Round 1", () => {
    const match = matchWithHeroesInZone(0, 0, 1);
    place(match, SquadId.Left, 1, SECOND_OUTPOST);
    expect(scoresAfter(match)![SquadId.Left]).toBe(OUTPOST_VALUE);
  });

  it("shows an inactive zone as inactive, without control", () => {
    const view = buildSquadView(resolveEmpty(matchWithHeroesInZone(1, 0, 1)), SquadId.Left);
    expect(view.zones![PRIME_ZONE]).toMatchObject({ active: false, contested: false });
    expect(view.zones![PRIME_ZONE]!.controller).toBeUndefined();
  });
});

describe("Victory", () => {
  it("is won at once by the Squad that reaches the threshold", () => {
    const match = matchWithHeroesInZone(1, 0);
    match.scores[SquadId.Left] = VICTORY_POINTS_TO_WIN - PRIME_ZONE_VALUE - 1;
    expect(resolveEmpty(match).result).toBeUndefined();
    match.scores[SquadId.Left] += 1;
    expect(resolveEmpty(match).result).toMatchObject({ winner: SquadId.Left, reason: MatchEndReason.VictoryPoints, round: PRIME_ZONE_UNLOCK_ROUND });
  });

  it("goes to the higher score when both Squads pass the threshold in the same Resolution", () => {
    const match = matchWithHeroesInZone(1, 0);
    place(match, SquadId.Right, 1, FIRST_OUTPOST);
    match.scores = { [SquadId.Left]: VICTORY_POINTS_TO_WIN - 1, [SquadId.Right]: VICTORY_POINTS_TO_WIN - 1 };
    expect(resolveEmpty(match).result).toMatchObject({ winner: SquadId.Left, reason: MatchEndReason.VictoryPoints });
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

  it("is not saved by points", () => {
    const match = matchWithHeroesInZone(0, 0);
    match.scores[SquadId.Left] = VICTORY_POINTS_TO_WIN - 1;
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

  it("is won by the higher score", () => {
    const match = matchWithHeroesInZone(0, 0);
    match.round = ROUND_LIMIT;
    match.scores = { [SquadId.Left]: 10, [SquadId.Right]: 12 };
    const result = resolveEmpty(match).result!;
    expect(result).toMatchObject({ winner: SquadId.Right, reason: MatchEndReason.RoundLimit, round: ROUND_LIMIT });
    expect(result.scores).toEqual({ [SquadId.Left]: 10, [SquadId.Right]: 12 });
  });

  it("goes on equal scores to the Squad with more cards not in the Exile", () => {
    const match = matchWithHeroesInZone(0, 0);
    match.round = ROUND_LIMIT;
    const hero = match.heroes.find((candidate) => candidate.id === "left-bruiser")!;
    hero.exile.push(hero.hand.pop()!);
    const result = resolveEmpty(match).result!;
    expect(result).toMatchObject({ winner: SquadId.Right, reason: MatchEndReason.RoundLimit });
    expect(result.cardTotals![SquadId.Right]).toBe(result.cardTotals![SquadId.Left] + 1);
  });

  it("counts the Hand and the Discard as not exiled", () => {
    const match = matchWithHeroesInZone(0, 0);
    match.round = ROUND_LIMIT;
    const hero = match.heroes.find((candidate) => candidate.id === "right-bruiser")!;
    hero.discard.push(hero.deck.pop()!);
    hero.exile.push(hero.deck.pop()!);
    // The Discard card does not change the total, the exiled card lowers it: the Left leads by one.
    expect(resolveEmpty(match).result).toMatchObject({ winner: SquadId.Left });
  });

  it("is a draw when scores and cards are equal", () => {
    const match = matchWithHeroesInZone(0, 0);
    match.round = ROUND_LIMIT;
    const result = resolveEmpty(match).result!;
    expect(result.reason).toBe(MatchEndReason.RoundLimit);
    expect(result.winner).toBeUndefined();
  });
});
