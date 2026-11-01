import { describe, expect, it } from "vitest";
import { HERO_DECKS, HeroClass } from "./cards";
import { buildSquadView, createMatch, startRound } from "./match";
import { SquadId } from "./host";
import { ActionKind, energyPool, type MoveAction, PlanIssueKind, type QueuedAction, validatePlan } from "./plan";
import type { GridPosition } from "./reactor-deck";

const view = buildSquadView(startRound(createMatch(9)), SquadId.Left);
const bruiser = view.heroes.find((hero) => hero.heroClass === HeroClass.Bruiser)!;
const near = (offset: number): GridPosition => ({ col: bruiser.position.col + offset, row: bruiser.position.row });
const move = (card: number, destination: GridPosition): MoveAction => ({ kind: ActionKind.Move, card, destination });
const planFor = (...queue: MoveAction[]) => ({ squad: SquadId.Left, heroes: [{ heroId: bruiser.id, queue }] });
const kinds = (...queue: MoveAction[]) => validatePlan(view, planFor(...queue)).map((issue) => issue.kind);

describe("validatePlan", () => {
  it("accepts empty and valid plans", () => {
    expect(kinds()).toEqual([]);
    expect(kinds(move(bruiser.hand[0]!, near(2)))).toEqual([]);
  });

  it("accepts a chain of moves, each measured from the end of the previous one", () => {
    expect(kinds(move(bruiser.hand[0]!, near(2)), move(bruiser.hand[1]!, near(4)))).toEqual([]);
  });

  it("rejects a card that is not in the Hand", () => {
    const outside = [...Array(12).keys()].find((index) => !bruiser.hand.includes(index))!;
    expect(kinds(move(outside, near(1)))).toEqual([PlanIssueKind.CardNotInHand]);
  });

  it("rejects a card used twice", () => {
    const card = bruiser.hand[0]!;
    expect(kinds(move(card, near(1)), move(card, near(2)))).toEqual([PlanIssueKind.CardUsedTwice]);
  });

  it("rejects a Queue longer than 4", () => {
    const moves = [1, 2, 3, 4, 5].map((i) => move(bruiser.hand[i % 4]!, near(i)));
    expect(kinds(...moves)).toContain(PlanIssueKind.QueueTooLong);
  });

  it("rejects destinations that are too far, unchanged, outside the Grid or a Wall", () => {
    expect(kinds(move(bruiser.hand[0]!, near(3)))).toEqual([PlanIssueKind.BadDestination]);
    expect(kinds(move(bruiser.hand[0]!, near(0)))).toEqual([PlanIssueKind.BadDestination]);
    expect(kinds(move(bruiser.hand[0]!, { col: -1, row: 4 }))).toEqual([PlanIssueKind.BadDestination]);
    // (0, 4) is a Wall, one tile away from the Bruiser's Spawn tile.
    expect(kinds(move(bruiser.hand[0]!, { col: 0, row: 4 }))).toEqual([PlanIssueKind.BadDestination]);
  });

  it("rejects an unknown Hero and another Squad's plan", () => {
    expect(validatePlan(view, { squad: SquadId.Left, heroes: [{ heroId: "x", queue: [] }] })[0]!.kind).toBe(PlanIssueKind.UnknownHero);
    expect(validatePlan(view, { squad: SquadId.Right, heroes: [] })[0]!.kind).toBe(PlanIssueKind.WrongSquad);
  });

  it("gives every issue a reason to show", () => {
    expect(validatePlan(view, planFor(move(999, near(5))))[0]!.message).not.toBe("");
  });
});

describe("validatePlan: Pitch, Energy and Block", () => {
  const costOf = (card: number) => HERO_DECKS[bruiser.heroClass][card]!.energyCost;
  const planKinds = (pitched: number[], queue: QueuedAction[]) =>
    validatePlan(view, { squad: SquadId.Left, heroes: [{ heroId: bruiser.id, queue, pitched }] }).map((issue) => issue.kind);

  it("gives 1 Energy per pitched card", () => {
    expect(energyPool([])).toBe(0);
    expect(energyPool(bruiser.hand.slice(0, 3))).toBe(3);
  });

  it("rejects a Queue whose Energy costs exceed the pool and accepts one that fits", () => {
    const [primary, ...others] = bruiser.hand;
    const cost = costOf(primary!);
    const action: QueuedAction = { kind: ActionKind.Primary, card: primary! };
    expect(planKinds([], [action])).toEqual([PlanIssueKind.NotEnoughEnergy]);
    expect(planKinds(others.slice(0, cost - 1), [action])).toEqual([PlanIssueKind.NotEnoughEnergy]);
    expect(planKinds(others.slice(0, cost), [action])).toEqual([]);
  });

  it("makes Move 2 and Block 2 free", () => {
    const [a, b] = bruiser.hand;
    expect(planKinds([], [{ kind: ActionKind.Block, card: a! }, move(b!, near(1))])).toEqual([]);
  });

  it("lets a card fulfil only one role per Round", () => {
    const [a] = bruiser.hand;
    expect(planKinds([a!], [{ kind: ActionKind.Block, card: a! }])).toEqual([PlanIssueKind.CardUsedTwice]);
    expect(planKinds([a!, a!], [])).toEqual([PlanIssueKind.CardUsedTwice]);
  });

  it("rejects pitching a card that is not in the Hand", () => {
    const outside = [...Array(12).keys()].find((index) => !bruiser.hand.includes(index))!;
    expect(planKinds([outside], [])).toEqual([PlanIssueKind.CardNotInHand]);
  });
});
