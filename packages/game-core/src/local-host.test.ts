import { describe, expect, it } from "vitest";
import { HAND_SIZE } from "./cards";
import { ROUND_LIMIT, SquadId } from "./host";
import { ActionKind, type SquadPlan } from "./plan";
import { createLocalHost, restoreLocalHost, SNAPSHOT_VERSION } from "./local-host";

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
      expect(hero.discardCount).toBe(0);
      expect(hero.position.col).toBeLessThan(15);
    }
  });

  it("contains no enemy Hands, Deck order, seed or PRNG state", async () => {
    const view = await createLocalHost(123456).getSquadView(SquadId.Left);
    const json = JSON.stringify(view);
    expect(Object.keys(view).sort()).toEqual(["destroyedCover", "enemies", "heroes", "placedCover", "primeProgress", "revealedAreas", "round", "roundLimit", "squad", "visibleTiles", "wreckCover"]);
    expect(Object.keys(view.heroes[0]!).sort()).toEqual(["deckCount", "discardCount", "exhausted", "exileCount", "hand", "heroClass", "hidden", "id", "marked", "position", "slowed"]);
    expect(view.enemies).toHaveLength(3);
    // At the Spawn areas no enemy is in sight yet, so nothing but identity is delivered.
    expect(view.enemies.map((enemy) => Object.keys(enemy).sort())).toEqual(
      Array(3).fill(["heroClass", "id", "visibility"]),
    );
    expect(json).not.toMatch(/seed|rng/i);
  });

  it("lets the AI move the allied Heroes the player did not plan", async () => {
    const host = createLocalHost(7);
    const before = await host.getSquadView(SquadId.Left);
    const result = await host.submitPlan({ squad: SquadId.Left, heroes: [] });
    expect(result.view).toEqual(await host.getSquadView(SquadId.Left));
    expect(result.view.round).toBe(before.round + 1);
    expect(result.view.heroes.map((hero) => hero.position)).not.toEqual(before.heroes.map((hero) => hero.position));
    expect(result.events.length).toBeGreaterThan(0);
  });

  it("leaves the allied Heroes the player planned to the player", async () => {
    const host = createLocalHost(7);
    const before = await host.getSquadView(SquadId.Left);
    const plan = { squad: SquadId.Left, heroes: before.heroes.map((hero) => ({ heroId: hero.id, queue: [] })) };
    const result = await host.submitPlan(plan);
    expect(result.view.heroes.map((hero) => hero.position)).toEqual(before.heroes.map((hero) => hero.position));
  });

  it("moves the Hero, discards the card and draws a new one the next Round", async () => {
    const host = createLocalHost(7);
    const before = (await host.getSquadView(SquadId.Left)).heroes[0]!;
    const plan = {
      squad: SquadId.Left,
      heroes: [{ heroId: before.id, queue: [{ kind: ActionKind.Move as const, card: before.hand[0]!, destination: { col: 1, row: before.position.row - 2 } }] }],
    };
    const result = await host.submitPlan(plan);
    const own = result.events.filter((event) => event.heroId === before.id);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((event) => event.tick === 1)).toBe(true);
    const after = result.view.heroes[0]!;
    expect(after.position).toEqual({ col: 1, row: before.position.row - 2 });
    expect(after.hand).toHaveLength(HAND_SIZE);
    expect(after.hand).not.toContain(before.hand[0]);
  });

  it("replays a recorded seed and plans to the same final state", async () => {
    async function play(seed: number, recorded?: SquadPlan[]) {
      const host = createLocalHost(seed);
      const plans: SquadPlan[] = [];
      const events = [];
      let view = await host.getSquadView(SquadId.Left);
      while (!view.result) {
        const recordedPlan = recorded?.[plans.length];
        let result;
        if (recordedPlan) {
          result = await host.submitPlan(recordedPlan);
          plans.push(recordedPlan);
        } else {
          // Scripted player: the first Hero steps one column along the Row each Round with its
          // first card. If the host rejects the step, the Queue stays empty (as after a timeout).
          const hero = view.heroes[0]!;
          const step = { col: hero.position.col + (hero.position.col < 5 ? 1 : -1), row: hero.position.row };
          const moving: SquadPlan = {
            squad: SquadId.Left,
            heroes: [{ heroId: hero.id, queue: [{ kind: ActionKind.Move as const, card: hero.hand[0]!, destination: step }] }],
          };
          const idle: SquadPlan = { squad: SquadId.Left, heroes: [{ heroId: hero.id, queue: [] }] };
          let plan = moving;
          try {
            result = await host.submitPlan(moving);
          } catch {
            plan = idle;
            result = await host.submitPlan(idle);
          }
          plans.push(plan);
        }
        events.push(result.events);
        view = result.view;
      }
      return { plans, events, view };
    }
    const first = await play(2024);
    expect(first.plans.some((plan) => plan.heroes.some((hero) => hero.queue.length > 0))).toBe(true);
    const replay = await play(2024, first.plans);
    expect(replay.view).toEqual(first.view);
    expect(replay.events).toEqual(first.events);
    expect(first.view.result).toBeDefined();
  });

  it("resumes a saved match with the same Round, Decks, Hands and positions", async () => {
    const host = createLocalHost(11);
    await host.submitPlan({ squad: SquadId.Left, heroes: [] });
    const resumed = restoreLocalHost(host.snapshot())!;
    expect(resumed.seed).toBe(11);
    expect(await resumed.getSquadView(SquadId.Left)).toEqual(await host.getSquadView(SquadId.Left));
    // Both continue identically.
    const plan = { squad: SquadId.Left, heroes: [] };
    expect(await resumed.submitPlan(plan)).toEqual(await host.submitPlan(plan));
  });

  it("ignores a snapshot with another schema version or garbage", () => {
    const saved = JSON.parse(createLocalHost(1).snapshot());
    expect(restoreLocalHost(JSON.stringify({ ...saved, version: SNAPSHOT_VERSION + 1 }))).toBeUndefined();
    expect(restoreLocalHost("not json")).toBeUndefined();
    expect(restoreLocalHost("null")).toBeUndefined();
    expect(restoreLocalHost(JSON.stringify({ version: SNAPSHOT_VERSION, match: {} }))).toBeUndefined();
  });

  it("rejects an invalid plan", async () => {
    const host = createLocalHost(7);
    const hero = (await host.getSquadView(SquadId.Left)).heroes[0]!;
    const move = { kind: ActionKind.Move as const, card: hero.hand[0]!, destination: { col: 20, row: 5 } };
    await expect(host.submitPlan({ squad: SquadId.Left, heroes: [{ heroId: hero.id, queue: [move] }] })).rejects.toThrow("Invalid plan");
  });
});
