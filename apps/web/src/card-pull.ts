import { type CardDefinition, type CardIndex } from "game-core";
import type { Point } from "./card-drag";
import { CardUse } from "./planning-selection";

// Pulling a card out of the Hand (issue 201): press lifts it, pulling it up shows the faces (one per use), and a
// face chosen by tap or drop picks the use. This module is the state machine; the component only draws it.

/** One use of a card as a face: the four uses and, on cards that have one, Overdrive. */
export type Face = CardUse | "overdrive";

/** How far (CSS pixels) a pressed card must be dragged up before the faces appear. */
export const PULL_THRESHOLD = 28;

export type PullState =
  /** No card is held. */
  | { phase: "idle" }
  /** The finger is down on a card: it is shown big, the others dim. */
  | { phase: "pressed"; card: CardIndex; origin: Point }
  /** The card is dragged up out of the Hand: the faces are shown and the card floats under the finger. */
  | { phase: "pulled"; card: CardIndex; origin: Point }
  /** The finger is up after a tap: the faces stay until one is tapped or the player taps elsewhere. */
  | { phase: "open"; card: CardIndex };

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
  return state.phase === "pulled" || state.phase === "open";
}

export function press(card: CardIndex, origin: Point): PullState {
  return { phase: "pressed", card, origin };
}

/** The faces open without a gesture (a click from the keyboard). */
export function openCard(card: CardIndex): PullState {
  return { phase: "open", card };
}

/**
 * The finger moved. `handTop` is the top edge of the Hand (screen y): dragging back down to it puts the card back
 * into the fan.
 */
export function move(state: PullState, point: Point, handTop: number): PullState {
  if (state.phase === "pressed" && state.origin.y - point.y > PULL_THRESHOLD) return { ...state, phase: "pulled" };
  if (state.phase === "pulled" && point.y >= handTop) return IDLE;
  return state;
}

/** The finger lifted over `face` (a face under it, if any). */
export function release(state: PullState, face: Face | undefined): PullResult {
  switch (state.phase) {
    case "pressed":
      return { state: { phase: "open", card: state.card } };
    case "pulled":
      return face === undefined ? { state: IDLE } : { state: IDLE, chosen: { card: state.card, face } };
    default:
      return { state };
  }
}

/** A tap while the faces stay open: a face chooses its use, anything else puts the card back. */
export function tap(state: PullState, face: Face | undefined): PullResult {
  if (state.phase !== "open") return { state };
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
 * "Not enough Energy". Pitch is always available.
 */
export function faceViews(
  card: CardDefinition,
  reasons: Record<CardUse, string | undefined>,
  overdriveReason: string | undefined,
  texts: { primary: string; overdrive: string | undefined },
): FaceView[] {
  const readable = (reason: string | undefined) => (reason?.startsWith("needs ") && reason.endsWith(" Energy") ? NOT_ENOUGH_ENERGY : reason);
  const faces: FaceView[] = [
    { face: CardUse.Primary, title: "Primary", effect: texts.primary, cost: card.energyCost, reason: readable(reasons[CardUse.Primary]) },
    { face: CardUse.Pitch, title: "Pitch +1 Energy", effect: "Adds 1 Energy", reason: reasons[CardUse.Pitch] },
    { face: CardUse.Move, title: "Move 2", effect: "Move up to 2 tiles", reason: reasons[CardUse.Move] },
    { face: CardUse.Block, title: "Block 2", effect: "Shield 2", reason: reasons[CardUse.Block] },
  ];
  if (texts.overdrive !== undefined) {
    faces.push({ face: "overdrive", title: "Overdrive", effect: texts.overdrive, cost: card.energyCost, reason: readable(overdriveReason) });
  }
  return faces;
}
