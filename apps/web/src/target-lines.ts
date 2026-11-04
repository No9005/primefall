import {
  ActionKind,
  type CardDefinition,
  CardTarget,
  cardInMode,
  chebyshevDistance,
  CoverKind,
  type EnemyView,
  EventKind,
  type Grid,
  type GridPosition,
  HERO_DECKS,
  type HeroView,
  type MatchEvent,
  type QueuedAction,
  type SquadPlan,
  Visibility,
} from "game-core";
import { drawShot, type ShotDrawing, SegmentStyle } from "./shot-lines";

// Who targets whom: a line from a Hero to the target of each queued action (planning) and of each resolved action
// (replay). Everything is pure and kept in tiles, so the board draws it through the same projection as the terrain.
// Only data of the Squad View is read: the plans passed in are the own Squad's, an Unknown enemy never gets a line.

export enum LineKind {
  /** A shot at an enemy Hero or a Ghost, drawn like the line of fire of an Attack. */
  Attack = "attack",
  /** A card effect on an allied Hero: teal, with an arrow head. */
  Ally = "ally",
  /** A card effect on a tile (Breach Charge, Scout Drone, Deploy Cover, the destination of Forward Deploy): ends in a ring. */
  Tile = "tile",
}

export enum LineTone {
  /** The action can reach its target: teal. */
  Clear = "clear",
  /** The shot is blocked by a Wall or out of Range, or an enemy acts: red. */
  Red = "red",
}

export interface TargetLine {
  /** The Hero that acts. */
  heroId: string;
  /** Belongs to the Squad's own Heroes (as opposed to an enemy shown in the replay). */
  own: boolean;
  kind: LineKind;
  tone: LineTone;
  /** The Tick of the action (1-based). */
  tick: number;
  from: GridPosition;
  to: GridPosition;
  /** For an Attack: the drawing of the shot with its block, cross and Cover tile. */
  shot?: ShotDrawing;
  /** A line of a queued action (planning), as opposed to one of the replay. */
  planned?: boolean;
  /** Planned Attack that cannot reach its target from the planned position: out of Range or no Line of Sight. */
  unreachable?: boolean;
  /** Set with `unreachable`: why the shot may miss from the planned position. A hint only; Commit is never blocked by it. */
  missHint?: string;
  /** An allied Hero's plan: drawn very faint in yellow, without badge or ring. */
  faint?: boolean;
}

const NO_RANGE_LIMIT = Number.MAX_SAFE_INTEGER;

const ENEMY_TARGETS = [CardTarget.VisibleEnemy, CardTarget.EnemyInSight, CardTarget.GhostEnemy];
const ALLY_TARGETS = [CardTarget.AllyHero, CardTarget.AllyHeroTile];
const TILE_TARGETS = [CardTarget.Tile, CardTarget.EmptyTile, CardTarget.Area];

/** The enemy Hero a line may end on: Visible, or a Ghost at its last known tile; never an Unknown one. */
function knownEnemy(enemies: readonly EnemyView[], id: string): { id: string; position: GridPosition } | undefined {
  const enemy = enemies.find((candidate) => candidate.id === id);
  return enemy && enemy.visibility !== Visibility.Unknown ? { id, position: enemy.position } : undefined;
}

/**
 * The note for a shot that cannot hit from the planned position (a Declared Target is only checked in the Tick it
 * fires, so this is a hint, not an error). It judges the target's last known position.
 */
export function mayMissHint(from: GridPosition, target: GridPosition, range: number): string {
  return chebyshevDistance(from, target) > range
    ? "may miss: out of Range from the planned position"
    : "may miss: no clear shot from the planned position";
}

/** Where a Hero stands when action `index` resolves: at its last queued Move destination before it (up to the Move's reach). */
function positionBefore(hero: HeroView, queue: readonly QueuedAction[], index: number): GridPosition {
  const moves = queue.slice(0, index).flatMap((action) => (action.kind === ActionKind.Move ? [action.destination] : []));
  return moves.at(-1) ?? hero.position;
}

