import { type Grid, type GridPosition, TileKind } from "game-core";
import { PIECE_SHAPE, type PieceStyle, TERRAIN_STYLE } from "./terrain-style";

// The terrain as shapes: the grid and a view angle in, drawing primitives out (floor polygons, and for each
// standing piece its top and two visible side faces). Pure; the Pixi code only fills the polygons.
// 2:1 projection with 128 x 64 px tiles (asset contract, skill isometric-grid-math).

export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

/** The view angle of today's board, in degrees. The rotation ticket only changes this value. */
export const VIEW_ANGLE = 45;

/** Centre of a tile in world pixels at the view angle of `VIEW_ANGLE`. */
export function gridToWorld({ col, row }: GridPosition): { x: number; y: number } {
  return { x: ((col - row) * TILE_WIDTH) / 2, y: ((col + row) * TILE_HEIGHT) / 2 };
}

interface Projection {
  /** Grid fractions and a height in world pixels to a world point. */
  point: (col: number, row: number, lift?: number) => { x: number; y: number };
  /** Distance from the viewer: larger is nearer. */
  depth: (col: number, row: number) => number;
}

/** The board turned from `VIEW_ANGLE` to `angle` about the grid origin; at `VIEW_ANGLE` it is `gridToWorld`. */
function projection(angle: number): Projection {
  const turn = ((angle - VIEW_ANGLE) * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const turned = (col: number, row: number) => ({ col: col * cos - row * sin, row: col * sin + row * cos });
  return {
    point: (col, row, lift = 0) => {
      const t = turned(col, row);
      return { x: ((t.col - t.row) * TILE_WIDTH) / 2, y: ((t.col + t.row) * TILE_HEIGHT) / 2 - lift };
    },
    depth: (col, row) => {
      const t = turned(col, row);
      return t.col + t.row;
    },
  };
}

export enum FaceRole {
  Floor = "floor",
  Top = "top",
  Left = "left",
  Right = "right",
}

export interface Face {
  role: FaceRole;
  /** Flat x, y pairs in world pixels. */
  points: number[];
  fill: number;
  edge: number;
}

export interface TerrainTile {
  position: GridPosition;
  kind: TileKind;
  /** Rotated depth of the tile; larger is nearer the viewer. */
  depth: number;
  floor: Face;
  /** A Spawn marker lying on the floor. */
  marker?: { points: number[]; color: number };
  /** What stands on the tile (Wall, Cover, Overwatch Nest): the two visible sides, then the top, in drawing order. */
  piece?: Face[];
}

type PieceKind = keyof typeof PIECE_SHAPE;

const PIECE_KINDS: Partial<Record<TileKind, PieceKind>> = {
  [TileKind.Wall]: "wall",
  [TileKind.FullCover]: "fullCover",
  [TileKind.HalfCover]: "halfCover",
  [TileKind.OverwatchNest]: "overwatchNest",
};

const flat = (points: { x: number; y: number }[]) => points.flatMap((p) => [p.x, p.y]);

function isNextToPrimeZone(grid: Grid, { col, row }: GridPosition): boolean {
  for (let dRow = -1; dRow <= 1; dRow++)
    for (let dCol = -1; dCol <= 1; dCol++) {
      if (grid.tiles[row + dRow]?.[col + dCol] === TileKind.PrimeZone) return true;
    }
  return false;
}

function floorStyle(kind: TileKind, { col, row }: GridPosition, nextToZone: boolean): { fill: number; edge: number } {
  if (kind === TileKind.PrimeZone) return TERRAIN_STYLE.primeZone;
  if (kind === TileKind.Floor && nextToZone) return TERRAIN_STYLE.primeZoneEdge;
  const { fill, fillAlt, edge } = TERRAIN_STYLE.floor;
  return { fill: (col + row) % 2 === 0 ? fill : fillAlt, edge };
}

/** The footprint of a standing piece as a box: its visible side faces and its top. */
function pieceFaces(proj: Projection, { col, row }: GridPosition, shape: { inset: number; height: number }, style: PieceStyle): Face[] {
  const half = shape.inset / 2;
  const corners = [
    [col - half, row - half],
    [col + half, row - half],
    [col + half, row + half],
    [col - half, row + half],
  ] as const;
  const centre = proj.point(col, row);
  // A side faces the viewer when its edge lies below the tile centre on screen.
  const sides = corners
    .map((from, i) => {
      const to = corners[(i + 1) % corners.length]!;
      const a = proj.point(from[0], from[1]);
      const b = proj.point(to[0], to[1]);
      const lifted = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - shape.height });
      return { middleX: (a.x + b.x) / 2, middleY: (a.y + b.y) / 2, points: flat([a, b, lifted(b), lifted(a)]) };
    })
    .filter((side) => side.middleY > centre.y)
    .sort((a, b) => a.middleX - b.middleX);
  const roles = [
    { role: FaceRole.Left, fill: style.left },
    { role: FaceRole.Right, fill: style.right },
  ];
  const faces = sides.map((side, i) => ({ ...roles[i]!, points: side.points, edge: style.edge }));
  const top = flat(corners.map(([c, r]) => proj.point(c, r, shape.height)));
  return [...faces, { role: FaceRole.Top, points: top, fill: style.top, edge: style.edge }];
}

