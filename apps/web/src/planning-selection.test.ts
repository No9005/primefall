import { ActionKind, cardInMode, HERO_DECKS, HeroClass, PlanIssueKind, type QueuedAction, SquadId, validatePlan } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { describe, expect, it } from "vitest";
import { actionUsesCard, addWaitAction, cardFace, CardUse, cardUseReasons, modeChoiceFaces, primaryAction, queueRowLabel,removeQueueAction, coverProtectionLabel, describeEffects, energyReadout, rangeDamageLabel, selectHero, pickInstruction, unpitchCard } from "./planning-selection";

describe("rangeDamageLabel", () => {
  const longShotOverdrive = cardInMode(HERO_DECKS[HeroClass.Assassin][4]!, true);
  const from = { col: 2, row: 1 };

  it("shows the long range bonus from Range 6 and the usual damage closer", () => {
    expect(rangeDamageLabel(longShotOverdrive, from, { col: 7, row: 1 })).toBe("Range 5 · 2 damage");
    expect(rangeDamageLabel(longShotOverdrive, from, { col: 8, row: 1 })).toBe("Range 6 · 4 damage (long range bonus)");
  });

  it("shows nothing for a card whose damage does not depend on Range", () => {
    expect(rangeDamageLabel(HERO_DECKS[HeroClass.Assassin][0]!, from, { col: 8, row: 1 })).toBeUndefined();
  });
});

describe("pickInstruction", () => {
  const card = HERO_DECKS[HeroClass.Assassin][0]!;
  const base = { card, aimsAtTile: false, aimsAtAlly: false, aimsAtDeployTile: false, needsSecondAlly: false, allyPicked: false };

  it("tells the player to pick an enemy by default and an ally for ally cards", () => {
    expect(pickInstruction(base)).toBe("Tap an enemy");
    expect(pickInstruction({ ...base, aimsAtAlly: true })).toBe("Tap an ally");
  });

  it("says to move closer when no enemy is inside the Range", () => {
    expect(pickInstruction({ ...base, noEnemyInRange: true })).toBe("No enemy in range: move closer first");
  });

  it("asks for the first and then the second ally when a card needs two", () => {
    expect(pickInstruction({ ...base, needsSecondAlly: true })).toBe("Tap the first ally");
    expect(pickInstruction({ ...base, needsSecondAlly: true, allyPicked: true })).toBe("Tap the second ally");
  });

  it("asks for a lit tile for tile cards and the Deploy tile", () => {
    expect(pickInstruction({ ...base, aimsAtTile: true })).toBe("Tap a lit tile");
    expect(pickInstruction({ ...base, aimsAtDeployTile: true })).toBe("Tap a lit tile");
  });
});

describe("describeEffects", () => {
  it("describes the standard effects and the Overdrive of Long Shot", () => {
    const longShot = HERO_DECKS[HeroClass.Assassin][4]!;
    expect(describeEffects(longShot.effects)).toBeTruthy();
    expect(describeEffects(longShot.overdrive)).toBe("2 damage, 4 from Range 6");
  });

  it("returns nothing for a card without Overdrive", () => {
    expect(describeEffects(undefined)).toBeUndefined();
  });
});

