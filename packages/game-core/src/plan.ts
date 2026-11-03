// Squad Plans and planning-time validation (ADR 0013, ADR 0020). Shared with clients: a plan is plain
// data, and `validatePlan` lets the UI explain why a plan cannot be committed. The host validates again.

import { type CardIndex, cardInMode, CardTarget, EffectKind, EffectRecipient, HERO_DECKS, type HeroClass, isPlayableCard } from "./cards";
import { type HeroView, type SquadId, type SquadView, Visibility } from "./host";
import { type Grid, type GridPosition, isStepAllowed, nextStep, REACTOR_DECK, stepTowards, TileKind, tileAt } from "./reactor-deck";

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
  let position = from;
  for (let step = 0; step < MOVE_DISTANCE; step++) {
    const next = stepTowards(position, destination);
    if (!isStepAllowed(position, next) || (next.col === position.col && next.row === position.row)) break;
    position = next;
  }
  return position;
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

/** A planned Move that fails because of another Hero of the same Squad (ADR 0013). */
export interface MoveCollision {
  heroId: string;
  /** 1-based Tick of the Move action. */
  tick: number;
  /** The destination of the Move, where the warning is drawn. */
  destination: GridPosition;
  /** The Squad Hero in the way: standing on the route, or entering the same tile in the same step. */
  blockedBy: string;
}

/** A Slowed Hero's first Move 2 becomes a Move 1 (mirrors the Resolution). */
const SLOWED_MOVE_DISTANCE = 1;

/**
 * The planned Moves that will fail because of another Hero of the Squad, judged like the Resolution does
 * for own Heroes: all Heroes take step n before any takes step n+1, a Hero cannot enter an occupied tile,
 * and two Heroes entering the same free tile in the same step both stay. Enemies are not considered, and a
 * Move stopped by a Wall is not a collision. Heroes that fail a Move stay where they are, so later Moves of
 * their Queue start from there.
 */
export function findMoveCollisions(heroes: readonly HeroView[], plans: readonly SquadPlan[]): MoveCollision[] {
  const positions = new Map(heroes.map((hero) => [hero.id, { ...hero.position }]));
  const slowed = new Set(heroes.filter((hero) => hero.slowed).map((hero) => hero.id));
  const extended = new Map<string, number>();
  const queues = plans.flatMap((plan) => plan.heroes).filter(({ heroId }) => positions.has(heroId));
  const collisions: MoveCollision[] = [];
  const ticks = Math.max(0, ...queues.map(({ queue }) => queue.length));
  const same = (a: GridPosition, b: GridPosition) => a.col === b.col && a.row === b.row;

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
    const flagged = new Map<string, MoveCollision>();
    let active = movers;
    for (let step = 0; step < Math.max(0, ...movers.map(({ distance }) => distance)) && active.length > 0; step++) {
      active = active.filter(({ distance }) => step < distance);
      const attempts = active.flatMap((mover) => {
        const from = positions.get(mover.heroId)!;
        const occupied = (tile: GridPosition) => [...positions.values()].some((position) => same(position, tile));
        return same(from, mover.destination) ? [] : [{ mover, from, to: nextStep(from, mover.destination, occupied) }];
      });
      const open = attempts.filter(({ from, to }) => isStepAllowed(from, to));
      const free = open.filter(({ to }) => ![...positions.values()].some((position) => same(position, to)));
      const moving = free.filter(({ to }) => free.filter((other) => same(other.to, to)).length === 1);
      for (const { mover, to } of open) {
        if (moving.some((entry) => entry.mover === mover) || flagged.has(mover.heroId)) continue;
        const occupant = [...positions].find(([, position]) => same(position, to))?.[0];
        const rival = free.find((other) => other.mover !== mover && same(other.to, to))?.mover.heroId;
        flagged.set(mover.heroId, { heroId: mover.heroId, tick, destination: mover.destination, blockedBy: (occupant ?? rival)! });
      }
      for (const { mover, to } of moving) positions.set(mover.heroId, to);
      active = moving.map(({ mover }) => mover);
    }
    collisions.push(...flagged.values());
  }
  return collisions;
}
