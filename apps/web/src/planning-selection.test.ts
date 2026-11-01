import { ActionKind, HeroClass, type QueuedAction } from "game-core";
import { describe, expect, it } from "vitest";
import { CardUse, cardUseReasons, energyReadout, selectHero } from "./planning-selection";

const queue: readonly QueuedAction[] = [{ kind: ActionKind.Move, card: 0, destination: { col: 1, row: 1 } }];

describe("selectHero", () => {
  it("discards the Queue, the pitched cards and the armed card when another Hero is selected", () => {
    expect(selectHero({ selectedId: "a", queue, pitched: [1], armed: 2 }, "b", false)).toEqual({
      selectedId: "b",
      queue: [],
      pitched: [],
      armed: undefined,
    });
  });

  it("keeps the draft when the same Hero is selected again", () => {
    const draft = { selectedId: "a", queue, pitched: [1], armed: undefined };
    expect(selectHero(draft, "a", false)).toBe(draft);
  });

  it("ignores selection during the playback", () => {
    const draft = { selectedId: "a", queue, pitched: [], armed: undefined };
    expect(selectHero(draft, "b", true)).toBe(draft);
  });
});

describe("energyReadout and cardUseReasons", () => {
  // Bruiser card 4 is Breach Charge (cost 2), card 0 is Slam Shot (cost 1).
  it("shows pitched, spent and available Energy", () => {
    const spending: QueuedAction[] = [{ kind: ActionKind.Primary, card: 0 }];
    expect(energyReadout(HeroClass.Bruiser, spending, [1, 2, 3])).toEqual({ pitched: 3, spent: 1, available: 2 });
  });

  it("explains a Primary effect the Hero cannot afford", () => {
    expect(cardUseReasons(HeroClass.Bruiser, 4, [], [1])[CardUse.Primary]).toBe("needs 2 Energy");
  });

  it("allows Pitch, Move and Block while the Queue has room and disables them when it is full", () => {
    const open = cardUseReasons(HeroClass.Bruiser, 0, [], []);
    expect([open[CardUse.Pitch], open[CardUse.Move], open[CardUse.Block]]).toEqual([undefined, undefined, undefined]);
    const full: QueuedAction[] = [1, 2, 3, 4].map((card) => ({ kind: ActionKind.Block, card }));
    const reasons = cardUseReasons(HeroClass.Bruiser, 0, full, []);
    expect([reasons[CardUse.Pitch], reasons[CardUse.Move], reasons[CardUse.Block]]).toEqual([undefined, "Queue is full", "Queue is full"]);
  });
});
