import { SquadId } from "game-core";
import { aiStyleFor, planSquad } from "game-core/ai";
import { createLocalHost } from "game-core/local-host";
import { describe, expect, it } from "vitest";
import { aiPlanner, answerPlanRequest } from "./ai-planner";

describe("AI planner", () => {
  it("the Worker's answer is the plan planSquad gives for the same Squad View and seed", async () => {
    for (const seed of [1, 7, 42, 1234]) {
      const host = createLocalHost(seed);
      const view = await host.getSquadView(SquadId.Right);
      const style = aiStyleFor(seed, SquadId.Right);
      const response = answerPlanRequest({ id: 3, view, heroIds: undefined, style, seed });
      expect(response.id).toBe(3);
      expect(response.plan).toEqual(planSquad(view, undefined, style, seed));
    }
  });

  it("without Workers the app planner plans on the main thread with the same result", async () => {
    const host = createLocalHost(5);
    const view = await host.getSquadView(SquadId.Left);
    const style = aiStyleFor(5, SquadId.Left);
    expect(await aiPlanner(view, undefined, style, 5)).toEqual(planSquad(view, undefined, style, 5));
  });

  it("a local host that plans through the app planner gives the same Resolution as the default", async () => {
    const direct = createLocalHost(9);
    const viaPlanner = createLocalHost(9, undefined, aiPlanner);
    const plan = { squad: SquadId.Left, heroes: [] };
    const a = await direct.submitPlan(plan);
    const b = await viaPlanner.submitPlan(plan);
    expect(b).toEqual(a);
  });
});
