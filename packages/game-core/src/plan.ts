// Squad Plans and planning-time validation (ADR 0013, ADR 0020). Shared with clients: a plan is plain
// data, and `validatePlan` lets the UI explain why a plan cannot be committed. The host validates again.

import { type CardIndex, cardInMode, CardTarget, EffectKind, HERO_DECKS, type HeroClass, isPlayableCard } from "./cards";
import { type SquadId, type SquadView, Visibility } from "./host";
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
  /** A card's primary effect; it costs the card's Energy. Simple damage Attacks and Shield Utility cards resolve so far. */
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
  /**
   * Id of the Hero the card is aimed at: an enemy Hero for an Attack (Range and Line of Sight are checked
   * when it resolves), this Hero or an allied Hero for a Utility card.
   */
  target: string;
  /** For a card aimed at a tile (Breach Charge): the tile; `target` is then the casting Hero. */
  tile?: GridPosition;
  /** Play the card's Overdrive instead of its standard effect; the card is then Exiled (ADR 0003). */
  overdrive?: boolean;
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
        } else if (card.target === CardTarget.Tile) {
          // Range and Line of Sight are checked when the card resolves, like for any Attack.
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
