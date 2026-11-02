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

describe("AI symmetry", () => {
  const mirror = ({ col, row }: { col: number; row: number }) => ({ col: 20 - col, row });

  // The Reactor Deck is mirror-symmetric around column 10 (ADR 0016), so a Hero and its mirror image must
  // plan the mirrored Moves; otherwise one Squad reaches the Prime Zone first (issue 87).
  it.each([
    [{ col: 5, row: 1 }],
    [{ col: 3, row: 2 }],
    [{ col: 6, row: 9 }],
    [{ col: 8, row: 5 }],
  ])("plans mirrored Moves for the Bruiser at %j and its mirror image", (start) => {
    const match = startRound(createMatch(5));
    match.heroes.find((hero) => hero.id === "left-bruiser")!.position = start;
    match.heroes.find((hero) => hero.id === "right-bruiser")!.position = mirror(start);
    const left = planSquad(buildSquadView(match, SquadId.Left)).heroes.find((hero) => hero.heroId === "left-bruiser")!;
    const right = planSquad(buildSquadView(match, SquadId.Right)).heroes.find((hero) => hero.heroId === "right-bruiser")!;
    const destinations = (queue: typeof left.queue) => queue.flatMap((action) => (action.kind === ActionKind.Move ? [action.destination] : []));
    expect(destinations(right.queue)).toEqual(destinations(left.queue).map(mirror));
  });

  it("does not let one side win nearly every match", () => {
    const wins = { [SquadId.Left]: 0, [SquadId.Right]: 0 };
    for (const seed of SEEDS) {
      const winner = playAiMatch(seed, MAX_ROUNDS).match.result?.winner;
      if (winner) wins[winner] += 1;
    }
    expect(Math.min(wins[SquadId.Left], wins[SquadId.Right])).toBeGreaterThanOrEqual(3);
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
