import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playAiMatch } from "./ai-match";
import { planSquad } from "./ai";
import { MatchEndReason, MatchMode, SquadId } from "./host";
import { buildSquadView, createMatch, startRound } from "./match";
import { ActionKind, moveEnd, validatePlan } from "./plan";
import { CoverKind, coverAt, type GridPosition, REACTOR_DECK } from "./reactor-deck";
import { resolveRound } from "./resolution";

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

  it("never lets two Heroes of the Squad enter the same tile in the same Tick", () => {
    // Two Heroes side by side would both pick the same Move 2 and block each other for ever.
    const match = startRound(createMatch(5));
    match.heroes.find((hero) => hero.id === "left-bruiser")!.position = { col: 6, row: 4 };
    match.heroes.find((hero) => hero.id === "left-controller")!.position = { col: 6, row: 5 };
    const plan = planSquad(buildSquadView(match, SquadId.Left));
    const bruiser = plan.heroes.find((hero) => hero.heroId === "left-bruiser")!;
    const controller = plan.heroes.find((hero) => hero.heroId === "left-controller")!;
    const first = (queue: typeof bruiser.queue) => (queue[0]?.kind === ActionKind.Move ? queue[0].destination : undefined);
    expect(first(bruiser.queue)).toBeDefined();
    expect(first(bruiser.queue)).not.toEqual(first(controller.queue));
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

describe("AI scoring of Moves", () => {
  /** The Left Bruiser stands at `start`, the Right Assassin at `enemy`; the other Heroes stay at their Spawn. */
  const arrange = (start: GridPosition, enemy: GridPosition) => {
    const match = startRound(createMatch(5));
    match.heroes.find((hero) => hero.id === "left-bruiser")!.position = start;
    match.heroes.find((hero) => hero.id === "right-assassin")!.position = enemy;
    return buildSquadView(match, SquadId.Left);
  };
  const firstMove = (view: ReturnType<typeof arrange>) => {
    const queue = planSquad(view).heroes.find((hero) => hero.heroId === "left-bruiser")!.queue;
    const move = queue.find((action) => action.kind === ActionKind.Move);
    return move?.kind === ActionKind.Move ? moveEnd(view.heroes.find((hero) => hero.id === "left-bruiser")!.position, move.destination) : undefined;
  };

  it("ends the Move in Cover when an open tile is equally far from the Prime Zone and an enemy is Visible", () => {
    // From (11, 8) the Half Cover at (13, 6) and the open tiles (13, 7) to (13, 9) are all one step from the Zone.
    const end = firstMove(arrange({ col: 11, row: 8 }, { col: 17, row: 7 }));
    expect(end).toEqual({ col: 13, row: 6 });
    expect(coverAt(REACTOR_DECK, end!)).not.toBe(CoverKind.None);
  });

  it("takes the flank tile beside the enemy instead of the straight advance", () => {
    const enemy = { col: 17, row: 8 };
    const end = firstMove(arrange({ col: 11, row: 8 }, enemy))!;
    expect(Math.abs(end.row - enemy.row)).toBeGreaterThanOrEqual(2);
  });

  it("plans a whole Squad in well under 50 ms", () => {
    const views = SEEDS.map((seed) => buildSquadView(startRound(createMatch(seed)), SquadId.Left));
    const start = performance.now();
    for (const view of views) planSquad(view);
    expect((performance.now() - start) / views.length).toBeLessThan(10);
  });
});

describe("AI symmetry", () => {
  const mirror = ({ col, row }: { col: number; row: number }) => ({ col: 30 - col, row });

  // The Reactor Deck is mirror-symmetric around column 15 (ADR 0016), so a Hero and its mirror image must
  // plan the mirrored Moves; otherwise one Squad reaches the Prime Zone first (issue 87).
  it.each([
    [{ col: 5, row: 1 }],
    [{ col: 3, row: 2 }],
    [{ col: 8, row: 13 }],
    [{ col: 10, row: 8 }],
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
      // The Squads take turns at yielding by Round parity, and every match follows the same early timeline, so the parity
      // of the Round of the first contest decides who wins it. Half of the seeds start one Round later to cancel that out.
      const winner = playAiMatch(seed, MAX_ROUNDS, seed % 2 === 0 ? 1 : 2).match.result?.winner;
      if (winner) wins[winner] += 1;
    }
    expect(Math.max(wins[SquadId.Left], wins[SquadId.Right])).toBeLessThanOrEqual(SEEDS.length - 3);
  });
});

describe("AI does not freeze", () => {
  it("keeps moving or acting while the Prime Zone is not held", () => {
    let match = startRound(createMatch(3));
    const snapshots: string[] = [];
    for (let round = 1; round <= 8 && !match.result; round++) {
      const plans = [SquadId.Left, SquadId.Right].map((squad) => planSquad(buildSquadView(match, squad)));
      const resolution = resolveRound(match, plans);
      match = resolution.match.result ? resolution.match : startRound(resolution.match);
      snapshots.push(JSON.stringify(match.heroes.map((hero) => [hero.position, hero.deck.length, hero.exhausted])));
    }
    // Before the fix every Round from the 4th on was identical: the Controllers kept planning a Move onto
    // a tile that an Exhausted Hero occupied.
    expect(new Set(snapshots.slice(3)).size).toBeGreaterThan(1);
  });

  it("never ends a match on the Round limit because Heroes block each other", () => {
    const stuck = SEEDS.filter((seed) => playAiMatch(seed, MAX_ROUNDS).match.result?.reason === MatchEndReason.RoundLimit);
    expect(stuck).toEqual([]);
  });

  it("decides at least half of the matches before the Round limit", () => {
    const decided = SEEDS.filter((seed) => playAiMatch(seed, MAX_ROUNDS).match.result?.reason !== MatchEndReason.RoundLimit);
    expect(decided.length).toBeGreaterThanOrEqual(SEEDS.length / 2);
  });
});

describe("AI in Attack and Defend", () => {
  const mode = (defender: SquadId) => ({ kind: MatchMode.AttackAndDefend as const, defender });
  const zoneTiles = (match: ReturnType<typeof createMatch>) =>
    match.heroes.filter((hero) => hero.squad === SquadId.Left).every((hero) => hero.position.col === 14);

  it("keeps the Defender on the Zone tiles while an Attacker Hero is in range", () => {
    const match = startRound(createMatch(7, mode(SquadId.Left)));
    expect(zoneTiles(match)).toBe(true);
    match.heroes.find((hero) => hero.id === "right-bruiser")!.position = { col: 18, row: 8 };
    const plan = planSquad(buildSquadView(match, SquadId.Left));
    for (const hero of plan.heroes) expect(hero.queue.filter((action) => action.kind === ActionKind.Move)).toEqual([]);
  });

  it("sends an Attacker with three Heroes close to the Zone into it in the same Round", () => {
    const match = startRound(createMatch(7, mode(SquadId.Right)));
    const starts = [{ col: 8, row: 7 }, { col: 8, row: 8 }, { col: 8, row: 9 }];
    match.heroes.filter((hero) => hero.squad === SquadId.Left).forEach((hero, i) => (hero.position = starts[i]!));
    const view = buildSquadView(match, SquadId.Left);
    const plan = planSquad(view);
    expect(plan.heroes).toHaveLength(3);
    for (const hero of plan.heroes) expect(hero.queue.some((action) => action.kind === ActionKind.Move)).toBe(true);
    const { match: after } = resolveRound(match, [plan, { squad: SquadId.Right, heroes: [] }]);
    const inZone = after.heroes.filter((hero) => hero.squad === SquadId.Left && hero.position.col >= 14 && hero.position.col <= 16);
    expect(inZone).toHaveLength(3);
  });

  it("holds an Attacker Hero back at the staging distance while a Squad mate is still far away", () => {
    const match = startRound(createMatch(7, mode(SquadId.Right)));
    const left = match.heroes.filter((hero) => hero.squad === SquadId.Left);
    [{ col: 9, row: 7 }, { col: 9, row: 8 }, { col: 1, row: 9 }].forEach((tile, i) => (left[i]!.position = tile));
    const plan = planSquad(buildSquadView(match, SquadId.Left));
    const near = plan.heroes.find((hero) => hero.heroId === left[0]!.id)!;
    expect(near.queue.some((action) => action.kind === ActionKind.Move)).toBe(false);
  });

  it("plays only legal plans for 200 seeds, either Squad defending", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { issues } = playAiMatch(seed, 60, 1, mode(seed % 2 === 0 ? SquadId.Left : SquadId.Right));
      expect({ seed, issues }).toEqual({ seed, issues: [] });
    }
  }, 60_000);
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
