import { REACTOR_DECK, type Grid, type GridPosition } from "game-core";
import type { Rect } from "./card-drag";
import { footprintCorners, gridToWorld, pickWallAt, TILE_HEIGHT, TILE_WIDTH, VIEW_ANGLE, worldToGrid } from "./terrain";

// Pure layout of the isometric board: camera, zoom and pan, and what a tap picks.
// The terrain shapes and the projection are in terrain.ts.

export { gridToWorld, TILE_HEIGHT, TILE_WIDTH, worldToGrid };

/** Height of the tallest standing piece, drawn upwards from its tile's bottom vertex; the camera keeps it in view. */
const PROP_HEIGHT = 128;
/** Share of the view left empty on each side of the board. */
const CAMERA_MARGIN = 0.03;

export interface Camera {
  scale: number;
  x: number;
  y: number;
}

/** World rectangle covering every tile footprint of the grid plus the height of tall props. */
export function boardBounds(grid: Grid, angle: number = VIEW_ANGLE): { left: number; right: number; top: number; bottom: number } {
  const corners = footprintCorners(grid, angle);
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys) - PROP_HEIGHT, bottom: Math.max(...ys) };
}

/** Scale and offset of the world container so the whole board is shown at a view angle, as large as fits, centred. */
export function computeCamera(viewWidth: number, viewHeight: number, grid: Grid = REACTOR_DECK, angle: number = VIEW_ANGLE): Camera {
  const bounds = boardBounds(grid, angle);
  const boardWidth = bounds.right - bounds.left;
  const boardHeight = bounds.bottom - bounds.top;
  const scale = Math.min(viewWidth / boardWidth, viewHeight / boardHeight) * (1 - 2 * CAMERA_MARGIN);
  return {
    scale,
    x: viewWidth / 2 - ((bounds.left + bounds.right) / 2) * scale,
    y: viewHeight / 2 - ((bounds.top + bounds.bottom) / 2) * scale,
  };
}

/** Hero tap tolerance in tile units: a finger within this distance of a targetable Hero's tile centre picks that Hero, even on a neighbouring tile's edge. */
export const HERO_PICK_TOLERANCE = 0.75;

/**
 * The tile under a world point, or undefined outside the grid. A Wall stands in front of the tiles behind it,
 * so a point on a drawn Wall (top or side faces) picks the Wall's tile (the nearest one wins), not the floor it hides.
 */
export function pickTileAt(x: number, y: number, grid: Grid = REACTOR_DECK, angle: number = VIEW_ANGLE): GridPosition | undefined {
  const wall = pickWallAt(x, y, grid, angle);
  if (wall) return wall;
  // A tile is a unit square in grid space, which is exactly its floor polygon on screen.
  const fraction = worldToGrid(x, y, angle);
  const tile = { col: Math.round(fraction.col) + 0, row: Math.round(fraction.row) + 0 }; // + 0 turns -0 into 0
  const inside = tile.col >= 0 && tile.row >= 0 && tile.col < grid.width && tile.row < grid.height;
  return inside ? tile : undefined;
}

/** Inverse of a camera: a point in view pixels to world pixels. Without a camera, the fitted one. */
export function viewToWorld(
  viewX: number,
  viewY: number,
  viewWidth: number,
  viewHeight: number,
  grid: Grid = REACTOR_DECK,
  camera: Camera = computeCamera(viewWidth, viewHeight, grid),
) {
  return { x: (viewX - camera.x) / camera.scale, y: (viewY - camera.y) / camera.scale };
}

// Zoom and pan: a small pure model on top of the fitted camera; the Pixi code only applies it.

/** Largest zoom, as a multiple of the fitted scale. */
export const MAX_ZOOM = 3;
/** Zoom of the Hero view, as a multiple of the fitted scale. */
export const HERO_ZOOM = 2.5;

export interface CameraView {
  width: number;
  height: number;
  grid?: Grid;
  /** View angle in degrees; the diagonal view when missing. */
  angle?: number;
}

export function fitCamera(view: CameraView): Camera {
  return computeCamera(view.width, view.height, view.grid, view.angle);
}

/** True when the camera is zoomed in past the fitted view (so the board can be panned). */
export function isZoomed(camera: Camera, view: CameraView): boolean {
  return camera.scale > fitCamera(view).scale * 1.001;
}

/**
 * The camera after turning the board from `view.angle` to `toAngle`. Fitted stays fitted; a zoomed camera keeps
 * its zoom (relative to the fitted scale) and the tile in the middle of the view stays in the middle.
 */
export function turnCamera(camera: Camera, view: CameraView, toAngle: number): Camera {
  const from = fitCamera(view);
  const to = fitCamera({ ...view, angle: toAngle });
  if (!isZoomed(camera, view)) return to;
  const centre = worldToGrid((view.width / 2 - camera.x) / camera.scale, (view.height / 2 - camera.y) / camera.scale, view.angle);
  const middle = gridToWorld(centre, toAngle);
  const scale = (camera.scale / from.scale) * to.scale;
  return clampCamera({ scale, x: view.width / 2 - middle.x * scale, y: view.height / 2 - middle.y * scale }, { ...view, angle: toAngle });
}

