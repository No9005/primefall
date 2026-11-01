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

/**
 * Line of Sight between two tiles: the straight line between their centres must not cross a Wall.
 * Heroes never block it. The line is traced from the same end for both directions, so it is symmetric.
 */
export function hasLineOfSight(grid: Grid, a: GridPosition, b: GridPosition): boolean {
  const [from, to] = a.col < b.col || (a.col === b.col && a.row <= b.row) ? [a, b] : [b, a];
  const steps = Math.max(Math.abs(to.col - from.col), Math.abs(to.row - from.row));
  for (let i = 1; i < steps; i++) {
    const col = Math.round(from.col + ((to.col - from.col) * i) / steps);
    const row = Math.round(from.row + ((to.row - from.row) * i) / steps);
    if (tileAt(grid, { col, row }) === TileKind.Wall) return false;
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
