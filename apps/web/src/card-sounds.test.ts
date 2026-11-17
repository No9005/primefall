import { describe, expect, it } from "vitest";
import { type PlanCounts, cardSoundsOf } from "./card-sounds";

const counts = (queue: number, pitched: number, key = "kit:1"): PlanCounts => ({ key, queue, pitched });

describe("the sounds of the card actions", () => {
  it("plays a card when it goes into the Queue and when it comes back", () => {
    expect(cardSoundsOf(counts(0, 0), counts(1, 0))).toEqual(["cardPlayed"]);
    expect(cardSoundsOf(counts(2, 0), counts(1, 0))).toEqual(["cardBack"]);
  });

  it("plays Energy when a card is pitched, and a card back when the Pitch is undone", () => {
    expect(cardSoundsOf(counts(0, 0), counts(0, 1))).toEqual(["energyUp"]);
    expect(cardSoundsOf(counts(0, 1), counts(0, 0))).toEqual(["cardBack"]);
  });

  it("is silent when nothing changed", () => {
    expect(cardSoundsOf(counts(1, 1), counts(1, 1))).toEqual([]);
  });

  it("is silent for the first look, for another Hero and for a new Round: those are not the player's actions", () => {
    expect(cardSoundsOf(undefined, counts(2, 1))).toEqual([]);
    expect(cardSoundsOf(counts(2, 1), counts(0, 0, "max:1"))).toEqual([]);
    expect(cardSoundsOf(counts(2, 1), counts(0, 0, "kit:2"))).toEqual([]);
  });
});
