import type { Rect } from "./card-drag";
import { FAN_WIDTH } from "./hand-fan";

// Pure layout of the HUD against the board (issue 185): which part of the view no HUD element covers. The numbers
// mirror styles.css and were measured in the running app; e2e/hud-overlap.e2e.ts reads the real DOM at three view sizes
// and fails when two elements intersect, which keeps these constants honest.

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
const IDLE_INSETS: Insets = { left: 0, right: 136, top: 42, bottom: 116 };
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

// The HUD elements as the layout in styles.css puts them (without the safe-area insets). Elements that bleed off the
// bottom edge are cut at the view.

/** Planning, or the Resolution with its bar across the top. */
export type HudPhase = "planning" | "resolution";

const BAR_HEIGHT = 28;
const PILL_HEIGHT = 34;
/** Planning: the pills sit at the top edge; during the Resolution they step below the bar. */
const PILL_TOP = { planning: 4, resolution: BAR_HEIGHT + 4 };
const PRIME_PILL_WIDTH = 200;
/** "ROUND 1 LOCKED" during the Resolution is the wider text. */
const TIMER_PILL_WIDTH = { planning: 143, resolution: 167 };

export function barRect(view: ViewSize): Rect {
  return { left: 0, top: 0, right: view.width, bottom: BAR_HEIGHT };
}

export function primePillRect(view: ViewSize, phase: HudPhase): Rect {
  const left = (view.width - PRIME_PILL_WIDTH) / 2;
  return { left, top: PILL_TOP[phase], right: left + PRIME_PILL_WIDTH, bottom: PILL_TOP[phase] + PILL_HEIGHT };
}

export function timerPillRect(view: ViewSize, phase: HudPhase): Rect {
  return { left: view.width - 8 - TIMER_PILL_WIDTH[phase], top: PILL_TOP[phase], right: view.width - 8, bottom: PILL_TOP[phase] + PILL_HEIGHT };
}

const COMMENTARY_ENTRY_HEIGHT = 36;
const COMMENTARY_GAP = 4;
const MAX_ENTRIES = 4;

/** The commentary column below the bar and the pills, with the most entries it shows. */
export function commentaryRect(): Rect {
  return { left: 8, top: PILL_TOP.resolution + PILL_HEIGHT + 4, right: 244, bottom: PILL_TOP.resolution + PILL_HEIGHT + 4 + MAX_ENTRIES * COMMENTARY_ENTRY_HEIGHT + (MAX_ENTRIES - 1) * COMMENTARY_GAP };
}

/** The Deck pile with the Discard and Exile counts (12 px) stacked above it (63 px wide, 115 px tall). */
const PILES_WIDTH = 63;
const PILES_HEIGHT = 115;
const ENERGY_PILL_HEIGHT = 26;
/** The Hand peeks 62 px out of the bottom edge; the outer cards of the fan are rotated and reach about 8 px above that line. */
const HAND_PEEK = 62;
/** Between the Energy pill and the peek line: at least 8 px of it stays clear above the rotated card tops. */
const ENERGY_GAP = 14;
const HAND_LEFT = 6 + PILES_WIDTH + 6;

export function pilesRect(view: ViewSize): Rect {
  return { left: 6, top: view.height - PILES_HEIGHT, right: 6 + PILES_WIDTH, bottom: view.height };
}

/** The Energy pill: right of the piles, above the top left of the fan, clear of the rotated cards. */
export function energyRect(view: ViewSize): Rect {
  const bottom = view.height - HAND_PEEK - ENERGY_GAP;
  return { left: HAND_LEFT, top: bottom - ENERGY_PILL_HEIGHT, right: HAND_LEFT + 193, bottom };
}

/** The Energy pill under its older name (touch-targets.test.ts). */
export const energyPillRect = energyRect;

/** The fan itself (the peeking part of the cards); the Energy pill has its own rectangle. */
export function handRect(view: ViewSize): Rect {
  return { left: HAND_LEFT, top: view.height - HAND_PEEK, right: HAND_LEFT + FAN_WIDTH, bottom: view.height };
}

export const QUEUE_COLUMN_WIDTH = 124;
const QUEUE_ROW_HEIGHT = 32;
const QUEUE_GAP = 4;
/** Secondary targets keep 8 px between them. */
const QUEUE_ROW_GAP = 8;
const COMMIT_HEIGHT = 46;

/** The Queue column: `rows` Queue rows, 4 by default and 5 with Forward Deploy; it ends above the Commit pill. */
export function queueRect(view: ViewSize, rows = 4): Rect {
  const bottom = commitButtonRect(view).top - QUEUE_GAP;
  return { left: view.width - 6 - QUEUE_COLUMN_WIDTH, top: bottom - (rows * QUEUE_ROW_HEIGHT + (rows - 1) * QUEUE_ROW_GAP), right: view.width - 6, bottom };
}

export function commitButtonRect(view: ViewSize): Rect {
  return { left: view.width - 6 - QUEUE_COLUMN_WIDTH, top: view.height - 6 - COMMIT_HEIGHT, right: view.width - 6, bottom: view.height - 6 };
}

/** The Commit pill with the Queue column above it: `rows` Queue rows, 4 by default and 5 with Forward Deploy. */
export function commitRect(view: ViewSize, rows = 4): Rect {
  const queue = queueRect(view, rows);
  return { left: queue.left, top: queue.top, right: queue.right, bottom: commitButtonRect(view).bottom };
}

/** The Wait card right of the Hand fan, 12 px away from it (6 px gap and 6 px margin), as big as a Hand card and level with the unrotated centre card. */
export function waitCardRect(view: ViewSize): Rect {
  const left = handRect(view).right + 12;
  return { left, top: view.height - HAND_PEEK, right: left + 108, bottom: view.height };
}
