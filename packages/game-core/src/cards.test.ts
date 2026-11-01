import { describe, expect, it } from "vitest";
import { HERO_DECKS, HeroClass } from "./cards";

describe("Hero Decks follow the card set spec", () => {
  it("makes cards with the same name identical in every respect, Overdrive included", () => {
    for (const deck of Object.values(HERO_DECKS)) {
      const byName = new Map<string, unknown>();
      for (const card of deck) {
        const first = byName.get(card.name);
        if (first === undefined) byName.set(card.name, card);
        else expect(card, card.name).toEqual(first);
      }
    }
  });

  it("gives every Deck three Overdrive modes on at most four cards (ADR 0003)", () => {
    for (const [heroClass, deck] of Object.entries(HERO_DECKS)) {
      const overdriveCards = deck.filter((card) => card.overdrive);
      const modes = new Set(overdriveCards.map((card) => card.name));
      expect(modes.size, heroClass).toBe(3);
      expect(overdriveCards.length, heroClass).toBeLessThanOrEqual(4);
    }
  });

  it("matches the Overdrive card counts of the spec", () => {
    const count = (heroClass: HeroClass) => HERO_DECKS[heroClass].filter((card) => card.overdrive).length;
    expect(count(HeroClass.Bruiser)).toBe(3);
    expect(count(HeroClass.Controller)).toBe(4);
    expect(count(HeroClass.Assassin)).toBe(4);
  });
});
