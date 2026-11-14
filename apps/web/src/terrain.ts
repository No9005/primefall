import { coverAt, CoverKind, destroyCover, type Grid, type GridPosition, isWreck, REACTOR_DECK, TileKind, withTile, withWreck } from "game-core";
import { PIECE_OUTLINE_WIDTH, PIECE_SHAPE, type PieceStyle, TERRAIN_STYLE } from "./terrain-style";

// The terrain as shapes: the grid in, drawing primitives out (floor polygons, and for each
// standing piece its top and two visible side faces). Pure; the Pixi code only fills the polygons.
// 2:1 projection with 128 x 64 px tiles (asset contract, skill isometric-grid-math).

export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

/** Centre of a tile in world pixels. */
export function gridToWorld({ col, row }: GridPosition): { x: number; y: number } {
  return PROJECTION.point(col, row);
}

/** Tile units (col, row as fractions) under a world point; the inverse of `gridToWorld`. */
export function worldToGrid(x: number, y: number): { col: number; row: number } {
  return { col: (x / (TILE_WIDTH / 2) + y / (TILE_HEIGHT / 2)) / 2, row: (y / (TILE_HEIGHT / 2) - x / (TILE_WIDTH / 2)) / 2 };
}

/** Distance from the viewer of a tile: larger is nearer, so drawing in this order puts nearer things on top. */
export function depthOf({ col, row }: GridPosition): number {
  return PROJECTION.depth(col, row);
}

/** The floor polygon of a tile (flat x, y pairs) relative to the tile's centre. */
export function floorOutline(): number[] {
  const proj = PROJECTION;
  return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].flatMap(([c, r]) => {
    const p = proj.point(c!, r!);
    return [p.x, p.y];
  });
}

/**
 * Distance in world pixels from a tile's centre down to where a Hero token stands: a little below the centre, so the feet
 * rest on the middle of the tile (not on its lower vertex, which would put the figure in front of the tile).
 */
export function footOffset(): number {
  const proj = PROJECTION;
  const lowerVertex = Math.max(...[-0.5, 0.5].flatMap((c) => [-0.5, 0.5].map((r) => proj.point(c, r).y)));
  return lowerVertex * 0.25;
}

/** The four outer corners of the grid's footprint in world pixels. */
export function footprintCorners({ width, height }: Grid): { x: number; y: number }[] {
  const proj = PROJECTION;
  return [proj.point(-0.5, -0.5), proj.point(width - 0.5, -0.5), proj.point(width - 0.5, height - 0.5), proj.point(-0.5, height - 0.5)];
}

interface Projection {
  /** Grid fractions and a height in world pixels to a world point. */
  point: (col: number, row: number, lift?: number) => { x: number; y: number };
  /** Distance from the viewer: larger is nearer. */
  depth: (col: number, row: number) => number;
}

/** The 2:1 diamond projection of the grid. */
const PROJECTION: Projection = {
  point: (col, row, lift = 0) => ({ x: ((col - row) * TILE_WIDTH) / 2, y: ((col + row) * TILE_HEIGHT) / 2 - lift }),
  depth: (col, row) => col + row,
};

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
  /** Width of the outline in px on screen; see `worldLineWidth`. */
  edgeWidth: number;
}

/** The width in world pixels that draws as `screenWidth` px at a camera scale: lines keep their width when zooming. */
export function worldLineWidth(screenWidth: number, scale: number): number {
  return screenWidth / scale;
}

/** A camera scale rounded to steps of 0.1, so the terrain is redrawn per step of a zoom, not per frame. */
export function lineScale(scale: number): number {
  return Math.max(0.1, Math.round(scale * 10) / 10);
}

