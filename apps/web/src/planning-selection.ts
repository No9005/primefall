import type { CardIndex, QueuedAction } from "game-core";

export interface PlanningDraft {
  selectedId: string;
  queue: readonly QueuedAction[];
  armed: CardIndex | undefined;
}

/**
 * The Queue belongs to the selected Hero, so selecting another Hero discards it.
 * Selection is locked while the playback runs.
 */
export function selectHero(draft: PlanningDraft, heroId: string, playing: boolean): PlanningDraft {
  if (playing || heroId === draft.selectedId) return draft;
  return { selectedId: heroId, queue: [], armed: undefined };
}
