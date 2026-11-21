import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILM, FILM_DURATION_MS, frameAt, locateFrame, shouldPlayIntro } from "./intro-film";

describe("intro film", () => {
  it("has a picture for every frame in its sheets", () => {
    expect(FILM.sheets.reduce((sum, sheet) => sum + sheet.frames, 0)).toBe(FILM.frames);
  });

  it("runs about nine seconds at twelve pictures a second", () => {
    expect(FILM_DURATION_MS).toBeCloseTo(9083, -1);
  });

  it("shows the first picture at the start and holds the last one", () => {
    expect(frameAt(0)).toBe(0);
    expect(frameAt(-50)).toBe(0);
    expect(frameAt(83)).toBe(0);
    expect(frameAt(84)).toBe(1);
    expect(frameAt(FILM_DURATION_MS)).toBe(FILM.frames - 1);
    expect(frameAt(FILM_DURATION_MS * 3)).toBe(FILM.frames - 1);
  });

  it("finds each picture in its sheet, row by row", () => {
    expect(locateFrame(0)).toEqual({ sheet: 0, column: 0, row: 0 });
    expect(locateFrame(7)).toEqual({ sheet: 0, column: 1, row: 1 });
    expect(locateFrame(59)).toEqual({ sheet: 0, column: 5, row: 9 });
    expect(locateFrame(60)).toEqual({ sheet: 1, column: 0, row: 0 });
    expect(locateFrame(FILM.frames - 1)).toEqual({ sheet: 1, column: 0, row: 8 });
    expect(() => locateFrame(FILM.frames)).toThrow(RangeError);
  });

  it("has sheets of the size the layout says", () => {
    for (const { file, frames } of FILM.sheets) {
      const png = readFileSync(new URL(`../public/assets/intro/${file}`, import.meta.url));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      expect(width).toBe(FILM.columns * FILM.width);
      expect(height).toBe(Math.ceil(frames / FILM.columns) * FILM.height);
    }
  });

  it("plays only for a player who has not asked for less motion, unless forced", () => {
    expect(shouldPlayIntro({ reducedMotion: false, automated: false, forced: false })).toBe(true);
    expect(shouldPlayIntro({ reducedMotion: true, automated: false, forced: false })).toBe(false);
    expect(shouldPlayIntro({ reducedMotion: false, automated: true, forced: false })).toBe(false);
    expect(shouldPlayIntro({ reducedMotion: true, automated: true, forced: true })).toBe(true);
  });
});
