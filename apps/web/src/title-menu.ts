// The layout and the highlight of the title screen's menu (the design canvas "title screen with fireballs"). The stage is a
// picture of 960 x 444 design pixels; every position here is in them, and the screen turns them into percentages.

/** The size of the title stage in design pixels (the art is drawn at 640 x 296 and shown at 1.5 times). */
export const STAGE = { width: 960, height: 444 } as const;

export type MenuId = "classic" | "attack-and-defend" | "glossary" | "resume";

export interface MenuSlot {
  /** The area a press counts for, and the height of the picture of the row inside it (centred). */
  top: number;
  height: number;
  art: number;
}

/**
 * The four rows of the menu from the top: the first, the default mode, is the big one. A row is pressed in `height` design pixels
 * (50 are 44 px on a phone of 844 x 390, so that a thumb does not miss it) but the pictures stand closer than that: the picture of
 * a row is `art` high, centred in its area, and the areas of two rows overlap a little (the lower row wins there). The text is a
 * fifth smaller than the pictures are drawn. The first row starts well under the line "Every Prime is a contract".
 */
export const MENU_SLOTS: readonly [MenuSlot, MenuSlot, MenuSlot, MenuSlot] = [
  { top: 232, height: 52, art: 48 },
  { top: 282, height: 50, art: 34 },
  { top: 324, height: 50, art: 34 },
  { top: 366, height: 50, art: 34 },
];

/**
 * The entries from the top: Start (the classic mode), the Glossary, and Resume when a match was saved. Attack and Defend is out of
 * the menu for now; `?menu=all` brings its row back between Start and the Glossary (the tests and the screenshots use it).
 */
export function menuIds(canResume: boolean, withAttackAndDefend = false): MenuId[] {
  const ids: MenuId[] = withAttackAndDefend ? ["classic", "attack-and-defend", "glossary"] : ["classic", "glossary"];
  return canResume ? [...ids, "resume"] : ids;
}

/** The highlight moves on by itself, row after row, until the player touches the menu. */
export const nextRow = (row: number, rows: number): number => (row + 1) % rows;

/** How long the highlight stays on one row while it moves by itself. */
export const AUTO_STEP_MS = 1600;

/** The red light streak runs through the middle of the highlighted row. */
export function streakTop(slot: MenuSlot): number {
  return slot.top + slot.height / 2 - 3;
}

/** A fireball falls from the top right onto the planet, bursts on the atmosphere, and starts again after its period. */
export interface Fireball {
  /** Left and top of the fireball at the end of its fall, in design pixels. */
  left: number;
  top: number;
  /** The seconds of one round and the seconds before the first one: five rounds with different periods, so the rhythm never repeats. */
  period: number;
  delay: number;
}

export const FIREBALLS: readonly Fireball[] = [
  { left: 192, top: 333, period: 9, delay: 1 },
  { left: 312, top: 306, period: 12, delay: 4 },
  { left: 462, top: 297, period: 7.5, delay: 2.5 },
  { left: 597, top: 309, period: 10, delay: 6.5 },
  { left: 717, top: 337, period: 14, delay: 0.5 },
];

/** The burst sits at the foot of its fireball. */
export const BURST_OFFSET = { left: -27, top: 62 } as const;

export const percentX = (x: number): string => `${(x / STAGE.width) * 100}%`;
export const percentY = (y: number): string => `${(y / STAGE.height) * 100}%`;
