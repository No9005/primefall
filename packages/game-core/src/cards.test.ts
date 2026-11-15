import { describe, expect, it } from "vitest";
import { HERO_DECKS, HeroClass } from "./cards";

describe("Hero Decks follow the card set spec", () => {
  it("gives each Hero exactly the cards listed in ADR 0025", () => {
    const names = (heroClass: HeroClass) => HERO_DECKS[heroClass].map((card) => card.name);
    expect(names(HeroClass.Bruiser).sort()).toEqual(
      ["Buy One, Get Two", "Express Delivery", "Express Delivery", "Hard Hat", "Hard Hat", "Cargo Hook", "Cargo Hook", "Handle With Care", "Handle With Care", "Handle With Care", "Time for Coffee", "Time for Coffee"].sort(),
    );
    expect(names(HeroClass.Controller).sort()).toEqual(
      ["Price Tag", "Price Tag", "Site Survey", "Site Survey", "Urban Renewal", "Urban Renewal", "Temporary Solution", "Temporary Solution", "Heavy Metal", "Heavy Metal"].sort(),
    );
    expect(names(HeroClass.Assassin).sort()).toEqual(
      ["Long Shot", "Long Shot", "Long Shot", "Vanish", "Vanish", "Personal Space", "Personal Space", "Shield Breaker", "Shield Breaker"].sort(),
    );
  });

  it("has no trace of the cards that left the Decks", () => {
    const all = Object.values(HERO_DECKS).flatMap((deck) => deck.map((card) => card.name));
    for (const gone of ["Suppress", "Forward Deploy", "Pulse Bolt", "Shock Pulse", "Mark Target", "Shockwave", "Adrenal Surge", "Aegis Protocol", "Reinforce", "Slam Shot", "Bulwark", "Concussion Round", "Charge", "Pull", "Precision Shot", "Cover Breaker", "Ghost Shot", "Execution Round", "Reposition", "Tag Round", "Scout Drone", "Breach Charge", "Wrecking Blow", "Fortify", "Deploy Cover", "Barricade", "Gravity Snare", "Overwatch Uplink"]) expect(all).not.toContain(gone);
  });

  it("makes cards with the same name identical in every respect", () => {
    for (const deck of Object.values(HERO_DECKS)) {
      const byName = new Map<string, unknown>();
      for (const card of deck) {
        const first = byName.get(card.name);
        if (first === undefined) byName.set(card.name, card);
        else expect(card, card.name).toEqual(first);
      }
    }
  });

});
