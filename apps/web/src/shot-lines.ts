import { CoverKind, type EnemyView, type Grid, type GridPosition, shotLine, Visibility } from "game-core";
import type { Point } from "./card-drag";
import { gridToWorld, TILE_HEIGHT } from "./terrain";

// The line of fire drawn while aiming. The decision (hit, Cover, where the shot is blocked) is `shotLine` of
// game-core; this module only turns it into world points, from the same projection as the terrain and the tokens.

export enum SegmentStyle {
  /** A shot that can be fired: dashed teal. */
  Clear = "clear",
  /** The part of the line up to the blocking Wall or the end of the Range: dotted red. */
  Stopped = "stopped",
  /** The continuation after a block, grey. */
  Beyond = "beyond",
}

export interface ShotSegment {
  from: Point;
  to: Point;
  style: SegmentStyle;
}

export interface ShotDrawing {
  targetId: string;
  segments: ShotSegment[];
  /** Where a shot is blocked (a ✕ is drawn there); missing for a clear shot and an out of Range one. */
  cross?: Point;
  /** The Cover tile on the board that protects the target, when it has Cover against this attacker. */
  coverTile?: GridPosition;
  coverKind: CoverKind;
  /** The target is ringed in red: Range and Line of Sight are satisfied. */
  ringed: boolean;
}

/** Where on a Hero the line starts and ends: the chest, above the foot of the token. */
const CHEST_LIFT = TILE_HEIGHT * 0.7;

function chestOf(tile: GridPosition): Point {
  const { x, y } = gridToWorld(tile);
  // Tokens stand on the lower edge of their tile diamond.
  return { x, y: y + TILE_HEIGHT / 2 - CHEST_LIFT };
}

const floorOf = (tile: GridPosition): Point => gridToWorld(tile);

/** The drawing of one shot. Pure: no state, same input gives the same lines. */
export function drawShot(grid: Grid, attacker: GridPosition, target: { id: string; position: GridPosition }, range: number): ShotDrawing {
  const line = shotLine(grid, attacker, target.position, range);
  const start = chestOf(attacker);
  const end = chestOf(target.position);
  const base = { targetId: target.id, coverKind: line.cover, ringed: line.canHit && line.cover !== CoverKind.Full };
  const cover = line.cover === CoverKind.None ? {} : { coverTile: target.position };
  const stop = line.blockedAt ? { at: floorOf(line.blockedAt), blocked: true } : line.rangeEnd ? { at: floorOf(line.rangeEnd), blocked: false } : undefined;
  if (!stop) return { ...base, ...cover, segments: [{ from: start, to: end, style: SegmentStyle.Clear }] };
  // The blocking tile is lifted to chest height so the cross sits on the line.
  const at = { x: stop.at.x, y: stop.at.y + TILE_HEIGHT / 2 - CHEST_LIFT };
  return {
    ...base,
    ...cover,
    cross: stop.blocked ? at : undefined,
    segments: [
      { from: start, to: at, style: SegmentStyle.Stopped },
      { from: at, to: end, style: SegmentStyle.Beyond },
    ],
  };
}

/**
 * The shots to draw at the given enemies. Only Visible enemies get a line: an Unknown enemy has no position the
 * Squad may know, and a Ghost is not a target of a shot.
 */
export function drawShots(
  grid: Grid,
  attacker: GridPosition,
  range: number,
  enemies: readonly EnemyView[],
  targetIds: readonly string[],
): ShotDrawing[] {
  return enemies.flatMap((enemy) =>
    enemy.visibility === Visibility.Visible && targetIds.includes(enemy.id) ? [drawShot(grid, attacker, enemy, range)] : [],
  );
}
