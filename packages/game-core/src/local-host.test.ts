import { describe, expect, it } from "vitest";
import { HAND_SIZE } from "./cards";
import { ROUND_LIMIT, SquadId } from "./host";
import { ActionKind } from "./plan";
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

  it("resolves an empty plan into the next Round with nothing happening", async () => {
    const host = createLocalHost(7);
    const before = await host.getSquadView(SquadId.Left);
    const result = await host.submitPlan({ squad: SquadId.Left, heroes: [] });
    expect(result.view).toEqual(await host.getSquadView(SquadId.Left));
    expect(result.view.round).toBe(before.round + 1);
    expect(result.view.heroes.map((hero) => hero.position)).toEqual(before.heroes.map((hero) => hero.position));
    expect(result.events).toEqual([]);
  });

  it("moves the Hero, discards the card and draws a new one the next Round", async () => {
    const host = createLocalHost(7);
    const before = (await host.getSquadView(SquadId.Left)).heroes[0]!;
    const plan = {
      squad: SquadId.Left,
      heroes: [{ heroId: before.id, queue: [{ kind: ActionKind.Move as const, card: before.hand[0]!, destination: { col: 3, row: before.position.row } }] }],
    };
    const result = await host.submitPlan(plan);
    expect(result.events.map((event) => event.tick)).toEqual([1, 1]);
    const after = result.view.heroes[0]!;
    expect(after.position).toEqual({ col: 3, row: before.position.row });
    expect(after.hand).toHaveLength(HAND_SIZE);
    expect(after.hand).not.toContain(before.hand[0]);
  });

  it("rejects an invalid plan", async () => {
    const host = createLocalHost(7);
    const hero = (await host.getSquadView(SquadId.Left)).heroes[0]!;
    const move = { kind: ActionKind.Move as const, card: hero.hand[0]!, destination: { col: 20, row: 5 } };
    await expect(host.submitPlan({ squad: SquadId.Left, heroes: [{ heroId: hero.id, queue: [move] }] })).rejects.toThrow("Invalid plan");
  });
});
