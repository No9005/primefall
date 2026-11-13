import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { aiStyleFor, planSquad, planSquadGreedy, SIMULATIONS_PER_ROUND } from "./ai";
import { MatchMode, SquadId, Visibility } from "./host";
import { buildSquadView, createMatch, matchFromSquadView, startRound } from "./match";
import { ActionKind, validatePlan } from "./plan";
import { resolveRound } from "./resolution";

const resolutions = vi.hoisted(() => ({ count: 0 }));
vi.mock("./resolution", async (importOriginal) => {
  const original = await importOriginal<typeof import("./resolution")>();
  return {
    ...original,
    resolveRound: (...args: Parameters<typeof original.resolveRound>) => {
      resolutions.count += 1;
      return original.resolveRound(...args);
    },
  };
});

const SIDES = [SquadId.Left, SquadId.Right];
const planKey = (seed: number) => {
  const match = startRound(createMatch(seed));
  return JSON.stringify(planSquad(buildSquadView(match, SquadId.Left), undefined, aiStyleFor(seed, SquadId.Left), seed));
};

describe("the Squad View as a Match State", () => {
  it("keeps what the Squad knows and leaves out an Unknown enemy", () => {
    const match = startRound(createMatch(7));
    const view = buildSquadView(match, SquadId.Left);
    const sim = matchFromSquadView(view, 7);
    for (const own of view.heroes) {
      const hero = sim.heroes.find((candidate) => candidate.id === own.id)!;
      expect(hero.hand).toEqual(own.hand);
      expect(hero.position).toEqual(own.position);
    }
    for (const enemy of view.enemies.filter((candidate) => candidate.visibility === Visibility.Unknown)) {
      expect(sim.heroes.find((candidate) => candidate.id === enemy.id)!.exhausted).toBe(true);
    }
    expect(matchFromSquadView(view, 7)).toEqual(sim);
  });

  it("guesses an enemy Hand as large as the counts leave, and none of the real Hand is read", () => {
    const match = startRound(createMatch(7));
    const near = match.heroes.find((hero) => hero.id === "left-bruiser")!.position;
    match.heroes.find((hero) => hero.id === "right-bruiser")!.position = { col: near.col + 2, row: near.row };
    const view = buildSquadView(match, SquadId.Left);
    const enemy = view.enemies.find((candidate) => candidate.id === "right-bruiser")!;
    expect(enemy.visibility).toBe(Visibility.Visible);
    const guessed = matchFromSquadView(view, 7).heroes.find((hero) => hero.id === "right-bruiser")!;
    expect(guessed.hand).toHaveLength(4);
    expect(guessed.deck).toHaveLength(match.heroes.find((hero) => hero.id === "right-bruiser")!.deck.length);
  });
});

describe("AI lookahead", () => {
  it("never imports the Reactor Deck", () => {
    const source = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/REACTOR_DECK/);
  });

  it("plans the same for the same seed and differently between seeds when plans are close", () => {
    expect(planKey(3)).toBe(planKey(3));
    // Round 1 with no enemy in sight: every candidate is about as good, so the seed decides.
    const plans = new Set(Array.from({ length: 40 }, (_, i) => planKey(i + 1)));
    expect(plans.size).toBeGreaterThanOrEqual(5);
  });

  it("returns a legal plan, and keeps the signature the allies of the player use", () => {
    const view = buildSquadView(startRound(createMatch(9)), SquadId.Right);
    const ids = [view.heroes[0]!.id, view.heroes[2]!.id];
    const plan = planSquad(view, ids);
    expect(plan.heroes.map((hero) => hero.heroId).sort()).toEqual([...ids].sort());
    expect(validatePlan(view, plan)).toEqual([]);
  });

  it("runs at most the budget of simulations to plan a Round", () => {
    for (const seed of [1, 2, 3]) {
      let match = startRound(createMatch(seed));
      for (let round = 1; round <= 6 && !match.result; round++) {
        const plans = SIDES.map((squad) => {
          resolutions.count = 0;
          const plan = planSquad(buildSquadView(match, squad), undefined, aiStyleFor(seed, squad), seed);
          expect(resolutions.count).toBeLessThanOrEqual(SIMULATIONS_PER_ROUND);
          return plan;
        });
        const resolved = resolveRound(match, plans).match;
        match = resolved.result ? resolved : startRound(resolved);
      }
    }
  });

  it("avoids the move that walks a Hero into the enemy's fire, where the greedy plan takes it", () => {
    // Hand-made position: the Left Heroes face the Right Heroes across the map, six tiles apart in a column.
    // Round 3: the enemies the Left Squad does not see could be anywhere they reached since the Spawn.
    const seed = 2;
    const match = startRound(createMatch(seed));
    match.round = 3;
    const place = (squad: SquadId, col: number) =>
      match.heroes.filter((hero) => hero.squad === squad).forEach((hero, i) => (hero.position = { col, row: 16 + i }));
    place(SquadId.Left, 21);
    place(SquadId.Right, 25);
    const leftView = buildSquadView(match, SquadId.Left);
    const greedy = planSquadGreedy(leftView, undefined, aiStyleFor(seed, SquadId.Left));
    const looked = planSquad(leftView, undefined, aiStyleFor(seed, SquadId.Left), seed);
    const enemy = planSquadGreedy(buildSquadView(match, SquadId.Right), undefined, aiStyleFor(seed, SquadId.Right));

    // The Right Assassin shoots the Left Controller. The greedy plan ends the Controller in its line; the lookahead goes elsewhere.
    const lastMove = (plan: typeof greedy) => {
      const moves = plan.heroes.find((hero) => hero.heroId === "left-controller")!.queue.filter((action) => action.kind === ActionKind.Move);
      return (moves[moves.length - 1] as { destination: { col: number; row: number } }).destination;
    };
    expect(lastMove(looked)).not.toEqual(lastMove(greedy));

    const exiled = (plan: typeof greedy) =>
      resolveRound(match, [plan, enemy]).match.heroes.find((hero) => hero.id === "left-controller")!.exile.length;
    expect(exiled(greedy)).toBe(2);
    expect(exiled(looked)).toBe(0);
  });

  it("works in Attack and Defend", () => {
    const match = startRound(createMatch(4, { kind: MatchMode.AttackAndDefend, defender: SquadId.Left }));
    for (const squad of SIDES) {
      const view = buildSquadView(match, squad);
      expect(validatePlan(view, planSquad(view, undefined, aiStyleFor(4, squad), 4))).toEqual([]);
    }
  });
});
