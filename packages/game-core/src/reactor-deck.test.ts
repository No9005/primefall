import { describe, expect, it } from "vitest";
import {
  CoverKind,
  coverAt,
  findTiles,
  type GridPosition,
  hasLineOfSight,
  isStepAllowed,
  parseGrid,
  REACTOR_DECK,
  TileKind,
  tileAt,
} from "./reactor-deck";

const centreColumn = (REACTOR_DECK.width - 1) / 2;
const spawns = findTiles(REACTOR_DECK, TileKind.Spawn);
const zone = findTiles(REACTOR_DECK, TileKind.PrimeZone);

/** Whether `target` can be reached from any of `starts` by legal steps that stay on tiles `allowed` accepts. */
function reaches(starts: readonly GridPosition[], isTarget: (tile: GridPosition) => boolean, allowed: (tile: GridPosition) => boolean) {
  const key = ({ col, row }: GridPosition) => `${col},${row}`;
  const seen = new Set(starts.map(key));
  const queue = [...starts];
  for (const tile of queue) {
    if (isTarget(tile)) return true;
    for (let row = tile.row - 1; row <= tile.row + 1; row++) {
      for (let col = tile.col - 1; col <= tile.col + 1; col++) {
        const next = { col, row };
        if (seen.has(key(next)) || !isStepAllowed(tile, next) || !allowed(next)) continue;
        seen.add(key(next));
        queue.push(next);
      }
    }
  }
  return false;
}

const isZone = (tile: GridPosition) => tileAt(REACTOR_DECK, tile) === TileKind.PrimeZone;
const isSpawn = (tile: GridPosition) => tileAt(REACTOR_DECK, tile) === TileKind.Spawn;
const spawnsOf = (side: "left" | "right") => spawns.filter((tile) => (side === "left" ? tile.col < centreColumn : tile.col > centreColumn));

describe("Reactor Deck", () => {
  it("is 31 by 17 tiles", () => {
    expect(REACTOR_DECK.width).toBe(31);
    expect(REACTOR_DECK.height).toBe(17);
  });

  it("is mirror-symmetric left-right and top-bottom, except the Nest", () => {
    const withoutNest = REACTOR_DECK.tiles.map((line) => line.map((tile) => (tile === TileKind.OverwatchNest ? TileKind.Floor : tile)));
    for (const line of withoutNest) expect([...line].reverse()).toEqual([...line]);
    expect([...withoutNest].reverse()).toEqual(withoutNest);
    expect(centreColumn).toBe(15);
  });

  it("is enclosed by walls", () => {
    const { width, height } = REACTOR_DECK;
    for (let col = 0; col < width; col++) {
      expect(tileAt(REACTOR_DECK, { col, row: 0 })).toBe(TileKind.Wall);
      expect(tileAt(REACTOR_DECK, { col, row: height - 1 })).toBe(TileKind.Wall);
    }
    for (let row = 0; row < height; row++) {
      expect(tileAt(REACTOR_DECK, { col: 0, row })).toBe(TileKind.Wall);
      expect(tileAt(REACTOR_DECK, { col: width - 1, row })).toBe(TileKind.Wall);
    }
  });

  it("gives each Squad exactly three Spawn tiles on its own edge", () => {
    expect(spawns).toHaveLength(6);
    expect(spawnsOf("left")).toEqual([7, 8, 9].map((row) => ({ col: 1, row })));
    expect(spawnsOf("right")).toEqual([7, 8, 9].map((row) => ({ col: 29, row })));
  });

  it("puts the open 3 by 3 Prime Zone on the central tiles", () => {
    expect(zone).toHaveLength(9);
    for (const { col, row } of zone) {
      expect(col).toBeGreaterThanOrEqual(14);
      expect(col).toBeLessThanOrEqual(16);
      expect(row).toBeGreaterThanOrEqual(7);
      expect(row).toBeLessThanOrEqual(9);
    }
  });

  it("has exactly one Overwatch Nest, on the central column in the top row", () => {
    expect(findTiles(REACTOR_DECK, TileKind.OverwatchNest)).toEqual([{ col: 15, row: 1 }]);
  });
});

