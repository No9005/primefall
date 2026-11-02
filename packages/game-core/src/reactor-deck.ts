// Reactor Deck map data (ADR 0016) and the Grid model shared by rules and rendering.

/** String-valued so Match State stays readable when serialized; always compare against the members. */
export enum TileKind {
  Floor = "floor",
  Wall = "wall",
  FullCover = "fullCover",
  HalfCover = "halfCover",
  PrimeZone = "primeZone",
  OverwatchNest = "overwatchNest",
  Spawn = "spawn",
}

export interface GridPosition {
  col: number;
  row: number;
}

export interface Grid {
  width: number;
  height: number;
  /** Indexed as `tiles[row][col]`. */
  tiles: readonly (readonly TileKind[])[];
}

// Raw characters only exist here, at the parsing boundary.
const LEGEND: Record<string, TileKind> = {
  ".": TileKind.Floor,
  "#": TileKind.Wall,
  F: TileKind.FullCover,
  H: TileKind.HalfCover,
  P: TileKind.PrimeZone,
  O: TileKind.OverwatchNest,
  S: TileKind.Spawn,
};

/** Parses an ASCII layout (one string per row) into a Grid and rejects ragged or unknown rows. */
export function parseGrid(rows: readonly string[]): Grid {
  const width = rows[0]?.length ?? 0;
  const tiles = rows.map((line, row) => {
    if (line.length !== width) throw new Error(`Row ${row} has width ${line.length}, expected ${width}`);
    return [...line].map((char, col): TileKind => {
      const kind = LEGEND[char];
      if (!kind) throw new Error(`Unknown tile '${char}' at column ${col}, row ${row}`);
      return kind;
    });
  });
  return { width, height: rows.length, tiles };
}

export function tileAt(grid: Grid, { col, row }: GridPosition): TileKind | undefined {
  return grid.tiles[row]?.[col];
}

export function findTiles(grid: Grid, kind: TileKind): GridPosition[] {
  const found: GridPosition[] = [];
  grid.tiles.forEach((line, row) => line.forEach((tile, col) => tile === kind && found.push({ col, row })));
  return found;
}

/** How a tile protects a Hero standing on it against attackers at Range 2 or more (ADR 0020). */
export enum CoverKind {
  None = "none",
  Half = "half",
  Full = "full",
}

/** Half Cover reduces incoming damage by this much. */
export const HALF_COVER_REDUCTION = 1;
/** Attackers at this Range or closer ignore Cover. */
export const COVER_IGNORED_RANGE = 1;

/** The Overwatch Nest is a Full Cover tile (ADR 0016). */
export function coverAt(grid: Grid, position: GridPosition): CoverKind {
  switch (tileAt(grid, position)) {
    case TileKind.FullCover:
    case TileKind.OverwatchNest:
      return CoverKind.Full;
    case TileKind.HalfCover:
      return CoverKind.Half;
    default:
      return CoverKind.None;
  }
}

/** A copy of the Grid with the tile at `position` set to `kind`. */
export function withTile(grid: Grid, position: GridPosition, kind: TileKind): Grid {
  const tiles = grid.tiles.map((line, row) =>
    row === position.row ? line.map((current, col) => (col === position.col ? kind : current)) : line,
  );
  return { ...grid, tiles };
}

/**
 * A copy of the Grid with the Cover on `position` destroyed: the tile becomes open floor, so it can still be
 * occupied but no longer protects or blocks Line of Sight. Tiles without Cover stay as they are.
 */
export function destroyCover(grid: Grid, position: GridPosition): Grid {
  return coverAt(grid, position) === CoverKind.None ? grid : withTile(grid, position, TileKind.Floor);
}

/** The Cover tiles of the original map that are no longer Cover in `grid`. */
export function destroyedCoverTiles(grid: Grid): GridPosition[] {
  const destroyed: GridPosition[] = [];
  REACTOR_DECK.tiles.forEach((line, row) =>
    line.forEach((_, col) => {
      const tile = { col, row };
      if (coverAt(REACTOR_DECK, tile) !== CoverKind.None && coverAt(grid, tile) === CoverKind.None) destroyed.push(tile);
    }),
  );
  return destroyed;
}

/** The Cover that protects `target` from an attacker standing at `attacker`; none at Range 1. */
export function coverAgainst(grid: Grid, attacker: GridPosition, target: GridPosition): CoverKind {
  const range = Math.max(Math.abs(attacker.col - target.col), Math.abs(attacker.row - target.row));
  return range <= COVER_IGNORED_RANGE ? CoverKind.None : coverAt(grid, target);
}

/**
 * Line of Sight between two tiles: the straight line between their centres must not cross a Wall or a
 * Full Cover tile between them (the end tiles never block). Half Cover and Heroes never block it.
 * The line is traced from the same end for both directions, so it is symmetric.
 */
export function hasLineOfSight(grid: Grid, a: GridPosition, b: GridPosition): boolean {
  const [from, to] = a.col < b.col || (a.col === b.col && a.row <= b.row) ? [a, b] : [b, a];
  const steps = Math.max(Math.abs(to.col - from.col), Math.abs(to.row - from.row));
  for (let i = 1; i < steps; i++) {
    const col = Math.round(from.col + ((to.col - from.col) * i) / steps);
    const row = Math.round(from.row + ((to.row - from.row) * i) / steps);
    const blocker = { col, row };
    if (tileAt(grid, blocker) === TileKind.Wall || coverAt(grid, blocker) === CoverKind.Full) return false;
  }
  return true;
}

/**
 * The Reactor Deck: 21 by 11 tiles, mirror-symmetric around column 10.
 * `#` Wall, `H` Half Cover, `P` Prime Zone, `O` Overwatch Nest, `S` Spawn, `.` open floor (ADR 0016).
 */
export const REACTOR_DECK: Grid = parseGrid([
  "#####################",
  "#.........O.........#",
  "#...##.........##...#",
  "#...#...........#...#",
  "#S..#....PPP....#..S#",
  "#S...H...PPP...H...S#",
  "#S..#....PPP....#..S#",
  "#...#...........#...#",
  "#...##.........##...#",
  "#...................#",
  "#####################",
]);
