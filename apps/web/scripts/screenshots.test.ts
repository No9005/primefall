import { describe, expect, it } from "vitest";
import { SCREENSHOT_NAMES, VIEWPORT } from "./screenshots";

describe("screenshot tool", () => {
  it("uses unique, numbered, stable file names in path order", () => {
    expect(new Set(SCREENSHOT_NAMES).size).toBe(SCREENSHOT_NAMES.length);
    expect([...SCREENSHOT_NAMES]).toEqual([...SCREENSHOT_NAMES].sort());
    SCREENSHOT_NAMES.forEach((name, index) => expect(name).toMatch(new RegExp(`^${String(index + 1).padStart(2, "0")}-[a-z0-9-]+\\.png$`)));
  });

  it("shoots at the landscape phone size", () => {
    expect(VIEWPORT).toEqual({ width: 844, height: 390 });
  });
});
