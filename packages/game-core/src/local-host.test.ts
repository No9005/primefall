import { describe, expect, it } from "vitest";
import { HAND_SIZE } from "./cards";
import { ROUND_LIMIT, SquadId } from "./host";
import { createLocalHost } from "./local-host";

describe("local host", () => {
  it("answers asynchronously with the Squad's own Heroes, Hands and counts", async () => {
    const pending = createLocalHost(42).getSquadView(SquadId.Left);
    expect(pending).toBeInstanceOf(Promise);
    const view = await pending;
    expect(view.round).toBe(1);
    expect(view.roundLimit).toBe(ROUND_LIMIT);
    expect(view.heroes).toHaveLength(3);
    for (const hero of view.heroes) {
      expect(hero.hand).toHaveLength(HAND_SIZE);
      expect(hero.deckCount).toBe(12 - HAND_SIZE);
      expect(hero.exileCount).toBe(0);
      expect(hero.position.col).toBeLessThan(10);
    }
  });

  it("contains no enemy Hands, Deck order, seed or PRNG state", async () => {
    const view = await createLocalHost(123456).getSquadView(SquadId.Left);
    const json = JSON.stringify(view);
    expect(json).not.toContain("right-");
    expect(Object.keys(view).sort()).toEqual(["heroes", "round", "roundLimit", "squad"]);
    expect(Object.keys(view.heroes[0]!).sort()).toEqual(["deckCount", "exileCount", "hand", "heroClass", "id", "position"]);
    expect(json).not.toMatch(/seed|rng/i);
  });

  it("returns the current view when a plan is submitted", async () => {
    const host = createLocalHost(7);
    const result = await host.submitPlan({ squad: SquadId.Left });
    expect(result.view).toEqual(await host.getSquadView(SquadId.Left));
    expect(result.events).toEqual([]);
  });
});
