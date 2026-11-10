import type { GridPosition } from "game-core";
import { gridToWorld, VIEW_ANGLE } from "./terrain";

/** The way a Hero faces on the screen. */
export type Facing = "left" | "right";

/** Own Heroes face right and enemy Heroes face left until they walk. */
export function baseFacing(enemy: boolean): Facing {
  return enemy ? "left" : "right";
}

/**
 * The facing of a Hero after a Step from one tile to another: the screen direction of the step. A step that does not move
 * the Hero sideways on the screen (straight up or down it) keeps the current facing.
 */
export function facingAfterStep(from: GridPosition, to: GridPosition, current: Facing, angle: number = VIEW_ANGLE): Facing {
  const dx = gridToWorld(to, angle).x - gridToWorld(from, angle).x;
  // Rounded so that float noise of a step straight up the screen does not turn the Hero.
  if (Math.abs(dx) < 1e-6) return current;
  return dx < 0 ? "left" : "right";
}
