import { describe, expect, it } from "vitest";
import { HERO_DECKS, HeroClass } from "./cards";

describe("Hero Decks follow the card set spec", () => {
  it("gives each Hero exactly the cards listed in ADR 0025", () => {
    const names = (heroClass: HeroClass) => HERO_DECKS[heroClass].map((card) => card.name);
    expect(names(HeroClass.Bruiser).sort()).toEqual(
      ["Slam Shot", "Slam Shot", "Concussion Round", "Breach Charge", "Shockwave", "Charge", "Charge", "Pull", "Bulwark", "Bulwark", "Adrenal Surge", "Wrecking Blow"].sort(),
    );
    expect(names(HeroClass.Controller).sort()).toEqual(
      ["Tag Round", "Scout Drone", "Scout Drone", "Aegis Protocol", "Reinforce", "Fortify", "Deploy Cover", "Barricade", "Gravity Snare", "Overwatch Uplink"].sort(),
    );
    expect(names(HeroClass.Assassin).sort()).toEqual(
      ["Precision Shot", "Long Shot", "Long Shot", "Cover Breaker", "Shield Breaker", "Ghost Shot", "Execution Round", "Vanish", "Reposition"].sort(),
    );
  });

  it("has no trace of the cards that left the Decks", () => {
    const all = Object.values(HERO_DECKS).flatMap((deck) => deck.map((card) => card.name));
    for (const gone of ["Suppress", "Forward Deploy", "Pulse Bolt", "Shock Pulse", "Mark Target"]) expect(all).not.toContain(gone);
  });

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

  it("gives the Decks their Overdrive modes on at most four cards each (ADR 0003, ADR 0025: the Assassin has two)", () => {
    const modeCounts = { [HeroClass.Bruiser]: 3, [HeroClass.Controller]: 3, [HeroClass.Assassin]: 2 };
    for (const [heroClass, deck] of Object.entries(HERO_DECKS)) {
      const overdriveCards = deck.filter((card) => card.overdrive);
      const modes = new Set(overdriveCards.map((card) => card.name));
      expect(modes.size, heroClass).toBe(modeCounts[heroClass as HeroClass]);
      expect(overdriveCards.length, heroClass).toBeLessThanOrEqual(4);
    }
  });

  it("matches the Overdrive card counts of the spec", () => {
    const count = (heroClass: HeroClass) => HERO_DECKS[heroClass].filter((card) => card.overdrive).length;
    expect(count(HeroClass.Bruiser)).toBe(3);
    expect(count(HeroClass.Controller)).toBe(4);
    expect(count(HeroClass.Assassin)).toBe(3);
  });
});