/** Keeps the scale within fitted..MAX_ZOOM times fitted and the view within the board plus its margin (centred when the board is smaller than the view). */
export function clampCamera(camera: Camera, view: CameraView): Camera {
  return clampCameraIn(camera, view, { left: 0, top: 0, right: view.width, bottom: view.height });
}

/** Like clampCamera, but the board only has to cover `area` (a part of the view) instead of the whole view. */
function clampCameraIn(camera: Camera, view: CameraView, area: Rect): Camera {
  const { width, height, grid = REACTOR_DECK, angle } = view;
  const fitted = computeCamera(width, height, grid, angle);
  const scale = Math.min(Math.max(camera.scale, fitted.scale), fitted.scale * MAX_ZOOM);
  const bounds = boardBounds(grid, angle);
  const marginX = (bounds.right - bounds.left) * CAMERA_MARGIN;
  const marginY = (bounds.bottom - bounds.top) * CAMERA_MARGIN;
  const clampAxis = (offset: number, near: number, far: number, low: number, high: number, margin: number) => {
    const min = far - (high + margin) * scale; // the area's far edge at the board's far edge plus margin
    const max = near - (low - margin) * scale; // the area's near edge at the board's near edge minus margin
    return min > max ? (min + max) / 2 : Math.min(Math.max(offset, min), max);
  };
  return {
    scale,
    x: clampAxis(camera.x, area.left, area.right, bounds.left, bounds.right, marginX),
    y: clampAxis(camera.y, area.top, area.bottom, bounds.top, bounds.bottom, marginY),
  };
}

/** Sets the scale (clamped) so that the world point under the view point stays under it. */
export function zoomAt(camera: Camera, scale: number, viewX: number, viewY: number, view: CameraView): Camera {
  const worldX = (viewX - camera.x) / camera.scale;
  const worldY = (viewY - camera.y) / camera.scale;
  const clamped = clampCamera({ scale, x: camera.x, y: camera.y }, view).scale;
  return clampCamera({ scale: clamped, x: viewX - worldX * clamped, y: viewY - worldY * clamped }, view);
}

/** Moves the board by a view-pixel delta; does nothing at the fitted scale, where the whole board is visible. */
export function panBy(camera: Camera, dx: number, dy: number, view: CameraView): Camera {
  if (!isZoomed(camera, view)) return camera;
  return clampCamera({ ...camera, x: camera.x + dx, y: camera.y + dy }, view);
}

/** The Hero view: HERO_ZOOM times the fitted scale with the world point in the middle of the view (as far as the board allows). */
export function zoomOnPoint(world: { x: number; y: number }, view: CameraView): Camera {
  const scale = fitCamera(view).scale * HERO_ZOOM;
  return clampCamera({ scale, x: view.width / 2 - world.x * scale, y: view.height / 2 - world.y * scale }, view);
}

/**
 * The camera for placing a Move (or another pick of a tile): the Hero and its highlighted tiles, with a margin of one tile,
 * as large as fits into `free` (the part of the view no HUD element covers; the whole view when missing) and within the
 * zoom limits, centred in it. At the border of the board the board edge, not the view edge, ends the camera, so the
 * tiles stay inside `free`.
 */
export function frameMoveCamera(hero: GridPosition, highlights: readonly GridPosition[], view: CameraView, free?: Rect): Camera {
  const area = free ?? { left: 0, top: 0, right: view.width, bottom: view.height };
  const points = [hero, ...highlights].map((tile) => gridToWorld(tile, view.angle));
  const left = Math.min(...points.map((p) => p.x)) - TILE_WIDTH / 2 - TILE_WIDTH;
  const right = Math.max(...points.map((p) => p.x)) + TILE_WIDTH / 2 + TILE_WIDTH;
  const top = Math.min(...points.map((p) => p.y)) - TILE_HEIGHT / 2 - TILE_HEIGHT;
  const bottom = Math.max(...points.map((p) => p.y)) + TILE_HEIGHT / 2 + TILE_HEIGHT;
  // Limit the scale first, so the offset below centres the box at the scale that is really used.
  const wanted = Math.min((area.right - area.left) / (right - left), (area.bottom - area.top) / (bottom - top));
  const scale = clampCamera({ ...fitCamera(view), scale: wanted }, view).scale;
  const centreX = (left + right) / 2;
  const centreY = (top + bottom) / 2;
  const x = (area.left + area.right) / 2 - centreX * scale;
  const y = (area.top + area.bottom) / 2 - centreY * scale;
  return clampCameraIn({ scale, x, y }, view, area);
}

/** Automatic framing of an armed Move: remembers the view to return to, and stops once the player moves the camera by hand. */
export interface MoveFraming {
  restore: Camera;
  automatic: boolean;
}

