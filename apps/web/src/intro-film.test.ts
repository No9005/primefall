import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILM, FILM_DURATION_MS, frameAt, LOOP_FADE_IN_S, LOOP_STARTS_AT_MS, locateFrame, shouldPlayIntro, WHIP_MS } from "./intro-film";

describe("intro film", () => {
  it("has a picture for every frame in its sheets", () => {
    expect(FILM.sheets.reduce((sum, sheet) => sum + sheet.frames, 0)).toBe(FILM.frames);
  });

  it("runs about eight seconds at twelve pictures a second after the live part", () => {
    expect(FILM_DURATION_MS).toBeCloseTo(7917, -1);
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
    expect(locateFrame(FILM.frames - 1)).toEqual({ sheet: 1, column: 4, row: 5 });
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

  it("starts the Hero Select loop under the end of the sound, before the film is over", () => {
    // The sound is 8.9 s from the tap (the live part of 1.17 s plus the film); the loop begins 0.2 s before its end.
    expect(LOOP_STARTS_AT_MS + WHIP_MS).toBeCloseTo(8700, 0);
    expect(LOOP_STARTS_AT_MS).toBeGreaterThan(0);
    expect(LOOP_STARTS_AT_MS).toBeLessThan(FILM_DURATION_MS);
    expect(LOOP_FADE_IN_S).toBeGreaterThan(0.5);
  });

  it("plays only for a player who has not asked for less motion, unless forced", () => {
    expect(shouldPlayIntro({ reducedMotion: false, automated: false, forced: false })).toBe(true);
    expect(shouldPlayIntro({ reducedMotion: true, automated: false, forced: false })).toBe(false);
    expect(shouldPlayIntro({ reducedMotion: false, automated: true, forced: false })).toBe(false);
    expect(shouldPlayIntro({ reducedMotion: true, automated: true, forced: true })).toBe(true);
  });
});
