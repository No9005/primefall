import { describe, expect, it } from "vitest";
import { FIREBALLS, MENU_SLOTS, menuIds, nextRow, percentX, percentY, STAGE, streakTop } from "./title-menu";

describe("title menu", () => {
  it("lists Classic, Attack and Defend and the Glossary, and Resume only when a match was saved", () => {
    expect(menuIds(false)).toEqual(["classic", "attack-and-defend", "glossary"]);
    expect(menuIds(true)).toEqual(["classic", "attack-and-defend", "glossary", "resume"]);
  });

  it("has a row of the layout for every entry, one below the other without overlap", () => {
    expect(MENU_SLOTS.length).toBeGreaterThanOrEqual(menuIds(true).length);
    MENU_SLOTS.forEach((slot, i) => {
      const above = MENU_SLOTS[i - 1];
      if (above) expect(slot.top).toBeGreaterThanOrEqual(above.top + above.height);
    });
    const last = MENU_SLOTS[3];
    // The legal line at the foot of the picture starts at about 425.
    expect(last.top + last.height).toBeLessThanOrEqual(425);
    expect(last.top + last.height).toBeLessThanOrEqual(STAGE.height);
    for (const slot of MENU_SLOTS) expect(slot.art).toBeLessThanOrEqual(slot.height);
  });

  it("moves the highlight on row by row and from the last row back to the first", () => {
    expect(nextRow(0, 3)).toBe(1);
    expect(nextRow(2, 3)).toBe(0);
    expect(nextRow(3, 4)).toBe(0);
  });

  it("puts the light streak on the middle of the highlighted row", () => {
    expect(streakTop(MENU_SLOTS[0])).toBe(214 + 26 - 3);
    expect(streakTop(MENU_SLOTS[1])).toBe(266 + 25 - 3);
  });

  it("gives every fireball its own period, so that the fall never repeats in step", () => {
    expect(new Set(FIREBALLS.map((f) => f.period)).size).toBe(FIREBALLS.length);
  });

  it("turns design pixels into percentages of the stage", () => {
    expect(percentX(480)).toBe("50%");
    expect(percentY(222)).toBe("50%");
  });
});
