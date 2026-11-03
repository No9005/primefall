// Squad Plans and planning-time validation (ADR 0013, ADR 0020). Shared with clients: a plan is plain
// data, and `validatePlan` lets the UI explain why a plan cannot be committed. The host validates again.

import { type CardIndex, cardInMode, CardTarget, EffectKind, EffectRecipient, HERO_DECKS, type HeroClass, isPlayableCard } from "./cards";
import { type HeroView, type SquadId, type SquadView, Visibility } from "./host";
import { type Grid, type GridPosition, isStepAllowed, REACTOR_DECK, stepTowards, TileKind, tileAt } from "./reactor-deck";

/** A Hero's Queue holds at most 4 actions (the maximum Hand size, ADR 0020). */
export const MAX_QUEUE_LENGTH = 4;

/** Tiles a Move 2 covers at most. */
export const MOVE_DISTANCE = 2;

/** Energy one Pitch produces (ADR 0007). */
export const PITCH_ENERGY = 1;

/** Shield a Block creates (ADR 0002). */
export const BLOCK_SHIELD = 2;

export enum ActionKind {
  /** Any card used as Move 2: up to two steps towards the destination. */
  Move = "move",
  /** Any card used as Block 2: Shield 2 in its Tick. */
  Block = "block",
  /** A card's primary effect; it costs the card's Energy. Simple damage Attacks and Shield Utility cards resolve so far. */
  Primary = "primary",
  /** The Hero does nothing for one Tick; it needs no card and no Energy but takes a slot of the Queue. */
  Wait = "wait",
}

export interface MoveAction {
  kind: ActionKind.Move;
  /** The Hand card spent on this action. */
  card: CardIndex;
  destination: GridPosition;
}

export interface BlockAction {
  kind: ActionKind.Block;
  card: CardIndex;
}

export interface PrimaryAction {
  kind: ActionKind.Primary;
  card: CardIndex;
  /**
   * Id of the Hero the card is aimed at: an enemy Hero for an Attack (Range and Line of Sight are checked
   * when it resolves), this Hero or an allied Hero for a Utility card.
   */
  target: string;
  /**
   * For a card aimed at a tile or area (Breach Charge, Scout Drone, Deploy Cover): the tile (the centre of
   * an area); `target` is then the casting Hero.
   * For Forward Deploy: the tile the allied `target` moves towards.
   */
  tile?: GridPosition;
  /** For an Overdrive that affects two allied Heroes (Aegis Protocol): the second one, distinct from `target`. */
  secondTarget?: string;
  /** Play the card's Overdrive instead of its standard effect; the card is then Exiled (ADR 0003). */
  overdrive?: boolean;
}

export interface WaitAction {
  kind: ActionKind.Wait;
}

/** Actions are a union that grows with the card uses. */
export type QueuedAction = MoveAction | BlockAction | PrimaryAction | WaitAction;

export interface HeroPlan {
  heroId: string;
  queue: readonly QueuedAction[];
  /** Hand cards pitched for Energy; Pitch is a planning step, not a queued action (ADR 0020). */
  pitched?: readonly CardIndex[];
}

/** Energy a Hero's pitched cards produce for the Round. */
export function energyPool(pitched: readonly CardIndex[] = []): number {
  return pitched.length * PITCH_ENERGY;
}

/** Energy the Queue spends: only primary effects cost Energy; Move 2 and Block 2 are free. */
export function queueEnergyCost(heroClass: HeroClass, queue: readonly QueuedAction[]): number {
  return queue.reduce(
    (sum, action) => sum + (action.kind === ActionKind.Primary ? HERO_DECKS[heroClass][action.card]!.energyCost : 0),
    0,
  );
}

export interface SquadPlan {
  squad: SquadId;
  /** Heroes without an entry plan nothing. */
  heroes: readonly HeroPlan[];
}

export enum PlanIssueKind {
  WrongSquad = "wrongSquad",
  UnknownHero = "unknownHero",
  CardNotInHand = "cardNotInHand",
  CardUsedTwice = "cardUsedTwice",
  QueueTooLong = "queueTooLong",
  BadDestination = "badDestination",
  NotEnoughEnergy = "notEnoughEnergy",
  /** The card's primary effect cannot be played yet. */
  UnplayableCard = "unplayableCard",
  BadTarget = "badTarget",
  HeroExhausted = "heroExhausted",
  /** Overdrive was requested for a card that has none. */
  NoOverdrive = "noOverdrive",
}

export interface PlanIssue {
  kind: PlanIssueKind;
  heroId?: string;
  /** Human-readable reason, shown to the player. */
  message: string;
}