/** Every tile of the grid as drawing primitives, sorted so that nearer tiles come last. */
export function buildTerrain(grid: Grid, angle: number = VIEW_ANGLE): TerrainTile[] {
  const proj = projection(angle);
  const tiles: TerrainTile[] = [];
  grid.tiles.forEach((line, row) =>
    line.forEach((kind, col) => {
      const position = { col, row };
      const ground = (dCol: number, dRow: number, scale = 1) => proj.point(col + dCol * scale, row + dRow * scale);
      const diamond = (scale: number) => flat([ground(-0.5, -0.5, scale), ground(0.5, -0.5, scale), ground(0.5, 0.5, scale), ground(-0.5, 0.5, scale)]);
      const style = floorStyle(kind, position, isNextToPrimeZone(grid, position));
      const tile: TerrainTile = {
        position,
        kind,
        depth: proj.depth(col, row),
        floor: { role: FaceRole.Floor, points: diamond(1), ...style },
      };
      if (kind === TileKind.Spawn) tile.marker = { points: diamond(0.5), color: TERRAIN_STYLE.spawnMarker };
      const pieceKind = PIECE_KINDS[kind];
      if (pieceKind) tile.piece = pieceFaces(proj, position, PIECE_SHAPE[pieceKind], TERRAIN_STYLE[pieceKind]);
      tiles.push(tile);
    }),
  );
  return tiles.sort((a, b) => a.depth - b.depth);
}

const EPSILON = 1e-6;

/** Whether a point lies inside (or on the border of) a convex polygon. */
function insideConvex(points: readonly number[], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    const cross = (points[j]! - points[i]!) * (y - points[i + 1]!) - (points[j + 1]! - points[i + 1]!) * (x - points[i]!);
    if (Math.abs(cross) <= EPSILON) continue;
    if (sign !== 0 && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
}

/**
 * The Wall whose drawn silhouette (top and side faces) contains a world point. A Wall stands in front of the
 * tiles behind it, so the nearest one wins; of two equally near ones, the one the point is horizontally closer to.
 */
export function pickWallAt(x: number, y: number, grid: Grid, angle: number = VIEW_ANGLE): GridPosition | undefined {
  let best: { position: GridPosition; depth: number; offset: number } | undefined;
  for (const tile of buildTerrain(grid, angle)) {
    if (tile.kind !== TileKind.Wall || !tile.piece?.some((face) => insideConvex(face.points, x, y))) continue;
    const offset = Math.abs(x - gridToWorld(tile.position).x);
    if (!best || tile.depth > best.depth || (tile.depth === best.depth && offset < best.offset)) best = { position: tile.position, depth: tile.depth, offset };
  }
  return best?.position;
}
