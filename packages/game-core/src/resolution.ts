// Resolution of a Round (ADR 0013, ADR 0020). Pure and deterministic: the same Match State and plans
// always give the same result. Only Move actions exist so far.

import { EventKind, type MatchEvent, type SquadId } from "./host";
import type { MatchState } from "./match";
import { ActionKind, BLOCK_SHIELD, MOVE_DISTANCE, type SquadPlan } from "./plan";
import { type GridPosition, REACTOR_DECK, TileKind, tileAt } from "./reactor-deck";

export interface ResolutionResult {
  /** The Match State after the Resolution; the Round counter and Hands are unchanged. */
  match: MatchState;
  /** Everything that happened, for all Squads. Clients only ever see `getSquadEvents`. */
  events: readonly MatchEvent[];
}

interface Mover {
  heroId: string;
  destination: GridPosition;
}

const samePosition = (a: GridPosition, b: GridPosition) => a.col === b.col && a.row === b.row;
const isWall = (position: GridPosition) => tileAt(REACTOR_DECK, position) === TileKind.Wall;

/** A step is legal into the Grid, not into a Wall, and a diagonal step may not cut a Wall corner. */
function isStepAllowed(from: GridPosition, to: GridPosition): boolean {
  if (tileAt(REACTOR_DECK, to) === undefined || isWall(to)) return false;
  const diagonal = from.col !== to.col && from.row !== to.row;
  return !(diagonal && (isWall({ col: to.col, row: from.row }) || isWall({ col: from.col, row: to.row })));
}

function stepTowards(from: GridPosition, destination: GridPosition): GridPosition {
  return {
    col: from.col + Math.sign(destination.col - from.col),
    row: from.row + Math.sign(destination.row - from.row),
  };
}

/**
 * Resolves one Tick of Move actions. All Heroes take their first step before any takes the second, so
 * Heroes entering the same free tile in the same step both stay (ADR 0013).
 */
function resolveMoves(match: MatchState, tick: number, movers: Mover[], events: MatchEvent[]): void {
  let active = movers;
  for (let step = 0; step < MOVE_DISTANCE && active.length > 0; step++) {
    const attempts = active.flatMap((mover) => {
      const hero = match.heroes.find((candidate) => candidate.id === mover.heroId)!;
      if (samePosition(hero.position, mover.destination)) return [];
      return [{ mover, hero, to: stepTowards(hero.position, mover.destination) }];
    });
    const allowed = attempts.filter(({ hero, to }) => {
      const occupied = match.heroes.some((other) => samePosition(other.position, to));
      return isStepAllowed(hero.position, to) && !occupied;
    });
    const blockedIds = new Set(attempts.map(({ mover }) => mover.heroId));
    const moving = allowed.filter(({ to }) => allowed.filter((other) => samePosition(other.to, to)).length === 1);
    for (const { mover, hero, to } of moving) {
      blockedIds.delete(mover.heroId);
      events.push({ kind: EventKind.Step, tick, heroId: hero.id, from: { ...hero.position }, to });
    }
    for (const { hero } of attempts.filter(({ mover }) => blockedIds.has(mover.heroId))) {
      events.push({ kind: EventKind.MoveBlocked, tick, heroId: hero.id, from: { ...hero.position } });
    }
    // Positions change only after every Hero of this step has been decided.
    for (const { hero, to } of moving) hero.position = to;
    active = moving.map(({ mover }) => mover);
  }
}

/**
 * Plays out the plans: Tick n resolves the n-th action of every Hero's Queue. Cards used in a Queue
 * leave the Hand for the Discard, whether the action succeeds or fails.
 */
export function resolveRound(previous: MatchState, plans: readonly SquadPlan[]): ResolutionResult {
  const match = structuredClone(previous);
  const queues = plans.flatMap((plan) => plan.heroes);
  const events: MatchEvent[] = [];

  const ticks = Math.max(0, ...queues.map(({ queue }) => queue.length));
  for (let tick = 1; tick <= ticks; tick++) {
    const actions = match.heroes.flatMap((hero) => {
      const action = queues.find(({ heroId }) => heroId === hero.id)?.queue[tick - 1];
      return action ? [{ hero, action }] : [];
    });
    // Shield exists from its Tick on, so damage resolved later in the same Tick is absorbed by it.
    for (const { hero, action } of actions) {
      if (action.kind === ActionKind.Block) {
        hero.shield += BLOCK_SHIELD;
        events.push({ kind: EventKind.ShieldGained, tick, heroId: hero.id, amount: BLOCK_SHIELD });
      }
    }
    const movers = actions.flatMap(({ hero, action }) =>
      action.kind === ActionKind.Move ? [{ heroId: hero.id, destination: action.destination }] : [],
    );
    resolveMoves(match, tick, movers, events);
  }

  // Pitched and queued cards leave the Hand for the Discard; Energy and Shield expire with the Round.
  for (const { heroId, queue, pitched = [] } of queues) {
    const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
    for (const card of [...pitched, ...queue.map((action) => action.card)]) {
      hero.hand.splice(hero.hand.indexOf(card), 1);
      hero.discard.push(card);
    }
  }
  for (const hero of match.heroes) hero.shield = 0;
  return { match, events };
}

/**
 * The events a Squad may see; the only source of events for a client. Without Fog of War every Squad
 * sees everything, but the filter lives here so hidden information never has to be removed in the UI.
 */
export function getSquadEvents(_squad: SquadId, events: readonly MatchEvent[]): MatchEvent[] {
  return structuredClone([...events]);
}
