import { describe, expect, it } from "vitest";
import { cardAtX, fanSpacing, MIN_STRIP } from "./hand-fan";

describe("fanSpacing", () => {
  for (const width of [310, 250]) {
    for (const cards of [3, 4, 5, 6]) {
      it(`gives every strip at least ${MIN_STRIP} px for ${cards} cards in ${width} px`, () => {
        const { step, cardWidth } = fanSpacing(width, cards);
        expect(step).toBeGreaterThanOrEqual(MIN_STRIP);
        expect(cardWidth).toBeGreaterThanOrEqual(MIN_STRIP);
      });
    }
  }

  it("fits the space whenever 44 px strips allow it", () => {
    expect(fanSpacing(310, 6).width).toBeLessThanOrEqual(310);
    expect(fanSpacing(250, 5).width).toBeLessThanOrEqual(250);
  });

  it("shrinks the cards once the strips are at their minimum", () => {
    const { cardWidth, step } = fanSpacing(250, 5);
    expect(step).toBe(MIN_STRIP);
    expect(cardWidth).toBe(74);
  });
});

describe("cardAtX", () => {
  it("picks the card whose strip is under the press, not its neighbours", () => {
    const spacing = fanSpacing(250, 4);
    const strip = spacing.step;
    expect(cardAtX(spacing, 4, strip + 2)).toBe(1);
    expect(cardAtX(spacing, 4, strip * 2 - 2)).toBe(1);
    expect(cardAtX(spacing, 4, strip * 2 + 2)).toBe(2);
    expect(cardAtX(spacing, 4, spacing.width - 1)).toBe(3);
  });
});
