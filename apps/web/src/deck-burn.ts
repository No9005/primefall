// The Deck Damage animation (issue 203): each card that leaves the Deck lifts off the pile and burns away into the Exile.

/** One card burns for 900 ms; the cards of one hit follow each other 400 ms apart, after the Hero's hit reaction. */
export const BURN_MS = 900;
export const BURN_STAGGER_MS = 400;
export const BURN_START_DELAY_MS = 300;

/** When card number `order` lifts off the Deck pile and when it has burned into the Exile, in ms from the hit. */
export function burnSchedule(order: number): { lift: number; burned: number } {
  const lift = BURN_START_DELAY_MS + order * BURN_STAGGER_MS;
  return { lift, burned: lift + BURN_MS };
}

/** A hit that removes `cards` cards from the Deck of a Hero; batches wait in line so one burn starts after the other. */
export interface BurnBatch {
  kind: "burn";
  id: number;
  heroId: string;
  cards: number;
}

/** Cards of a Hero that have not yet lifted off the Deck pile or not yet burned into the Exile. */
export interface BurnPending {
  unlifted: Record<string, number>;
  unburned: Record<string, number>;
}

export const NO_BURN_PENDING: BurnPending = { unlifted: {}, unburned: {} };

/** The cards of a hit are added to the pending cards of their Hero. */
export function addBurn(pending: BurnPending, heroId: string, cards: number): BurnPending {
  return {
    unlifted: { ...pending.unlifted, [heroId]: (pending.unlifted[heroId] ?? 0) + cards },
    unburned: { ...pending.unburned, [heroId]: (pending.unburned[heroId] ?? 0) + cards },
  };
}

/** One card of the Hero has lifted off the Deck pile or has burned into the Exile. */
export function settleBurn(pending: BurnPending, heroId: string, step: "lifted" | "burned"): BurnPending {
  const key = step === "lifted" ? "unlifted" : "unburned";
  return { ...pending, [key]: { ...pending[key], [heroId]: Math.max(0, (pending[key][heroId] ?? 0) - 1) } };
}

/**
 * The pile counts to show during the playback: `deckAfterDamage` and `exileAfterDamage` already include all Deck
 * Damage of the frames shown so far; cards still on their way count with their old pile.
 */
export function shownBurnCounts(deckAfterDamage: number, exileAfterDamage: number, pending: BurnPending, heroId: string): { deck: number; exile: number } {
  return {
    deck: deckAfterDamage + (pending.unlifted[heroId] ?? 0),
    exile: exileAfterDamage - (pending.unburned[heroId] ?? 0),
  };
}
