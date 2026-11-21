import { describe, expect, it } from "vitest";
import { FIREBALLS, MENU_SLOTS, menuIds, percentX, percentY, STAGE, streakTop } from "./title-menu";

describe("title menu", () => {
  it("lists Start (the classic mode) and the Glossary, and Resume only when a match was saved; Attack and Defend is out for now", () => {
    expect(menuIds(false)).toEqual(["classic", "glossary"]);
    expect(menuIds(true)).toEqual(["classic", "glossary", "resume"]);
    expect(menuIds(false, true)).toEqual(["classic", "attack-and-defend", "glossary"]);
    expect(menuIds(true, true)).toEqual(["classic", "attack-and-defend", "glossary", "resume"]);
  });

  it("has a row of the layout for every entry; the pictures stand one below the other, the areas that are pressed overlap a little", () => {
    expect(MENU_SLOTS.length).toBeGreaterThanOrEqual(menuIds(true, true).length);
    MENU_SLOTS.forEach((slot, i) => {
      const above = MENU_SLOTS[i - 1];
      const middle = (row: (typeof MENU_SLOTS)[number]) => row.top + row.height / 2;
      if (above) {
        expect(middle(slot) - slot.art / 2).toBeGreaterThan(middle(above) + above.art / 2);
        // The overlap of two areas stays smaller than a fifth of the smaller one: each row keeps most of its area.
        expect(above.top + above.height - slot.top).toBeLessThan(Math.min(slot.height, above.height) / 5);
      }
      expect(slot.height).toBeGreaterThanOrEqual(50);
      expect(slot.art).toBeLessThanOrEqual(slot.height);
    });
    // The rows of the menu as the player sees it (Start, Glossary, Resume) end above the foot of the picture. The fourth row exists
    // only with `?menu=all` (Attack and Defend back in the menu) and a saved match: its centre is still inside the picture, its lower edge is not.
    const resume = MENU_SLOTS[2];
    expect(resume.top + resume.height).toBeLessThanOrEqual(425);
    expect(MENU_SLOTS[3].top + MENU_SLOTS[3].height / 2).toBeLessThanOrEqual(STAGE.height);
  });

  it("puts the light streak on the middle of the highlighted row", () => {
    expect(streakTop(MENU_SLOTS[0])).toBe(277 + 26 - 3);
    expect(streakTop(MENU_SLOTS[1])).toBe(327 + 25 - 3);
  });

  it("gives every fireball its own period, so that the fall never repeats in step", () => {
    expect(new Set(FIREBALLS.map((f) => f.period)).size).toBe(FIREBALLS.length);
  });

  it("turns design pixels into percentages of the stage", () => {
    expect(percentX(480)).toBe("50%");
    expect(percentY(222)).toBe("50%");
  });
});
