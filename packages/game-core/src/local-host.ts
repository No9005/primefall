// Local host entry point: runs the server-side simulation inside the browser for the offline
// prototype behind the same interface a network host will use later (ADR 0017).

import type { MatchHost, SquadId, SquadView, SubmitResult } from "./host";
import { buildSquadView, createMatch, startRound } from "./match";
import { type SquadPlan, validatePlan } from "./plan";
import { getSquadEvents, resolveRound } from "./resolution";
import { SERVER_ENTRY } from "./server";

export const LOCAL_HOST_ENTRY = "game-core/local-host" as const;
export const LOCAL_HOST_BACKEND = SERVER_ENTRY;

/** Starts a match at Round 1 with all Hands drawn. The AI-controlled Heroes submit empty plans for now. */
export function createLocalHost(seed: number): MatchHost {
  let match = startRound(createMatch(seed));
  return {
    async getSquadView(squad: SquadId): Promise<SquadView> {
      return buildSquadView(match, squad);
    },
    async submitPlan(plan: SquadPlan): Promise<SubmitResult> {
      const issues = validatePlan(buildSquadView(match, plan.squad), plan);
      if (issues.length > 0) throw new Error(`Invalid plan: ${issues.map((issue) => issue.message).join(" ")}`);
      const resolution = resolveRound(match, [plan]);
      match = startRound(resolution.match);
      return { view: buildSquadView(match, plan.squad), events: getSquadEvents(plan.squad, resolution) };
    },
  };
}
