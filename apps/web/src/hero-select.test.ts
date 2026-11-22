import { HeroClass } from "game-core";
import { describe, expect, it } from "vitest";
import { feetX, HERO_PROFILES, SELECTABLE_HEROES } from "./hero-select";

describe("the position of the Heroes", () => {
  it("moves the selected Bruiser's feet left so its tracer stays in its area", () => {
    expect(feetX(HeroClass.Bruiser, true)).toBe(62);
    expect(feetX(HeroClass.Bruiser, false)).toBe(120);
    expect(feetX(HeroClass.Controller, true)).toBe(120);
  });
});

describe("the Hero Names", () => {
  it("gives every Hero a Hero Name, a bio and a line", () => {
    expect(SELECTABLE_HEROES.map((heroClass) => HERO_PROFILES[heroClass].name)).toEqual(["Max Overload", "Tilly Turnover", "Kit Crosshair"]);
    for (const heroClass of SELECTABLE_HEROES) {
      const { bio, quote } = HERO_PROFILES[heroClass];
      expect(bio.length).toBeGreaterThan(40);
      expect(quote.length).toBeGreaterThan(10);
    }
  });

  it("keeps the bio free of the other Heroes' kit: nothing about the Site Survey on the sheet of Tilly", () => {
    expect(HERO_PROFILES[HeroClass.Controller].bio).not.toContain("Site Survey");
  });
});
