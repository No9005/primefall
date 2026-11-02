// Plays a whole match with the AI on both sides, for the smoke test and for balance analysis (`npm run sim`).

import { planSquad } from "./ai";
import { SquadId } from "./host";
import { createMatch, buildSquadView, type MatchState, startRound } from "./match";
import { type PlanIssue, type SquadPlan, validatePlan } from "./plan";
import { resolveRound } from "./resolution";

export interface AiMatchOutcome {
  match: MatchState;
  /** Every issue `validatePlan` found in an AI plan; empty when all plans were legal. */
  issues: PlanIssue[];
  plans: SquadPlan[];
}

/** Plays up to `maxRounds` Rounds; the match ends earlier when a victory condition is met. */
export function playAiMatch(seed: number, maxRounds: number): AiMatchOutcome {
  let match = startRound(createMatch(seed));
  const issues: PlanIssue[] = [];
  const plans: SquadPlan[] = [];
  for (let round = 1; round <= maxRounds && !match.result; round++) {
    const roundPlans = [SquadId.Left, SquadId.Right].map((squad) => {
      const view = buildSquadView(match, squad);
      const plan = planSquad(view);
      issues.push(...validatePlan(view, plan));
      return plan;
    });
    plans.push(...roundPlans);
    const resolution = resolveRound(match, roundPlans);
    match = resolution.match.result ? resolution.match : startRound(resolution.match);
  }
  return { match, issues, plans };
}
