import { describe, expect, it } from "vitest";
import { burnSoundMs } from "./deck-burn";
import { GLIMMER, glimmerFrame, glimmerOf, type Raster } from "./burn-glimmer";

const W = 20;
const H = 30;
const card: Raster = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).map((_, index) => (index % 4 === 3 ? 255 : 90 + (index % 7))) };
const glimmer = glimmerOf(W, H);
const visible = (picture: Raster) => picture.data.filter((_, index) => index % 4 === 3 && picture.data[index]! > 0).length;

describe("the glimmer of a card that goes into the Exile", () => {
  it("starts as the card, lifted into the headroom above it, and is gone at the end", () => {
    const start = glimmerFrame(card, glimmer, 0);
    expect(start.height).toBe(H + GLIMMER.headroom);
    expect(visible(start)).toBe(W * H);
    expect(visible(glimmerFrame(card, glimmer, 1))).toBe(0);
  });

  it("lifts the card before it burns", () => {
    const rows = (t: number) => {
      const picture = glimmerFrame(card, glimmer, t, false);
      return Array.from({ length: picture.height }, (_, y) => y).filter((y) => picture.data[(y * W + 5) * 4 + 3]! > 0);
    };
    expect(rows(0)[0]).toBe(GLIMMER.headroom);
    expect(rows(GLIMMER.liftEnd)[0]).toBe(GLIMMER.headroom - GLIMMER.liftPx);
    expect(rows(GLIMMER.burnStart - 0.01)).toHaveLength(H);
  });

  it("eats the card and never gives a pixel back", () => {
    let previous = Infinity;
    for (let step = 0; step <= 20; step++) {
      const shown = visible(glimmerFrame(card, glimmer, step / 20, false));
      expect(shown).toBeLessThanOrEqual(previous);
      previous = shown;
    }
    expect(previous).toBe(0);
  });

  it("glows at the edge: orange and red pixels appear while it burns", () => {
    const picture = glimmerFrame(card, glimmer, 0.5, false);
    let glowing = 0;
    for (let at = 0; at < picture.data.length; at += 4) if (picture.data[at + 3]! > 0 && picture.data[at]! > 180 && picture.data[at + 2]! < 120) glowing++;
    expect(glowing).toBeGreaterThan(0);
  });

  it("sends sparks up from the edge that are out before the end", () => {
    const withSparks = visible(glimmerFrame(card, glimmer, 0.6));
    const without = visible(glimmerFrame(card, glimmer, 0.6, false));
    expect(withSparks).toBeGreaterThanOrEqual(without);
    expect(visible(glimmerFrame(card, glimmer, 1))).toBe(0);
  });

  it("burns every card the same way (no randomness)", () => {
    expect(glimmerFrame(card, glimmerOf(W, H), 0.5)).toEqual(glimmerFrame(card, glimmerOf(W, H), 0.5));
  });
});

describe("the sound of the burn", () => {
  it("comes once, as the glowing edge appears on the first card", () => {
    expect(burnSoundMs()).toBe(300 + 0.14 * 900);
  });
});