export interface TerrainTile {
  position: GridPosition;
  kind: TileKind;
  /** Rotated depth of the tile; larger is nearer the viewer. */
  depth: number;
  /** Whether the Squad sees the tile; false is drawn dark (the fog). Always true when no sight is given. */
  lit: boolean;
  floor: Face;
  /** A Drop Point marker lying on the floor. */
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

const EPSILON = 1e-6;

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
  if (kind === TileKind.Outpost) return lit === false ? TERRAIN_STYLE.outpostDark : TERRAIN_STYLE.outpost;
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
  if (!kind) {
    // Half Cover left by an Exhausted Hero is a low slab of its own that joins no neighbour.
    return isWreck(grid, { col, row }) ? { kind: "halfCover", form: FORM_BY_MASK[0]!, joins: 0 } : undefined;
  }
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
function boxFaces(proj: Projection, box: Box, height: number, style: PieceStyle, edgeWidth: number): Face[] {
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
    .filter((side) => side.middleY > centre.y + EPSILON)
    .sort((a, b) => a.middleX - b.middleX);
  const roles = [
    { role: FaceRole.Left, fill: style.left },
    { role: FaceRole.Right, fill: style.right },
  ];
  const faces = sides.map((side, i) => ({ ...roles[i]!, points: side.points, edge: style.edge, edgeWidth }));
  const top = flat(corners.map(([c, r]) => proj.point(c, r, height)));
  return [...faces, { role: FaceRole.Top, points: top, fill: style.top, edge: style.topEdge ?? style.edge, edgeWidth }];
}

/** All faces of the piece on a tile, the boxes farthest from the viewer first. */
function pieceFaces(proj: Projection, position: GridPosition, choice: PieceChoice): Face[] {
  const shape = PIECE_SHAPE[choice.kind];
  const style = TERRAIN_STYLE[choice.kind];
  const depthOf = (box: Box) => proj.depth((box.fromCol + box.toCol) / 2, (box.fromRow + box.toRow) / 2);
  return pieceBoxes(position, choice, shape)
    .sort((a, b) => depthOf(a) - depthOf(b))
    .flatMap((box) => boxFaces(proj, box, shape.height, style, PIECE_OUTLINE_WIDTH[choice.kind]));
}

/** Every tile of the grid as drawing primitives, sorted so that nearer tiles come last. */
export function buildTerrain(grid: Grid, lit?: ReadonlySet<string>): TerrainTile[] {
  const proj = PROJECTION;
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
        floor: { role: FaceRole.Floor, points: diamond(1), ...style, edgeWidth: TERRAIN_STYLE.gridLineWidth },
      };
      if (kind === TileKind.DropPoint) tile.marker = { points: diamond(0.5), color: tile.lit ? TERRAIN_STYLE.dropPointMarker : TERRAIN_STYLE.dropPointMarkerDark };
      const choice = choosePiece(grid, position);
      if (choice) tile.piece = pieceFaces(proj, position, choice);
      tiles.push(tile);
    }),
  );
  return tiles.sort((a, b) => a.depth - b.depth);
}

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
export function pickWallAt(x: number, y: number, grid: Grid): GridPosition | undefined {
  let best: { position: GridPosition; depth: number; offset: number } | undefined;
  for (const tile of buildTerrain(grid)) {
    if (tile.kind !== TileKind.Wall || !tile.piece?.some((face) => insideConvex(face.points, x, y))) continue;
    const offset = Math.abs(x - gridToWorld(tile.position).x);
    if (!best || tile.depth > best.depth || (tile.depth === best.depth && offset < best.offset)) best = { position: tile.position, depth: tile.depth, offset };
  }
  return best?.position;
}

/** Game px (a tile is the 46 x 24 diamond of the design canvas) to world px. */
const GAME_PX = TILE_WIDTH / 46;

/** Where the cover look of design `docs/design/role-visuals` is measured: heights and thicknesses in game px. */
const COVER_LOOK = {
  plinth: 2,
  natural: { half: 16, full: 34 },
  built: { half: 9, full: 22, rail: 10, thickness: 0.2 },
  stripe: { band: 4, angle: 35 },
} as const;

/** The shield panel across the front of a tile: a translucent quad that fades towards its top, with a foot line. */
export interface CoverPanel {
  points: number[];
  /** The foot line as x1, y1, x2, y2. */
  foot: number[];
  /** The top line as x1, y1, x2, y2. */
  top: number[];
}

/** One face of a construction bar, with the black bands drawn over its yellow. */
export interface BarFace {
  points: number[];
  fill: number;
  stripes: number[][];
}

/** The look of a Cover tile, in drawing order: the plinth and panels of natural Cover, or the bars of built Cover. */
export interface CoverLook {
  kind: "full" | "half";
  built: boolean;
  /** Natural Cover: the flat dark plinth. */
  plinth: Face[];
  /** Natural Cover: the one panel across the front, drawn above the Heroes on the tile. */
  panels: CoverPanel[];
  /** Built Cover: faces of the bars (sides first, then tops). */
  bars: BarFace[];
  /** Built Cover of Full height: the rail as line segments x1, y1, x2, y2. */
  rails: number[][];
}

const clipHalfPlane = (polygon: number[][], inside: (p: number[]) => number): number[][] => {
  const out: number[][] = [];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length]!;
    const dp = inside(p);
    const dq = inside(q);
    if (dp >= 0) out.push(p);
    if (dp >= 0 !== dq >= 0) {
      const t = dp / (dp - dq);
      out.push([p[0]! + (q[0]! - p[0]!) * t, p[1]! + (q[1]! - p[1]!) * t]);
    }
  });
  return out;
};

/**
 * The diagonal bands on a side face (a, b, b lifted, a lifted): yellow base, black bands of 4 game px at -35 degrees,
 * measured in the face's own plane (u along the edge, v up).
 */
