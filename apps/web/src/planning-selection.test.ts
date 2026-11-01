import { ActionKind, HeroClass, type QueuedAction } from "game-core";
import { describe, expect, it } from "vitest";
import { CardUse, cardUseReasons, coverProtectionLabel, energyReadout, selectHero } from "./planning-selection";

describe("coverProtectionLabel", () => {
  it("names the protection a target tile gives against the attacker", () => {
    expect(coverProtectionLabel({ col: 8, row: 5 }, { col: 5, row: 5 })).toBe("Half Cover · damage -1");
    expect(coverProtectionLabel({ col: 10, row: 4 }, { col: 10, row: 1 })).toBe("Full Cover · cannot be attacked");
  });

  it("shows nothing on open floor or at Range 1", () => {
    expect(coverProtectionLabel({ col: 8, row: 5 }, { col: 7, row: 5 })).toBeUndefined();
    expect(coverProtectionLabel({ col: 6, row: 5 }, { col: 5, row: 5 })).toBeUndefined();
  });
});

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
    const spending: QueuedAction[] = [{ kind: ActionKind.Primary, card: 0, target: "enemy" }];
    expect(energyReadout(HeroClass.Bruiser, spending, [1, 2, 3])).toEqual({ pitched: 3, spent: 1, available: 2 });
  });

  it("explains a Primary effect the Hero cannot afford", () => {
    // Assassin card 7 is Execution Round (cost 2).
    expect(cardUseReasons(HeroClass.Assassin, 7, [], [1])[CardUse.Primary]).toBe("needs 2 Energy");
  });

  it("allows the Primary effect of an affordable simple Attack and explains one that is not playable yet", () => {
    expect(cardUseReasons(HeroClass.Bruiser, 0, [], [1])[CardUse.Primary]).toBeUndefined();
    // Bruiser card 6 is Bulwark (playable Utility); card 8 is Forward Deploy (no interpreter yet).
    expect(cardUseReasons(HeroClass.Bruiser, 6, [], [1])[CardUse.Primary]).toBeUndefined();
    expect(cardUseReasons(HeroClass.Bruiser, 8, [], [1])[CardUse.Primary]).toBe("effect is not playable yet");
  });

  it("allows Pitch, Move and Block while the Queue has room and disables them when it is full", () => {
    const open = cardUseReasons(HeroClass.Bruiser, 0, [], []);
    expect([open[CardUse.Pitch], open[CardUse.Move], open[CardUse.Block]]).toEqual([undefined, undefined, undefined]);
    const full: QueuedAction[] = [1, 2, 3, 4].map((card) => ({ kind: ActionKind.Block, card }));
    const reasons = cardUseReasons(HeroClass.Bruiser, 0, full, []);
    expect([reasons[CardUse.Pitch], reasons[CardUse.Move], reasons[CardUse.Block]]).toEqual([undefined, "Queue is full", "Queue is full"]);
  });
});
