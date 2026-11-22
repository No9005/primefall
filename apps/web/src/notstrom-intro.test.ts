import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOTSTROM_INTRO, NOTSTROM_INTRO_DURATION_MS, NOTSTROM_INTRO_SOUND, frameAt, locateFrame, shouldPlayNotstromIntro } from "./notstrom-intro";

describe("Notstrom Intro", () => {
  it("has a picture for every frame in its sheets", () => {
    expect(NOTSTROM_INTRO.sheets.reduce((sum, sheet) => sum + sheet.frames, 0)).toBe(NOTSTROM_INTRO.frames);
  });

  it("runs about eight seconds at twelve pictures a second after the live part", () => {
    expect(NOTSTROM_INTRO_DURATION_MS).toBeCloseTo(7917, -1);
  });

  it("shows the first picture at the start and holds the last one", () => {
    expect(frameAt(0)).toBe(0);
    expect(frameAt(-50)).toBe(0);
    expect(frameAt(83)).toBe(0);
    expect(frameAt(84)).toBe(1);
    expect(frameAt(NOTSTROM_INTRO_DURATION_MS)).toBe(NOTSTROM_INTRO.frames - 1);
    expect(frameAt(NOTSTROM_INTRO_DURATION_MS * 3)).toBe(NOTSTROM_INTRO.frames - 1);
  });

  it("finds each picture in its sheet, row by row", () => {
    expect(locateFrame(0)).toEqual({ sheet: 0, column: 0, row: 0 });
    expect(locateFrame(7)).toEqual({ sheet: 0, column: 1, row: 1 });
    expect(locateFrame(59)).toEqual({ sheet: 0, column: 5, row: 9 });
    expect(locateFrame(60)).toEqual({ sheet: 1, column: 0, row: 0 });
    expect(locateFrame(NOTSTROM_INTRO.frames - 1)).toEqual({ sheet: 1, column: 4, row: 5 });
    expect(() => locateFrame(NOTSTROM_INTRO.frames)).toThrow(RangeError);
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
