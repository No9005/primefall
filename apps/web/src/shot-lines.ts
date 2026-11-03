import { CoverKind, type EnemyView, type Grid, type GridPosition, shotLine, Visibility } from "game-core";
import type { Point } from "./card-drag";
import { footOffset, gridToWorld, TILE_HEIGHT, VIEW_ANGLE } from "./terrain";

// The line of fire drawn while aiming. The decision (hit, Cover, where the shot is blocked) is `shotLine` of
// game-core. A drawing is kept in tiles, so it does not depend on the view angle; `shotInWorld` turns it into
// world points with the same projection as the terrain and the tokens, whatever angle the board is turned to.

export enum SegmentStyle {
  /** A shot that can be fired: dashed teal. */
  Clear = "clear",
  /** The part of the line up to the blocking Wall or the end of the Range: dotted red. */
  Stopped = "stopped",
  /** The continuation after a block, grey. */
  Beyond = "beyond",
}

export interface ShotSegment {
  /** The tile the line starts on, drawn at chest height. */
  from: GridPosition;
  to: GridPosition;
  style: SegmentStyle;
}

export interface ShotDrawing {
  targetId: string;
  segments: ShotSegment[];
  /** The tile where a shot is blocked (a ✕ is drawn there); missing for a clear shot and an out of Range one. */
  cross?: GridPosition;
  /** The Cover tile on the board that protects the target, when it has Cover against this attacker. */
  coverTile?: GridPosition;
  coverKind: CoverKind;
  /** The target is ringed in red: Range and Line of Sight are satisfied. */
  ringed: boolean;
}

/** A shot drawing in world pixels at one view angle. */
export interface ShotInWorld {
  segments: { from: Point; to: Point; style: SegmentStyle }[];
  cross?: Point;
}

/** How high above the foot of a Hero the line starts and ends: the chest. */
const CHEST_LIFT = TILE_HEIGHT * 0.7;

/** The chest height above a tile, in world pixels at a view angle. Tokens stand on the lower vertex of their tile. */
export function chestOf(tile: GridPosition, angle: number = VIEW_ANGLE): Point {
  const { x, y } = gridToWorld(tile, angle);
  return { x, y: y + footOffset(angle) - CHEST_LIFT };
}

/** The drawing of one shot. Pure: no state, same input gives the same lines. */
export function drawShot(grid: Grid, attacker: GridPosition, target: { id: string; position: GridPosition }, range: number): ShotDrawing {
  const line = shotLine(grid, attacker, target.position, range);
  const base = { targetId: target.id, coverKind: line.cover, ringed: line.canHit && line.cover !== CoverKind.Full };
  const cover = line.cover === CoverKind.None ? {} : { coverTile: target.position };
  const stop = line.blockedAt ?? line.rangeEnd;
  if (!stop) return { ...base, ...cover, segments: [{ from: attacker, to: target.position, style: SegmentStyle.Clear }] };
  return {
    ...base,
    ...cover,
    cross: line.blockedAt,
    segments: [
      { from: attacker, to: stop, style: SegmentStyle.Stopped },
      { from: stop, to: target.position, style: SegmentStyle.Beyond },
    ],
  };
}

/** The lines and the cross of a drawing as world points at a view angle. */
export function shotInWorld({ segments, cross }: ShotDrawing, angle: number = VIEW_ANGLE): ShotInWorld {
  return {
    segments: segments.map(({ from, to, style }) => ({ from: chestOf(from, angle), to: chestOf(to, angle), style })),
    cross: cross && chestOf(cross, angle),
  };
}

/** The dashes of a straight line: `dash` long runs separated by `gap`, the last one cut at the end of the line. */
export function dashRuns(from: Point, to: Point, dash: number, gap: number): { from: Point; to: Point }[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const at = (distance: number): Point => ({ x: from.x + ((to.x - from.x) * distance) / length, y: from.y + ((to.y - from.y) * distance) / length });
  const runs: { from: Point; to: Point }[] = [];
  for (let start = 0; length > 0 && start < length; start += dash + gap) runs.push({ from: at(start), to: at(Math.min(start + dash, length)) });
  return runs;
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
