// Balance analysis: `npm run sim` plays many AI-versus-AI matches and prints win rates and match lengths.
// Set SIM_SEEDS to change the number of seeds (default 1000). Not part of `npm test`.

import { it } from "vitest";
import { playAiMatch } from "./ai-match";
import { MatchEndReason, ROUND_LIMIT, SquadId } from "./host";

it("prints win rates and match lengths", () => {
  const seeds = Number(process.env.SIM_SEEDS ?? 1000);
  const wins = { [SquadId.Left]: 0, [SquadId.Right]: 0, draw: 0 };
  const reasons: Record<string, number> = {};
  let totalRounds = 0;
  let longest = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const { match, issues } = playAiMatch(seed, ROUND_LIMIT * 2);
    if (issues.length > 0) throw new Error(`Seed ${seed} produced an illegal AI plan: ${issues[0]!.message}`);
    const result = match.result;
    wins[result?.winner ?? "draw"] += 1;
    const reason = result?.reason ?? MatchEndReason.RoundLimit;
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    totalRounds += match.round;
    longest = Math.max(longest, match.round);
  }
  const percent = (count: number) => `${((count / seeds) * 100).toFixed(1)}%`;
  console.log(`Matches: ${seeds}`);
  console.log(`Left wins ${percent(wins[SquadId.Left])}, Right wins ${percent(wins[SquadId.Right])}, draws ${percent(wins.draw)}`);
  console.log(`Match length: average ${(totalRounds / seeds).toFixed(1)} Rounds, longest ${longest}`);
  console.log(`End reasons: ${Object.entries(reasons).map(([reason, count]) => `${reason} ${percent(count)}`).join(", ")}`);
});
