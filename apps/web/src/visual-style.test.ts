import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  currentVisualStyle,
  DEFAULT_VISUAL_STYLE,
  loadVisualStyle,
  renderedStyle,
  saveVisualStyle,
  VISUAL_STYLE_STORAGE_KEY,
  VisualStyle,
} from "./visual-style";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const broken = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("full");
  },
};

describe("visual style setting", () => {
  it("defaults to Pixel art", () => {
    expect(DEFAULT_VISUAL_STYLE).toBe(VisualStyle.Pixel);
    expect(loadVisualStyle(fakeStorage())).toBe(VisualStyle.Pixel);
  });

  it("keeps a saved choice across a reload", () => {
    const storage = fakeStorage();
    saveVisualStyle(VisualStyle.Original, storage);
    expect(loadVisualStyle(storage)).toBe(VisualStyle.Original);
  });

  it("falls back to the default for an unknown value, missing storage and broken storage", () => {
    expect(loadVisualStyle(fakeStorage({ [VISUAL_STYLE_STORAGE_KEY]: "neon" }))).toBe(VisualStyle.Pixel);
    expect(loadVisualStyle(undefined)).toBe(VisualStyle.Pixel);
    expect(loadVisualStyle(broken)).toBe(VisualStyle.Pixel);
    expect(() => saveVisualStyle(VisualStyle.Original, broken)).not.toThrow();
  });

  it("lets ?style= override the saved value, and ignores an unknown parameter", () => {
    const storage = fakeStorage({ [VISUAL_STYLE_STORAGE_KEY]: VisualStyle.Pixel });
    expect(currentVisualStyle("?style=original", storage)).toBe(VisualStyle.Original);
    const original = fakeStorage({ [VISUAL_STYLE_STORAGE_KEY]: VisualStyle.Original });
    expect(currentVisualStyle("?style=pixel", original)).toBe(VisualStyle.Pixel);
    expect(currentVisualStyle("?style=other", original)).toBe(VisualStyle.Original);
    expect(currentVisualStyle("", original)).toBe(VisualStyle.Original);
  });

  it("draws the Original look in both settings until the Pixel-art renderers exist", () => {
    expect(renderedStyle(VisualStyle.Pixel)).toBe(VisualStyle.Original);
    expect(renderedStyle(VisualStyle.Original)).toBe(VisualStyle.Original);
  });
});

describe("Options screen", () => {
  const read = (file: string) => readFileSync(path.join(import.meta.dirname, file), "utf8");

  it("is static: no match host and no saved match", () => {
    expect(read("OptionsScreen.tsx")).not.toMatch(/match-storage|local-host|createLocalHost/);
  });

  it("is opened from the start screen and closes back to it", () => {
    const app = read("App.tsx");
    expect(app).toContain('data-testid="options-button"');
    expect(app).toMatch(/entry === "options"\) return <OptionsScreen onClose=\{\(\) => setEntry\("start"\)\}/);
  });
});
