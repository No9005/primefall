// Local host entry point: runs the server-side simulation inside the browser for the offline
// prototype behind the same interface a network host will use later (ADR 0017).

import { planSquad } from "./ai";
import { type MatchHost, SquadId, type SquadView, type SubmitResult } from "./host";
import { buildSquadView, createMatch, startRound } from "./match";
import { type SquadPlan, validatePlan } from "./plan";
import { getSquadEvents, resolveRound } from "./resolution";
import { SERVER_ENTRY } from "./server";

export const LOCAL_HOST_ENTRY = "game-core/local-host" as const;
export const LOCAL_HOST_BACKEND = SERVER_ENTRY;

/** Starts a match at Round 1 with all Hands drawn. The AI plans the enemy Squad and the allied Heroes the player leaves out of a plan. */
export function createLocalHost(seed: number): MatchHost {
  let match = startRound(createMatch(seed));
  return {
    async getSquadView(squad: SquadId): Promise<SquadView> {
      return buildSquadView(match, squad);
    },
    async submitPlan(plan: SquadPlan): Promise<SubmitResult> {
      if (match.result) throw new Error("The match is over.");
      const issues =validatePlan(buildSquadView(match, plan.squad), plan);
      if (issues.length > 0) throw new Error(`Invalid plan: ${issues.map((issue) => issue.message).join(" ")}`);
      // The AI plans from Squad Views only: every enemy Hero, and the allied Heroes the player did not plan.
      const planned = new Set(plan.heroes.map((hero) => hero.heroId));
      const allyView = buildSquadView(match, plan.squad);
      const allyAi = planSquad(allyView, allyView.heroes.filter((hero) => !planned.has(hero.id)).map((hero) => hero.id));
      const enemySquad = plan.squad === SquadId.Left ? SquadId.Right : SquadId.Left;
      const enemyAi = planSquad(buildSquadView(match, enemySquad));
      const resolution = resolveRound(match, [{ ...plan, heroes: [...plan.heroes, ...allyAi.heroes] }, enemyAi]);
      // A finished match stays at the Round it ended in.
      match = resolution.match.result ? resolution.match : startRound(resolution.match);
      return { view: buildSquadView(match, plan.squad), events: getSquadEvents(plan.squad, resolution) };
    },
  };
}
