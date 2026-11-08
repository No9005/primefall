import { type CardDefinition, type CardIndex } from "game-core";
import type { Point } from "./card-drag";
import { CardUse } from "./planning-selection";

// Pulling a card out of the Hand (issue 201): press lifts it, pulling it up shows the faces (one per use), and a
// face chosen by tap or drop picks the use. This module is the state machine; the component only draws it.

/** One use of a card as a face: the four uses and, on cards that have one, Overdrive. */
export type Face = CardUse | "overdrive";

/** How far (CSS pixels) a pressed card must be moved before it counts as a drag (canvas board O). */
export const PULL_THRESHOLD = 14;
/** The faces start to show this far (CSS pixels) above the top edge of the Hand and are fully there another REVEAL_SPAN higher. */
export const REVEAL_START = 28;
export const REVEAL_SPAN = 90;
/** A release above this share of the viewport height (board O: 250 of 390) parks the card; a lower one puts it back. */
export const MIDDLE_LINE = 250 / 390;

export type PullState =
  /** No card is held. */
  | { phase: "idle" }
  /** The finger is down on a card: it is shown big, the others dim. */
  | { phase: "pressed"; card: CardIndex; origin: Point }
  /** The card is dragged out of the Hand: it floats under the finger and the faces fade in with its height. */
  | { phase: "pulled"; card: CardIndex; origin: Point; point: Point }
  /** The finger is up (after a tap, or a release above the middle line): the faces stay open until one is tapped or the card is put back. */
  | { phase: "parked"; card: CardIndex };

export const IDLE: PullState = { phase: "idle" };

export interface PullResult {
  state: PullState;
  /** The use that was chosen by this step; the card leaves the Hand fan and the use goes on. */
  chosen?: { card: CardIndex; face: Face };
}

/** The card held in any phase, if there is one. */
export function heldCard(state: PullState): CardIndex | undefined {
  return state.phase === "idle" ? undefined : state.card;
}

/** Whether the faces are shown. */
export function showsFaces(state: PullState): boolean {
  return state.phase === "pulled" || state.phase === "parked";
}

export function press(card: CardIndex, origin: Point): PullState {
  return { phase: "pressed", card, origin };
}

/** The faces open without a gesture (a click from the keyboard). */
export function openCard(card: CardIndex): PullState {
  return { phase: "parked", card };
}

/** How much of the faces shows (0 to 1) for a finger at screen height `y`, given the top edge of the Hand. */
export function faceReveal(y: number, handTop: number): number {
  return Math.max(0, Math.min(1, (handTop - REVEAL_START - y) / REVEAL_SPAN));
}

/** The finger moved: past the threshold the card is pulled out and follows the finger. */
export function move(state: PullState, point: Point): PullState {
  if (state.phase === "pressed" && Math.hypot(point.x - state.origin.x, point.y - state.origin.y) > PULL_THRESHOLD) {
    return { phase: "pulled", card: state.card, origin: state.origin, point };
  }
  if (state.phase === "pulled") return { ...state, point };
  return state;
}

/**
 * The finger lifted over `face` (a face under it, if any); `middle` is the screen height of the middle line. A tap
 * parks the card; after a drag, a face under the finger is chosen, otherwise a release above the middle line parks
 * the card and a lower one puts it back.
 */
export function release(state: PullState, face: Face | undefined, middle: number): PullResult {
  switch (state.phase) {
    case "pressed":
      return { state: { phase: "parked", card: state.card } };
    case "pulled":
      if (face !== undefined) return { state: IDLE, chosen: { card: state.card, face } };
      return { state: state.point.y < middle ? { phase: "parked", card: state.card } : IDLE };
    default:
      return { state };
  }
}

/** A tap while the card is parked: a face chooses its use, anything else puts the card back. */
export function tap(state: PullState, face: Face | undefined): PullResult {
  if (state.phase !== "parked") return { state };
  return face === undefined ? { state: IDLE } : { state: IDLE, chosen: { card: state.card, face } };
}

/** The press was cancelled (the pointer was taken over): the card goes back. */
export function cancel(): PullState {
  return IDLE;
}

export interface FaceView {
  face: Face;
  title: string;
  effect: string;
  /** The Energy cost the face shows (Primary and Overdrive only). */
  cost?: number;
  /** Why the face cannot be chosen; the face is greyed and shows it in red. */
  reason?: string;
}

const NOT_ENOUGH_ENERGY = "Not enough Energy";

/**
 * The faces of a card in order. `reasons` are the reasons of the existing planning selection for the Primary, Move
 * and Block uses, and `overdriveReason` the one for the Overdrive; a reason that is only about Energy is shown as
 * "Not enough Energy". Pitch is always available; Block only when the mode has it.
 */
export function faceViews(
  card: CardDefinition,
  reasons: Record<CardUse, string | undefined>,
  overdriveReason: string | undefined,
  texts: { primary: string; overdrive: string | undefined },
  blockAllowed: boolean,
): FaceView[] {
  const readable = (reason: string | undefined) => (reason?.startsWith("needs ") && reason.endsWith(" Energy") ? NOT_ENOUGH_ENERGY : reason);
  const faces: FaceView[] = [
    { face: CardUse.Primary, title: "Primary", effect: texts.primary, cost: card.energyCost, reason: readable(reasons[CardUse.Primary]) },
    { face: CardUse.Pitch, title: "Pitch +1 Energy", effect: "Adds 1 Energy", reason: reasons[CardUse.Pitch] },
    { face: CardUse.Move, title: "Move 2", effect: "Move up to 2 tiles", reason: reasons[CardUse.Move] },
  ];
  // Block is a rule of Attack and Defend; the classic mode takes Shield from Shield cards.
  if (blockAllowed) faces.push({ face: CardUse.Block, title: "Block 2", effect: "Shield 2", reason: reasons[CardUse.Block] });
  if (texts.overdrive !== undefined) {
    faces.push({ face: "overdrive", title: "Overdrive", effect: texts.overdrive, cost: card.energyCost, reason: readable(overdriveReason) });
  }
  return faces;
}
