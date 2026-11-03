import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { exhaustionHud } from "./exhaustion-hud";
import { PilePanel } from "./PlanningScreen";

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

describe("PilePanel skull", () => {
  it("renders the skull outside the greyed Deck pile, so it stays red and fully visible", () => {
    const html = renderToStaticMarkup(createElement(PilePanel, { deck: 0, discard: 3, exile: 1, opacity: 1, skull: true, greyed: true }));
    const greyedPile = html.match(/<div class="deck-pile exhausted-hud"[^>]*>.*?<\/div>/s)?.[0] ?? "";
    expect(greyedPile).not.toBe("");
    expect(greyedPile).not.toContain("deck-skull");
    expect(html).toContain('data-testid="deck-skull"');
    expect(html.slice(0, html.indexOf("deck-skull"))).not.toContain("piles exhausted-hud");
  });
});
