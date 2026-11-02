import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playAiMatch } from "./ai-match";
import { planSquad } from "./ai";
import { SquadId } from "./host";
import { buildSquadView, createMatch, startRound } from "./match";
import { ActionKind, validatePlan } from "./plan";

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const MAX_ROUNDS = 60;

describe("AI planning", () => {
  it("is deterministic for the same Squad View", () => {
    const view = buildSquadView(startRound(createMatch(5)), SquadId.Left);
    expect(planSquad(view)).toEqual(planSquad(view));
  });

  it("plans a move toward the Prime Zone from the Spawn", () => {
    const view = buildSquadView(startRound(createMatch(5)), SquadId.Left);
    const plan = planSquad(view);
    expect(plan.heroes.length).toBe(3);
    for (const hero of plan.heroes) {
      expect(hero.queue[0]?.kind).toBe(ActionKind.Move);
    }
  });

  it("plans only the requested Heroes", () => {
    const view = buildSquadView(startRound(createMatch(5)), SquadId.Right);
    const plan = planSquad(view, [view.heroes[1]!.id]);
    expect(plan.heroes.map((hero) => hero.heroId)).toEqual([view.heroes[1]!.id]);
  });

  it("never imports the Match State: it plans from a Squad View only", () => {
    const source = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "\.\/(match|resolution|server)"/);
    expect(planSquad.length).toBeLessThanOrEqual(2);
  });
});

describe("AI-versus-AI smoke test", () => {
  const outcomes = SEEDS.map((seed) => ({ seed, ...playAiMatch(seed, MAX_ROUNDS) }));

  it("plays only legal plans", () => {
    for (const { seed, issues } of outcomes) expect({ seed, issues }).toEqual({ seed, issues: [] });
  });

  it("ends every match within the Round limit", () => {
    for (const { seed, match } of outcomes) {
      expect({ seed, ended: match.result !== undefined }).toEqual({ seed, ended: true });
    }
  });

  it("produces plans that stay valid when re-checked against the view", () => {
    const { plans } = outcomes[0]!;
    expect(plans.length).toBeGreaterThan(0);
    const view = buildSquadView(startRound(createMatch(1)), SquadId.Left);
    expect(validatePlan(view, planSquad(view))).toEqual([]);
  });
});