function stripesOn(face: number[]): number[][] {
  const [ax, ay, bx, by, , , , liftedY] = face as [number, number, number, number, number, number, number, number];
  const width = Math.hypot(bx - ax, by - ay);
  const height = ay - liftedY;
  if (width < 1e-6 || height < 1e-6) return [];
  const turn = (COVER_LOOK.stripe.angle * Math.PI) / 180;
  const along = { x: Math.cos(turn), y: -Math.sin(turn) };
  const across = { x: Math.sin(turn), y: Math.cos(turn) };
  const band = COVER_LOOK.stripe.band * GAME_PX;
  const reach = width + height;
  const last = Math.ceil((width * across.x + height * across.y) / (2 * band));
  const toScreen = ([u, v]: number[]) => [ax + ((bx - ax) * u!) / width, ay + ((by - ay) * u!) / width - v!];
  const bands: number[][] = [];
  for (let k = 0; k <= last; k++) {
    const s0 = k * 2 * band;
    const s1 = s0 + band;
    let polygon = [
      [across.x * s0 - along.x * reach, across.y * s0 - along.y * reach],
      [across.x * s1 - along.x * reach, across.y * s1 - along.y * reach],
      [across.x * s1 + along.x * reach, across.y * s1 + along.y * reach],
      [across.x * s0 + along.x * reach, across.y * s0 + along.y * reach],
    ];
    polygon = clipHalfPlane(polygon, (p) => p[0]!);
    polygon = clipHalfPlane(polygon, (p) => width - p[0]!);
    polygon = clipHalfPlane(polygon, (p) => p[1]!);
    polygon = clipHalfPlane(polygon, (p) => height - p[1]!);
    if (polygon.length >= 3) bands.push(polygon.flatMap(toScreen));
  }
  return bands;
}

/** The look of a Cover tile; `built` is Cover a Hero placed (bars), otherwise the map's own (panels). */
export function coverLook(position: GridPosition, kind: "full" | "half", built: boolean, grow = 1): CoverLook {
  const proj = PROJECTION;
  const { col, row } = position;
  const colors = TERRAIN_STYLE.coverLook;
  const edges = [
    { from: [-0.5, -0.5], to: [0.5, -0.5], inward: [0, 1] },
    { from: [0.5, -0.5], to: [0.5, 0.5], inward: [-1, 0] },
    { from: [0.5, 0.5], to: [-0.5, 0.5], inward: [0, -1] },
    { from: [-0.5, 0.5], to: [-0.5, -0.5], inward: [1, 0] },
  ] as const;
  const centreY = proj.point(col, row).y;
  const back = edges.filter((edge) => {
    const middle = proj.point(col + (edge.from[0] + edge.to[0]) / 2, row + (edge.from[1] + edge.to[1]) / 2);
    return middle.y < centreY - EPSILON;
  });
  const look: CoverLook = { kind, built, plinth: [], panels: [], bars: [], rails: [] };
  if (!built) {
    const plinthStyle: PieceStyle = { top: colors.plinthTop, left: colors.plinthSide, right: colors.plinthSide, edge: colors.outline };
    const whole = { fromCol: col - 0.5, toCol: col + 0.5, fromRow: row - 0.5, toRow: row + 0.5 };
    look.plinth = boxFaces(proj, whole, COVER_LOOK.plinth * GAME_PX, plinthStyle, 1);
    const lift = COVER_LOOK.plinth * GAME_PX;
    const height = COVER_LOOK.natural[kind] * GAME_PX;
    // One panel across the front of the tile, level on the screen, drawn above the Heroes on the tile:
    // a Hero standing on Cover is hidden behind it.
    const front = edges.filter((edge) => {
      const middle = proj.point(col + (edge.from[0] + edge.to[0]) / 2, row + (edge.from[1] + edge.to[1]) / 2);
      return middle.y > centreY + EPSILON;
    });
    const middleOf = (edge: (typeof edges)[number]) => [(edge.from[0] + edge.to[0]) / 2, (edge.from[1] + edge.to[1]) / 2] as const;
    const ends = front.length === 2 ? [middleOf(front[0]!), middleOf(front[1]!)] : front.length === 1 ? [front[0]!.from, front[0]!.to] : [];
    if (ends.length === 2) {
      const [a, b] = ends.map(([dc, dr]) => proj.point(col + dc, row + dr, lift)).sort((p, q) => p.x - q.x) as [{ x: number; y: number }, { x: number; y: number }];
      look.panels.push({
        points: [a.x, a.y, b.x, b.y, b.x, b.y - height, a.x, a.y - height],
        foot: [a.x, a.y, b.x, b.y],
        top: [a.x, a.y - height, b.x, b.y - height],
      });
    }
    return look;
  }
  const height = Math.max(0.5, COVER_LOOK.built[kind] * GAME_PX * grow);
  const thick = COVER_LOOK.built.thickness;
  const boxes: Box[] = back.map((edge, i) => {
    const [fromCol, toCol] = [edge.from[0], edge.to[0]].sort((x, y) => x - y) as [number, number];
    const [fromRow, toRow] = [edge.from[1], edge.to[1]].sort((x, y) => x - y) as [number, number];
    const box: Box = {
      fromCol: col + (edge.inward[0] === 1 ? fromCol : edge.inward[0] === -1 ? toCol - thick : fromCol),
      toCol: col + (edge.inward[0] === 1 ? fromCol + thick : edge.inward[0] === -1 ? toCol : toCol),
      fromRow: row + (edge.inward[1] === 1 ? fromRow : edge.inward[1] === -1 ? toRow - thick : fromRow),
      toRow: row + (edge.inward[1] === 1 ? fromRow + thick : edge.inward[1] === -1 ? toRow : toRow),
    };
    // The second bar stops where the first one's thickness ends, so they meet in a clean corner.
    if (i === 1) {
      const first = back[0]!;
      if (first.inward[1] !== 0) box[first.inward[1] === 1 ? "fromRow" : "toRow"] += first.inward[1] === 1 ? thick : -thick;
      else box[first.inward[0] === 1 ? "fromCol" : "toCol"] += first.inward[0] === 1 ? thick : -thick;
    }
    return box;
  });
  const faces = boxes.flatMap((box) => boxFaces(proj, box, height, { top: colors.grey, left: colors.yellow, right: colors.yellow, edge: colors.outline }, 1));
  for (const face of faces) {
    if (face.role !== FaceRole.Top) look.bars.push({ points: face.points, fill: colors.yellow, stripes: stripesOn(face.points) });
  }
  for (const face of faces) if (face.role === FaceRole.Top) look.bars.push({ points: face.points, fill: colors.grey, stripes: [] });
  if (kind === "full") {
    const rail = COVER_LOOK.built.rail * GAME_PX;
    for (const box of boxes) {
      const a = proj.point(box.fromCol, box.fromRow, height + rail);
      const b = proj.point(box.toCol, box.toRow, height + rail);
      const foot = [proj.point(box.fromCol, box.fromRow, height), proj.point(box.toCol, box.toRow, height)];
      look.rails.push([a.x, a.y, b.x, b.y], [a.x, a.y, a.x, foot[0]!.y], [b.x, b.y, b.x, foot[1]!.y]);
    }
  }
  return look;
}

