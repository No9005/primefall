import { ActionKind, cardIndex, HERO_DECKS, HeroClass, PlanIssueKind, type QueuedAction, SquadId, validatePlan } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { describe, expect, it } from "vitest";
import { actionUsesCard, addWaitAction, CardUse, cardUseReasons, queueRowLabel,removeQueueAction, describeEffects, energyReadout, selectHero, pickInstruction, unpitchCard } from "./planning-selection";

const LONG_SHOT = cardIndex(HeroClass.Assassin, "Long Shot");

describe("pickInstruction", () => {
  const card = HERO_DECKS[HeroClass.Assassin][0]!;
  const base = { card, aimsAtTile: false };

  it("tells the player to pick an enemy by default", () => {
    expect(pickInstruction(base)).toBe("Tap an enemy");
  });

  it("says to move closer when no enemy is inside the Range", () => {
    expect(pickInstruction({ ...base, noEnemyInRange: true })).toBe("No enemy in sight");
  });

  it("asks for a lit tile for tile cards", () => {
    expect(pickInstruction({ ...base, aimsAtTile: true })).toBe("Tap a lit tile");
  });
});

describe("describeEffects", () => {
  it("describes the standard effects of Long Shot", () => {
    const longShot = HERO_DECKS[HeroClass.Assassin][LONG_SHOT]!;
    expect(describeEffects(longShot.effects)).toBeTruthy();
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
  // Bruiser card 0 is Handle With Care (cost 1).
  it("shows pitched, spent and available Energy", () => {
    const spending: QueuedAction[] = [{ kind: ActionKind.Primary, card: 0, target: "enemy" }];
    expect(energyReadout(HeroClass.Bruiser, spending, [1, 2, 3])).toEqual({ pitched: 3, spent: 1, available: 2 });
  });

  it("explains a Primary effect the Hero cannot afford", () => {
    // Every card costs 1 Energy.
    expect(cardUseReasons(HeroClass.Assassin, 6, [], [])[CardUse.Primary]).toBe("needs 1 Energy");
  });

  it("allows the Primary effect of an affordable Attack or Utility card", () => {
    expect(cardUseReasons(HeroClass.Bruiser, 0, [], [1])[CardUse.Primary]).toBeUndefined();
    // Bruiser card 5 is Hard Hat; Controller card 5 is Urban Renewal and card 6 is Temporary Solution.
    expect(cardUseReasons(HeroClass.Bruiser, 5, [], [1])[CardUse.Primary]).toBeUndefined();
    expect(cardUseReasons(HeroClass.Controller, 5, [], [1])[CardUse.Primary]).toBeUndefined();
    expect(cardUseReasons(HeroClass.Controller, 6, [], [1])[CardUse.Primary]).toBeUndefined();
  });

  it("allows Pitch and Move while the Queue has room and disables them when it is full", () => {
    const open = cardUseReasons(HeroClass.Bruiser, 0, [], []);
    expect([open[CardUse.Pitch], open[CardUse.Move]]).toEqual([undefined, undefined]);
    const full: QueuedAction[] = [1, 2, 3, 4].map((card) => ({ kind: ActionKind.Move, card, destination: { col: 3, row: 3 } }));
    const reasons = cardUseReasons(HeroClass.Bruiser, 0, full, []);
    expect([reasons[CardUse.Pitch], reasons[CardUse.Move]]).toEqual([undefined, "Queue is full"]);
  });
});

describe("Queue window", () => {
  const queue: QueuedAction[] = [
    { kind: ActionKind.Wait },
    { kind: ActionKind.Move, card: 2, destination: { col: 3, row: 3 } },
  ];

  it("shows the action name and its target per row", () => {
    const nameOf = (id: string) => (id === "right-bruiser" ? "Enemy Bruiser" : id);
    const label = (action: QueuedAction) => queueRowLabel(HeroClass.Bruiser, "left-bruiser", action, nameOf);
    expect(label(queue[0]!)).toEqual({ name: "Wait", target: "" });
    expect(label(queue[1]!)).toEqual({ name: "Move 3", target: "to 3 · 3" });
    expect(label({ kind: ActionKind.Wait })).toEqual({ name: "Wait", target: "" });
    // Bruiser card 0 is Handle With Care.
    expect(label({ kind: ActionKind.Primary, card: 0, target: "right-bruiser" })).toEqual({ name: "Handle With Care", target: "Enemy Bruiser" });
    expect(label({ kind: ActionKind.Primary, card: 0, target: "left-bruiser" }).target).toBe("");
  });

  it("gives the Energy of a removed action back", () => {
    // Bruiser card 0 is Handle With Care (cost 1).
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
  const executionRound: QueuedAction = { kind: ActionKind.Primary, card: 6, target: "right-bruiser" };
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
    const uses = cardUseReasons(assassin, LONG_SHOT, [], freed);
    expect(uses[CardUse.Pitch]).toBeUndefined();
    expect(uses[CardUse.Move]).toBeUndefined();
    expect(primary([...freed, 5])).toBeUndefined();
  });

  it("flags the first unaffordable action instead of deleting it, and pitching again clears the issue", async () => {
    const view = await createLocalHost(9).getSquadView(SquadId.Left);
    const hero = view.heroes.find((candidate) => candidate.heroClass === assassin)!;
    const withHand = { ...view, heroes: view.heroes.map((candidate) => (candidate === hero ? { ...candidate, hand: [6, 0, 1, 2] } : candidate)) };
    const energyIssues = (pitched: readonly number[]) =>
      validatePlan(withHand, { squad: SquadId.Left, heroes: [{ heroId: hero.id, queue, pitched: [...pitched] }] }).filter(
        (issue) => issue.kind === PlanIssueKind.NotEnoughEnergy,
      );
    expect(energyIssues([0])).toEqual([]);
    const freed = unpitchCard([0], 0);
    expect(energyIssues(freed).map((issue) => issue.slot)).toEqual([0]);
    expect(queue).toEqual([executionRound]);
    expect(energyIssues([...freed, 0])).toEqual([]);
  });
});