export function beginMoveFraming(camera: Camera): MoveFraming {
  return { restore: camera, automatic: true };
}

export function takeOverFraming(framing: MoveFraming | undefined): MoveFraming | undefined {
  return framing && { ...framing, automatic: false };
}

/** The camera after the Move is placed or cancelled: the previous view, unless the player has moved the camera since. */
export function endMoveFraming(framing: MoveFraming, current: Camera): Camera {
  return framing.automatic ? framing.restore : current;
}

export type TapTarget = { kind: "hero"; id: string } | { kind: "tile"; tile: GridPosition } | { kind: "none" };

export interface TapCandidates {
  /** Heroes drawn on the board (own, allied and visible enemies). */
  heroes: readonly { id: string; position: GridPosition }[];
  /** Heroes that are valid targets right now. */
  targetableIds: readonly string[];
  /** Tiles that are valid targets right now. */
  highlights: readonly GridPosition[];
}

/** Smallest finger area, as a radius in CSS pixels on screen, whatever the zoom: Heroes and highlighted tiles count as hit within it. */
export const MIN_TOUCH_RADIUS = 22;

/** Distance from a point to a convex polygon (0 inside). */
function distanceToPolygon(point: { x: number; y: number }, corners: readonly { x: number; y: number }[]): number {
  let inside = true;
  let nearest = Infinity;
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const along = Math.min(Math.max(((point.x - a.x) * ex + (point.y - a.y) * ey) / (ex * ex + ey * ey), 0), 1);
    nearest = Math.min(nearest, Math.hypot(point.x - (a.x + along * ex), point.y - (a.y + along * ey)));
    if (ex * (point.y - a.y) - ey * (point.x - a.x) < 0) inside = false;
  });
  return inside ? 0 : nearest;
}

/**
 * What a tap at a world point selects: a valid target Hero within tolerance first, then a valid tile, then any Hero on the picked tile,
 * and last the nearest valid tile within the minimum touch radius. `scale` is the camera scale, which turns that radius into world pixels.
 */
export function resolveTap(
  x: number,
  y: number,
  { heroes, targetableIds, highlights }: TapCandidates,
  grid: Grid = REACTOR_DECK,
  angle: number = VIEW_ANGLE,
  scale = 1,
): TapTarget {
  const point = worldToGrid(x, y, angle);
  const touchRadius = MIN_TOUCH_RADIUS / scale;
  let nearest: { id: string; distance: number } | undefined;
  for (const hero of heroes) {
    if (!targetableIds.includes(hero.id)) continue;
    const gridDistance = Math.hypot(point.col - hero.position.col, point.row - hero.position.row);
    const centre = gridToWorld(hero.position, angle);
    const pixelDistance = Math.hypot(x - centre.x, y - centre.y);
    if (gridDistance > HERO_PICK_TOLERANCE && pixelDistance > touchRadius) continue;
    // Rank by the distance in world pixels, which is what the finger sees.
    if (!nearest || pixelDistance < nearest.distance) nearest = { id: hero.id, distance: pixelDistance };
  }
  if (nearest) return { kind: "hero", id: nearest.id };
  // A highlighted tile is a valid target, so its floor diamond wins over a Wall sprite whose rectangle also covers the point.
  const floor = { col: Math.round(point.col) + 0, row: Math.round(point.row) + 0 };
  if (highlights.some((h) => h.col === floor.col && h.row === floor.row)) return { kind: "tile", tile: floor };
  const tile = pickTileAt(x, y, grid, angle);
  if (tile) {
    if (highlights.some((h) => h.col === tile.col && h.row === tile.row)) return { kind: "tile", tile };
    const hero = heroes.find((h) => h.position.col === tile.col && h.position.row === tile.row);
    if (hero) return { kind: "hero", id: hero.id };
  }
  return nearestHighlight(x, y, highlights, touchRadius, angle);
}

/** The highlighted tile whose floor is nearest to the point, if within the radius (world pixels). */
function nearestHighlight(x: number, y: number, highlights: readonly GridPosition[], radius: number, angle: number): TapTarget {
  let best: { tile: GridPosition; distance: number } | undefined;
  for (const tile of highlights) {
    const corners = [
      { col: tile.col - 0.5, row: tile.row - 0.5 },
      { col: tile.col + 0.5, row: tile.row - 0.5 },
      { col: tile.col + 0.5, row: tile.row + 0.5 },
      { col: tile.col - 0.5, row: tile.row + 0.5 },
    ].map((corner) => gridToWorld(corner, angle));
    // Corners run clockwise on screen or not depending on the angle; the inside test needs one winding.
    const distance = Math.min(distanceToPolygon({ x, y }, corners), distanceToPolygon({ x, y }, [...corners].reverse()));
    if (distance <= radius && (!best || distance < best.distance)) best = { tile, distance };
  }
  return best ? { kind: "tile", tile: best.tile } : { kind: "none" };
}
