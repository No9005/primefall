// Local host entry point: runs the server-side simulation inside the browser for the offline
// prototype behind the same interface a network host will use later (ADR 0017).

import { type AiStyle, aiStyleFor, planSquad } from "./ai";
import { type MatchHost, MatchMode, type MatchModeSetting, SquadId, type SquadView, type SubmitResult } from "./host";
import { buildSquadView, createMatch, type MatchState, recordSightings, startRound, ZONES } from "./match";
import { type SquadPlan, validatePlan } from "./plan";
import { TileKind, withWreck } from "./reactor-deck";
import { getSquadEvents, resolveRound } from "./resolution";
import { SERVER_ENTRY } from "./server";

export const LOCAL_HOST_ENTRY = "game-core/local-host" as const;
export const LOCAL_HOST_BACKEND = SERVER_ENTRY;

/** Schema version of a saved match; bump it whenever the Match State changes shape. */
export const SNAPSHOT_VERSION = 2;

/** Plans a Squad from its view; the browser passes one that runs the search in a Web Worker. */
export type SquadPlanner = (view: SquadView, heroIds: readonly string[] | undefined, style: AiStyle, seed: number) => Promise<SquadPlan>;

const planOnThisThread: SquadPlanner = async (view, heroIds, style, seed) => planSquad(view, heroIds, style, seed);

/** A local host can save the running match as text, to resume it later. */
export interface LocalMatchHost extends MatchHost {
  /** The match seed, shown for bug reports. */
  readonly seed: number;
  /** The Match State at the start of the current Round, tagged with `SNAPSHOT_VERSION`. */
  snapshot(): string;
}

/** Starts a match at Round 1 with all Hands drawn. The AI plans the enemy Squad and the allied Heroes the player leaves out of a plan. */
export function createLocalHost(seed: number, mode?: MatchModeSetting, planner: SquadPlanner = planOnThisThread): LocalMatchHost {
  return hostFor(startRound(createMatch(seed, mode)), planner);
}

/** Resumes a saved match. Returns undefined if the text is unreadable or has another schema version. */
export function restoreLocalHost(snapshot: string, planner: SquadPlanner = planOnThisThread): LocalMatchHost | undefined {
  try {
    const saved: unknown = JSON.parse(snapshot);
    if (typeof saved !== "object" || saved === null) return undefined;
    const { version, match } = saved as { version?: unknown; match?: Partial<MatchState> };
    // Version 1 is the same shape without a mode: it is a classic match.
    if ((version !== SNAPSHOT_VERSION && version !== 1) || typeof match !== "object" || match === null) return undefined;
    if (!Array.isArray(match.heroes) || typeof match.round !== "number" || typeof match.rngState !== "number") return undefined;
    return hostFor(upgradeSavedMatch(match as MatchState), planner);
  } catch {
    return undefined;
  }
}

/** A match saved when the Drop Point was still called "spawn" stores that name in its grid. */
function withDropPoints(match: MatchState): MatchState {
  const stale = match.grid.tiles.some((line) => line.some((tile) => (tile as string) === "spawn"));
  if (!stale) return match;
  const tiles = match.grid.tiles.map((line) => line.map((tile) => ((tile as string) === "spawn" ? TileKind.DropPoint : tile)));
  return { ...match, grid: { ...match.grid, tiles } };
}

/**
 * A match saved before Exhausted Heroes left Half Cover has no wrecks: every Exhausted Hero in it leaves Half
 * Cover on its tile now, and each Squad knows the wrecks it could have seen.
 */
function upgradeSavedMatch(match: MatchState): MatchState {
  match = withDropPoints(match);
  if (match.mode === undefined) match = { ...match, mode: { kind: MatchMode.Classic } };
  // Matches saved before the Credits start with none.
  if (match.scores === undefined) match = { ...match, scores: { [SquadId.Left]: 0, [SquadId.Right]: 0 }, zoneControl: ZONES.map(() => ({ contested: false })) };
  if (match.takeoverCooldown === undefined) match = { ...match, takeoverCooldown: ZONES.map(() => 0) };
  if (match.knownWrecks !== undefined) return match;
  const grid = match.heroes.filter((hero) => hero.exhausted).reduce((current, hero) => withWreck(current, hero.position), match.grid);
  const upgraded: MatchState = { ...match, grid, knownWrecks: { [SquadId.Left]: [], [SquadId.Right]: [] } };
  recordSightings(upgraded);
  return upgraded;
}

function hostFor(initial: MatchState, planner: SquadPlanner): LocalMatchHost {
  let match = initial;
  return {
    seed: initial.seed,
    snapshot: () => JSON.stringify({ version: SNAPSHOT_VERSION, match }),
    async getSquadView(squad: SquadId): Promise<SquadView> {
      return buildSquadView(match, squad);
    },
    async getAllyPlan(squad: SquadId, heroIds: readonly string[]): Promise<SquadPlan> {
      return planner(buildSquadView(match, squad), heroIds, aiStyleFor(match.seed, squad), match.seed);
    },
    async submitPlan(plan: SquadPlan): Promise<SubmitResult> {
      if (match.result) throw new Error("The match is over.");
      const issues = validatePlan(buildSquadView(match, plan.squad), plan);
      if (issues.length > 0) throw new Error(`Invalid plan: ${issues.map((issue) => issue.message).join(" ")}`);
      // The AI plans from Squad Views only: every enemy Hero, and the allied Heroes the player did not plan.
      const planned = new Set(plan.heroes.map((hero) => hero.heroId));
      const allyView = buildSquadView(match, plan.squad);
      const allyIds = allyView.heroes.filter((hero) => !planned.has(hero.id)).map((hero) => hero.id);
      const enemySquad = plan.squad === SquadId.Left ? SquadId.Right : SquadId.Left;
      const round = match;
      // The search may run in a Worker; Resolution waits for both plans.
      const [allyAi, enemyAi] = await Promise.all([
        planner(allyView, allyIds, aiStyleFor(round.seed, plan.squad), round.seed),
        planner(buildSquadView(round, enemySquad), undefined, aiStyleFor(round.seed, enemySquad), round.seed),
      ]);
      if (match !== round) throw new Error("The Round changed while the AI was planning.");
      const resolution = resolveRound(match, [{ ...plan, heroes: [...plan.heroes, ...allyAi.heroes] }, enemyAi]);
      // A finished match stays at the Round it ended in.
      match = resolution.match.result ? resolution.match : startRound(resolution.match);
      return { view: buildSquadView(match, plan.squad), events: getSquadEvents(plan.squad, resolution) };
    },
  };
}
