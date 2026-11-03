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
  /** Whether the Squad sees the tile; false is drawn dark (the fog). Always true when no sight is given. */
  lit: boolean;
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

/** The tiles drawn lit: those the Squad sees, and the tiles its Heroes stand on. */
export function litTiles(visibleTiles: readonly GridPosition[], heroPositions: readonly GridPosition[]): ReadonlySet<string> {
  return new Set([...visibleTiles, ...heroPositions].map(tileKey));
}

const tileKey = ({ col, row }: GridPosition) => `${col},${row}`;

/** `lit` undefined means no sight is applied: plain colours. */
function floorStyle(kind: TileKind, { col, row }: GridPosition, nextToZone: boolean, lit: boolean | undefined): { fill: number; edge: number } {
  if (lit !== undefined) {
    if (!lit) return kind === TileKind.PrimeZone ? TERRAIN_STYLE.primeZoneDark : TERRAIN_STYLE.floorDark;
    return kind === TileKind.PrimeZone ? TERRAIN_STYLE.primeZone : TERRAIN_STYLE.floorLit;
  }
  if (kind === TileKind.PrimeZone) return TERRAIN_STYLE.primeZone;
  if (kind === TileKind.Floor && nextToZone) return TERRAIN_STYLE.primeZoneEdge;
  const { fill, fillAlt, edge } = TERRAIN_STYLE.floor;
  return { fill: (col + row) % 2 === 0 ? fill : fillAlt, edge };
}

/** The sides of a tile a standing piece joins its neighbour on, as bits of a neighbour mask. */
export const Join = { West: 1, North: 2, East: 4, South: 8 } as const;

export type PieceForm = "pillar" | "end" | "straight" | "corner" | "tee" | "cross";

/** The form for each neighbour mask (West 1, North 2, East 4, South 8). */
const FORM_BY_MASK: readonly PieceForm[] = [
  "pillar", // none
  "end", // W
  "end", // N
  "corner", // W N
  "end", // E
  "straight", // W E
  "corner", // N E
  "tee", // W N E
  "end", // S
  "corner", // W S
  "straight", // N S
  "tee", // W N S
  "corner", // E S
  "tee", // W E S
  "tee", // N E S
  "cross", // all
];

export interface PieceChoice {
  kind: PieceKind;
  form: PieceForm;
  /** The sides on which the piece continues into a neighbouring piece of the same kind. */
  joins: number;
}

/** Which standing piece to draw on a tile, chosen from its four neighbours; undefined for open tiles. */
export function choosePiece(grid: Grid, { col, row }: GridPosition): PieceChoice | undefined {
  const kind = PIECE_KINDS[grid.tiles[row]?.[col] as TileKind];
  if (!kind) return undefined;
  const neighbours = [
    [Join.West, col - 1, row],
    [Join.North, col, row - 1],
    [Join.East, col + 1, row],
    [Join.South, col, row + 1],
  ] as const;
  const joins =
    kind === "overwatchNest" ? 0 : neighbours.reduce((mask, [bit, c, r]) => (PIECE_KINDS[grid.tiles[r]?.[c] as TileKind] === kind ? mask | bit : mask), 0);
  return { kind, form: FORM_BY_MASK[joins]!, joins };
}

interface Box {
  fromCol: number;
  toCol: number;
  fromRow: number;
  toRow: number;
}

/** A piece as boxes: the middle post and, for each join, a slab out to the tile edge. */
function pieceBoxes({ col, row }: GridPosition, { joins }: PieceChoice, shape: { thickness: number; pillar: number }): Box[] {
  const t = (joins === 0 ? shape.pillar : shape.thickness) / 2;
  const middle = { fromCol: col - t, toCol: col + t, fromRow: row - t, toRow: row + t };
  const arms: [number, Box][] = [
    [Join.West, { ...middle, fromCol: col - 0.5, toCol: col - t }],
    [Join.North, { ...middle, fromRow: row - 0.5, toRow: row - t }],
    [Join.East, { ...middle, fromCol: col + t, toCol: col + 0.5 }],
    [Join.South, { ...middle, fromRow: row + t, toRow: row + 0.5 }],
  ];
  return [middle, ...arms.filter(([bit]) => joins & bit).map(([, box]) => box)];
}

