import { readFileSync } from "node:fs";
import path from "node:path";
import { HeroClass } from "game-core";
import { describe, expect, it } from "vitest";
import type { ClipName } from "./hero-clips";
import { frameAt, PIXEL_SCALE, pixelSheetOf, restLoopProgress } from "./pixel-heroes";

const FOLDER = path.join(import.meta.dirname, "../public/assets/pixel-heroes");
const FOLDERS: Record<HeroClass, string> = { [HeroClass.Bruiser]: "bruiser", [HeroClass.Controller]: "controller", [HeroClass.Assassin]: "assassin" };

/** Every clip name the game can play for a Hero (the `ClipName` union, as an exhaustive record). */
const CLIP_NAMES: Record<ClipName, true> = {
  idle: true,
  walk: true,
  wait: true,
  attack: true,
  longShot: true,
  longHidden: true,
  knockback: true,
  shieldBreaker: true,
  hitHidden: true,
  tagRound: true,
  slowPulse: true,
  scoutDrone: true,
  aegis: true,
  deploy: true,
  deployFull: true,
  demolish: true,
  scrapField: true,
  scrapGain: true,
  hidden: true,
  block: true,
  hit: true,
  absorb: true,
  takeCover: true,
  takeCoverFull: true,
  inCover: true,
  inCoverFull: true,
  exhausted: true,
};

function sheetsOf(heroClass: HeroClass): { sheet: string; layers: string[] }[] {
  return JSON.parse(readFileSync(path.join(FOLDER, FOLDERS[heroClass], "clips.json"), "utf8")).clips;
}

describe("Pixel Hero sheets", () => {
  for (const heroClass of Object.values(HeroClass)) {
    it(`every game clip of the ${heroClass} has a sheet that exists, with a figure layer`, () => {
      const sheets = sheetsOf(heroClass);
      for (const name of Object.keys(CLIP_NAMES) as ClipName[]) {
        const sheet = pixelSheetOf(heroClass, name);
        const clip = sheets.find((candidate) => candidate.sheet === `${sheet}.json`);
        expect(clip, `${heroClass} ${name} -> ${sheet}`).toBeDefined();
        expect(clip!.layers).toContain("figure");
        expect(readFileSync(path.join(FOLDER, FOLDERS[heroClass], `${sheet}.json`), "utf8")).toContain(`${FOLDERS[heroClass]}.${sheet}.figure`);
      }
    });
  }

  it("a clip a class lacks plays its basic attack; a Shield-absorbed hit of a Controller or Assassin stands in idle", () => {
    expect(pixelSheetOf(HeroClass.Bruiser, "longShot")).toBe("slam");
    expect(pixelSheetOf(HeroClass.Bruiser, "absorb")).toBe("shield");
    expect(pixelSheetOf(HeroClass.Controller, "absorb")).toBe("idle");
    expect(pixelSheetOf(HeroClass.Assassin, "absorb")).toBe("idle");
    expect(pixelSheetOf(HeroClass.Assassin, "hidden")).toBe("hidden");
  });

  it("plays a loop round and rests a clip that plays once on its last frame", () => {
    expect(frameAt(40, true, 0.5)).toBe(20);
    expect(frameAt(40, true, 1.25)).toBe(10);
    expect(frameAt(49, false, 3)).toBe(48);
    expect(frameAt(49, false, -1)).toBe(0);
  });

  it("scales by whole numbers", () => {
    expect(Number.isInteger(PIXEL_SCALE)).toBe(true);
  });
});

describe("the rest loop of a Hero in Cover", () => {
  it("never shows the rise at the end of the sheet, which ran into a jump back to crouching every cycle", () => {
    for (const heroClass of Object.values(HeroClass)) {
      for (const name of ["inCover", "inCoverFull"] as const) {
        for (let progress = 0; progress < 5; progress += 0.037) {
          const at = restLoopProgress(heroClass, name, progress);
          expect(at, `${heroClass} ${name}`).toBeGreaterThanOrEqual(name === "inCover" ? 0.24 : 0.22);
          expect(at, `${heroClass} ${name}`).toBeLessThan(0.9);
        }
      }
    }
  });

  it("starts the loop after the taking and wraps inside it", () => {
    expect(restLoopProgress(HeroClass.Assassin, "inCover", 0)).toBeCloseTo(0.24);
    expect(restLoopProgress(HeroClass.Assassin, "inCover", 1)).toBeCloseTo(0.24);
    expect(restLoopProgress(HeroClass.Assassin, "inCover", 1.5)).toBeCloseTo((0.24 + 0.739) / 2);
  });

  it("leaves every other clip as it is", () => {
    expect(restLoopProgress(HeroClass.Bruiser, "idle", 0.7)).toBe(0.7);
  });
});
