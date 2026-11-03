import { describe, expect, it } from "vitest";
import { CoverKind, coverAgainst, hasLineOfSight, parseGrid, REACTOR_DECK, shotLine } from "./reactor-deck";

const grid = parseGrid(["#########", "#.......#", "#...#...#", "#.H...F.#", "#.......#", "#########"]);

describe("shotLine", () => {
  it("is a clear shot over open floor", () => {
    const line = shotLine(grid, { col: 1, row: 1 }, { col: 5, row: 1 }, 6);
    expect(line).toMatchObject({ inRange: true, lineOfSight: true, cover: CoverKind.None, canHit: true });
    expect(line.blockedAt).toBeUndefined();
    expect(line.rangeEnd).toBeUndefined();
  });

  it("returns the Wall that blocks the shot", () => {
    const line = shotLine(grid, { col: 2, row: 2 }, { col: 6, row: 2 }, 6);
    expect(line).toMatchObject({ lineOfSight: false, canHit: false, blockedAt: { col: 4, row: 2 } });
  });

  it("reports the blocker nearest to the attacker", () => {
    const walls = parseGrid(["#######", "#.#.#.#", "#######"]);
    expect(shotLine(walls, { col: 1, row: 1 }, { col: 5, row: 1 }, 6).blockedAt).toEqual({ col: 2, row: 1 });
    expect(shotLine(walls, { col: 5, row: 1 }, { col: 1, row: 1 }, 6).blockedAt).toEqual({ col: 4, row: 1 });
  });

  it("marks Half Cover and Full Cover on the target", () => {
    const half = shotLine(grid, { col: 5, row: 3 }, { col: 2, row: 3 }, 6);
    expect(half).toMatchObject({ cover: CoverKind.Half, canHit: true });
    const full = shotLine(grid, { col: 3, row: 3 }, { col: 6, row: 3 }, 6);
    expect(full).toMatchObject({ cover: CoverKind.Full, canHit: false });
  });

  it("ignores Cover at Range 1", () => {
    expect(shotLine(grid, { col: 3, row: 3 }, { col: 2, row: 3 }, 3).cover).toBe(CoverKind.None);
  });

  it("stops where the Range ends", () => {
    const line = shotLine(grid, { col: 1, row: 1 }, { col: 7, row: 1 }, 3);
    expect(line).toMatchObject({ inRange: false, canHit: false, rangeEnd: { col: 4, row: 1 } });
  });

  it("agrees with hasLineOfSight and coverAgainst on a grid of start and end tiles", () => {
    const tiles = REACTOR_DECK.tiles.flatMap((line, row) => line.map((_, col) => ({ col, row }))).filter((_, index) => index % 7 === 0);
    for (const from of tiles) {
      for (const to of tiles) {
        const line = shotLine(REACTOR_DECK, from, to, 4);
        expect(line.lineOfSight).toBe(hasLineOfSight(REACTOR_DECK, from, to));
        expect(line.cover).toBe(coverAgainst(REACTOR_DECK, from, to));
        expect(line.blockedAt !== undefined).toBe(!line.lineOfSight);
      }
    }
  });
});
