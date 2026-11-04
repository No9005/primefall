import { describe, expect, it } from "vitest";
import { CARD_WIDTH, cardAtX, fanSpacing, MIN_STRIP, STRIP } from "./hand-fan";

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

  it("keeps full-size cards with the normal strip while the space allows it", () => {
    expect(fanSpacing(370, 4)).toEqual({ cardWidth: CARD_WIDTH, step: STRIP, width: 3 * STRIP + CARD_WIDTH });
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

  it("resolves every point across the whole width of the fan, gaps included, to the card whose strip it is on", () => {
    for (const cards of [1, 2, 3, 4]) {
      const spacing = fanSpacing(336, cards);
      for (let x = 0; x < spacing.width; x += 1) {
        const expected = Math.min(cards - 1, Math.floor(x / spacing.step));
        expect(cardAtX(spacing, cards, x)).toBe(expected);
      }
    }
  });
});
