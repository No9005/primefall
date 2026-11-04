import { describe, expect, it } from "vitest";
import { HERO_STYLE } from "./hero-style";
import { TERRAIN_STYLE } from "./terrain-style";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(color: number): number {
  return 0.2126 * channel((color >> 16) & 0xff) + 0.7152 * channel((color >> 8) & 0xff) + 0.0722 * channel(color & 0xff);
}
function contrast(a: number, b: number): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
function blend(base: number, over: number, alpha: number): number {
  const mix = (shift: number) => Math.round(((over >> shift) & 0xff) * alpha + ((base >> shift) & 0xff) * (1 - alpha));
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

const litWithGlow = blend(TERRAIN_STYLE.floorLit.fill, TERRAIN_STYLE.heroLight.color, TERRAIN_STYLE.heroLight.alpha);
const floors = [TERRAIN_STYLE.floorLit.fill, TERRAIN_STYLE.floor.fill, TERRAIN_STYLE.floorDark.fill];

describe("Hero readability (contrast >= 3:1)", () => {
  it("the rim separates from lit floor with glow, plain floor and fog", () => {
    for (const rim of [HERO_STYLE.rim.own, HERO_STYLE.rim.enemy]) {
      for (const floor of [litWithGlow, ...floors]) expect(contrast(rim, floor)).toBeGreaterThanOrEqual(3);
    }
  });

  it("the dark outline reads against the rim", () => {
    for (const rim of [HERO_STYLE.rim.own, HERO_STYLE.rim.enemy]) expect(contrast(HERO_STYLE.outline.color, rim)).toBeGreaterThanOrEqual(3);
  });

  it("the own ring reads on lit floor with glow", () => {
    expect(contrast(HERO_STYLE.ring.own, litWithGlow)).toBeGreaterThanOrEqual(3);
  });

  it("the enemy ring reads on lit, plain and dark floor", () => {
    for (const floor of floors) expect(contrast(HERO_STYLE.ring.enemy, floor)).toBeGreaterThanOrEqual(3);
  });
});