function linesOfAction(
  grid: Grid,
  hero: HeroView,
  from: GridPosition,
  action: QueuedAction,
  tick: number,
  heroes: readonly HeroView[],
  enemies: readonly EnemyView[],
): TargetLine[] {
  if (action.kind !== ActionKind.Primary) return [];
  const card: CardDefinition = cardInMode(HERO_DECKS[hero.heroClass][action.card]!, action.overdrive);
  const base = { heroId: hero.id, own: true, tick };
  if (ENEMY_TARGETS.includes(card.target)) {
    const target = knownEnemy(enemies, action.target);
    if (!target) return [];
    const shot = drawShot(grid, from, target, card.range ?? NO_RANGE_LIMIT);
    const clear = shot.segments.every((segment) => segment.style === SegmentStyle.Clear) && shot.ringed;
    const missHint = clear ? undefined : mayMissHint(from, target.position, card.range ?? NO_RANGE_LIMIT);
    return [{ ...base, kind: LineKind.Attack, tone: clear ? LineTone.Clear : LineTone.Red, from, to: target.position, shot, unreachable: !clear, missHint }];
  }
  if (ALLY_TARGETS.includes(card.target)) {
    const ally = heroes.find((candidate) => candidate.id === action.target);
    if (!ally || ally.id === hero.id) return action.tile && ally ? [tileLine(base, from, action.tile)] : [];
    const toAlly: TargetLine = { ...base, kind: LineKind.Ally, tone: LineTone.Clear, from, to: ally.position };
    // Forward Deploy: the allied Hero then moves towards the tile.
    return action.tile ? [toAlly, tileLine(base, ally.position, action.tile)] : [toAlly];
  }
  if (TILE_TARGETS.includes(card.target) && action.tile) return [tileLine(base, from, action.tile)];
  return [];
}

function tileLine(base: Pick<TargetLine, "heroId" | "own" | "tick">, from: GridPosition, to: GridPosition): TargetLine {
  return { ...base, kind: LineKind.Tile, tone: LineTone.Clear, from, to };
}

/**
 * The lines of the queued actions of the own Squad's plans, numbered with their Tick. Plans of other Heroes than the
 * Squad's own are ignored, as are Move and Block actions (a Move's path is drawn elsewhere).
 */
export function plannedTargetLines(
  grid: Grid,
  heroes: readonly HeroView[],
  enemies: readonly EnemyView[],
  plans: readonly SquadPlan[],
): TargetLine[] {
  return plans.flatMap((plan) =>
    plan.heroes.flatMap(({ heroId, queue }) => {
      const hero = heroes.find((candidate) => candidate.id === heroId);
      if (!hero || hero.exhausted) return [];
      return queue.flatMap((action, index) =>
        linesOfAction(grid, hero, positionBefore(hero, queue, index), action, index + 1, heroes, enemies).map((line) => ({ ...line, planned: true })),
      );
    }),
  );
}

/**
 * The lines of the actions that resolved in one playback frame. `positionOf` tells where a Hero stands at that moment.
 * Own Heroes always show their lines (the Squad knows its own actions and targets only if it may see them); an enemy's
 * line shows only when that enemy is Visible, and is red. An action on a target the Squad has no position for is skipped.
 */
export function replayTargetLines(
  events: readonly MatchEvent[],
  heroes: readonly HeroView[],
  enemies: readonly EnemyView[],
  positionOf: (heroId: string) => GridPosition | undefined,
): TargetLine[] {
  const ownIds = new Set(heroes.map((hero) => hero.id));
  return events.flatMap((event): TargetLine[] => {
    const own = ownIds.has(event.heroId);
    const actor = positionOf(event.heroId);
    if (!actor) return [];
    if (!own && enemies.find((enemy) => enemy.id === event.heroId)?.visibility !== Visibility.Visible) return [];
    const base = { heroId: event.heroId, own, tick: event.tick };
    const tone = (clear: boolean) => (own && clear ? LineTone.Clear : LineTone.Red);
    switch (event.kind) {
      case EventKind.CoverDestroyed:
      case EventKind.CoverPlaced:
      case EventKind.AreaRevealed:
        return event.to ? [{ ...base, kind: LineKind.Tile, tone: tone(true), from: actor, to: event.to }] : [];
      case EventKind.AttackHit:
      case EventKind.AttackFailed:
      case EventKind.SlowApplied:
      case EventKind.MarkedApplied: {
        const target = event.targetId ? positionOf(event.targetId) : undefined;
        if (!event.targetId || !target || (!ownIds.has(event.targetId) && !knownEnemy(enemies, event.targetId))) return [];
        const failed = event.kind === EventKind.AttackFailed;
        const shot: ShotDrawing = {
          targetId: event.targetId,
          segments: [{ from: actor, to: target, style: failed ? SegmentStyle.Stopped : SegmentStyle.Clear }],
          ...(failed ? { cross: target } : {}),
          coverKind: CoverKind.None,
          ringed: !failed,
        };
        return [{ ...base, kind: LineKind.Attack, tone: tone(!failed), from: actor, to: target, shot }];
      }
      default:
        return [];
    }
  });
}