export function chebyshevDistance(a: GridPosition, b: GridPosition): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/** Tiles a Move 2 from `from` may be planned to: 1 or 2 tiles away, inside the Grid, not a Wall. */
export function moveDestinations(from: GridPosition, grid: Grid = REACTOR_DECK, distance = MOVE_DISTANCE): GridPosition[] {
  const found: GridPosition[] = [];
  for (let row = from.row - distance; row <= from.row + distance; row++) {
    for (let col = from.col - distance; col <= from.col + distance; col++) {
      const kind = tileAt(grid, { col, row });
      if (kind !== undefined && kind !== TileKind.Wall && chebyshevDistance(from, { col, row }) > 0) {
        found.push({ col, row });
      }
    }
  }
  return found;
}

/** Where a Move 2 towards `destination` really ends: it stops before a Wall or Wall corner (ADR 0020). */
export function moveEnd(from: GridPosition, destination: GridPosition): GridPosition {
  return movePath(from, destination).at(-1) ?? from;
}

/** The tiles a Move 2 towards `destination` stands on after step 1 and step 2, without other Heroes in the way. */
export function movePath(from: GridPosition, destination: GridPosition): GridPosition[] {
  const path: GridPosition[] = [];
  let position = from;
  for (let step = 0; step < MOVE_DISTANCE; step++) {
    const next = stepTowards(position, destination);
    if (!isStepAllowed(position, next) || (next.col === position.col && next.row === position.row)) break;
    position = next;
    path.push(position);
  }
  return path;
}

/** The Move 2 destinations the Hero reaches completely: `moveDestinations` minus tiles behind a Wall or Wall corner. */
export const reachableMoveDestinations = (from: GridPosition): GridPosition[] =>
  moveDestinations(from).filter((destination) => {
    const end = moveEnd(from, destination);
    return end.col === destination.col && end.row === destination.row;
  });

