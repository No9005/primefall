import { describe, expect, it } from "vitest";
import { baseFacing, type Facing, type FacingHero, facingAfterStep, turnHeroes } from "./facing";

describe("facing", () => {
  it("starts own Heroes right and enemy Heroes left", () => {
    expect(baseFacing(false)).toBe("right");
    expect(baseFacing(true)).toBe("left");
  });

  it("faces the screen direction of a step, whatever the base facing", () => {
    // At the start view a step along the columns goes right on the screen, a step down the rows goes left.
    expect(facingAfterStep({ col: 1, row: 1 }, { col: 2, row: 1 }, "left")).toBe("right");
    expect(facingAfterStep({ col: 2, row: 1 }, { col: 1, row: 1 }, "right")).toBe("left");
    expect(facingAfterStep({ col: 1, row: 1 }, { col: 1, row: 2 }, "right")).toBe("left");
    expect(facingAfterStep({ col: 1, row: 2 }, { col: 1, row: 1 }, "left")).toBe("right");
  });

  it("keeps the facing when the step is straight up or down the screen", () => {
    const from = { col: 3, row: 3 };
    const to = { col: 4, row: 4 };
    expect(facingAfterStep(from, to, "left")).toBe("left");
    expect(facingAfterStep(from, to, "right")).toBe("right");
    expect(facingAfterStep(from, from, "left")).toBe("left");
  });
});

describe("turnHeroes", () => {
  const NO_WALKS = {};
  const board: Record<string, FacingHero> = {
    own: { position: { col: 5, row: 3 }, enemy: false },
    enemy: { position: { col: 5, row: 3 }, enemy: true },
    onRight: { position: { col: 8, row: 3 }, enemy: true },
    onLeft: { position: { col: 2, row: 3 }, enemy: true },
    sameX: { position: { col: 7, row: 5 }, enemy: true },
  };
  const heroOf = (id: string) => board[id];
  const aim = (attacker: string, target: string, facings = new Map<string, Facing>()) => {
    turnHeroes(facings, { walks: NO_WALKS, aims: { [attacker]: target } }, heroOf);
    return facings.get(attacker);
  };

  it("turns an own attacker towards a target on its left and on its right", () => {
    expect(aim("own", "onLeft")).toBe("left");
    expect(aim("own", "onRight")).toBe("right");
  });

  it("turns an enemy attacker towards a target on its right and on its left", () => {
    expect(aim("enemy", "onRight")).toBe("right");
    expect(aim("enemy", "onLeft")).toBe("left");
  });

  it("keeps the facing when the target is on the same screen x", () => {
    expect(aim("own", "sameX", new Map([["own", "left"]]))).toBe("left");
    expect(aim("enemy", "sameX", new Map([["enemy", "right"]]))).toBe("right");
    // With no facing remembered yet, the base facing stays.
    expect(aim("own", "sameX")).toBe("right");
    expect(aim("enemy", "sameX")).toBe("left");
  });

  it("keeps the facing of an attack until the next Step", () => {
    const facings = new Map<string, Facing>();
    aim("own", "onLeft", facings);
    turnHeroes(facings, { walks: {}, aims: {} }, heroOf);
    expect(facings.get("own")).toBe("left");
    turnHeroes(facings, { walks: { own: { col: 4, row: 3 } }, aims: {} }, heroOf);
    expect(facings.get("own")).toBe("right");
  });

  it("does not turn the target", () => {
    const facings = new Map<string, Facing>();
    aim("own", "onLeft", facings);
    expect(facings.has("onLeft")).toBe(false);
  });
});
