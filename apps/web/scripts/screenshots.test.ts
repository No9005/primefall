import { describe, expect, it } from "vitest";
import { findChromium, SCREENSHOT_NAMES, VIEWPORT } from "./screenshots";

describe("screenshot tool", () => {
  it("uses unique, numbered, stable file names in path order", () => {
    expect(new Set(SCREENSHOT_NAMES).size).toBe(SCREENSHOT_NAMES.length);
    expect([...SCREENSHOT_NAMES]).toEqual([...SCREENSHOT_NAMES].sort());
    SCREENSHOT_NAMES.forEach((name, index) => expect(name).toMatch(new RegExp(`^${String(index + 1).padStart(2, "0")}-[a-z0-9-]+\\.png$`)));
  });

  it("shoots at the landscape phone size", () => {
    expect(VIEWPORT).toEqual({ width: 844, height: 390 });
  });

  describe("finding a Chromium", () => {
    const only = (...present: string[]) => (file: string) => present.includes(file);

    it("uses CHROMIUM_PATH when Playwright's own build is missing", () => {
      expect(findChromium({ CHROMIUM_PATH: "/x/chrome" }, only("/x/chrome"))).toBe("/x/chrome");
    });

    it("uses the chromium link of the sandbox browsers folder, whatever its version", () => {
      expect(findChromium({ PLAYWRIGHT_BROWSERS_PATH: "/opt/pw" }, only("/opt/pw/chromium"))).toBe("/opt/pw/chromium");
    });

    it("prefers CHROMIUM_PATH over the browsers folder and gives up when nothing exists", () => {
      const env = { CHROMIUM_PATH: "/x/chrome", PLAYWRIGHT_BROWSERS_PATH: "/opt/pw" };
      expect(findChromium(env, only("/x/chrome", "/opt/pw/chromium"))).toBe("/x/chrome");
      expect(findChromium(env, only())).toBeUndefined();
    });
  });
});
