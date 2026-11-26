import { existsSync, readFileSync } from "node:fs";
import type { MusicManifest } from "./audio-manifest";
import { describe, expect, it } from "vitest";
import { NOTSTROM_INTRO, NOTSTROM_INTRO_SOUND, shouldPlayNotstromIntro } from "./notstrom-intro";

describe("Notstrom Intro", () => {
  it("has a picture for every frame in its sheets", () => {
    expect(NOTSTROM_INTRO.sheets.reduce((sum, sheet) => sum + sheet.frames, 0)).toBe(NOTSTROM_INTRO.frames);
  });

  it("has sheets of the size the layout says", () => {
    for (const { file, frames } of NOTSTROM_INTRO.sheets) {
      const png = readFileSync(new URL(`../../../archive/notstrom-intro/sheets/${file}`, import.meta.url));
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

  it("keeps the sounds that follow the pictures inside the film, in order, and their files exist", () => {
    const manifest = JSON.parse(readFileSync(new URL("../public/assets/audio/music/manifest.json", import.meta.url), "utf8")) as MusicManifest;
    const effects = manifest.notstromIntro?.effects ?? [];
    const filmMs = (NOTSTROM_INTRO.frames / NOTSTROM_INTRO.fps) * 1000;
    expect(effects.length).toBeGreaterThan(0);
    expect(effects.map((effect) => effect.atMs)).toEqual([...effects.map((effect) => effect.atMs)].sort((a, b) => a - b));
    for (const effect of effects) {
      expect(effect.atMs).toBeGreaterThanOrEqual(0);
      expect(effect.atMs).toBeLessThan(filmMs);
      expect(existsSync(new URL(`../public/assets/audio/music/${effect.file}`, import.meta.url))).toBe(true);
    }
  });

  it("plays only for a player who has not asked for less motion, unless forced", () => {
    expect(shouldPlayNotstromIntro({ reducedMotion: false, automated: false, forced: false })).toBe(true);
    expect(shouldPlayNotstromIntro({ reducedMotion: true, automated: false, forced: false })).toBe(false);
    expect(shouldPlayNotstromIntro({ reducedMotion: false, automated: true, forced: false })).toBe(false);
    expect(shouldPlayNotstromIntro({ reducedMotion: true, automated: true, forced: true })).toBe(true);
  });
});
