import { it } from "vitest";
import { buildSquadView, createMatch, startRound } from "./match";
import { planSquad } from "./ai";
import { SquadId } from "./host";
import { resolveRound } from "./resolution";

it("debug", () => {
  let m = startRound(createMatch(3));
  for (let r = 0; r < 12; r++) {
    const plans = [SquadId.Left, SquadId.Right].map((s) => planSquad(buildSquadView(m, s)));
    console.log(r, m.heroes.map((h) => `${h.id}@${h.position.col},${h.position.row} d${h.deck.length}`).join(" "), JSON.stringify(plans[0]!.heroes.map((h) => h.queue.map((a) => a.kind))), m.primeZone);
    const res = resolveRound(m, plans);
    m = res.match.result ? res.match : startRound(res.match);
    if (m.result) break;
  }
});
