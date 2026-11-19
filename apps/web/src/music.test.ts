import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { MusicManifest } from "./audio-manifest";
import { CONTESTED_LEVEL, levelChange, musicLevelFor, musicPhaseOf, nextBarTime } from "./music";

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

describe("how the music changes level", () => {
  it("steps into the Resolution and into the climax with a stinger, at once", () => {
    expect(levelChange(0, 2)).toEqual({ stinger: "mid", at: "now" });
    expect(levelChange(1, 2)).toEqual({ stinger: "mid", at: "now" });
    expect(levelChange(2, CONTESTED_LEVEL)).toEqual({ stinger: "high", at: "now" });
    expect(levelChange(0, CONTESTED_LEVEL)).toEqual({ stinger: "high", at: "now" });
  });

  it("returns to planning with a low stinger, at once", () => {
    expect(levelChange(2, 0)).toEqual({ stinger: "low", at: "now" });
    expect(levelChange(CONTESTED_LEVEL, 0)).toEqual({ stinger: "low", at: "now" });
  });

  it("changes at once, without a stinger, into the countdown (its number makes the sound)", () => {
    expect(levelChange(0, 1)).toEqual({ at: "now" });
  });

  it("waits for the bar line when nothing makes a sound: from the climax back to the Resolution", () => {
    expect(levelChange(CONTESTED_LEVEL, 2)).toEqual({ at: "bar" });
  });

  it("does nothing when the level stays", () => {
    for (const level of [0, 1, 2, 3] as const) expect(levelChange(level, level)).toBeUndefined();
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

  it("names the end music of both outcomes, which exists", () => {
    for (const outcome of ["victory", "defeat"] as const) {
      const track = manifest.ending?.[outcome];
      expect(track, outcome).toBeDefined();
      for (const part of [track?.jingle, track?.loop]) expect(existsSync(path.join(dir, part?.file ?? "missing")), `${outcome} ${part?.file}`).toBe(true);
      expect(track?.crossfadeSeconds).toBeGreaterThan(0);
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
