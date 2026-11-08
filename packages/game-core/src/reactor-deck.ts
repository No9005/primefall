// Reactor Deck map data (ADR 0016) and the Grid model shared by rules and rendering.

/** String-valued so Match State stays readable when serialized; always compare against the members. */
export enum TileKind {
  Floor = "floor",
  Wall = "wall",
  FullCover = "fullCover",
  HalfCover = "halfCover",
  PrimeZone = "primeZone",
  Outpost = "outpost",
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
  /**
   * Half Cover left by Exhausted Heroes, kept apart from `tiles` so a Prime Zone tile stays a Prime Zone tile.
   * Absent when there is none.
   */
  wrecks?: readonly GridPosition[];
}

// Raw characters only exist here, at the parsing boundary.
const LEGEND: Record<string, TileKind> = {
  ".": TileKind.Floor,
  "#": TileKind.Wall,
  F: TileKind.FullCover,
  H: TileKind.HalfCover,
  P: TileKind.PrimeZone,
  O: TileKind.OverwatchNest,
  X: TileKind.Outpost,
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
  const tileCover = tileCoverAt(grid, position);
  return tileCover === CoverKind.None && isWreck(grid, position) ? CoverKind.Half : tileCover;
}

/** The Cover of the tile itself, without wrecks. */
function tileCoverAt(grid: Grid, position: GridPosition): CoverKind {
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

/** Whether an Exhausted Hero left Half Cover on the tile (and it has not been destroyed). */
export const isWreck = (grid: Grid, position: GridPosition): boolean =>
  grid.wrecks?.some((wreck) => wreck.col === position.col && wreck.row === position.row) ?? false;

/** A copy of the Grid with Half Cover left on `position` by an Exhausted Hero; better Cover on the tile stays. */
export function withWreck(grid: Grid, position: GridPosition): Grid {
  return isWreck(grid, position) ? grid : { ...grid, wrecks: [...(grid.wrecks ?? []), { ...position }] };
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
  if (coverAt(grid, position) === CoverKind.None) return grid;
  const wrecks = grid.wrecks?.filter((wreck) => wreck.col !== position.col || wreck.row !== position.row);
  const cleared: Grid = wrecks ? { ...grid, wrecks } : grid;
  // A wreck on a Prime Zone (or any tile without Cover of its own) only loses the wreck; the tile keeps its kind.
  return tileCoverAt(cleared, position) === CoverKind.None ? cleared : withTile(cleared, position, TileKind.Floor);
}

export const isWall = (position: GridPosition) => tileAt(REACTOR_DECK, position) === TileKind.Wall;

/** A step is legal into the Grid, not into a Wall, and a diagonal step may not cut a Wall corner. */
export function isStepAllowed(from: GridPosition, to: GridPosition): boolean {
  if (tileAt(REACTOR_DECK, to) === undefined || isWall(to)) return false;
  const diagonal = from.col !== to.col && from.row !== to.row;
  return !(diagonal && (isWall({ col: to.col, row: from.row }) || isWall({ col: from.col, row: to.row })));
}

/** The tile one step from `from` straight towards `destination` (diagonal when both axes differ). */
export function stepTowards(from: GridPosition, destination: GridPosition): GridPosition {
  return {
    col: from.col + Math.sign(destination.col - from.col),
    row: from.row + Math.sign(destination.row - from.row),
  };
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
  return sightBlockers(grid, a, b).length === 0;
}

/** The tiles between `a` and `b` that block Line of Sight. */
function sightBlockers(grid: Grid, a: GridPosition, b: GridPosition): GridPosition[] {
  const [from, to] = a.col < b.col || (a.col === b.col && a.row <= b.row) ? [a, b] : [b, a];
  const steps = Math.max(Math.abs(to.col - from.col), Math.abs(to.row - from.row));
  const blockers: GridPosition[] = [];
  for (let i = 1; i < steps; i++) {
    const col = Math.round(from.col + ((to.col - from.col) * i) / steps);
    const row = Math.round(from.row + ((to.row - from.row) * i) / steps);
    const tile = { col, row };
    if (tileAt(grid, tile) === TileKind.Wall || coverAt(grid, tile) === CoverKind.Full) blockers.push(tile);
  }
  return blockers;
}

const distanceBetween = (a: GridPosition, b: GridPosition) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

/** The line of fire from an attacker to a target, as the rules see it. */
export interface ShotLine {
  from: GridPosition;
  to: GridPosition;
  inRange: boolean;
  lineOfSight: boolean;
  /** The Cover that protects the target from this attacker (on the target's own tile); none at Range 1. */
  cover: CoverKind;
  /** The blocking tile nearest to the attacker when Line of Sight is missing. */
  blockedAt?: GridPosition;
  /** The last tile of the line within Range when the target is out of Range. */
  rangeEnd?: GridPosition;
  /** The attack can hit: in Range, in Line of Sight and not against Full Cover. */
  canHit: boolean;
}

/** The straight line of fire from `from` to `to` for an attack of `range`, decided by the functions the Resolution uses. */
export function shotLine(grid: Grid, from: GridPosition, to: GridPosition, range: number): ShotLine {
  const distance = distanceBetween(from, to);
  const inRange = distance <= range;
  const lineOfSight = hasLineOfSight(grid, from, to);
  const cover = coverAgainst(grid, from, to);
  const blockedAt = sightBlockers(grid, from, to).sort((x, y) => distanceBetween(from, x) - distanceBetween(from, y))[0];
  const line: ShotLine = { from, to, inRange, lineOfSight, cover, canHit: inRange && lineOfSight && cover !== CoverKind.Full };
  if (blockedAt) line.blockedAt = blockedAt;
  if (!inRange) {
    line.rangeEnd = {
      col: Math.round(from.col + ((to.col - from.col) * range) / distance),
      row: Math.round(from.row + ((to.row - from.row) * range) / distance),
    };
  }
  return line;
}

/**
 * The Reactor Deck: 31 by 17 tiles, mirror-symmetric around the centre column (ADR 0016).
 * The two Outposts (3 by 2 tiles, rows 3-4 and 12-13) are an interim placement; the real map comes later.
 * `#` Wall, `H` Half Cover, `P` Prime Zone, `X` Outpost, `S` Spawn, `.` open floor.
 */
export const REACTOR_DECK: Grid = parseGrid([
  "###############################",
  "#.............................#",
  "#...H...HH...HH.HH...HH...H...#",
  "#.............XXX.............#",
  "#.....HH..##.HXXXH.##..HH.....#",
  "#.............H.H.............#",
  "#....#######HH...HH#######....#",
  "#S............PPP............S#",
  "#S............PPP............S#",
  "#S............PPP............S#",
  "#....#######HH...HH#######....#",
  "#.............H.H.............#",
  "#.....HH..##.HXXXH.##..HH.....#",
  "#.............XXX.............#",
  "#...H...HH...HH.HH...HH...H...#",
  "#.............................#",
  "###############################",
]);
