import { describe, expect, it } from "vitest";
import {
  CoverKind,
  coverAt,
  defenderStartTiles,
  findTiles,
  type GridPosition,
  hasLineOfSight,
  isStepAllowed,
  parseGrid,
  REACTOR_DECK,
  spawnStartTiles,
  TileKind,
  tileAt,
} from "./reactor-deck";

const centreColumn = (REACTOR_DECK.width - 1) / 2;
const spawns = findTiles(REACTOR_DECK, TileKind.Spawn);
const zone = findTiles(REACTOR_DECK, TileKind.PrimeZone);
const outposts = findTiles(REACTOR_DECK, TileKind.Outpost);

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
const isOutpost = (tile: GridPosition) => tileAt(REACTOR_DECK, tile) === TileKind.Outpost;
const spawnsOf = (side: "left" | "right") => spawns.filter((tile) => (side === "left" ? tile.col < centreColumn : tile.col > centreColumn));
const open = (tile: GridPosition) => tileAt(REACTOR_DECK, tile) !== TileKind.Wall;

describe("Reactor Deck", () => {
  it("is 45 by 25 tiles", () => {
    expect(REACTOR_DECK.width).toBe(45);
    expect(REACTOR_DECK.height).toBe(25);
    expect(centreColumn).toBe(22);
  });

  it("is mirror-symmetric except the two slabs beside the Prime Zone and the Overwatch Nests", () => {
    const slab = ({ col, row }: GridPosition) => ((col === 27 || col === 28) && row >= 12 && row <= 14) || ((col === 16 || col === 17) && row >= 10 && row <= 12);
    const nestOrItsMirror = ({ row }: GridPosition) => row === 7 || row === 17;
    for (let row = 0; row < REACTOR_DECK.height; row++) {
      for (let col = 0; col < REACTOR_DECK.width; col++) {
        const mirror = { col: REACTOR_DECK.width - 1 - col, row };
        if (!slab({ col, row }) && !slab(mirror)) expect(tileAt(REACTOR_DECK, { col, row }), `${col},${row}`).toBe(tileAt(REACTOR_DECK, mirror));
      }
    }
    // Top-bottom symmetry holds everywhere but the Nests (row 7) and the Full Cover that stands in their place (row 17) and the slabs.
    for (let row = 0; row < REACTOR_DECK.height; row++) {
      for (let col = 0; col < REACTOR_DECK.width; col++) {
        const flipped = { col, row: REACTOR_DECK.height - 1 - row };
        if (slab({ col, row }) || slab(flipped) || nestOrItsMirror({ col, row })) continue;
        // The left-side slab piece (16-17) sits at rows 10-12 and mirrors onto 12-14; these are covered by `slab`.
        expect(tileAt(REACTOR_DECK, { col, row }), `${col},${row}`).toBe(tileAt(REACTOR_DECK, flipped));
      }
    }
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

  it("gives each Squad a 2 by 5 Spawn strip on its own edge", () => {
    expect(spawns).toHaveLength(20);
    expect(spawnsOf("left").every(({ col, row }) => col >= 1 && col <= 2 && row >= 10 && row <= 14)).toBe(true);
    expect(spawnsOf("right").every(({ col, row }) => col >= 42 && col <= 43 && row >= 10 && row <= 14)).toBe(true);
    expect(spawnsOf("left")).toHaveLength(10);
    expect(spawnsOf("right")).toHaveLength(10);
  });

  it("starts the three Heroes of a Squad on the middle rows of the inner Spawn column", () => {
    expect(spawnStartTiles(true)).toEqual([11, 12, 13].map((row) => ({ col: 2, row })));
    expect(spawnStartTiles(false)).toEqual([11, 12, 13].map((row) => ({ col: 42, row })));
  });

  it("starts Defenders on the middle rows of the inner column of the Prime Zone", () => {
    expect(defenderStartTiles(true)).toEqual([11, 12, 13].map((row) => ({ col: 20, row })));
    expect(defenderStartTiles(false)).toEqual([11, 12, 13].map((row) => ({ col: 24, row })));
  });

  it("puts the open 5 by 5 Prime Zone on the central tiles", () => {
    expect(zone).toHaveLength(25);
    for (const { col, row } of zone) {
      expect(col).toBeGreaterThanOrEqual(20);
      expect(col).toBeLessThanOrEqual(24);
      expect(row).toBeGreaterThanOrEqual(10);
      expect(row).toBeLessThanOrEqual(14);
      expect(coverAt(REACTOR_DECK, { col, row })).toBe(CoverKind.None);
    }
  });

  it("puts two 3 by 3 Outposts on the centre column, top and bottom", () => {
    expect(outposts).toHaveLength(18);
    expect(outposts.filter(({ row }) => row <= 4).map(({ col, row }) => `${col},${row}`).sort()).toEqual(
      [21, 22, 23].flatMap((col) => [2, 3, 4].map((row) => `${col},${row}`)).sort(),
    );
    expect(outposts.filter(({ row }) => row >= 20).map(({ col, row }) => `${col},${row}`).sort()).toEqual(
      [21, 22, 23].flatMap((col) => [20, 21, 22].map((row) => `${col},${row}`)).sort(),
    );
  });

  it("keeps the two Overwatch Nests in the elbow of the upper ruins", () => {
    expect(findTiles(REACTOR_DECK, TileKind.OverwatchNest)).toEqual([
      { col: 13, row: 7 },
      { col: 31, row: 7 },
    ]);
  });
});

describe("Reactor Deck sight lines", () => {
  it("has no Line of Sight from any left Spawn tile to any right Spawn tile", () => {
    let open = 0;
    for (const a of spawnsOf("left")) for (const b of spawnsOf("right")) if (hasLineOfSight(REACTOR_DECK, a, b)) open++;
    expect(open).toBe(0);
  });

  it("has no open tile that sees the centre of the Prime Zone and of both Outposts at once", () => {
    const centres = [
      { col: 22, row: 12 },
      { col: 22, row: 3 },
      { col: 22, row: 21 },
    ];
    for (let row = 0; row < REACTOR_DECK.height; row++) {
      for (let col = 0; col < REACTOR_DECK.width; col++) {
        const tile = { col, row };
        if (!open(tile)) continue;
        expect(centres.every((centre) => hasLineOfSight(REACTOR_DECK, tile, centre)), `${col},${row}`).toBe(false);
      }
    }
  });

  it("has no firing lane longer than 16 tiles along the top and bottom edge rows", () => {
    const blocks = (tile: GridPosition) => tileAt(REACTOR_DECK, tile) === TileKind.Wall || coverAt(REACTOR_DECK, tile) === CoverKind.Full;
    for (const row of [1, 2, 3, 4, 20, 21, 22, 23]) {
      let run = 0;
      for (let col = 0; col < REACTOR_DECK.width; col++) {
        run = blocks({ col, row }) ? 0 : run + 1;
        expect(run, `row ${row}, col ${col}`).toBeLessThanOrEqual(16);
      }
    }
  });
});

describe("Reactor Deck routes", () => {
  it.each(["left", "right"] as const)("lets the %s Spawn reach the Prime Zone", (side) => {
    expect(reaches(spawnsOf(side), isZone, open)).toBe(true);
  });

  it.each(["left", "right"] as const)("lets the %s Spawn reach both Outposts", (side) => {
    expect(reaches(spawnsOf(side), (tile) => isOutpost(tile) && tile.row < 12, open)).toBe(true);
    expect(reaches(spawnsOf(side), (tile) => isOutpost(tile) && tile.row > 12, open)).toBe(true);
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
    REACTOR_DECK.tiles.forEach((line, row) =>
      line.forEach((kind, col) => {
        if (kind === TileKind.Wall) expect(isStepAllowed({ col: 22, row: 12 }, { col, row })).toBe(false);
      }),
    );
    // The wall of the ruin at column 10 and 11 stands between these tiles.
    expect(hasLineOfSight(REACTOR_DECK, { col: 9, row: 8 }, { col: 14, row: 8 })).toBe(false);
    expect(hasLineOfSight(REACTOR_DECK, { col: 1, row: 11 }, { col: 8, row: 11 })).toBe(true);
  });
});
