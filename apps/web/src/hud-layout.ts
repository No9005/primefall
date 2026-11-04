import type { Rect } from "./card-drag";
import { FAN_WIDTH } from "./hand-fan";

// Pure layout of the HUD against the board (issue 185): which part of the view no HUD element covers. The numbers
// mirror styles.css; the tests keep the two honest through the rectangles below.

export interface ViewSize {
  width: number;
  height: number;
}

/** What the HUD shows: everything (idle), or the collapsed HUD while a target is picked. */
export type HudState = { kind: "idle" } | { kind: "picking" };

interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Idle: the timer and score pills on top, the Queue column and Commit at the right, the piles, Energy pill and the peeking Hand at the bottom. */
const IDLE_INSETS: Insets = { left: 0, right: 136, top: 42, bottom: 100 };
/** Picking: the Hand slides away; the Queue column and Commit stay at the right, the pills on top. */
const PICKING_INSETS: Insets = { left: 0, right: 136, top: 42, bottom: 6 };

function inside(view: ViewSize, insets: Insets): Rect {
  return { left: insets.left, top: insets.top, right: view.width - insets.right, bottom: view.height - insets.bottom };
}

/** The part of the view, in CSS pixels, that no HUD element covers in the given HUD state. */
export function freeBoardArea(view: ViewSize, state: HudState): Rect {
  if (state.kind === "picking") return inside(view, PICKING_INSETS);
  return inside(view, IDLE_INSETS);
}

// The HUD elements the camera must keep clear of, as the layout in styles.css puts them.

const PILES_WIDTH = 66;

const ENERGY_PILL_HEIGHT = 26;

/** The Hand peeks 62 px out of the bottom edge (the cost badges stick out above the cards) with the Energy pill right above it; the piles are taller. */
const HAND_PEEK = 62;
export function handRect(view: ViewSize): Rect {
  return { left: 6, top: view.height - HAND_PEEK - 2 - ENERGY_PILL_HEIGHT, right: 6 + PILES_WIDTH + 6 + FAN_WIDTH, bottom: view.height };
}

export const QUEUE_COLUMN_WIDTH = 124;
const QUEUE_ROW_HEIGHT = 28;
const QUEUE_GAP = 4;
const COMMIT_HEIGHT = 46;

/** The Commit pill with the Queue column above it: `rows` Queue rows, 4 by default and 5 with Forward Deploy. */
export function commitRect(view: ViewSize, rows = 4): Rect {
  const queueHeight = rows * QUEUE_ROW_HEIGHT + (rows - 1) * QUEUE_GAP;
  return {
    left: view.width - 6 - QUEUE_COLUMN_WIDTH,
    top: view.height - 6 - COMMIT_HEIGHT - QUEUE_GAP - queueHeight,
    right: view.width - 6,
    bottom: view.height - 6,
  };
}

/** The Wait card right of the Hand fan, 12 px away from it, peeking like the Hand. */
export function waitCardRect(view: ViewSize): Rect {
  const fanRight = handRect(view).right;
  return { left: fanRight + 12, top: view.height - 62, right: fanRight + 12 + 108, bottom: view.height };
}
