import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playAiMatch } from "./ai-match";
// These tests check how the greedy scoring behaves (scoring, symmetry, roles); the lookahead on top is tested in ai-lookahead.test.ts.
import { AI_WEIGHTS, AiStyle, aiStyleFor, assignRoles, GHOST_MEMORY_ROUNDS, planSquadGreedy as planSquad, SquadRole, weightsFor } from "./ai";
import { MatchMode, ROUND_LIMIT, SquadId, Visibility } from "./host";
import { buildSquadView, createMatch, startRound } from "./match";
import { ActionKind, moveEnd, validatePlan } from "./plan";
import { CoverKind, coverAt, type GridPosition, parseGrid, REACTOR_DECK } from "./reactor-deck";
import { resolveRound } from "./resolution";

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
// Playing a whole match with the lookahead AI takes seconds (every planned Round plays the candidates through the Resolution),
// so the tests that play matches use fewer seeds than the tests of the greedy scoring. A long synchronous run starves the
// Vitest worker and CI fails with "Timeout calling onTaskUpdate".
const MATCH_SEEDS = SEEDS.slice(0, 8);
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

  it("plans from a Squad View only: no server entry point", () => {
    const source = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "\.\/server"/);
    expect(planSquad.length).toBeLessThanOrEqual(2);
  });

  it("names no map: ai.ts does not use the Reactor Deck", () => {
    const source = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/REACTOR_DECK|PRIME_ZONE_TILES|isPrimeZoneTile/);
    expect(source).not.toMatch(/from "\.\/reactor-deck"[\s\S]*REACTOR_DECK/);
  });
});