/** A shield mark above a Cover piece of the map: filled for Full Cover, half filled for Half Cover. */
export interface CoverMark {
  position: GridPosition;
  kind: "full" | "half";
  /** Above the back corner of the tile, over the panels, in world pixels. */
  x: number;
  y: number;
}

/** One mark per standing piece of natural Cover (Exhausted Hero wrecks and built Cover have none). */
export function coverMarks(grid: Grid, built: ReadonlySet<string> = new Set()): CoverMark[] {
  const proj = PROJECTION;
  return grid.tiles.flatMap((line, row) =>
    line.flatMap((tileKind, col) => {
      const kind = tileKind === TileKind.FullCover ? "full" : tileKind === TileKind.HalfCover ? "half" : undefined;
      if (!kind || built.has(tileKey({ col, row }))) return [];
      const corner = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([c, r]) => proj.point(col + c!, row + r!)).reduce((a, b) => (b.y < a.y ? b : a));
      const mark: CoverMark = { position: { col, row }, kind, x: corner.x, y: corner.y - COVER_LOOK.natural[kind] * GAME_PX - 12 };
      return [mark];
    }),
  );
}

/** Whether a tile is drawn with the cover look (a Cover tile) rather than as a plain standing piece. */
export const hasCoverLook = (kind: TileKind): kind is TileKind.FullCover | TileKind.HalfCover => kind === TileKind.FullCover || kind === TileKind.HalfCover;

export { tileKey };

/** The grid with every Cover tile (Half and Full) turned into plain floor; Walls, zones and Drop Points stay. */
export function withoutCover(grid: Grid): Grid {
  let result = grid;
  grid.tiles.forEach((line, row) =>
    line.forEach((_, col) => {
      if (coverAt(result, { col, row }) !== CoverKind.None) result = destroyCover(result, { col, row });
    }),
  );
  return result;
}

/** The Reactor Deck as the Squad knows it: destroyed Cover gone, Cover placed in the match standing, wrecks of Exhausted Heroes as Half Cover. */
export function coverGridOf(destroyed: readonly GridPosition[], placed: readonly GridPosition[], wrecks: readonly GridPosition[]): Grid {
  const standing = placed.reduce((grid, tile) => withTile(grid, tile, TileKind.HalfCover), destroyed.reduce(destroyCover, REACTOR_DECK));
  return wrecks.reduce(withWreck, standing);
}
