// Squad Plans and planning-time validation (ADR 0013, ADR 0020). Shared with clients: a plan is plain
// data, and `validatePlan` lets the UI explain why a plan cannot be committed. The host validates again.

import { type CardIndex, HERO_DECKS, type HeroClass, isSimpleAttack } from "./cards";
import type { SquadId, SquadView } from "./host";
import { type Grid, type GridPosition, REACTOR_DECK, TileKind, tileAt } from "./reactor-deck";

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
  /** A card's primary effect; it costs the card's Energy. Only simple damage Attacks resolve so far. */
  Primary = "primary",
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
  /** Id of the enemy Hero the Attack is aimed at. Range and Line of Sight are checked when it resolves. */
  target: string;
}

/** Actions are a union that grows with the card uses. */
export type QueuedAction = MoveAction | BlockAction | PrimaryAction;

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
export function moveDestinations(from: GridPosition, grid: Grid = REACTOR_DECK): GridPosition[] {
  const found: GridPosition[] = [];
  for (let row = from.row - MOVE_DISTANCE; row <= from.row + MOVE_DISTANCE; row++) {
    for (let col = from.col - MOVE_DISTANCE; col <= from.col + MOVE_DISTANCE; col++) {
      const kind = tileAt(grid, { col, row });
      if (kind !== undefined && kind !== TileKind.Wall && chebyshevDistance(from, { col, row }) > 0) {
        found.push({ col, row });
      }
    }
  }
  return found;
}

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
    for (const action of queue) {
      useCard(action.card);
      if (action.kind === ActionKind.Primary) {
        const card = HERO_DECKS[hero.heroClass][action.card];
        if (!card || !isSimpleAttack(card)) {
          issues.push({ kind: PlanIssueKind.UnplayableCard, heroId, message: "This card's effect cannot be played yet." });
        } else if (!view.enemies.some((enemy) => enemy.id === action.target && !enemy.exhausted)) {
          issues.push({ kind: PlanIssueKind.BadTarget, heroId, message: "An Attack needs an enemy Hero as its target." });
        }
      }
      if (action.kind !== ActionKind.Move) continue;
      const reachable = moveDestinations(position).some(
        (tile) => tile.col === action.destination.col && tile.row === action.destination.row,
      );
      if (!reachable) {
        issues.push({ kind: PlanIssueKind.BadDestination, heroId, message: "Move 2 needs a free destination 1 or 2 tiles away." });
      }
      position = action.destination;
    }
  }
  return issues;
}
