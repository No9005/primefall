import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GLOSSARY_ENTRIES, GLOSSARY_GROUPS, type HudName, type SceneName } from "./glossary";
import { SCENE_NAMES } from "./glossary-pictures";

const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");
const AVOIDED = [/\bHP\b/, /\bhealth\b/i, /\bdeath\b/i, /\bteam\b/i];
const HUD_NAMES: readonly HudName[] = ["scorePill", "timerPill", "queue", "deckPile", "resolutionBar", "commentary"];

describe("Glossary entries", () => {
  it("each have a name, a text and a group of the screen", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.name.trim(), "name").not.toBe("");
      expect(entry.text.trim(), `text of ${entry.name}`).not.toBe("");
      expect(GLOSSARY_GROUPS).toContain(entry.group);
    }
  });

  it("have unique names", () => {
    const names = GLOSSARY_ENTRIES.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("each have a picture the game draws: a scene of the board's own drawing code or a HUD component", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      if ("scene" in entry.picture) expect(SCENE_NAMES as readonly SceneName[], entry.name).toContain(entry.picture.scene);
      else expect(HUD_NAMES, entry.name).toContain(entry.picture.hud);
    }
  });

  it("have every group filled", () => {
    for (const group of GLOSSARY_GROUPS) expect(GLOSSARY_ENTRIES.some((entry) => entry.group === group), group).toBe(true);
  });

  it("do not use the terms GLOSSARY.md says to avoid", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      for (const term of AVOIDED) expect(`${entry.name} ${entry.text} ${entry.mode ?? ""}`, entry.name).not.toMatch(term);
    }
  });
});

describe("Glossary screen", () => {
  it("draws with the board's own drawing code, not its own copy of a look", () => {
    const pictures = read("glossary-pictures.ts");
    for (const shared of ["drawTerrain", "drawZone", "drawScoutArea", "scannedMark", "scoutDroneMark", "hiddenSeenMark", "ghostMark", "heroFigure", "marksFigure", "markedMark", "slowMark", "attackBadge", "EffectsLayer"]) {
      expect(pictures, shared).toContain(shared);
    }
    // The board uses the same functions.
    const board = read("Board.tsx");
    for (const shared of ["drawTerrain", "drawZone", "drawScoutArea", "scannedMark", "scoutDroneMark", "hiddenSeenMark", "ghostMark"]) expect(board, shared).toContain(shared);
  });

  it("is static data only: no match host, no saved match", () => {
    for (const file of ["GlossaryScreen.tsx", "glossary-pictures.ts", "glossary.ts"]) expect(read(file), file).not.toMatch(/match-storage|local-host|createLocalHost/);
  });

  it("opens from the start screen and returns to it", () => {
    const app = read("App.tsx");
    expect(app).toContain('data-testid="glossary-button"');
    expect(app).toMatch(/onGlossary=\{\(\) => setEntry\("glossary"\)\}/);
    expect(app).toMatch(/entry === "glossary"\) return <GlossaryScreen onClose=\{\(\) => setEntry\("start"\)\}/);
  });
});
