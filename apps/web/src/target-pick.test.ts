import { describe, expect, it } from "vitest";
import { pulseAlpha, pullOffset, ReleaseOutcome, releaseOutcome } from "./target-pick";

describe("pullOffset", () => {
  it("follows the finger down and never up", () => {
    expect(pullOffset(100, 130)).toBe(30);
    expect(pullOffset(100, 80)).toBe(0);
  });
});

describe("releaseOutcome", () => {
  it("cancels after a pull of more than 36 px and on a tap", () => {
    expect(releaseOutcome(37)).toBe(ReleaseOutcome.Cancel);
    expect(releaseOutcome(0)).toBe(ReleaseOutcome.Cancel);
  });
  it("springs back after a shorter pull", () => {
    expect(releaseOutcome(36)).toBe(ReleaseOutcome.SpringBack);
    expect(releaseOutcome(20)).toBe(ReleaseOutcome.SpringBack);
  });
});

describe("pulseAlpha", () => {
  it("swings between 35 % and 90 % in 0.9 s and alternates", () => {
    expect(pulseAlpha(0, false)).toBeCloseTo(0.35);
    expect(pulseAlpha(900, false)).toBeCloseTo(0.9);
    expect(pulseAlpha(1800, false)).toBeCloseTo(0.35);
  });
  it("stands still with reduced motion", () => {
    expect(pulseAlpha(0, true)).toBe(pulseAlpha(450, true));
  });
});
