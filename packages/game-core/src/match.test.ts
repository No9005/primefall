import { describe, expect, it } from "vitest";
import { HAND_SIZE, HERO_DECKS, HeroClass } from "./cards";
import { createMatch, HeroState, MatchState, startRound } from "./match";
import { SquadId } from "./host";

function hero(match: MatchState, squad: SquadId, heroClass: HeroClass): HeroState {
  return match.heroes.find((h) => h.squad === squad && h.heroClass === heroClass)!;
}

describe("card data", () => {
  it("gives every Hero a Deck of 12 cards", () => {
    for (const deck of Object.values(HERO_DECKS)) expect(deck).toHaveLength(12);
  });
});

describe("createMatch", () => {
  it("produces identical Decks and Hands for the same seed", () => {
    expect(startRound(createMatch(42))).toEqual(startRound(createMatch(42)));
  });

  it("produces different Decks for different seeds", () => {
    expect(createMatch(1).heroes[0]!.deck).not.toEqual(createMatch(2).heroes[0]!.deck);
  });

  it("shuffles consecutive Decks of the same cards into different orders", () => {
    for (const seed of [1, 2, 3]) {
      const match = createMatch(seed);
      for (const heroClass of Object.values(HeroClass)) {
        expect(hero(match, SquadId.Left, heroClass).deck).not.toEqual(hero(match, SquadId.Right, heroClass).deck);
      }
    }
  });

  it("puts every card of the fixed Deck into each Hero's Deck", () => {
    for (const h of createMatch(7).heroes) {
      expect([...h.deck].sort((a, b) => a - b)).toEqual(HERO_DECKS[h.heroClass].map((_, i) => i));
    }
  });

  it("places both Squads on their Spawn tiles", () => {
    const match = createMatch(1);
    for (const [squad, col] of [[SquadId.Left, 1], [SquadId.Right, 29]] as const) {
      const squadHeroes = match.heroes.filter((h) => h.squad === squad);
      expect(squadHeroes).toHaveLength(3);
      expect(squadHeroes.map((h) => h.position)).toEqual([
        { col, row: 7 },
        { col, row: 8 },
        { col, row: 9 },
      ]);
    }
  });

  it("round-trips through JSON unchanged", () => {
    const match = startRound(createMatch(5));
    expect(JSON.parse(JSON.stringify(match))).toEqual(match);
  });
});

describe("startRound", () => {
  it("draws every Hero up to a Hand of 4", () => {
    const match = startRound(createMatch(3));
    expect(match.round).toBe(1);
    for (const h of match.heroes) {
      expect(h.hand).toHaveLength(HAND_SIZE);
      expect(h.deck).toHaveLength(8);
    }
  });

  it("does not mutate the previous Match State", () => {
    const before = createMatch(3);
    const snapshot = structuredClone(before);
    startRound(before);
    expect(before).toEqual(snapshot);
  });

  it("retains unused cards and never exceeds a Hand of 4", () => {
    let match = startRound(createMatch(3));
    const bruiser = hero(match, SquadId.Left, HeroClass.Bruiser);
    const kept = bruiser.hand.slice(0, 3);
    const spent = bruiser.hand[3]!;
    bruiser.hand = kept;
    bruiser.discard.push(spent);

    match = startRound(match);
    const next = hero(match, SquadId.Left, HeroClass.Bruiser);
    expect(next.hand).toHaveLength(HAND_SIZE);
    expect(next.hand.slice(0, 3)).toEqual(kept);

    match = startRound(match);
    expect(hero(match, SquadId.Left, HeroClass.Bruiser).hand).toEqual(next.hand);
  });

  it("reshuffles the Discard without Exiled cards and draws again the following Round", () => {
    const match = startRound(createMatch(9));
    const bruiser = hero(match, SquadId.Left, HeroClass.Bruiser);
    bruiser.hand = [];
    bruiser.deck = [0];
    bruiser.discard = [1, 2, 3, 4, 5];
    bruiser.exile = [6, 7];

    const afterReshuffle = hero(startRound(match), SquadId.Left, HeroClass.Bruiser);
    expect(afterReshuffle.hand).toEqual([0]);
    expect(afterReshuffle.discard).toEqual([]);
    expect([...afterReshuffle.deck].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(afterReshuffle.exile).toEqual([6, 7]);

    const nextRound = hero(startRound(startRound(match)), SquadId.Left, HeroClass.Bruiser);
    expect(nextRound.hand).toHaveLength(4);
    expect(nextRound.hand).not.toContain(6);
    expect(nextRound.hand).not.toContain(7);
  });
});
