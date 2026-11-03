import { describe, expect, it } from "vitest";

import { exhaustionHud } from "./exhaustion-hud";

describe("exhaustionHud", () => {
  it("a Hero that is not Exhausted shows no skull and nothing is greyed", () => {
    expect(exhaustionHud({ exhausted: false, exhaustedInPlayback: false, animationsQueued: false })).toEqual({ skull: false, greyed: false });
  });

  it("an Exhausted Hero (also from a loaded saved match) shows the skull and greys the HUD at once", () => {
    expect(exhaustionHud({ exhausted: true, exhaustedInPlayback: false, animationsQueued: false })).toEqual({ skull: true, greyed: true });
  });

  it("Exhaustion during the playback waits for the Deck Damage animation to end", () => {
    expect(exhaustionHud({ exhausted: false, exhaustedInPlayback: true, animationsQueued: true })).toEqual({ skull: false, greyed: false });
    expect(exhaustionHud({ exhausted: false, exhaustedInPlayback: true, animationsQueued: false })).toEqual({ skull: true, greyed: true });
  });
});
