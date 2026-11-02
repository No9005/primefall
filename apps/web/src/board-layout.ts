import { REACTOR_DECK, type Grid, type GridPosition } from "game-core";
import { gridToWorld, TILE_HEIGHT, TILE_WIDTH, pickWallAt } from "./terrain";

// Pure layout of the isometric board: camera, zoom and pan, and what a tap picks.
// The terrain shapes and the projection are in terrain.ts.

export { gridToWorld, TILE_HEIGHT, TILE_WIDTH };

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
export function boardBounds({ width, height }: Grid): { left: number; right: number; top: number; bottom: number } {
  return {
    left: gridToWorld({ col: 0, row: height - 1 }).x - TILE_WIDTH / 2,
    right: gridToWorld({ col: width - 1, row: 0 }).x + TILE_WIDTH / 2,
    top: gridToWorld({ col: 0, row: 0 }).y + TILE_HEIGHT / 2 - PROP_HEIGHT,
    bottom: gridToWorld({ col: width - 1, row: height - 1 }).y + TILE_HEIGHT / 2,
  };
}

/** Scale and offset of the world container so the whole board is shown, as large as fits, centred. */
export function computeCamera(viewWidth: number, viewHeight: number, grid: Grid = REACTOR_DECK): Camera {
  const bounds = boardBounds(grid);
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

/** Tile units (col, row as fractions) under a world point; the inverse of `gridToWorld`. */
export function worldToGrid(x: number, y: number): { col: number; row: number } {
  const a = x / (TILE_WIDTH / 2);
  const b = y / (TILE_HEIGHT / 2);
  return { col: (a + b) / 2, row: (b - a) / 2 };
}

/**
 * The tile under a world point, or undefined outside the grid. A Wall stands in front of the tiles behind it,
 * so a point on a drawn Wall (top or side faces) picks the Wall's tile (the nearest one wins), not the floor it hides.
 */
export function pickTileAt(x: number, y: number, grid: Grid = REACTOR_DECK): GridPosition | undefined {
  const wall = pickWallAt(x, y, grid);
  if (wall) return wall;
  // A tile is a unit square in grid space, which is exactly the diamond on screen.
  const fraction = worldToGrid(x, y);
  const tile = { col: Math.round(fraction.col), row: Math.round(fraction.row) };
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
}

export function fitCamera(view: CameraView): Camera {
  return computeCamera(view.width, view.height, view.grid);
}

/** True when the camera is zoomed in past the fitted view (so the board can be panned). */
export function isZoomed(camera: Camera, { width, height, grid }: CameraView): boolean {
  return camera.scale > computeCamera(width, height, grid).scale * 1.001;
}

/** Keeps the scale within fitted..MAX_ZOOM times fitted and the view within the board plus its margin (centred when the board is smaller than the view). */
export function clampCamera(camera: Camera, view: CameraView): Camera {
  const { width, height, grid = REACTOR_DECK } = view;
  const fitted = computeCamera(width, height, grid);
  const scale = Math.min(Math.max(camera.scale, fitted.scale), fitted.scale * MAX_ZOOM);
  const bounds = boardBounds(grid);
  const marginX = (bounds.right - bounds.left) * CAMERA_MARGIN;
  const marginY = (bounds.bottom - bounds.top) * CAMERA_MARGIN;
  const clampAxis = (offset: number, viewSize: number, low: number, high: number, margin: number) => {
    const min = viewSize - (high + margin) * scale; // the view's far edge at the board's far edge plus margin
    const max = -(low - margin) * scale; // the view's near edge at the board's near edge minus margin
    return min > max ? (min + max) / 2 : Math.min(Math.max(offset, min), max);
  };
  return {
    scale,
    x: clampAxis(camera.x, width, bounds.left, bounds.right, marginX),
    y: clampAxis(camera.y, height, bounds.top, bounds.bottom, marginY),
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
  const scale = computeCamera(view.width, view.height, view.grid).scale * HERO_ZOOM;
  return clampCamera({ scale, x: view.width / 2 - world.x * scale, y: view.height / 2 - world.y * scale }, view);
}

/**
 * The camera for placing a Move: the Hero and its highlighted tiles, with a margin of one tile, as large as fits
 * and within the zoom limits. At the border of the board the clamp keeps the camera legal.
 */
export function frameMoveCamera(hero: GridPosition, highlights: readonly GridPosition[], view: CameraView): Camera {
  const points = [hero, ...highlights].map(gridToWorld);
  const left = Math.min(...points.map((p) => p.x)) - TILE_WIDTH / 2 - TILE_WIDTH;
  const right = Math.max(...points.map((p) => p.x)) + TILE_WIDTH / 2 + TILE_WIDTH;
  const top = Math.min(...points.map((p) => p.y)) - TILE_HEIGHT / 2 - TILE_HEIGHT;
  const bottom = Math.max(...points.map((p) => p.y)) + TILE_HEIGHT / 2 + TILE_HEIGHT;
  // Limit the scale first, so the offset below centres the box at the scale that is really used.
  const scale = clampCamera({ ...fitCamera(view), scale: Math.min(view.width / (right - left), view.height / (bottom - top)) }, view).scale;
  const centreX = (left + right) / 2;
  const centreY = (top + bottom) / 2;
  return clampCamera({ scale, x: view.width / 2 - centreX * scale, y: view.height / 2 - centreY * scale }, view);
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

/** What a tap at a world point selects: a valid target Hero within tolerance first, then a valid tile, then any Hero on the picked tile. */
export function resolveTap(x: number, y: number, { heroes, targetableIds, highlights }: TapCandidates, grid: Grid = REACTOR_DECK): TapTarget {
  const point = worldToGrid(x, y);
  let nearest: { id: string; distance: number } | undefined;
  for (const hero of heroes) {
    if (!targetableIds.includes(hero.id)) continue;
    const distance = Math.hypot(point.col - hero.position.col, point.row - hero.position.row);
    if (distance <= HERO_PICK_TOLERANCE && (!nearest || distance < nearest.distance)) nearest = { id: hero.id, distance };
  }
  if (nearest) return { kind: "hero", id: nearest.id };
  // A highlighted tile is a valid target, so its floor diamond wins over a Wall sprite whose rectangle also covers the point.
  const floor = { col: Math.round(point.col), row: Math.round(point.row) };
  if (highlights.some((h) => h.col === floor.col && h.row === floor.row)) return { kind: "tile", tile: floor };
  const tile = pickTileAt(x, y, grid);
  if (!tile) return { kind: "none" };
  if (highlights.some((h) => h.col === tile.col && h.row === tile.row)) return { kind: "tile", tile };
  const hero = heroes.find((h) => h.position.col === tile.col && h.position.row === tile.row);
  return hero ? { kind: "hero", id: hero.id } : { kind: "none" };
}
