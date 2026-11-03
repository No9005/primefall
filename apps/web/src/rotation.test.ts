import { parseGrid, REACTOR_DECK, TileKind } from "game-core";
import { describe, expect, it } from "vitest";
import { boardBounds, clampCamera, computeCamera, isZoomed, pickTileAt, resolveTap, turnCamera, zoomOnPoint } from "./board-layout";
import { buildTerrain, depthOf, gridToWorld, turnView, VIEW_ANGLE, worldToGrid } from "./terrain";

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const VIEWS = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
];
const grid = REACTOR_DECK;
const tiles = grid.tiles.flatMap((line, row) => line.map((kind, col) => ({ col, row, kind })));
// A board without standing pieces, where what is drawn at a floor centre is that floor tile.
const openGrid = parseGrid(["........", "........", "........", "........", "........"]);
const openTiles = openGrid.tiles.flatMap((line, row) => line.map((kind, col) => ({ col, row, kind })));

describe("turnView", () => {
  it("returns to the start after eight turns in either direction", () => {
    for (const steps of [1, -1] as const) {
      let angle = VIEW_ANGLE;
      const seen = new Set<number>();
      for (let i = 0; i < 8; i++) {
        seen.add(angle);
        angle = turnView(angle, steps);
      }
      expect(angle).toBe(VIEW_ANGLE);
      expect([...seen].sort((a, b) => a - b)).toEqual(ANGLES);
    }
  });
});

describe.each(ANGLES)("view at %i degrees", (angle) => {
  it("maps every tile to a screen point and back to the same tile", () => {
    for (const tile of tiles) {
      const { x, y } = gridToWorld(tile, angle);
      const back = worldToGrid(x, y, angle);
      expect(back.col).toBeCloseTo(tile.col);
      expect(back.row).toBeCloseTo(tile.row);
    }
  });

  it("picks the tile that is drawn at a point: its floor centre", () => {
    for (const tile of openTiles) {
      const { x, y } = gridToWorld(tile, angle);
      expect(pickTileAt(x, y, openGrid, angle)).toEqual({ col: tile.col, row: tile.row });
    }
  });

  it("picks a Wall by the point on its drawn top", () => {
    const wall = buildTerrain(grid, angle).find((tile) => tile.kind === TileKind.Wall && tile.piece);
    const top = wall!.piece!.at(-1)!.points;
    const x = (top[0]! + top[4]!) / 2;
    const y = (top[1]! + top[5]!) / 2;
    expect(pickTileAt(x, y, grid, angle)).toBeDefined();
    expect(grid.tiles[pickTileAt(x, y, grid, angle)!.row]![pickTileAt(x, y, grid, angle)!.col]).toBe(TileKind.Wall);
  });

  it("resolves a tap on a highlighted tile to that tile", () => {
    const open = tiles.filter((t) => t.kind === TileKind.Floor).slice(0, 40);
    for (const tile of open) {
      const { x, y } = gridToWorld(tile, angle);
      const target = resolveTap(x, y, { heroes: [], targetableIds: [], highlights: [tile] }, grid, angle);
      expect(target).toEqual({ kind: "tile", tile: { col: tile.col, row: tile.row } });
    }
  });

  it("draws a Wall after the floor tile in front of it", () => {
    const ordered = buildTerrain(grid, angle);
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
    const sorted = [...tiles].sort((a, b) => depthOf(a, angle) - depthOf(b, angle));
    expect(buildTerrain(grid, angle).map((tile) => depthOf(tile.position, angle))).toEqual(sorted.map((tile) => depthOf(tile, angle)));
  });

  it.each(VIEWS)("fits all four board corner tiles in a view of $width by $height", ({ width, height }) => {
    const camera = computeCamera(width, height, grid, angle);
    const corners = [
      { col: 0, row: 0 },
      { col: grid.width - 1, row: 0 },
      { col: 0, row: grid.height - 1 },
      { col: grid.width - 1, row: grid.height - 1 },
    ];
    for (const corner of corners) {
      const { x, y } = gridToWorld(corner, angle);
      expect(x * camera.scale + camera.x).toBeGreaterThanOrEqual(0);
      expect(x * camera.scale + camera.x).toBeLessThanOrEqual(width);
      expect(y * camera.scale + camera.y).toBeGreaterThanOrEqual(0);
      expect(y * camera.scale + camera.y).toBeLessThanOrEqual(height);
    }
    const bounds = boardBounds(grid, angle);
    expect((bounds.right - bounds.left) * camera.scale).toBeLessThanOrEqual(width);
    expect((bounds.bottom - bounds.top) * camera.scale).toBeLessThanOrEqual(height);
  });
});

describe("turnCamera", () => {
  const view = { width: 844, height: 390, angle: 45 };

  it("refits a fitted camera for the new angle", () => {
    expect(turnCamera(computeCamera(844, 390, grid, 45), view, 90)).toEqual(computeCamera(844, 390, grid, 90));
  });

  it("keeps a zoomed camera zoomed and the tile in the middle of the view in the middle", () => {
    const hero = { col: Math.floor(grid.width / 2), row: Math.floor(grid.height / 2) };
    const zoomed = zoomOnPoint(gridToWorld(hero, 45), view);
    const turned = turnCamera(zoomed, view, 90);
    expect(isZoomed(turned, { ...view, angle: 90 })).toBe(true);
    const middle = worldToGrid((view.width / 2 - turned.x) / turned.scale, (view.height / 2 - turned.y) / turned.scale, 90);
    expect(middle.col).toBeCloseTo(hero.col, 0);
    expect(middle.row).toBeCloseTo(hero.row, 0);
    expect(clampCamera(turned, { ...view, angle: 90 })).toEqual(turned);
  });
});
