import { useEffect, useRef } from "react";
import { gameAudio } from "./audio";

// The sounds of the player's own card actions while planning: a card goes into the Queue, a card comes back, Energy is
// gained (a Pitch). They follow the counts, so every way to do it (tap, drop, undo) sounds the same.

export type CardSound = "cardPlayed" | "cardBack" | "energyUp";

export interface PlanCounts {
  /** What the counts belong to (the selected Hero in this Round): another key is not a change the player made. */
  key: string;
  queue: number;
  pitched: number;
}

/** The sounds of a change in the plan: none for the first look, a switch to another Hero or a new Round. */
export function cardSoundsOf(previous: PlanCounts | undefined, next: PlanCounts): CardSound[] {
  if (!previous || previous.key !== next.key) return [];
  const sounds: CardSound[] = [];
  if (next.queue > previous.queue) sounds.push("cardPlayed");
  if (next.queue < previous.queue) sounds.push("cardBack");
  if (next.pitched > previous.pitched) sounds.push("energyUp");
  if (next.pitched < previous.pitched) sounds.push("cardBack");
  return sounds;
}

/** Plays the sounds of the changes in the plan; `silent` (the Resolution runs) only keeps count. */
export function useCardSounds(counts: PlanCounts, silent: boolean): void {
  const previous = useRef<PlanCounts | undefined>(undefined);
  const { key, queue, pitched } = counts;
  useEffect(() => {
    const sounds = silent ? [] : cardSoundsOf(previous.current, { key, queue, pitched });
    previous.current = { key, queue, pitched };
    for (const sound of sounds) gameAudio.playUi(sound);
  }, [key, queue, pitched, silent]);
}
