// The spacing of the Hand fan: a pure function of the space the fan has and the number of cards, so that the part of
// every card that is visible (its grab strip) stays big enough for a finger.

export const CARD_WIDTH = 88;
/** A strip, and with it a card, never gets narrower than this (CSS pixels). */
export const MIN_STRIP = 44;
/** The space the fan may use next to the Squad panel and the Energy orb on a landscape phone. */
export const FAN_WIDTH = 270;

export interface FanSpacing {
  /** Width of one card. */
  cardWidth: number;
  /** Distance between the left edges of neighbouring cards: the grab strip of every card but the last. */
  step: number;
  /** Width of the whole fan; it can exceed the available space when even 44 px strips do not fit (the strips win). */
  width: number;
}

/**
 * Cards keep their full width while the strips are wide enough; when the space is short, the strips shrink down to
 * `MIN_STRIP` and then the cards get smaller. The last card is wholly visible, so its width is its strip.
 */
export function fanSpacing(available: number, cards: number): FanSpacing {
  if (cards <= 1) return { cardWidth: CARD_WIDTH, step: CARD_WIDTH, width: CARD_WIDTH };
  const gaps = cards - 1;
  const step = Math.min(CARD_WIDTH, Math.max(MIN_STRIP, (available - CARD_WIDTH) / gaps));
  const cardWidth = Math.min(CARD_WIDTH, Math.max(MIN_STRIP, available - gaps * step));
  return { cardWidth, step, width: gaps * step + cardWidth };
}

/** The position in the Hand whose visible strip contains `x` (measured from the left edge of the fan). */
export function cardAtX(spacing: FanSpacing, cards: number, x: number): number {
  return Math.max(0, Math.min(cards - 1, Math.floor(x / spacing.step)));
}
