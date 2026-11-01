// Resolution of a Round (ADR 0013, ADR 0020). Pure and deterministic: the same Match State and plans
// always give the same result. Only Move actions exist so far.

import { type CardDefinition, HERO_DECKS } from "./cards";
import { EventKind, MatchEndReason, type MatchEvent, PRIME_ZONE_WIN_RESOLUTIONS, ROUND_LIMIT, SquadId } from "./host";
import { canSquadSee, type HeroState, type MatchState, recordSightings } from "./match";
import { ActionKind, BLOCK_SHIELD, chebyshevDistance, MOVE_DISTANCE, type SquadPlan } from "./plan";
import {
  CoverKind,
  coverAgainst,
  type GridPosition,
  HALF_COVER_REDUCTION,
  hasLineOfSight,
  REACTOR_DECK,
  TileKind,
  tileAt,
} from "./reactor-deck";

export interface ResolutionResult {
  /** The Match State after the Resolution; the Round counter and Hands are unchanged. */
  match: MatchState;
  /** Everything that happened, for all Squads. Clients only ever see `getSquadEvents`. */
  events: readonly MatchEvent[];
  /** Parallel to `events`: the Squads that perceive each event. */
  perceivedBy: readonly (readonly SquadId[])[];
}

const SQUADS = [SquadId.Left, SquadId.Right];

/** Which Squads perceive the events from `first` on, judged by the current positions (see `getSquadEvents`). */
function perceivers(match: MatchState, events: readonly MatchEvent[], first: number): SquadId[][] {
  return events.slice(first).map((event) => {
    const involved = [event.heroId, event.targetId].flatMap((id) => match.heroes.filter((hero) => hero.id === id));
    const tiles = [event.from, event.to, ...involved.map((hero) => hero.position)].filter((tile) => tile !== undefined);
    return SQUADS.filter(
      (squad) =>
        involved.some((hero) => hero.squad === squad) || tiles.some((tile) => canSquadSee(match, squad, tile)),
    );
  });
}

interface Mover {
  heroId: string;
  destination: GridPosition;
}

