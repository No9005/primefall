import { describe, expect, it } from "vitest";
import { drawSchedule, newCards, shownDeckCount } from "./hand-draw";

describe("newCards", () => {
  it("treats every card as new at the start of the match", () => {
    expect(newCards(undefined, [3, 1, 7, 0])).toEqual([3, 1, 7, 0]);
  });
  it("returns only the cards that were not in the previous Hand, in Hand order", () => {
    expect(newCards([0, 1, 2, 3], [2, 5, 3, 6])).toEqual([5, 6]);
  });
  it("returns nothing when the Hand did not change", () => {
    expect(newCards([4, 5], [4, 5])).toEqual([]);
  });
});

describe("drawSchedule", () => {
  it("starts each card 200 ms after the previous and lands it 450 ms later, 1.2 s for four", () => {
    expect(drawSchedule(0)).toEqual({ start: 0, landed: 450 });
    expect(drawSchedule(3)).toEqual({ start: 600, landed: 1050 });
  });
});

describe("shownDeckCount", () => {
  it("counts down with each card that leaves the pile", () => {
    expect(shownDeckCount(8, 4, 0)).toBe(12);
    expect(shownDeckCount(8, 4, 2)).toBe(10);
    expect(shownDeckCount(8, 4, 4)).toBe(8);
  });
});