describe("AI objective and navigation from the Squad View", () => {
  /** A Squad View on a small custom map; the Left Squad's Heroes stand at `positions` (by class order), no enemy is known. */
  const customView = (rows: readonly string[], zones: readonly { tiles: GridPosition[]; value: number }[], positions: GridPosition[]) => {
    const base = buildSquadView(startRound(createMatch(5)), SquadId.Left);
    return {
      ...base,
      grid: parseGrid(rows),
      zones: zones.map((zone) => ({ ...base.zones![0]!, ...zone, active: true })),
      heroes: base.heroes.map((hero, i) => ({ ...hero, position: positions[i]! })),
      enemies: base.enemies.map((enemy) => ({ id: enemy.id, heroClass: enemy.heroClass, visibility: Visibility.Unknown as const })),
    };
  };
  const endOf = (view: ReturnType<typeof customView>, heroId: string): GridPosition => {
    const queue = planSquad(view).heroes.find((hero) => hero.heroId === heroId)!.queue;
    return queue.reduce(
      (position, action) => (action.kind === ActionKind.Move ? moveEnd(position, action.destination, view.grid) : position),
      view.heroes.find((hero) => hero.id === heroId)!.position,
    );
  };
  const away = [{ col: 0, row: 0 }, { col: 0, row: 6 }];

  it("walks toward a zone in a different place and around a Wall in the way", () => {
    // The Wall at column 5 leaves a gap in row 0 only; the zone is in the top right corner.
    const rows = ["...........", ".....#.....", ".....#.....", ".....#.....", ".....#.....", ".....#.....", ".....#....."];
    const zone = [{ tiles: [{ col: 9, row: 0 }, { col: 10, row: 0 }], value: 2 }];
    const view = customView(rows, zone, [{ col: 4, row: 3 }, ...away]);
    const plan = planSquad(view);
    expect(validatePlan(view, plan)).toEqual([]);
    const end = endOf(view, view.heroes[0]!.id);
    // Straight toward the zone is blocked by the Wall; the Hero climbs to the gap in row 0 (and may be through it already).
    expect(end.row).toBeLessThanOrEqual(1);
    expect(end.col).toBeGreaterThanOrEqual(4);
  });

  it("goes for the zone with the higher value over a nearer zone with a lower value", () => {
    const open = Array.from({ length: 7 }, () => "...........");
    const west = { col: 2, row: 3 };
    const east = { col: 10, row: 3 };
    const start = [{ col: 5, row: 3 }, ...away];
    const highEast = customView(open, [{ tiles: [west], value: 1 }, { tiles: [east], value: 2 }], start);
    expect(endOf(highEast, highEast.heroes[0]!.id).col).toBeGreaterThan(5);
    const highWest = customView(open, [{ tiles: [west], value: 2 }, { tiles: [east], value: 1 }], start);
    expect(endOf(highWest, highWest.heroes[0]!.id).col).toBeLessThan(5);
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

  /** The same view, but the Right Assassin is a Ghost last seen at `position` (or stays Unknown). */
  const withGhost = (view: ReturnType<typeof arrange>, position?: GridPosition, lastSeenRound = view.round) => ({
    ...view,
    enemies: view.enemies.map((enemy) =>
      enemy.id === "right-assassin" && position
        ? { id: enemy.id, heroClass: enemy.heroClass, visibility: Visibility.Ghost as const, position, deckCount: 8, discardCount: 0, exileCount: 0, lastSeenRound }
        : enemy,
    ),
  });

  it("leaves the straight way that a remembered enemy covers, less the older the Ghost is", () => {
    // From (11, 7) the open tiles (13, 7) to (13, 9) are equally far from the Zone. A Ghost at (13, 1) reaches
    // 7 tiles (Long Shot) down the column: it covers (13, 7) and (13, 8) but not (13, 9).
    const base = arrange({ col: 11, row: 7 }, { col: 29, row: 1 });
    const ghost = { col: 13, row: 1 };
    expect(firstMove(base)).toEqual({ col: 13, row: 7 });
    expect(firstMove(withGhost(base, ghost))).toEqual({ col: 13, row: 9 });
    expect(firstMove(withGhost(base, ghost, base.round - GHOST_MEMORY_ROUNDS))).toEqual({ col: 13, row: 7 });
  });

  it("gives the same plan for the same view with a Ghost", () => {
    const view = withGhost(arrange({ col: 11, row: 7 }, { col: 29, row: 1 }), { col: 13, row: 1 });
    expect(planSquad(view)).toEqual(planSquad(view));
  });

  it("gives the Assassin another tile than the Bruiser from the same start", () => {
    const start = { col: 6, row: 5 };
    const match = startRound(createMatch(5));
    match.heroes.find((hero) => hero.id === "right-assassin")!.position = { col: 12, row: 2 };
    for (const hero of match.heroes.filter((candidate) => candidate.squad === SquadId.Left)) hero.position = start;
    const sameStart = buildSquadView(match, SquadId.Left);
    const endOf = (heroId: string, plan: ReturnType<typeof planSquad>) => {
      const move = plan.heroes.find((hero) => hero.heroId === heroId)!.queue.find((action) => action.kind === ActionKind.Move);
      return move?.kind === ActionKind.Move ? moveEnd(start, move.destination) : undefined;
    };
    // One Hero planned at a time, so claimed tiles do not separate them: only the role does.
    const alone = (heroId: string) => planSquad(sameStart, [heroId]);
    const roles = assignRoles(sameStart, sameStart.heroes.map((hero) => hero.id));
    expect(roles.get("left-bruiser")).toBe(SquadRole.Breaker);
    expect(roles.get("left-assassin")).toBe(SquadRole.Flanker);
    expect(endOf("left-assassin", alone("left-assassin"))).not.toEqual(endOf("left-bruiser", alone("left-bruiser")));
  });

  it("gives a Hero without Squad mates no role", () => {
    const view = arrange({ col: 11, row: 8 }, { col: 17, row: 8 });
    const lone = { ...view, heroes: view.heroes.map((hero, i) => ({ ...hero, exhausted: i > 0 })) };
    expect([...assignRoles(lone, [lone.heroes[0]!.id]).values()]).toEqual([SquadRole.None]);
  });

  it("plans a whole Squad in well under 50 ms", () => {
    const views = SEEDS.map((seed) => buildSquadView(startRound(createMatch(seed)), SquadId.Left));
    const start = performance.now();
    for (const view of views) planSquad(view);
    expect((performance.now() - start) / views.length).toBeLessThan(10);
  });
});

describe("AI Styles", () => {
  it("gives the same Style for the same seed and at least three Styles over a range of seeds", () => {
    const styles = (seed: number) => [aiStyleFor(seed, SquadId.Left), aiStyleFor(seed, SquadId.Right)];
    const seen = new Set<AiStyle>();
    for (let seed = 1; seed <= 100; seed++) {
      expect(styles(seed)).toEqual(styles(seed));
      styles(seed).forEach((style) => seen.add(style));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it("gives the same plan for the same seed's Style and scales weights without touching progress", () => {
    const view = buildSquadView(startRound(createMatch(7)), SquadId.Left);
    const style = aiStyleFor(7, SquadId.Left);
    expect(planSquad(view, undefined, style)).toEqual(planSquad(view, undefined, style));
    for (const each of Object.values(AiStyle)) expect(weightsFor(each, SquadRole.None).progress).toBe(AI_WEIGHTS.progress);
    expect(weightsFor(AiStyle.Aggressive, SquadRole.None).danger).toBeLessThan(weightsFor(AiStyle.Defensive, SquadRole.None).danger);
  });

  it("plays only legal plans with every pair of Styles", () => {
    const styles = Object.values(AiStyle);
    for (const [i, left] of styles.entries()) {
      const right = styles[(i + 1) % styles.length]!;
      let match = startRound(createMatch(3 + i));
      for (let round = 1; round <= 30 && !match.result; round++) {
        const plans = [SquadId.Left, SquadId.Right].map((squad) => {
          const view = buildSquadView(match, squad);
          const plan = planSquad(view, undefined, squad === SquadId.Left ? left : right);
          expect(validatePlan(view, plan)).toEqual([]);
          return plan;
        });
        const resolution = resolveRound(match, plans);
        match = resolution.match.result ? resolution.match : startRound(resolution.match);
      }
    }
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
    // Sixteen seeds: with eight, a fair coin gives seven wins to one side in one run of thirty.
    const seeds = SEEDS.slice(0, 16);
    for (const seed of seeds) {
      // The Squads take turns at yielding by Round parity, and every match follows the same early timeline, so the parity
      // of the Round of the first contest decides who wins it. Half of the seeds start one Round later to cancel that out.
      const winner = playAiMatch(seed, MAX_ROUNDS, seed % 2 === 0 ? 1 : 2).match.result?.winner;
      if (winner) wins[winner] += 1;
    }
    expect(Math.max(wins[SquadId.Left], wins[SquadId.Right])).toBeLessThanOrEqual(seeds.length - 3);
  }, 120_000);
});

describe("AI in the classic mode", () => {
  it("never plans a Block, over many seeds", () => {
    for (const seed of MATCH_SEEDS) {
      const { plans, issues } = playAiMatch(seed, MAX_ROUNDS);
      expect(issues).toEqual([]);
      const blocks = plans.flatMap((plan) => plan.heroes.flatMap((hero) => hero.queue)).filter((action) => action.kind === ActionKind.Block);
      expect(blocks).toEqual([]);
    }
  }, 120_000);
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

  // The AI only walks to the Prime Zone and does not split (a later ticket), so most classic matches end at the Round limit.
  it("ends every classic match within the Round limit with legal plans", () => {
    for (const seed of MATCH_SEEDS) {
      const { match, issues } = playAiMatch(seed, MAX_ROUNDS);
      expect(issues).toEqual([]);
      expect(match.result).toBeDefined();
      expect(match.round).toBeLessThanOrEqual(ROUND_LIMIT);
    }
  }, 120_000);
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

  it("plays only legal plans for 40 seeds, either Squad defending", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { issues } = playAiMatch(seed, 60, 1, mode(seed % 2 === 0 ? SquadId.Left : SquadId.Right));
      expect({ seed, issues }).toEqual({ seed, issues: [] });
    }
  }, 60_000);
});

describe("AI-versus-AI smoke test", () => {
  // Played on first use inside a test, not while Vitest collects the tests (a long run there blocks the worker).
  let played: ReturnType<typeof playOutcomes> | undefined;
  const playOutcomes = () => MATCH_SEEDS.map((seed) => ({ seed, ...playAiMatch(seed, MAX_ROUNDS) }));
  const outcomes = () => (played ??= playOutcomes());

  it("plays only legal plans", () => {
    for (const { seed, issues } of outcomes()) expect({ seed, issues }).toEqual({ seed, issues: [] });
  }, 120_000);

  it("ends every match within the Round limit", () => {
    for (const { seed, match } of outcomes()) {
      expect({ seed, ended: match.result !== undefined }).toEqual({ seed, ended: true });
    }
  });

  it("produces plans that stay valid when re-checked against the view", () => {
    const { plans } = outcomes()[0]!;
    expect(plans.length).toBeGreaterThan(0);
    const view = buildSquadView(startRound(createMatch(1)), SquadId.Left);
    expect(validatePlan(view, planSquad(view))).toEqual([]);
  });
});

describe("AI focus fire", () => {
  /** Two Left Heroes beside each other, two Right Heroes in front of them, all in Range and in sight. */
  const arrange = (positions: Record<string, GridPosition>) => {
    const match = startRound(createMatch(5));
    for (const [id, position] of Object.entries(positions)) match.heroes.find((hero) => hero.id === id)!.position = position;
    return buildSquadView(match, SquadId.Left);
  };
  const attacks = (plan: ReturnType<typeof planSquad>, heroId: string) =>
    plan.heroes
      .find((hero) => hero.heroId === heroId)!
      .queue.flatMap((action, slot) => (action.kind === ActionKind.Primary ? [{ slot, target: action.target }] : []));
  const duel = () =>
    arrange({
      "left-bruiser": { col: 8, row: 4 },
      "left-controller": { col: 8, row: 5 },
      "right-bruiser": { col: 10, row: 4 },
      "right-assassin": { col: 10, row: 5 },
    });

  it("names the same enemy for both Heroes and puts the Attacks in the same or consecutive Ticks", () => {
    const view = duel();
    const plan = planSquad(view);
    const first = attacks(plan, "left-bruiser")[0];
    const second = attacks(plan, "left-controller")[0];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second!.target).toBe(first!.target);
    expect(Math.abs(second!.slot - first!.slot)).toBeLessThanOrEqual(1);
    expect(validatePlan(view, plan)).toEqual([]);
  });

  it("changes nothing when only one Hero has an enemy in Range", () => {
    const view = arrange({ "left-bruiser": { col: 8, row: 4 }, "right-bruiser": { col: 10, row: 4 } });
    const plan = planSquad(view);
    expect(attacks(plan, "left-controller")).toEqual([]);
    expect(validatePlan(view, plan)).toEqual([]);
  });

  it("is deterministic", () => {
    const view = duel();
    expect(planSquad(view)).toEqual(planSquad(view));
  });
});
