// Local host entry point: runs the server-side simulation inside the browser for the offline
// prototype behind the same interface a network host will use later (ADR 0017).

import type { MatchHost, SquadId, SquadPlan, SquadView, SubmitResult } from "./host";
import { buildSquadView, createMatch, startRound } from "./match";
import { SERVER_ENTRY } from "./server";

export const LOCAL_HOST_ENTRY = "game-core/local-host" as const;
export const LOCAL_HOST_BACKEND = SERVER_ENTRY;

/** Starts a match at Round 1 with all Hands drawn. The AI-controlled Heroes are placeholders for now. */
export function createLocalHost(seed: number): MatchHost {
  const match = startRound(createMatch(seed));
  return {
    async getSquadView(squad: SquadId): Promise<SquadView> {
      return buildSquadView(match, squad);
    },
    async submitPlan(plan: SquadPlan): Promise<SubmitResult> {
      // Resolution is not implemented yet: nothing changes and nothing happens.
      return { view: buildSquadView(match, plan.squad), events: [] };
    },
  };
}
