import { describe, expect, it } from "vitest";
import { findTiles, parseGrid, REACTOR_DECK, TileKind, tileAt } from "./reactor-deck";

const centreColumn = (REACTOR_DECK.width - 1) / 2;

describe("Reactor Deck", () => {
  it("is 21 by 11 tiles", () => {
    expect(REACTOR_DECK.width).toBe(21);
    expect(REACTOR_DECK.height).toBe(11);
  });

  it("is mirror-symmetric around the central column", () => {
    for (const line of REACTOR_DECK.tiles) {
      expect([...line].reverse()).toEqual([...line]);
    }
    expect(centreColumn).toBe(10);
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
    const spawns = findTiles(REACTOR_DECK, TileKind.Spawn);
    const left = spawns.filter((p) => p.col < centreColumn);
    const right = spawns.filter((p) => p.col > centreColumn);
    expect(spawns).toHaveLength(6);
    expect(left).toEqual([1, 2, 3].map((i) => ({ col: 1, row: 3 + i })));
    expect(right).toEqual([1, 2, 3].map((i) => ({ col: 19, row: 3 + i })));
  });

  it("puts the 3 by 3 Prime Zone on the central tiles", () => {
    const zone = findTiles(REACTOR_DECK, TileKind.PrimeZone);
    expect(zone).toHaveLength(9);
    for (const { col, row } of zone) {
      expect(col).toBeGreaterThanOrEqual(9);
      expect(col).toBeLessThanOrEqual(11);
      expect(row).toBeGreaterThanOrEqual(4);
      expect(row).toBeLessThanOrEqual(6);
    }
  });

  it("has exactly one Overwatch Nest on the central column", () => {
    expect(findTiles(REACTOR_DECK, TileKind.OverwatchNest)).toEqual([{ col: 10, row: 1 }]);
  });

  it("places Half Cover symmetrically in the main corridor", () => {
    expect(findTiles(REACTOR_DECK, TileKind.HalfCover)).toEqual([{ col: 5, row: 5 }, { col: 15, row: 5 }]);
  });
});

describe("parseGrid", () => {
  it("rejects unknown tiles and ragged rows", () => {
    expect(() => parseGrid(["#?#"])).toThrow("Unknown tile");
    expect(() => parseGrid(["###", "##"])).toThrow("width");
  });
});
