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
