import { ActionKind, findMoveCollisions, type GridPosition, type HeroView, type MoveCollision, type SquadPlan } from "game-core";

// The planned Moves of the own Squad drawn on the board before Commit. Only own Heroes are read: the
// functions take `HeroView`s and plans, never enemy data. A path is kept in tiles, so it does not depend on the
// view angle; the board draws it through the same projection as the shot line.

export enum PathOwner {
  /** A Hero the AI plans for: yellow. */
  Ally = "ally",
  /** The Hero the player plans: teal. */
  Player = "player",
}

export interface PathStop {
  tile: GridPosition;
  /** The Tick of the Move action (1-based). */
  tick: number;
}

export interface PlannedPath {
  heroId: string;
  owner: PathOwner;
  /** The first letter of the Hero's role, shown in the destination marker. */
  letter: string;
  /** The tile the Hero stands on; the line starts here. */
  from: GridPosition;
  /** The destination of each queued Move, in order. */
  stops: PathStop[];
}

/** The paths of the own Heroes that have at least one Move queued; plan entries of other Heroes are ignored. */
export function plannedPaths(heroes: readonly HeroView[], plans: readonly SquadPlan[], playerHeroId: string): PlannedPath[] {
  return plans.flatMap((plan) =>
    plan.heroes.flatMap(({ heroId, queue }) => {
      const hero = heroes.find((candidate) => candidate.id === heroId);
      const stops = queue.flatMap((action, index) =>
        action.kind === ActionKind.Move ? [{ tile: action.destination, tick: index + 1 }] : [],
      );
      if (!hero || hero.exhausted || stops.length === 0) return [];
      const owner = heroId === playerHeroId ? PathOwner.Player : PathOwner.Ally;
      return [{ heroId, owner, letter: hero.heroClass.charAt(0).toUpperCase(), from: hero.position, stops }];
    }),
  );
}

/** The warnings for the Squad's combined plan, and the text the Queue shows for a Hero's own Move. */
export function collisionWarnings(heroes: readonly HeroView[], plans: readonly SquadPlan[], names: Record<string, string>) {
  const collisions: MoveCollision[] = findMoveCollisions(heroes, plans);
  return {
    collisions,
    textFor: (heroId: string, tick: number): string | undefined => {
      const found = collisions.find((collision) => collision.heroId === heroId && collision.tick === tick);
      return found && `Collides with ${names[found.blockedBy] ?? "an ally"} at Tick ${found.tick}`;
    },
  };
}