describe("coverProtectionLabel", () => {
  it("names the protection a target tile gives against the attacker", () => {
    expect(coverProtectionLabel({ col: 17, row: 5 }, { col: 14, row: 5 })).toBe("Half Cover · damage -1");
    expect(coverProtectionLabel({ col: 15, row: 4 }, { col: 15, row: 1 })).toBe("Full Cover · cannot be attacked");
  });

  it("shows nothing on open floor or at Range 1", () => {
    expect(coverProtectionLabel({ col: 17, row: 5 }, { col: 15, row: 5 })).toBeUndefined();
    expect(coverProtectionLabel({ col: 15, row: 5 }, { col: 14, row: 5 })).toBeUndefined();
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

  it("allows the Primary effect of an affordable Attack or Utility card", () => {
    expect(cardUseReasons(HeroClass.Bruiser, 0, [], [1])[CardUse.Primary]).toBeUndefined();
    // Bruiser card 6 is Bulwark; Controller card 7 is Fortify and card 8 is Deploy Cover.
    expect(cardUseReasons(HeroClass.Bruiser, 6, [], [1])[CardUse.Primary]).toBeUndefined();
    expect(cardUseReasons(HeroClass.Controller, 7, [], [1])[CardUse.Primary]).toBeUndefined();
    expect(cardUseReasons(HeroClass.Controller, 8, [], [1])[CardUse.Primary]).toBeUndefined();
  });

  it("allows an Overdrive that exists and explains one that is missing", () => {
    // Assassin card 4 is Long Shot, card 0 is Precision Shot (no Overdrive); Controller card 4 is Scout Drone
    // and card 6 is Aegis Protocol.
    expect(cardUseReasons(HeroClass.Assassin, 4, [], [1], true)[CardUse.Primary]).toBeUndefined();
    expect(cardUseReasons(HeroClass.Assassin, 0, [], [1], true)[CardUse.Primary]).toBe("Overdrive is not playable yet");
    expect(cardUseReasons(HeroClass.Controller, 4, [], [1], true)[CardUse.Primary]).toBeUndefined();
    expect(cardUseReasons(HeroClass.Controller, 6, [], [1], true)[CardUse.Primary]).toBeUndefined();
  });

  it("allows Pitch, Move and Block while the Queue has room and disables them when it is full", () => {
    const open = cardUseReasons(HeroClass.Bruiser, 0, [], []);
    expect([open[CardUse.Pitch], open[CardUse.Move], open[CardUse.Block]]).toEqual([undefined, undefined, undefined]);
    const full: QueuedAction[] = [1, 2, 3, 4].map((card) => ({ kind: ActionKind.Block, card }));
    const reasons = cardUseReasons(HeroClass.Bruiser, 0, full, []);
    expect([reasons[CardUse.Pitch], reasons[CardUse.Move], reasons[CardUse.Block]]).toEqual([undefined, "Queue is full", "Queue is full"]);
  });
});

describe("cardFace", () => {
  it("takes the effect text from the card data for every MVP card", () => {
    for (const heroClass of Object.values(HeroClass)) {
      for (const card of HERO_DECKS[heroClass]) {
        const { type, effectText } = cardFace(card);
        expect(effectText).toContain(describeEffects(card.effects));
        if (card.overdrive) expect(effectText).toContain(describeEffects(card.overdrive));
        expect(["ATTACK", "UTILITY"]).toContain(type);
      }
    }
  });
});

describe("modeChoiceFaces", () => {
  it("offers the choice for every MVP card with an Overdrive mode and for no other", () => {
    for (const heroClass of Object.values(HeroClass)) {
      HERO_DECKS[heroClass].forEach((card, index) => {
        const faces = modeChoiceFaces(heroClass, index, [], [1, 2, 3]);
        if (!card.overdrive) {
          expect(faces).toBeUndefined();
          return;
        }
        expect(faces?.map((face) => face.overdrive)).toEqual([false, true]);
        expect(faces?.[0]?.effectText).toBe(describeEffects(card.effects));
        expect(faces?.[1]?.effectText).toBe(describeEffects(card.overdrive));
        expect(faces?.map((face) => face.energyCost)).toEqual([card.energyCost, card.energyCost]);
        expect(faces?.map((face) => face.exiled)).toEqual([false, true]);
      });
    }
  });

  it("builds the plain Queue entry for Normal and the one with `overdrive` for Overdrive", () => {
    const [normal, overdrive] = modeChoiceFaces(HeroClass.Assassin, 4, [], [1, 2])!;
    expect(primaryAction(4, "enemy", { overdrive: normal.overdrive })).toEqual({ kind: ActionKind.Primary, card: 4, target: "enemy" });
    expect(primaryAction(4, "enemy", { overdrive: overdrive.overdrive })).toEqual({ kind: ActionKind.Primary, card: 4, target: "enemy", overdrive: true });
  });

  it("dims a face with its reason when it cannot be afforded or the target does not fit", () => {
    const unaffordable = modeChoiceFaces(HeroClass.Assassin, 4, [], [])!;
    expect(unaffordable.map((face) => face.reason)).toEqual(["needs 1 Energy", "needs 1 Energy"]);
    const wrongTarget = modeChoiceFaces(HeroClass.Assassin, 4, [], [1], (overdrive) => !overdrive)!;
    expect(wrongTarget.map((face) => face.reason)).toEqual([undefined, "needs another target"]);
  });
});

describe("Queue window", () => {
  const queue: QueuedAction[] = [
    { kind: ActionKind.Block, card: 1 },
    { kind: ActionKind.Move, card: 2, destination: { col: 3, row: 3 } },
  ];

  it("shows the action name and its target per row", () => {
    const nameOf = (id: string) => (id === "right-bruiser" ? "Enemy Bruiser" : id);
    const label = (action: QueuedAction) => queueRowLabel(HeroClass.Bruiser, "left-bruiser", action, nameOf);
    expect(label(queue[0]!)).toEqual({ name: "Block 2", target: "" });
    expect(label(queue[1]!)).toEqual({ name: "Move 2", target: "to 3 · 3" });
    expect(label({ kind: ActionKind.Wait })).toEqual({ name: "Wait", target: "" });
    // Bruiser card 0 is Slam Shot.
    expect(label({ kind: ActionKind.Primary, card: 0, target: "right-bruiser" })).toEqual({ name: "Slam Shot", target: "Enemy Bruiser" });
    expect(label({ kind: ActionKind.Primary, card: 0, target: "left-bruiser" }).target).toBe("");
  });

  it("gives the Energy of a removed action back", () => {
    // Bruiser card 0 is Slam Shot (cost 1).
    const withAttack: QueuedAction[] = [...queue, { kind: ActionKind.Primary, card: 0, target: "enemy" }];
    const pitched = [5, 6];
    expect(energyReadout(HeroClass.Bruiser, withAttack, pitched).available).toBe(energyReadout(HeroClass.Bruiser, queue, pitched).available - 1);
    const afterRemoval = removeQueueAction(withAttack, 2);
    expect(afterRemoval).toEqual(queue);
    expect(energyReadout(HeroClass.Bruiser, afterRemoval, pitched)).toEqual(energyReadout(HeroClass.Bruiser, queue, pitched));
    expect(removeQueueAction(queue, 0)).toEqual([queue[1]]);
  });

  it("adds a Wait to the first free slot, spends no card or Energy, and can remove it again", () => {
    const withWait = addWaitAction(queue);
    expect(withWait).toEqual([...queue, { kind: ActionKind.Wait }]);
    expect(actionUsesCard(withWait[2]!, 0)).toBe(false);
    expect(energyReadout(HeroClass.Bruiser, withWait, [5])).toEqual(energyReadout(HeroClass.Bruiser, queue, [5]));
    expect(removeQueueAction(withWait, 2)).toEqual(queue);
  });

  it("adds no Wait to a full Queue", () => {
    const full = addWaitAction(addWaitAction(queue));
    expect(full).toHaveLength(4);
    expect(addWaitAction(full)).toBe(full);
  });
});

describe("unpitchCard", () => {
  const assassin = HeroClass.Assassin;
  // Execution Round (Assassin card 7) costs 2 Energy.
  const executionRound: QueuedAction = { kind: ActionKind.Primary, card: 7, target: "right-bruiser" };
  const queue = [executionRound];

  it("removes only that card, keeps the order of the others and leaves the Queue alone", () => {
    expect(unpitchCard([3, 1, 2], 1)).toEqual([3, 2]);
    expect(queue).toEqual([executionRound]);
  });

  it("takes exactly one Energy out of the pool", () => {
    const before = energyReadout(assassin, queue, [0, 1, 2]);
    const after = energyReadout(assassin, queue, unpitchCard([0, 1, 2], 1));
    expect(after.pitched).toBe(before.pitched - 1);
    expect(after.available).toBe(before.available - 1);
  });

  it("is a no-op for a card that is not pitched", () => {
    expect(unpitchCard([0, 1], 5)).toEqual([0, 1]);
  });

  it("makes a cost-1 Primary need Energy again, and pitching another card makes it usable", () => {
    expect(HERO_DECKS[assassin][0]!.energyCost).toBe(1);
    const primary = (pitched: readonly number[]) => cardUseReasons(assassin, 0, [], pitched)[CardUse.Primary];
    expect(primary([4])).toBeUndefined();
    const freed = unpitchCard([4], 4);
    expect(primary(freed)).toBe("needs 1 Energy");
    const uses = cardUseReasons(assassin, 4, [], freed);
    expect(uses[CardUse.Pitch]).toBeUndefined();
    expect(uses[CardUse.Move]).toBeUndefined();
    expect(uses[CardUse.Block]).toBeUndefined();
    expect(primary([...freed, 5])).toBeUndefined();
  });

  it("flags the first unaffordable action instead of deleting it, and pitching again clears the issue", async () => {
    const view = await createLocalHost(9).getSquadView(SquadId.Left);
    const hero = view.heroes.find((candidate) => candidate.heroClass === assassin)!;
    const withHand = { ...view, heroes: view.heroes.map((candidate) => (candidate === hero ? { ...candidate, hand: [7, 0, 1, 2] } : candidate)) };
    const energyIssues = (pitched: readonly number[]) =>
      validatePlan(withHand, { squad: SquadId.Left, heroes: [{ heroId: hero.id, queue, pitched: [...pitched] }] }).filter(
        (issue) => issue.kind === PlanIssueKind.NotEnoughEnergy,
      );
    expect(energyIssues([0, 1])).toEqual([]);
    const freed = unpitchCard([0, 1], 1);
    expect(energyIssues(freed).map((issue) => issue.slot)).toEqual([0]);
    expect(queue).toEqual([executionRound]);
    expect(energyIssues([...freed, 1])).toEqual([]);
  });
});