interface Attack {
  hero: HeroState;
  card: CardDefinition;
  targetId: string;
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
 * Resolves one Tick of Attacks against the positions at the end of the Tick's movement. Every Attack is
 * checked before any damage is applied, so simultaneous Attacks all resolve, even between Heroes that
 * lose their last card in this Tick. A failed Attack (Range, Line of Sight, Exhausted target) does nothing.
 */
function resolveAttacks(match: MatchState, tick: number, attacks: Attack[], events: MatchEvent[]): void {
  const landed = attacks.filter(({ hero, card, targetId }) => {
    const target = match.heroes.find((candidate) => candidate.id === targetId);
    const reachable =
      target !== undefined &&
      !target.exhausted &&
      target.squad !== hero.squad &&
      chebyshevDistance(hero.position, target.position) <= (card.range ?? 0) &&
      hasLineOfSight(REACTOR_DECK, hero.position, target.position) &&
      coverAgainst(REACTOR_DECK, hero.position, target.position) !== CoverKind.Full;
    if (!reachable) events.push({ kind: EventKind.AttackFailed, tick, heroId: hero.id, targetId });
    return reachable;
  });
  for (const { hero, card, targetId } of landed) {
    const target = match.heroes.find((candidate) => candidate.id === targetId)!;
    const halfCover = coverAgainst(REACTOR_DECK, hero.position, target.position) === CoverKind.Half;
    const incoming = Math.max(0, (card.effects[0]!.amount ?? 0) - (halfCover ? HALF_COVER_REDUCTION : 0));
    const absorbed = Math.min(target.shield, incoming);
    target.shield -= absorbed;
    // Deck Damage takes the top cards, one per point; they leave the cycle (Exile) so the damage lasts.
    const removed = target.deck.splice(Math.max(0, target.deck.length - (incoming - absorbed)));
    target.exile.push(...removed);
    events.push({ kind: EventKind.AttackHit, tick, heroId: hero.id, targetId, absorbed, damage: removed.length });
  }
}

const otherSquad = (squad: SquadId) => (squad === SquadId.Left ? SquadId.Right : SquadId.Left);

/**
 * Updates Prime Zone control and checks the victory conditions at the end of a Resolution
 * (ADR 0010, ADR 0011, ADR 0019). Squad loss is checked first: an Exhausted Squad cannot win by keeping
 * control on a tie. Sets `match.result` when the match is over.
 */
function evaluateMatchEnd(match: MatchState): void {
  const inZone = (squad: SquadId) =>
    match.heroes.filter(
      (hero) => hero.squad === squad && !hero.exhausted && tileAt(REACTOR_DECK, hero.position) === TileKind.PrimeZone,
    ).length;
  const [left, right] = [inZone(SquadId.Left), inZone(SquadId.Right)];
  const controller = left === right ? match.primeZone.controller : left > right ? SquadId.Left : SquadId.Right;
  match.primeZone =
    controller === undefined
      ? { progress: 0 }
      : { controller, progress: controller === match.primeZone.controller ? match.primeZone.progress + 1 : 1 };

  const deckTotals = {
    [SquadId.Left]: 0,
    [SquadId.Right]: 0,
  };
  for (const hero of match.heroes) deckTotals[hero.squad] += hero.deck.length;
  const end = (reason: MatchEndReason, winner?: SquadId) => {
    match.result = { ...(winner ? { winner } : {}), reason, round: match.round, deckTotals };
  };

  const lost = SQUADS.filter((squad) => match.heroes.filter((hero) => hero.squad === squad).every((hero) => hero.exhausted));
  if (lost.length === 2) return end(MatchEndReason.AllHeroesExhausted);
  if (lost.length === 1) return end(MatchEndReason.AllHeroesExhausted, otherSquad(lost[0]!));
  if (match.primeZone.progress >= PRIME_ZONE_WIN_RESOLUTIONS) {
    return end(MatchEndReason.PrimeZoneHeld, match.primeZone.controller);
  }
  if (match.round >= ROUND_LIMIT) {
    const difference = deckTotals[SquadId.Left] - deckTotals[SquadId.Right];
    end(MatchEndReason.RoundLimit, difference === 0 ? undefined : difference > 0 ? SquadId.Left : SquadId.Right);
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
  const perceivedBy: SquadId[][] = [];
  // Judged at the end of each Tick, when Heroes stand where the Tick left them; also feeds Ghost memory.
  const endTick = () => {
    perceivedBy.push(...perceivers(match, events, perceivedBy.length));
    recordSightings(match);
  };

  const ticks = Math.max(0, ...queues.map(({ queue }) => queue.length));
  for (let tick = 1; tick <= ticks; tick++) {
    const actions = match.heroes.filter((hero) => !hero.exhausted).flatMap((hero) => {
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
    const attacks = actions.flatMap(({ hero, action }) =>
      action.kind === ActionKind.Primary
        ? [{ hero, card: HERO_DECKS[hero.heroClass][action.card]!, targetId: action.target }]
        : [],
    );
    resolveAttacks(match, tick, attacks, events);
    endTick();
  }

  // Pitched and queued cards leave the Hand for the Discard; Energy and Shield expire with the Round.
  for (const { heroId, queue, pitched = [] } of queues) {
    const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
    if (hero.exhausted) continue;
    for (const card of [...pitched, ...queue.map((action) => action.card)]) {
      hero.hand.splice(hero.hand.indexOf(card), 1);
      hero.discard.push(card);
    }
  }
  for (const hero of match.heroes) hero.shield = 0;
  // Exhaustion takes effect only now, so a Hero whose Deck ran out mid-Resolution finished its Queue (ADR 0006).
  for (const hero of match.heroes.filter((candidate) => !candidate.exhausted && candidate.deck.length === 0)) {
    hero.exhausted = true;
    events.push({ kind: EventKind.Exhausted, tick: Math.max(ticks, 1), heroId: hero.id });
  }
  evaluateMatchEnd(match);
  endTick();
  return { match, events, perceivedBy };
}

/**
 * The events a Squad may perceive; the only source of events for a client, so hidden information never
 * has to be removed in the UI. A Squad perceives an event when one of its own Heroes is involved (it acts
 * or is the target), or when it sees, at the end of the event's Tick, a tile the event touched: the tiles
 * a Hero stepped from or to, and where the acting and the targeted Hero stand. Being attacked by an
 * enemy out of sight therefore reveals which Hero attacked, but not where it stands.
 */
export function getSquadEvents(squad: SquadId, resolution: ResolutionResult): MatchEvent[] {
  return structuredClone(resolution.events.filter((_, i) => resolution.perceivedBy[i]!.includes(squad)));
}
