import type { Point, Rect } from "./card-drag";
import { FAN_WIDTH } from "./hand-fan";

// Pure layout of the HUD against the board (issue 185): which part of the view no HUD element covers, and where the
// card sheet goes. The numbers mirror styles.css; the tests keep the two honest through the rectangles below.

export interface ViewSize {
  width: number;
  height: number;
}

/** What the HUD shows: everything (idle), the card sheet over it, or the collapsed HUD while a target is picked. */
export type HudState = { kind: "idle" } | { kind: "sheet"; sheet: Rect } | { kind: "picking" };

interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Idle: Queue window with the squad chips top left, enemy panel top right, commit column and zoom buttons right, hand fan bottom left. */
const IDLE_INSETS: Insets = { left: 231, right: 136, top: 30, bottom: 136 };
/** Picking: the Queue slots with name pills and the hand chip at the left, the enemy pills, zoom buttons and Commit at the right. */
const PICKING_INSETS: Insets = { left: 140, right: 136, top: 30, bottom: 6 };

const SHEET_GAP = 6;

function inside(view: ViewSize, insets: Insets): Rect {
  return { left: insets.left, top: insets.top, right: view.width - insets.right, bottom: view.height - insets.bottom };
}

/** The part of the view, in CSS pixels, that no HUD element covers in the given HUD state. */
export function freeBoardArea(view: ViewSize, state: HudState): Rect {
  if (state.kind === "picking") return inside(view, PICKING_INSETS);
  const idle = inside(view, IDLE_INSETS);
  return state.kind === "sheet" ? { ...idle, top: Math.max(idle.top, state.sheet.bottom + SHEET_GAP) } : idle;
}

// The HUD elements the card sheet and the camera must keep clear of, as the layout in styles.css puts them.

/** The hand fan and the Energy orb next to it. */
export function handRect(view: ViewSize): Rect {
  return { left: 6, top: view.height - 4 - 126, right: 6 + 40 + 4 + FAN_WIDTH, bottom: view.height - 4 };
}

/** The Commit button with the hint above it. */
export function commitRect(view: ViewSize): Rect {
  return { left: view.width - 6 - 110, top: view.height - 6 - 44 - 3 - 56, right: view.width - 6, bottom: view.height - 6 };
}

/** The turn, Lines and zoom buttons at the right edge. */
export function zoomColumnRect(view: ViewSize): Rect {
  return { left: view.width - 66, top: view.height / 2 - 90, right: view.width, bottom: view.height / 2 + 150 };
}

const SHEET_HEIGHT = 112;
const SHEET_TOP = 34;
/** The sheet keeps a clear space around the Hero: its tile plus the figure standing on it. */
const HERO_CLEARANCE = { x: 20, above: 70, below: 24 };
/** Space kept free at the right edge for the zoom and rotate buttons. */
const ZOOM_COLUMN_WIDTH = 70;

/**
 * The card sheet: at most 45 % of the width and the height of its 2 x 2 buttons, in the top strip at the left or the right
 * (over the Queue window or the enemy panel, which are not needed while a use is chosen), on the side the selected Hero
 * (a screen point) is not on.
 */
export function cardSheetRect(view: ViewSize, hero: Point | undefined): Rect {
  const width = Math.min(view.width * 0.45, 320);
  const rect = (left: number): Rect => ({ left, top: SHEET_TOP, right: left + width, bottom: SHEET_TOP + SHEET_HEIGHT });
  const left = rect(6);
  const right = rect(view.width - ZOOM_COLUMN_WIDTH - width);
  if (!hero) return right;
  const covers = (sheet: Rect) =>
    hero.x >= sheet.left - HERO_CLEARANCE.x &&
    hero.x <= sheet.right + HERO_CLEARANCE.x &&
    hero.y >= sheet.top - HERO_CLEARANCE.below &&
    hero.y <= sheet.bottom + HERO_CLEARANCE.above;
  if (covers(right) !== covers(left)) return covers(right) ? left : right;
  // Both or neither cover the Hero: take the one whose middle is farther from it.
  const distance = (sheet: Rect) => Math.abs((sheet.left + sheet.right) / 2 - hero.x);
  return distance(left) > distance(right) ? left : right;
}
