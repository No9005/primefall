import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { MusicManifest } from "./audio-manifest";
import { CONTESTED_LEVEL, musicLevelFor, musicPhaseOf, nextBarTime } from "./music";

describe("the level of the music", () => {
  it("steps up from planning to the countdown to the Resolution", () => {
    expect(musicLevelFor("planning", false)).toBe(0);
    expect(musicLevelFor("countdown", false)).toBe(1);
    expect(musicLevelFor("resolution", false)).toBe(2);
  });

  it("is the climax whenever the Prime Zone is contested", () => {
    for (const phase of ["planning", "countdown", "resolution"] as const) expect(musicLevelFor(phase, true)).toBe(CONTESTED_LEVEL);
  });

  it("takes the countdown in the last seconds of planning, and the Resolution once it plays", () => {
    expect(musicPhaseOf(false, 45, 10)).toBe("planning");
    expect(musicPhaseOf(false, 11, 10)).toBe("planning");
    expect(musicPhaseOf(false, 10, 10)).toBe("countdown");
    expect(musicPhaseOf(false, 1, 10)).toBe("countdown");
    expect(musicPhaseOf(false, 0, 10)).toBe("planning");
    expect(musicPhaseOf(true, 7, 10)).toBe("resolution");
  });
});

describe("the bar line a change waits for", () => {
  const LOOP = 80 / 3;
  const BAR = LOOP / 8;

  it("is the next bar of the loop", () => {
    expect(nextBarTime(1.0, 0, LOOP, 8)).toBeCloseTo(BAR, 6);
    expect(nextBarTime(BAR + 0.5, 0, LOOP, 8)).toBeCloseTo(2 * BAR, 6);
  });

  it("counts from the start of the loop and wraps with it", () => {
    expect(nextBarTime(10 + 1.0, 10, LOOP, 8)).toBeCloseTo(10 + BAR, 6);
    expect(nextBarTime(LOOP * 3 + 0.2, 0, LOOP, 8)).toBeCloseTo(LOOP * 3 + BAR, 6);
  });

  it("takes the bar after the next when the next is too close to schedule", () => {
    expect(nextBarTime(BAR - 0.01, 0, LOOP, 8, 0.05)).toBeCloseTo(2 * BAR, 6);
  });

  it("never waits longer than one bar and never lands in the past", () => {
    for (let now = 0; now < LOOP * 2; now += 0.37) {
      const at = nextBarTime(now, 0, LOOP, 8);
      expect(at).toBeGreaterThan(now);
      expect(at - now).toBeLessThanOrEqual(BAR + 0.05 + 1e-9);
    }
  });
});

describe("the music manifest", () => {
  const dir = path.resolve(__dirname, "../public/assets/audio/music");
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as MusicManifest;

  it("names layer files that exist, and every level only layers it has", () => {
    for (const [layer, file] of Object.entries(manifest.layers)) expect(existsSync(path.join(dir, file)), layer).toBe(true);
    for (const level of manifest.levels) for (const layer of Object.keys(level.gains)) expect(manifest.layers[layer], `${level.name}: ${layer}`).toBeDefined();
  });

  it("names the intro and the opening files, which exist", () => {
    for (const part of [manifest.intro, manifest.opening]) {
      expect(part).toBeDefined();
      expect(existsSync(path.join(dir, part?.file ?? "missing")), part?.file).toBe(true);
    }
  });

  it("has the four levels of the game, and only the contested one plays the finished refrain", () => {
    expect(manifest.levels.map((level) => level.name)).toEqual(["planning", "countdown", "resolution", "contested"]);
    expect(manifest.levels.map((level) => "refrain" in level.gains)).toEqual([false, false, false, true]);
  });

  it("is a loop of 8 bars at 72 BPM", () => {
    expect(manifest.bpm).toBe(72);
    expect(manifest.bars).toBe(8);
  });
});
