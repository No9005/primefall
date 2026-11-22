import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOTSTROM_INTRO, NOTSTROM_INTRO_DURATION_MS, NOTSTROM_INTRO_SOUND, shouldPlayNotstromIntro } from "./notstrom-intro";

describe("Notstrom Intro", () => {
  it("has a picture for every frame in its sheets", () => {
    expect(NOTSTROM_INTRO.sheets.reduce((sum, sheet) => sum + sheet.frames, 0)).toBe(NOTSTROM_INTRO.frames);
  });

  it("runs about eight seconds at twelve pictures a second after the live part", () => {
    expect(NOTSTROM_INTRO_DURATION_MS).toBeCloseTo(7917, -1);
  });

  it("has sheets of the size the layout says", () => {
    for (const { file, frames } of NOTSTROM_INTRO.sheets) {
      const png = readFileSync(new URL(`../public/assets/notstrom-intro/${file}`, import.meta.url));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      expect(width).toBe(NOTSTROM_INTRO.columns * NOTSTROM_INTRO.width);
      expect(height).toBe(Math.ceil(frames / NOTSTROM_INTRO.columns) * NOTSTROM_INTRO.height);
    }
  });

  it("starts the Hero Select loop under the end of the sound of the Notstrom Intro (8.9 s), with a soft overlap", () => {
    expect(NOTSTROM_INTRO_SOUND.loopStartsAtSeconds).toBeLessThan(8.9);
    expect(8.9 - NOTSTROM_INTRO_SOUND.loopStartsAtSeconds).toBeLessThanOrEqual(0.5);
    expect(NOTSTROM_INTRO_SOUND.loopFadeInSeconds).toBeGreaterThan(0.5);
  });

  it("plays only for a player who has not asked for less motion, unless forced", () => {
    expect(shouldPlayNotstromIntro({ reducedMotion: false, automated: false, forced: false })).toBe(true);
    expect(shouldPlayNotstromIntro({ reducedMotion: true, automated: false, forced: false })).toBe(false);
    expect(shouldPlayNotstromIntro({ reducedMotion: false, automated: true, forced: false })).toBe(false);
    expect(shouldPlayNotstromIntro({ reducedMotion: true, automated: true, forced: true })).toBe(true);
  });
});
