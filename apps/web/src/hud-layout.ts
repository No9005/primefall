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

/** Idle: Queue window with the squad chips top left, enemy panel top right, commit column and zoom buttons right, hand fan bottom left. */
const IDLE_INSETS: Insets = { left: 231, right: 200, top: 30, bottom: 150 };
/** Picking: the Queue slots with name pills and the hand chip at the left, the enemy pills, zoom buttons and Commit at the right. */
const PICKING_INSETS: Insets = { left: 140, right: 200, top: 30, bottom: 6 };

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

/** The piles, the hand fan (146 px high: the cost badges stick out above the cards) and the Energy pill above it. */
export function handRect(view: ViewSize): Rect {
  return { left: 6, top: view.height - 4 - 146 - 2 - ENERGY_PILL_HEIGHT, right: 6 + PILES_WIDTH + 6 + FAN_WIDTH, bottom: view.height - 4 };
}

export const QUEUE_COLUMN_WIDTH = 124;
const QUEUE_ROW_HEIGHT = 28;
const QUEUE_GAP = 4;
const COMMIT_HEIGHT = 46;

/** The enemy panel top right: three rows, at most about 150 px high. */
export function enemyPanelRect(view: ViewSize): Rect {
  return { left: view.width - 6 - 124, top: 6, right: view.width - 6, bottom: 6 + 150 };
}

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

/** The Wait card right of the Hand fan, 12 px away from it. */
export function waitCardRect(view: ViewSize): Rect {
  const fanRight = handRect(view).right;
  return { left: fanRight + 12, top: view.height - 4 - 134, right: fanRight + 12 + 108, bottom: view.height - 4 };
}

/** The turn, Zoom and Lines buttons, a column left of the Queue column, stacked from 26 px below the top. */
export function zoomColumnRect(view: ViewSize): Rect {
  return { left: view.width - 188, top: 26, right: view.width - 136, bottom: 232 };
}

