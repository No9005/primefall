import { describe, expect, it } from "vitest";

import { CardUseStage, hudFocus } from "./hud-focus";

describe("hudFocus", () => {
  it("idle: the Energy pill is slightly dimmed, everything else is fully visible", () => {
    expect(hudFocus({ energy: 2, stage: CardUseStage.Idle })).toEqual({ energyPill: 0.85, deck: 1, commit: 1, otherCards: 1 });
  });

  it("idle with no Energy: the pill fades to 0.3", () => {
    expect(hudFocus({ energy: 0, stage: CardUseStage.Idle }).energyPill).toBe(0.3);
  });

  it.each([CardUseStage.Selected, CardUseStage.UseChosen])("%s: the pill is fully visible, Deck and Commit fade, the other cards dim", (stage) => {
    for (const energy of [0, 3]) {
      expect(hudFocus({ energy, stage })).toEqual({ energyPill: 1, deck: 0.3, commit: 0.3, otherCards: 0.55 });
    }
  });
});
