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
 * The four rows of the menu from the top: the first, the default mode, is the big one. The small rows are 50 design pixels
 * high, which is 44 px on a phone of 844 x 390, so that a thumb does not miss them; their picture is 42 high.
 */
export const MENU_SLOTS: readonly [MenuSlot, MenuSlot, MenuSlot, MenuSlot] = [
  { top: 207, height: 60, art: 60 },
  { top: 268, height: 50, art: 42 },
  { top: 318, height: 50, art: 42 },
  { top: 368, height: 50, art: 42 },
];

/** The entries from the top; a saved match adds Resume as the last row. */
export function menuIds(canResume: boolean): MenuId[] {
  return canResume ? ["classic", "attack-and-defend", "glossary", "resume"] : ["classic", "attack-and-defend", "glossary"];
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
