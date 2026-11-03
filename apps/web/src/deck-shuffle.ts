// The shuffle animation (issue 204): the Discard flies over to the Deck pile and is riffled into it twice.

/** The whole animation; styles.css (`shuffle-card`) has the same timeline in percent. */
export const SHUFFLE_MS = 1900;
/** With reduced motion there is no riffle, only a short highlight of the numbers. */
export const SHUFFLE_CALM_MS = 400;
/** At most this many card backs are shown, however many cards are really shuffled. */
export const SHUFFLE_MAX_CARDS = 6;

/** Milliseconds from the start: the stack has arrived at the Deck pile, then each riffle splits it and merges it again. */
export const SHUFFLE_TIMELINE = {
  arrived: 500,
  riffles: [
    { split: 850, merged: 1200 },
    { split: 1550, merged: 1900 },
  ],
} as const;

/** How many card backs the stack shows for `amount` shuffled cards. */
export function shuffleStackSize(amount: number): number {
  return Math.min(SHUFFLE_MAX_CARDS, Math.max(0, amount));
}

/** One of the two halves a card of the stack belongs to during a riffle; the halves alternate so they interleave. */
export function riffleSide(index: number): -1 | 1 {
  return index % 2 === 0 ? -1 : 1;
}

/** A shuffle that waits in the queue of pile animations (the same line as the Deck Damage batches). */
export interface ShuffleStep {
  kind: "shuffle";
  id: number;
  heroId: string;
  /** The real number of cards shuffled. */
  cards: number;
}

/** Shuffles of a Hero that have not started yet (the Discard still shows its cards), and the cards still in a shuffle. */
export interface ShufflePending {
  unstarted: Record<string, number>;
  /** Cards in a shuffle that has not ended: the Deck pile does not count them yet. */
  held: Record<string, number>;
}

export const NO_SHUFFLE_PENDING: ShufflePending = { unstarted: {}, held: {} };

export function addShuffle(pending: ShufflePending, heroId: string, cards: number): ShufflePending {
  return {
    unstarted: { ...pending.unstarted, [heroId]: (pending.unstarted[heroId] ?? 0) + 1 },
    held: { ...pending.held, [heroId]: (pending.held[heroId] ?? 0) + cards },
  };
}

/** The shuffle has started (the Discard goes to 0) or has ended (the Deck jumps by the shuffled cards). */
export function settleShuffle(pending: ShufflePending, heroId: string, step: "started" | "ended", cards: number): ShufflePending {
  const count = (record: Record<string, number>, by: number) => ({ ...record, [heroId]: Math.max(0, (record[heroId] ?? 0) - by) });
  return step === "started"
    ? { ...pending, unstarted: count(pending.unstarted, 1) }
    : { ...pending, held: count(pending.held, cards) };
}

/**
 * The Discard count to show: once the playback has reached a shuffle of the Hero, the Discard is 0 from the moment
 * the shuffle starts; until then it keeps its old count.
 */
export function shownDiscardCount(discardCount: number, shuffledSoFar: number, pending: ShufflePending, heroId: string): number {
  if (shuffledSoFar === 0) return discardCount;
  return (pending.unstarted[heroId] ?? 0) > 0 ? discardCount : 0;
}

/** The Deck count to show: the cards that are still in the shuffle are not in the Deck yet. */
export function shownDeckAfterShuffle(deckCount: number, pending: ShufflePending, heroId: string): number {
  return deckCount - (pending.held[heroId] ?? 0);
}

/**
 * The cards shuffled when the Round started: the draw wanted more cards than the Deck had, so the Discard was
 * shuffled in while drawing and the Match State holds no event for it. 0 when the Deck was enough.
 */
export function shuffledWhileDrawing(deckBefore: number, drawn: number, deckAfter: number): number {
  return drawn > deckBefore ? deckAfter + (drawn - deckBefore) : 0;
}
