import type { GridPosition } from "game-core";
import { gridToWorld } from "./terrain";

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
export function facingAfterStep(from: GridPosition, to: GridPosition, current: Facing): Facing {
  const dx = gridToWorld(to).x - gridToWorld(from).x;
  // Rounded so that float noise of a step straight up the screen does not turn the Hero.
  if (Math.abs(dx) < 1e-6) return current;
  return dx < 0 ? "left" : "right";
}

/** A Hero that is on the board: where it stands and which Squad it is in. */
export interface FacingHero {
  position: GridPosition;
  enemy: boolean;
}

/**
 * Updates the remembered facings for one playback frame. A Step turns the Hero the way it walks; an aimed Attack turns the
 * attacker towards its target (from the tile it stands on to the tile of the target). Either one lasts until the next.
 * `walks` holds the tile each walking Hero came from, `aims` the target of each attacker that has exactly one.
 */
export function turnHeroes(
  facings: Map<string, Facing>,
  frame: { walks: Readonly<Record<string, GridPosition>>; aims: Readonly<Record<string, string>> },
  heroOf: (heroId: string) => FacingHero | undefined,
): void {
  for (const [id, from] of Object.entries(frame.walks)) {
    const hero = heroOf(id);
    if (hero) facings.set(id, facingAfterStep(from, hero.position, facings.get(id) ?? baseFacing(hero.enemy)));
  }
  for (const [id, targetId] of Object.entries(frame.aims)) {
    const hero = heroOf(id);
    const target = heroOf(targetId);
    if (hero && target) facings.set(id, facingAfterStep(hero.position, target.position, facings.get(id) ?? baseFacing(hero.enemy)));
  }
}
