import { REACTOR_DECK, TileKind, type Grid, type GridPosition } from "game-core";

// Pure layout of the isometric board: which sprite goes where and in what depth order.
// 2:1 projection with 128 x 64 px tiles (asset contract, skill isometric-grid-math).

export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

/** Height of the tallest prop sprite (Wall, 128 px), drawn upwards from its tile's bottom vertex. */
const PROP_HEIGHT = 128;
/** Share of the view left empty on each side of the board. */
const CAMERA_MARGIN = 0.03;

export enum Layer {
  Floor = "floor",
  Object = "object",
}

/** Asset manifest aliases the board draws (asset contract); always refer to them by member. */
export enum AssetAlias {
  Floor01 = "tiles.floor_01",
  Floor02 = "tiles.floor_02",
  FloorDamaged01 = "tiles.floor_damaged_01",
  ReactorFloor01 = "tiles.reactor_floor_01",
  ReactorEdge01 = "tiles.reactor_edge_01",
  SpawnMarker01 = "tiles.spawn_marker_01",
  Wall01 = "props.wall_01",
  CoverFull01 = "props.cover_full_01",
  CoverHalf01 = "props.cover_half_01",
  OverwatchNest01 = "props.overwatch_nest_01",
}

export interface Placement {
  alias: AssetAlias;
  /** Bottom vertex of the tile footprint in world pixels; every sprite is anchored there. */
  x: number;
  y: number;
  /** Floor sprites share one layer; objects (walls, Cover, Nest) sort by depth inside theirs. */
  layer: Layer;
  depth: number;
}

/** Centre of a tile in world pixels. */
export function gridToWorld({ col, row }: GridPosition): { x: number; y: number } {
  return { x: ((col - row) * TILE_WIDTH) / 2, y: ((col + row) * TILE_HEIGHT) / 2 };
}

const PROP_ALIASES: Partial<Record<TileKind, AssetAlias>> = {
  [TileKind.Wall]: AssetAlias.Wall01,
  [TileKind.FullCover]: AssetAlias.CoverFull01,
  [TileKind.HalfCover]: AssetAlias.CoverHalf01,
  [TileKind.OverwatchNest]: AssetAlias.OverwatchNest01,
};

function floorAlias(kind: TileKind, { col, row }: GridPosition, nextToZone: boolean): AssetAlias {
  if (kind === TileKind.PrimeZone) return AssetAlias.ReactorFloor01;
  if (kind === TileKind.Spawn) return AssetAlias.SpawnMarker01;
  if (kind === TileKind.Floor && nextToZone) return AssetAlias.ReactorEdge01;
  if ((col * 7 + row * 3) % 11 === 0) return AssetAlias.FloorDamaged01;
  return (col + row) % 2 === 0 ? AssetAlias.Floor01 : AssetAlias.Floor02;
}

function isNextToPrimeZone(grid: Grid, { col, row }: GridPosition): boolean {
  for (let dRow = -1; dRow <= 1; dRow++)
    for (let dCol = -1; dCol <= 1; dCol++) {
      if (grid.tiles[row + dRow]?.[col + dCol] === TileKind.PrimeZone) return true;
    }
  return false;
}

export function buildPlacements(grid: Grid): Placement[] {
  const placements: Placement[] = [];
  grid.tiles.forEach((line, row) =>
    line.forEach((kind, col) => {
      const position = { col, row };
      const { x, y } = gridToWorld(position);
      const bottom = y + TILE_HEIGHT / 2;
      const depth = col + row;
      placements.push({ alias: floorAlias(kind, position, isNextToPrimeZone(grid, position)), x, y: bottom, layer: Layer.Floor, depth });
      const prop = PROP_ALIASES[kind];
      if (prop) placements.push({ alias: prop, x, y: bottom, layer: Layer.Object, depth });
    }),
  );
  return placements;
}

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
 * so a point on a Wall sprite picks the Wall's tile (the nearest one wins), not the floor it hides.
 */
export function pickTileAt(x: number, y: number, grid: Grid = REACTOR_DECK): GridPosition | undefined {
  let wall: (GridPosition & { depth: number; offset: number }) | undefined;
  grid.tiles.forEach((line, row) =>
    line.forEach((kind, col) => {
      if (kind !== TileKind.Wall) return;
      const { x: tx, y: ty } = gridToWorld({ col, row });
      const bottom = ty + TILE_HEIGHT / 2;
      const offset = Math.abs(x - tx);
      const onSprite = offset < TILE_WIDTH / 2 && y <= bottom && y >= bottom - PROP_HEIGHT;
      // The nearest Wall wins; of two equally near ones, the one the point is horizontally closer to.
      if (onSprite && (!wall || col + row > wall.depth || (col + row === wall.depth && offset < wall.offset)))
        wall = { col, row, depth: col + row, offset };
    }),
  );
  if (wall) return { col: wall.col, row: wall.row };
  // A tile is a unit square in grid space, which is exactly the diamond on screen.
  const fraction = worldToGrid(x, y);
  const tile = { col: Math.round(fraction.col), row: Math.round(fraction.row) };
  const inside = tile.col >= 0 && tile.row >= 0 && tile.col < grid.width && tile.row < grid.height;
  return inside ? tile : undefined;
}

/** Inverse of `computeCamera`: a point in view pixels to world pixels. */
export function viewToWorld(viewX: number, viewY: number, viewWidth: number, viewHeight: number, grid: Grid = REACTOR_DECK) {
  const camera = computeCamera(viewWidth, viewHeight, grid);
  return { x: (viewX - camera.x) / camera.scale, y: (viewY - camera.y) / camera.scale };
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
