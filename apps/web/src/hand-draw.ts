import type { CardIndex } from "game-core";

// The draw animation (issue 202): at the start of a Round the cards that were drawn fly from the Deck pile into the
// Hand, one after the other. Which cards those are follows from the Hand of the previous Round and the current one.

/** How long one card flies from the Deck pile to its slot, and how long the next one waits after the previous one starts. */
export const DRAW_FLIGHT_MS = 450;
export const DRAW_STAGGER_MS = 200;

/**
 * The cards of `hand` that were not in the Hand of the previous Round, in Hand order. Without a previous Hand (the
 * start of the match) every card is new. A card played and drawn again within one Round counts as a card that stayed.
 */
export function newCards(previousHand: readonly CardIndex[] | undefined, hand: readonly CardIndex[]): CardIndex[] {
  if (previousHand === undefined) return [...hand];
  return hand.filter((card) => !previousHand.includes(card));
}

/** When card number `order` (0 for the first) starts to fly and when it has landed, in ms from the start of the draw. */
export function drawSchedule(order: number): { start: number; landed: number } {
  const start = order * DRAW_STAGGER_MS;
  return { start, landed: start + DRAW_FLIGHT_MS };
}

/** The Deck count shown on the pile: the cards that have not left it yet are still counted. */
export function shownDeckCount(deckCount: number, drawnCards: number, departed: number): number {
  return deckCount + Math.max(0, drawnCards - departed);
}