/** One box of a standing piece: its visible side faces and its top. */
function boxFaces(proj: Projection, box: Box, height: number, style: PieceStyle): Face[] {
  const corners = [
    [box.fromCol, box.fromRow],
    [box.toCol, box.fromRow],
    [box.toCol, box.toRow],
    [box.fromCol, box.toRow],
  ] as const;
  const centre = proj.point((box.fromCol + box.toCol) / 2, (box.fromRow + box.toRow) / 2);
  // A side faces the viewer when its edge lies below the tile centre on screen.
  const sides = corners
    .map((from, i) => {
      const to = corners[(i + 1) % corners.length]!;
      const a = proj.point(from[0], from[1]);
      const b = proj.point(to[0], to[1]);
      const lifted = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - height });
      return { middleX: (a.x + b.x) / 2, middleY: (a.y + b.y) / 2, points: flat([a, b, lifted(b), lifted(a)]) };
    })
    .filter((side) => side.middleY > centre.y)
    .sort((a, b) => a.middleX - b.middleX);
  const roles = [
    { role: FaceRole.Left, fill: style.left },
    { role: FaceRole.Right, fill: style.right },
  ];
  const faces = sides.map((side, i) => ({ ...roles[i]!, points: side.points, edge: style.edge }));
  const top = flat(corners.map(([c, r]) => proj.point(c, r, height)));
  return [...faces, { role: FaceRole.Top, points: top, fill: style.top, edge: style.edge }];
}

/** All faces of the piece on a tile, the boxes farthest from the viewer first. */
function pieceFaces(proj: Projection, position: GridPosition, choice: PieceChoice): Face[] {
  const shape = PIECE_SHAPE[choice.kind];
  const style = TERRAIN_STYLE[choice.kind];
  const depthOf = (box: Box) => proj.depth((box.fromCol + box.toCol) / 2, (box.fromRow + box.toRow) / 2);
  return pieceBoxes(position, choice, shape)
    .sort((a, b) => depthOf(a) - depthOf(b))
    .flatMap((box) => boxFaces(proj, box, shape.height, style));
}

/** Every tile of the grid as drawing primitives, sorted so that nearer tiles come last. */
export function buildTerrain(grid: Grid, angle: number = VIEW_ANGLE, lit?: ReadonlySet<string>): TerrainTile[] {
  const proj = projection(angle);
  const tiles: TerrainTile[] = [];
  grid.tiles.forEach((line, row) =>
    line.forEach((kind, col) => {
      const position = { col, row };
      const ground = (dCol: number, dRow: number, scale = 1) => proj.point(col + dCol * scale, row + dRow * scale);
      const diamond = (scale: number) => flat([ground(-0.5, -0.5, scale), ground(0.5, -0.5, scale), ground(0.5, 0.5, scale), ground(-0.5, 0.5, scale)]);
      const isLit = lit?.has(tileKey(position));
      const style = floorStyle(kind, position, isNextToPrimeZone(grid, position), isLit);
      const tile: TerrainTile = {
        position,
        kind,
        depth: proj.depth(col, row),
        lit: isLit ?? true,
        floor: { role: FaceRole.Floor, points: diamond(1), ...style },
      };
      if (kind === TileKind.Spawn) tile.marker = { points: diamond(0.5), color: tile.lit ? TERRAIN_STYLE.spawnMarker : TERRAIN_STYLE.spawnMarkerDark };
      const choice = choosePiece(grid, position);
      if (choice) tile.piece = pieceFaces(proj, position, choice);
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
