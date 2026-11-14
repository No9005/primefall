import { parseGrid, REACTOR_DECK, TileKind } from "game-core";
import { describe, expect, it } from "vitest";
import { boardBounds, computeCamera, pickTileAt, resolveTap } from "./board-layout";
import { buildTerrain, depthOf, gridToWorld, worldToGrid } from "./terrain";

const VIEWS = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
];
const grid = REACTOR_DECK;
const tiles = grid.tiles.flatMap((line, row) => line.map((kind, col) => ({ col, row, kind })));
// A board without standing pieces, where what is drawn at a floor centre is that floor tile.
const openGrid = parseGrid(["........", "........", "........", "........", "........"]);
const openTiles = openGrid.tiles.flatMap((line, row) => line.map((kind, col) => ({ col, row, kind })));

describe("the view", () => {
  it("maps every tile to a screen point and back to the same tile", () => {
    for (const tile of tiles) {
      const { x, y } = gridToWorld(tile);
      const back = worldToGrid(x, y);
      expect(back.col).toBeCloseTo(tile.col);
      expect(back.row).toBeCloseTo(tile.row);
    }
  });

  it("picks the tile that is drawn at a point: its floor centre", () => {
    for (const tile of openTiles) {
      const { x, y } = gridToWorld(tile);
      expect(pickTileAt(x, y, openGrid)).toEqual({ col: tile.col, row: tile.row });
    }
  });

  it("picks a Wall by the point on its drawn top", () => {
    const wall = buildTerrain(grid).find((tile) => tile.kind === TileKind.Wall && tile.piece);
    const top = wall!.piece!.at(-1)!.points;
    const x = (top[0]! + top[4]!) / 2;
    const y = (top[1]! + top[5]!) / 2;
    expect(pickTileAt(x, y, grid)).toBeDefined();
    expect(grid.tiles[pickTileAt(x, y, grid)!.row]![pickTileAt(x, y, grid)!.col]).toBe(TileKind.Wall);
  });

  it("resolves a tap on a highlighted tile to that tile", () => {
    const open = tiles.filter((t) => t.kind === TileKind.Floor).slice(0, 40);
    for (const tile of open) {
      const { x, y } = gridToWorld(tile);
      const target = resolveTap(x, y, { heroes: [], targetableIds: [], highlights: [tile] }, grid);
      expect(target).toEqual({ kind: "tile", tile: { col: tile.col, row: tile.row } });
    }
  });

  it("draws a Wall after the floor tile in front of it", () => {
    const ordered = buildTerrain(grid);
    const walls = ordered.filter((tile) => tile.kind === TileKind.Wall);
    expect(walls.length).toBeGreaterThan(0);
    for (const wall of walls) {
      const front = ordered.find((tile) => tile.kind === TileKind.Floor && tile.depth > wall.depth - 1.5 && tile.depth < wall.depth);
      if (!front) continue;
      expect(ordered.indexOf(wall)).toBeGreaterThan(ordered.indexOf(front));
    }
    for (let i = 1; i < ordered.length; i++) expect(ordered[i]!.depth).toBeGreaterThanOrEqual(ordered[i - 1]!.depth);
  });

  it("sorts a tile nearer the viewer after the tile behind it", () => {
    const sorted = [...tiles].sort((a, b) => depthOf(a) - depthOf(b));
    expect(buildTerrain(grid).map((tile) => depthOf(tile.position))).toEqual(sorted.map((tile) => depthOf(tile)));
  });

  it.each(VIEWS)("fits all four board corner tiles in a view of $width by $height", ({ width, height }) => {
    const camera = computeCamera(width, height, grid);
    const corners = [
      { col: 0, row: 0 },
      { col: grid.width - 1, row: 0 },
      { col: 0, row: grid.height - 1 },
      { col: grid.width - 1, row: grid.height - 1 },
    ];
    for (const corner of corners) {
      const { x, y } = gridToWorld(corner);
      expect(x * camera.scale + camera.x).toBeGreaterThanOrEqual(0);
      expect(x * camera.scale + camera.x).toBeLessThanOrEqual(width);
      expect(y * camera.scale + camera.y).toBeGreaterThanOrEqual(0);
      expect(y * camera.scale + camera.y).toBeLessThanOrEqual(height);
    }
    const bounds = boardBounds(grid);
    expect((bounds.right - bounds.left) * camera.scale).toBeLessThanOrEqual(width);
    expect((bounds.bottom - bounds.top) * camera.scale).toBeLessThanOrEqual(height);
  });
});
