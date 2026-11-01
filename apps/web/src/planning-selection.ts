import {
  type CardIndex,
  CoverKind,
  coverAgainst,
  energyPool,
  type GridPosition,
  HALF_COVER_REDUCTION,
  HERO_DECKS,
  type HeroClass,
  isPlayableCard,
  MAX_QUEUE_LENGTH,
  type QueuedAction,
  queueEnergyCost,
  REACTOR_DECK,
} from "game-core";

export interface PlanningDraft {
  selectedId: string;
  queue: readonly QueuedAction[];
  pitched: readonly CardIndex[];
  armed: CardIndex | undefined;
}

/**
 * The Queue and the pitched cards belong to the selected Hero, so selecting another Hero discards them.
 * Selection is locked while the playback runs.
 */
export function selectHero(draft: PlanningDraft, heroId: string, playing: boolean): PlanningDraft {
  if (playing || heroId === draft.selectedId) return draft;
  return { selectedId: heroId, queue: [], pitched: [], armed: undefined };
}

/** What the Cover on a target's tile does against an attacker at `attacker`; `undefined` without protection. */
export function coverProtectionLabel(attacker: GridPosition, target: GridPosition): string | undefined {
  switch (coverAgainst(REACTOR_DECK, attacker, target)) {
    case CoverKind.Full:
      return "Full Cover · cannot be attacked";
    case CoverKind.Half:
      return `Half Cover · damage -${HALF_COVER_REDUCTION}`;
    default:
      return undefined;
  }
}

export enum CardUse {
  Primary = "primary",
  Pitch = "pitch",
  Move = "move",
  Block = "block",
}

export const CARD_USE_LABELS: Record<CardUse, string> = {
  [CardUse.Primary]: "Primary effect",
  [CardUse.Pitch]: "Pitch 1",
  [CardUse.Move]: "Move 2",
  [CardUse.Block]: "Block 2",
};

export interface EnergyReadout {
  pitched: number;
  spent: number;
  available: number;
}

export function energyReadout(heroClass: HeroClass, queue: readonly QueuedAction[], pitched: readonly CardIndex[]): EnergyReadout {
  const total = energyPool(pitched);
  const spent = queueEnergyCost(heroClass, queue);
  return { pitched: total, spent, available: total - spent };
}

/** For each use of a card: `undefined` when it can be chosen, otherwise the reason it is disabled. */
export function cardUseReasons(
  heroClass: HeroClass,
  card: CardIndex,
  queue: readonly QueuedAction[],
  pitched: readonly CardIndex[],
): Record<CardUse, string | undefined> {
  const queueFull = queue.length >= MAX_QUEUE_LENGTH ? "Queue is full" : undefined;
  const cost = HERO_DECKS[heroClass][card]!.energyCost;
  const { available } = energyReadout(heroClass, queue, pitched);
  return {
    [CardUse.Primary]:
      queueFull ??
      (!isPlayableCard(HERO_DECKS[heroClass][card]!)
        ? "effect is not playable yet"
        : cost > available
          ? `needs ${cost} Energy`
          : undefined),
    [CardUse.Pitch]: undefined,
    [CardUse.Move]: queueFull,
    [CardUse.Block]: queueFull,
  };
}
