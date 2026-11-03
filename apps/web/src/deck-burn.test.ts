import { describe, expect, it } from "vitest";
import { addBurn, burnSchedule, NO_BURN_PENDING, settleBurn, shownBurnCounts } from "./deck-burn";

describe("burnSchedule", () => {
  it("burns one card in 900 ms after the hit reaction, several cards 400 ms apart", () => {
    expect(burnSchedule(0)).toEqual({ lift: 300, burned: 1200 });
    expect(burnSchedule(2)).toEqual({ lift: 1100, burned: 2000 });
  });
});

describe("shownBurnCounts", () => {
  it("keeps the old counts until each card has lifted and burned", () => {
    let pending = addBurn(NO_BURN_PENDING, "h1", 2);
    // Deck 10 and Exile 1 before the hit: after the damage the true counts are 8 and 3.
    expect(shownBurnCounts(8, 3, pending, "h1")).toEqual({ deck: 10, exile: 1 });
    pending = settleBurn(pending, "h1", "lifted");
    expect(shownBurnCounts(8, 3, pending, "h1")).toEqual({ deck: 9, exile: 1 });
    pending = settleBurn(pending, "h1", "burned");
    expect(shownBurnCounts(8, 3, pending, "h1")).toEqual({ deck: 9, exile: 2 });
  });
  it("does not touch other Heroes", () => {
    const pending = addBurn(NO_BURN_PENDING, "h1", 1);
    expect(shownBurnCounts(5, 0, pending, "h2")).toEqual({ deck: 5, exile: 0 });
  });
});
