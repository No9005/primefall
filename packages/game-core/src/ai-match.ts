// Plays a whole match with the AI on both sides, for the smoke test and for balance analysis (`npm run sim`).

import { planSquad } from "./ai";
import { type MatchModeSetting, SquadId } from "./host";
import { createMatch, buildSquadView, type MatchState, startRound } from "./match";
import { type PlanIssue, type SquadPlan, validatePlan } from "./plan";
import { resolveRound } from "./resolution";

export interface AiMatchOutcome {
  match: MatchState;
  /** Every issue `validatePlan` found in an AI plan; empty when all plans were legal. */
  issues: PlanIssue[];
  plans: SquadPlan[];
}

/**
 * Plays up to `maxRounds` Rounds; the match ends earlier when a victory condition is met. `firstRound` is the number
 * of the first Round: the AI Squads take turns at yielding by the parity of the Round number (see `planHero`), so
 * balance checks play half of their matches with an odd and half with an even first Round.
 */
export function playAiMatch(seed: number, maxRounds: number, firstRound = 1, mode?: MatchModeSetting): AiMatchOutcome {
  const created = createMatch(seed, mode);
  created.round = firstRound - 1;
  let match = startRound(created);
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
