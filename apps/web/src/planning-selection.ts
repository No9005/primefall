import { type CardIndex, energyPool, HERO_DECKS, type HeroClass, MAX_QUEUE_LENGTH, type QueuedAction, queueEnergyCost } from "game-core";

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
    [CardUse.Primary]: queueFull ?? (cost > available ? `needs ${cost} Energy` : "effects are not playable yet"),
    [CardUse.Pitch]: undefined,
    [CardUse.Move]: queueFull,
    [CardUse.Block]: queueFull,
  };
}
