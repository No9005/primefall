import { HERO_DECKS, HeroClass } from "game-core";
import { describe, expect, it } from "vitest";
import { canvasResolution, cardListTitle, cardRowName, cardRows, feetX, HERO_CLOSE_UP, HERO_PROFILES, SELECTABLE_HEROES } from "./hero-select";

describe("the card list", () => {
  it("has one row per distinct card with the number of copies, for every Hero", () => {
    for (const heroClass of SELECTABLE_HEROES) {
      const rows = cardRows(heroClass);
      expect(rows.reduce((sum, row) => sum + row.copies, 0)).toBe(HERO_DECKS[heroClass].length);
      expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length);
    }
  });

  it("writes duplicates as x2 and takes the text from the card data", () => {
    const siteSurvey = cardRows(HeroClass.Controller).find((row) => row.name === "Site Survey");
    expect(cardRowName(siteSurvey!)).toBe("Site Survey x2");
    expect(siteSurvey).toMatchObject({ type: "Utility", cost: 1 });
    expect(siteSurvey!.effect).not.toContain("Range");
    expect(cardRows(HeroClass.Controller).map((row) => row.effect).join(" ")).not.toContain("undefined");
  });

  it("titles the list with the Hero and the size of its Deck", () => {
    expect(cardListTitle(HeroClass.Controller)).toBe("CONTROLLER: 10 CARDS");
  });
});

describe("the position of the Heroes", () => {
  it("moves the selected Bruiser's feet left so its tracer stays in its area", () => {
    expect(feetX(HeroClass.Bruiser, true)).toBe(62);
    expect(feetX(HeroClass.Bruiser, false)).toBe(120);
    expect(feetX(HeroClass.Controller, true)).toBe(120);
  });
});

describe("the Hero Names", () => {
  it("gives every Hero a Hero Name, a bio and a line, and a close-up of its own", () => {
    expect(SELECTABLE_HEROES.map((heroClass) => HERO_PROFILES[heroClass].name)).toEqual(["Max Overload", "Tilly Turnover", "Kit Crosshair"]);
    for (const heroClass of SELECTABLE_HEROES) {
      const { bio, quote } = HERO_PROFILES[heroClass];
      expect(bio.length).toBeGreaterThan(40);
      expect(quote.length).toBeGreaterThan(10);
    }
    expect(new Set(SELECTABLE_HEROES.map((heroClass) => HERO_CLOSE_UP[heroClass])).size).toBe(3);
  });

  it("keeps the bio free of the other Heroes' kit: nothing about the Site Survey on the sheet of Tilly", () => {
    expect(HERO_PROFILES[HeroClass.Controller].bio).not.toContain("Site Survey");
  });
});

describe("the resolution of the Hero Select canvas", () => {
  it("draws at the size the enlarged stage ends up, never coarser than the device", () => {
    expect(canvasResolution(1, 2.4)).toBeCloseTo(2.4);
    expect(canvasResolution(2, 1.5)).toBe(3);
    expect(canvasResolution(2, 0.8)).toBe(2);
  });
});
