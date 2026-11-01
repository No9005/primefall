import { describe, expect, it } from "vitest";
import { HeroClass } from "./cards";
import { buildSquadView, createMatch, startRound } from "./match";
import { SquadId } from "./host";
import { ActionKind, type MoveAction, PlanIssueKind, validatePlan } from "./plan";
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