describe("Reactor Deck routes", () => {
  const channelRows = (tile: GridPosition) => tile.row >= 7 && tile.row <= 9;
  const upperFlank = (tile: GridPosition) => tile.row <= 6 || isZone(tile) || isSpawn(tile);
  const lowerFlank = (tile: GridPosition) => tile.row >= 10 || isZone(tile) || isSpawn(tile);

  // A flank route may not use the channel rows, except at the Spawn and at the Zone itself.
  const flankRoute = (flank: (tile: GridPosition) => boolean) => (tile: GridPosition) => flank(tile) && (!channelRows(tile) || isZone(tile) || isSpawn(tile));

  it.each(["left", "right"] as const)("lets the %s Spawn reach the Prime Zone through the channel", (side) => {
    expect(reaches(spawnsOf(side), isZone, channelRows)).toBe(true);
  });

  it.each(["left", "right"] as const)("lets the %s Spawn reach the Prime Zone through the upper flank", (side) => {
    expect(reaches(spawnsOf(side), isZone, flankRoute(upperFlank))).toBe(true);
  });

  it.each(["left", "right"] as const)("lets the %s Spawn reach the Prime Zone through the lower flank", (side) => {
    expect(reaches(spawnsOf(side), isZone, flankRoute(lowerFlank))).toBe(true);
  });

  it("has no Cover in the channel and in the Prime Zone", () => {
    for (let row = 7; row <= 9; row++) {
      for (let col = 5; col <= 25; col++) expect(coverAt(REACTOR_DECK, { col, row })).toBe(CoverKind.None);
    }
  });

  it("lets a Hero at a window see into the channel", () => {
    // The channel Walls end in Half Cover next to the Zone; Half Cover never blocks Line of Sight.
    expect(tileAt(REACTOR_DECK, { col: 12, row: 6 })).toBe(TileKind.HalfCover);
    expect(hasLineOfSight(REACTOR_DECK, { col: 12, row: 6 }, { col: 8, row: 8 })).toBe(true);
    expect(hasLineOfSight(REACTOR_DECK, { col: 18, row: 6 }, { col: 22, row: 8 })).toBe(true);
    expect(hasLineOfSight(REACTOR_DECK, { col: 13, row: 10 }, { col: 9, row: 8 })).toBe(true);
  });

  it("lets a Hero at a window see the Prime Zone", () => {
    expect(hasLineOfSight(REACTOR_DECK, { col: 12, row: 6 }, { col: 15, row: 8 })).toBe(true);
  });

  it("does not let a Hero on a flank see through the channel Wall", () => {
    expect(hasLineOfSight(REACTOR_DECK, { col: 8, row: 5 }, { col: 8, row: 8 })).toBe(false);
  });
});

describe("parseGrid", () => {
  it("rejects unknown tiles and ragged rows", () => {
    expect(() => parseGrid(["#?#"])).toThrow("Unknown tile");
    expect(() => parseGrid(["###", "##"])).toThrow("width");
  });
});

describe("blocked tiles (the wall kit only changes how Walls are drawn)", () => {
  it("blocks Movement and Line of Sight on exactly the Wall tiles of the layout", () => {
    const wallRows = REACTOR_DECK.tiles.map((line) => line.map((kind) => (kind === TileKind.Wall ? "#" : ".")).join(""));
    expect(wallRows).toEqual([
      "###############################",
      "#.............................#",
      "#.............................#",
      "#.............................#",
      "#.........##.......##.........#",
      "#.............................#",
      "#....#######.......#######....#",
      "#.............................#",
      "#.............................#",
      "#.............................#",
      "#....#######.......#######....#",
      "#.............................#",
      "#.........##.......##.........#",
      "#.............................#",
      "#.............................#",
      "#.............................#",
      "###############################",
    ]);
    REACTOR_DECK.tiles.forEach((line, row) =>
      line.forEach((kind, col) => {
        const open = isStepAllowed({ col: 15, row: 7 }, { col, row });
        if (kind === TileKind.Wall) expect(open).toBe(false);
      }),
    );
    expect(hasLineOfSight(REACTOR_DECK, { col: 8, row: 5 }, { col: 8, row: 11 })).toBe(false);
    expect(hasLineOfSight(REACTOR_DECK, { col: 1, row: 7 }, { col: 8, row: 7 })).toBe(true);
  });
});
