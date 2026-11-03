import { describe, expect, it } from "vitest";
import {
  addShuffle,
  NO_SHUFFLE_PENDING,
  riffleSide,
  settleShuffle,
  SHUFFLE_MS,
  SHUFFLE_TIMELINE,
  shownDeckAfterShuffle,
  shownDiscardCount,
  shuffledWhileDrawing,
  shuffleStackSize,
} from "./deck-shuffle";

describe("shuffle timeline", () => {
  it("riffles twice and ends after about 1.9 s", () => {
    expect(SHUFFLE_TIMELINE.riffles).toHaveLength(2);
    expect(SHUFFLE_TIMELINE.riffles[1].merged).toBe(SHUFFLE_MS);
    expect(SHUFFLE_TIMELINE.riffles[0].merged).toBeLessThan(SHUFFLE_TIMELINE.riffles[1].split);
  });
  it("shows at most 6 card backs and splits them into alternating halves", () => {
    expect(shuffleStackSize(14)).toBe(6);
    expect(shuffleStackSize(3)).toBe(3);
    expect([0, 1, 2, 3].map(riffleSide)).toEqual([-1, 1, -1, 1]);
  });
});

describe("shown counts around a shuffle", () => {
  it("keeps the Discard until the shuffle starts, then 0; the Deck jumps only when it ends", () => {
    // Deck 0 and Discard 6 before; after the shuffle the Deck holds 6 (deckAfter already includes them).
    let pending = addShuffle(NO_SHUFFLE_PENDING, "h1", 6);
    expect(shownDiscardCount(6, 6, pending, "h1")).toBe(6);
    expect(shownDeckAfterShuffle(6, pending, "h1")).toBe(0);
    pending = settleShuffle(pending, "h1", "started", 6);
    expect(shownDiscardCount(6, 6, pending, "h1")).toBe(0);
    expect(shownDeckAfterShuffle(6, pending, "h1")).toBe(0);
    pending = settleShuffle(pending, "h1", "ended", 6);
    expect(shownDeckAfterShuffle(6, pending, "h1")).toBe(6);
  });
  it("leaves the Discard alone before the playback has reached the shuffle", () => {
    expect(shownDiscardCount(6, 0, NO_SHUFFLE_PENDING, "h1")).toBe(6);
  });
});

describe("shuffledWhileDrawing", () => {
  it("finds the shuffle when the draw wanted more cards than the Deck had", () => {
    // Deck 2, three cards drawn, 5 left in the Deck: 6 cards were shuffled in after the 2 were drawn.
    expect(shuffledWhileDrawing(2, 3, 5)).toBe(6);
  });
  it("finds none when the Deck was enough", () => {
    expect(shuffledWhileDrawing(5, 3, 2)).toBe(0);
    expect(shuffledWhileDrawing(3, 3, 0)).toBe(0);
  });
});