/** Returns every rule the plan breaks against the Squad View; an empty list means it can be committed. */
export function validatePlan(view: SquadView, plan: SquadPlan): PlanIssue[] {
  const issues: PlanIssue[] = [];
  if (plan.squad !== view.squad) {
    issues.push({ kind: PlanIssueKind.WrongSquad, message: "The plan belongs to another Squad." });
  }
  for (const { heroId, queue, pitched = [] } of plan.heroes) {
    const hero = view.heroes.find((candidate) => candidate.id === heroId);
    if (!hero) {
      issues.push({ kind: PlanIssueKind.UnknownHero, heroId, message: `Unknown Hero ${heroId}.` });
      continue;
    }
    if (hero.exhausted && (queue.length > 0 || pitched.length > 0)) {
      issues.push({ kind: PlanIssueKind.HeroExhausted, heroId, message: "An Exhausted Hero cannot act." });
      continue;
    }
    if (queue.length > MAX_QUEUE_LENGTH) {
      issues.push({ kind: PlanIssueKind.QueueTooLong, heroId, message: `A Queue holds at most ${MAX_QUEUE_LENGTH} actions.` });
    }
    const used = new Set<CardIndex>();
    // A card fulfils one role per Round: Pitch and Queue actions share the same set.
    const useCard = (card: CardIndex) => {
      if (!hero.hand.includes(card)) {
        issues.push({ kind: PlanIssueKind.CardNotInHand, heroId, message: "A planned card is not in the Hand." });
      } else if (used.has(card)) {
        issues.push({ kind: PlanIssueKind.CardUsedTwice, heroId, message: "A card can be used only once per Round." });
      }
      used.add(card);
    };
    pitched.forEach(useCard);
    const cost = queueEnergyCost(hero.heroClass, queue);
    if (cost > energyPool(pitched)) {
      issues.push({
        kind: PlanIssueKind.NotEnoughEnergy,
        heroId,
        message: `The Queue needs ${cost} Energy but only ${energyPool(pitched)} is pitched.`,
      });
    }
    let position = hero.position;
    // Reposition stretches the next Move of the Queue to the distance on its card.
    let moveDistance = MOVE_DISTANCE;
    for (const action of queue) {
      if (action.kind === ActionKind.Wait) continue;
      useCard(action.card);
      if (action.kind === ActionKind.Primary) {
        const extend = cardInMode(HERO_DECKS[hero.heroClass][action.card]!, action.overdrive).effects.find(
          ({ kind }) => kind === EffectKind.ExtendMove,
        );
        if (extend) moveDistance = extend.amount ?? MOVE_DISTANCE;
      }
      if (action.kind === ActionKind.Primary) {
        const base = HERO_DECKS[hero.heroClass][action.card];
        const card = base && cardInMode(base, action.overdrive);
        if (base && action.overdrive && !base.overdrive) {
          issues.push({ kind: PlanIssueKind.NoOverdrive, heroId, message: `${base.name} has no Overdrive.` });
        } else if (!card || !isPlayableCard(base!, action.overdrive)) {
          issues.push({ kind: PlanIssueKind.UnplayableCard, heroId, message: "This card's effect cannot be played yet." });
        } else if (card.target === CardTarget.GhostEnemy) {
          if (!view.enemies.some((enemy) => enemy.id === action.target && enemy.visibility === Visibility.Ghost)) {
            issues.push({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a Ghost as its target.` });
          }
        } else if (card.target === CardTarget.Tile || card.target === CardTarget.EmptyTile || card.target === CardTarget.Area) {
          // Range, Line of Sight and whether the tile is empty are checked when the card resolves.
          const kind = action.tile && tileAt(REACTOR_DECK, action.tile);
          if (action.target !== heroId || kind === undefined || kind === TileKind.Wall) {
            issues.push({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a tile that is not a Wall as its target.` });
          }
        } else if (card.target !== CardTarget.VisibleEnemy && card.target !== CardTarget.EnemyInSight) {
          // Self cards and area Attacks are confirmed on this Hero; ally cards need another Hero.
          const isSelfCard = card.target === CardTarget.SelfHero || card.target === CardTarget.EnemiesInRange;
          const validTarget = isSelfCard
            ? action.target === heroId
            : view.heroes.some((ally) => ally.id === action.target && ally.id !== heroId && !ally.exhausted);
          if (!validTarget) {
            issues.push({
              kind: PlanIssueKind.BadTarget,
              heroId,
              message: isSelfCard ? `${card.name} can only target this Hero.` : `${card.name} needs an allied Hero as its target.`,
            });
          }
          if (card.effects.some(({ recipient }) => recipient === EffectRecipient.SecondTarget)) {
            const second = view.heroes.find((ally) => ally.id === action.secondTarget);
            if (!second || second.id === heroId || second.id === action.target || second.exhausted) {
              issues.push({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a second, different allied Hero.` });
            }
          }
          // Forward Deploy also names the tile the ally heads for; where the ally stands by then is checked when it resolves.
          const destination = action.tile && tileAt(REACTOR_DECK, action.tile);
          if (
            card.effects.some(({ kind }) => kind === EffectKind.GrantExtraMove) &&
            (destination === undefined || destination === TileKind.Wall)
          ) {
            issues.push({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a destination tile that is not a Wall.` });
          }
        } else if (!view.enemies.some(
            (enemy) => enemy.id === action.target && enemy.visibility === Visibility.Visible && !enemy.exhausted,
          )) {
          issues.push({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a Visible enemy Hero as its target.` });
        }
      }
      if (action.kind !== ActionKind.Move) continue;
      const reachable = moveDestinations(position, REACTOR_DECK, moveDistance).some(
        (tile) => tile.col === action.destination.col && tile.row === action.destination.row,
      );
      if (!reachable) {
        issues.push({ kind: PlanIssueKind.BadDestination, heroId, message: "Move 2 needs a free destination 1 or 2 tiles away." });
      }
      position = action.destination;
      moveDistance = MOVE_DISTANCE;
    }
  }
  return issues;
}

export interface WalkRequest {
  heroId: string;
  destination: GridPosition;
  /** Tiles the Move covers at most. */
  distance: number;
}

export interface WalkOutcome {
  heroId: string;
  /** The tiles the Hero stood on after each step, starting with its own tile; the last one is where it stops. */
  path: GridPosition[];
  /** The Hero stops before its destination: a Wall or a Wall corner is in the way, or a step failed because of another Hero. */
  blocked: boolean;
  /** For a Move stopped by Heroes: the Hero that was on the tile of the failed step (standing there or stepping onto it too). */
  occupiedBy?: string;
}

const sameTile = (a: GridPosition, b: GridPosition) => a.col === b.col && a.row === b.row;

/**
 * Decides where Moves end (ADR 0013). `standing` has every Hero. Steps are taken one after the other: in each
 * step every walking Hero tries the next tile towards its destination (a Wall or Wall corner ends its walk).
 * Heroes that move do not hinder each other, but a Hero cannot step onto a tile where a Hero stays, and no two
 * Heroes may be on one tile after the step. A Hero whose step fails stops for the rest of its Move and counts as
 * standing, which may make the Heroes behind it fail too; this is repeated until nothing changes. The result does
 * not depend on the order of the requests or on which Squad a Hero belongs to.
 */
export function resolveWalks(standing: ReadonlyMap<string, GridPosition>, requests: readonly WalkRequest[]): Map<string, WalkOutcome> {
  const walks = new Map<string, { path: GridPosition[]; wallBlocked: boolean; failedAgainst?: string; done: boolean }>();
  for (const [heroId, position] of standing) walks.set(heroId, { path: [{ ...position }], wallBlocked: false, done: true });
  for (const { heroId } of requests) walks.get(heroId)!.done = false;
  const furthest = Math.max(0, ...requests.map(({ distance }) => distance));

  for (let step = 0; step < furthest; step++) {
    const candidates = new Map<string, GridPosition>();
    for (const { heroId, destination, distance } of requests) {
      const walk = walks.get(heroId)!;
      if (walk.done) continue;
      const from = walk.path.at(-1)!;
      if (step >= distance || sameTile(from, destination)) {
        walk.done = true;
        continue;
      }
      const next = stepTowards(from, destination);
      if (isStepAllowed(from, next)) {
        candidates.set(heroId, next);
      } else {
        walk.wallBlocked = true;
        walk.done = true;
      }
    }
    // Failures only ever get added, so this settles.
    const failed = new Map<string, string>();
    for (let changed = true; changed; ) {
      changed = false;
      const after = new Map(
        [...walks].map(([heroId, { path }]) => [heroId, failed.has(heroId) ? path.at(-1)! : (candidates.get(heroId) ?? path.at(-1)!)]),
      );
      for (const heroId of candidates.keys()) {
        if (failed.has(heroId)) continue;
        const tile = after.get(heroId)!;
        const other = [...after].find(([otherId, otherTile]) => otherId !== heroId && sameTile(otherTile, tile));
        if (other) {
          failed.set(heroId, other[0]);
          changed = true;
        }
      }
    }
    for (const [heroId, tile] of candidates) {
      const walk = walks.get(heroId)!;
      if (failed.has(heroId)) {
        walk.failedAgainst = failed.get(heroId);
        walk.done = true;
      } else {
        walk.path.push({ ...tile });
      }
    }
  }
  return new Map(
    requests.map(({ heroId }) => {
      const { path, wallBlocked, failedAgainst } = walks.get(heroId)!;
      const outcome: WalkOutcome = { heroId, path, blocked: wallBlocked || failedAgainst !== undefined };
      if (failedAgainst !== undefined) outcome.occupiedBy = failedAgainst;
      return [heroId, outcome];
    }),
  );
}

/** A planned Move that stops short because of another Hero of the same Squad (ADR 0013). */
export interface MoveCollision {
  heroId: string;
  /** 1-based Tick of the Move action. */
  tick: number;
  /** The destination of the Move, where the warning is drawn. */
  destination: GridPosition;
  /** A Squad Hero on the tile the Move would reach: standing there, or ending its own Move there. */
  blockedBy: string;
}

/** A Slowed Hero's first Move 2 becomes a Move 1 (mirrors the Resolution). */
const SLOWED_MOVE_DISTANCE = 1;

/**
 * The planned Moves that stop short of their destination because another Hero of the Squad is on the tile they
 * would end on, judged by `resolveWalks` like the Resolution does. Enemies are not considered, and a Move stopped
 * by a Wall is not a collision. Heroes that stop short start their next Move from where they stopped.
 */
export function findMoveCollisions(heroes: readonly HeroView[], plans: readonly SquadPlan[]): MoveCollision[] {
  const positions = new Map(heroes.filter((hero) => !hero.exhausted).map((hero) => [hero.id, { ...hero.position }]));
  const slowed = new Set(heroes.filter((hero) => hero.slowed).map((hero) => hero.id));
  const extended = new Map<string, number>();
  const queues = plans.flatMap((plan) => plan.heroes).filter(({ heroId }) => positions.has(heroId));
  const collisions: MoveCollision[] = [];
  const ticks = Math.max(0, ...queues.map(({ queue }) => queue.length));

  for (let tick = 1; tick <= ticks; tick++) {
    const movers = queues.flatMap(({ heroId, queue }) => {
      const hero = heroes.find((candidate) => candidate.id === heroId)!;
      const action = queue[tick - 1];
      if (!action || hero.exhausted) return [];
      if (action.kind === ActionKind.Primary) {
        const card = HERO_DECKS[hero.heroClass][action.card];
        const extend = card && cardInMode(card, action.overdrive).effects.find(({ kind }) => kind === EffectKind.ExtendMove);
        if (extend) extended.set(heroId, extend.amount ?? MOVE_DISTANCE);
      }
      if (action.kind !== ActionKind.Move) return [];
      let distance = extended.get(heroId) ?? MOVE_DISTANCE;
      extended.delete(heroId);
      if (slowed.delete(heroId)) distance = SLOWED_MOVE_DISTANCE;
      return [{ heroId, destination: action.destination, distance }];
    });
    // A Slowed Hero's walk is shorter, so the Resolution's Slow rule is already in `distance`.
    const outcomes = resolveWalks(positions, movers);
    for (const { heroId, destination } of movers) {
      const { path, occupiedBy } = outcomes.get(heroId)!;
      if (occupiedBy !== undefined) collisions.push({ heroId, tick, destination, blockedBy: occupiedBy });
      positions.set(heroId, path.at(-1)!);
    }
  }
  return collisions;
}
