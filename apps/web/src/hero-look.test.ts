import { HeroClass } from "game-core";
import { describe, expect, it } from "vitest";
import { beaconAlpha } from "./hero-figure";
import { heroLook } from "./hero-style";

describe("heroLook", () => {
  it("gives the exact palette of the README table for all six combinations", () => {
    expect(heroLook(HeroClass.Bruiser, false)).toMatchObject({ body: 0x2a56a8, plate: 0x5f8fe0, legs: 0x173a78, arms: 0x234a94, accent: 0x1f4488 });
    expect(heroLook(HeroClass.Controller, false)).toMatchObject({ body: 0x4f8fe6, plate: 0xa9ccff, legs: 0x2d5aa8, arms: 0x3f78d0, accent: 0x2a5fb8 });
    expect(heroLook(HeroClass.Assassin, false)).toMatchObject({ body: 0x8ec3ff, plate: 0xd0e8ff, legs: 0x4a7ab8, arms: 0x6aa6ea, accent: 0x3a6ab0 });
    expect(heroLook(HeroClass.Bruiser, true)).toMatchObject({ body: 0xa3212c, plate: 0xd8606a, legs: 0x6e141c, arms: 0x8c1b25, accent: 0x7a1822 });
    expect(heroLook(HeroClass.Controller, true)).toMatchObject({ body: 0xe04a44, plate: 0xff9c96, legs: 0x9a2a2a, arms: 0xc93a38, accent: 0xb02e2e });
    expect(heroLook(HeroClass.Assassin, true)).toMatchObject({ body: 0xff9a92, plate: 0xffd0cc, legs: 0xb04a4a, arms: 0xe87a76, accent: 0xa63a3a });
  });

  it("makes enemy visors glow red and ours class-coloured", () => {
    expect(heroLook(HeroClass.Bruiser, true).visor).toBe(0xff5a5a);
    expect(heroLook(HeroClass.Assassin, true).visor).toBe(0xff5a5a);
    expect(heroLook(HeroClass.Controller, true).visor).toBe(0xff9a5a);
    expect(heroLook(HeroClass.Controller, false).visor).toBe(0xffd24a);
    expect(heroLook(HeroClass.Assassin, false).visor).toBe(0x7fe8ff);
  });

  it("gives the Bruiser a skin head and the others a helmet or hood in the accent colour", () => {
    expect(heroLook(HeroClass.Bruiser, false).head).toBe(0xe8d3b9);
    expect(heroLook(HeroClass.Assassin, true).head).toBe(heroLook(HeroClass.Assassin, true).accent);
  });
});

describe("beaconAlpha", () => {
  it("is lit at the start, dimmest at half the loop and lit again at the end", () => {
    expect(beaconAlpha(0)).toBeCloseTo(1);
    expect(beaconAlpha(700)).toBeCloseTo(0.25);
    expect(beaconAlpha(1400)).toBeCloseTo(1);
  });
});
