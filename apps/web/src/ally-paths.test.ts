import { ActionKind, HeroClass, type HeroView, type QueuedAction, SquadId, type SquadPlan } from "game-core";
import { describe, expect, it } from "vitest";
import { collisionWarnings, finalTile, PathOwner, plannedPaths } from "./ally-paths";

const hero = (id: string, heroClass: HeroClass, col: number, row: number): HeroView => ({
  id,
  heroClass,
  position: { col, row },
  deckCount: 8,
  discardCount: 0,
  exileCount: 0,
  hand: [],
  exhausted: false,
  slowed: false,
  hidden: false,
  marked: false,
});
const move = (col: number, row: number): QueuedAction => ({ kind: ActionKind.Move, card: 0, destination: { col, row } });
const block: QueuedAction = { kind: ActionKind.Block, card: 1 };

const heroes = [hero("b", HeroClass.Bruiser, 2, 2), hero("c", HeroClass.Controller, 4, 2)];

describe("plannedPaths", () => {
  const plan: SquadPlan = {
    squad: SquadId.Left,
    heroes: [
      { heroId: "b", queue: [move(3, 2)] },
      { heroId: "c", queue: [block, move(4, 3)] },
      // An enemy Hero is not a Hero of the Squad: its entry is never drawn.
      { heroId: "enemy", queue: [move(9, 9)] },
    ],
  };

  it("draws the player in teal and the allies in yellow, numbered by Tick of the action", () => {
    const paths = plannedPaths(heroes, [plan], "b");
    expect(paths).toEqual([
      { heroId: "b", owner: PathOwner.Player, heroClass: HeroClass.Bruiser, from: { col: 2, row: 2 }, stops: [{ tile: { col: 3, row: 2 }, tick: 1 }] },
      { heroId: "c", owner: PathOwner.Ally, heroClass: HeroClass.Controller, from: { col: 4, row: 2 }, stops: [{ tile: { col: 4, row: 3 }, tick: 2 }] },
    ]);
  });

  it("is computed only from own Squad Heroes", () => {
    expect(plannedPaths(heroes, [plan], "b").map(({ heroId }) => heroId)).not.toContain("enemy");
    expect(plannedPaths([], [plan], "b")).toEqual([]);
  });
});

describe("collisionWarnings", () => {
  it("finds the final tile: the destination of the last queued Move", () => {
    const longer: SquadPlan = { squad: SquadId.Left, heroes: [{ heroId: "b", queue: [move(3, 2), block, move(5, 5)] }] };
    expect(finalTile(plannedPaths(heroes, [longer], "b")[0]!)).toEqual({ col: 5, row: 5 });
  });

  it("names the Hero in the way and the Tick", () => {
    const plan: SquadPlan = { squad: SquadId.Left, heroes: [{ heroId: "b", queue: [move(4, 2)] }] };
    const { collisions, textFor } = collisionWarnings(heroes, [plan], { b: "Bruiser", c: "Controller" });
    expect(collisions).toHaveLength(1);
    expect(textFor("b", 1)).toBe("Collides with Controller at Tick 1");
    expect(textFor("b", 2)).toBeUndefined();
  });
});
