import { parseGrid, REACTOR_DECK, TileKind } from "game-core";
import { describe, expect, it } from "vitest";
import { buildTerrain, FaceRole, gridToWorld, pickWallAt, TILE_HEIGHT, TILE_WIDTH, VIEW_ANGLE } from "./terrain";

const flatPoints = (points: number[]) => Array.from({ length: points.length / 2 }, (_, i) => ({ x: points[i * 2]!, y: points[i * 2 + 1]! }));

describe("buildTerrain at 45 degrees", () => {
  const tiles = buildTerrain(REACTOR_DECK, VIEW_ANGLE);

  it("yields one floor polygon per tile, equal to the diamond around gridToWorld", () => {
    expect(tiles).toHaveLength(REACTOR_DECK.width * REACTOR_DECK.height);
    for (const { position, floor } of tiles) {
      const { x, y } = gridToWorld(position);
      expect(flatPoints(floor.points)).toEqual([
        { x, y: y - TILE_HEIGHT / 2 },
        { x: x + TILE_WIDTH / 2, y },
        { x, y: y + TILE_HEIGHT / 2 },
        { x: x - TILE_WIDTH / 2, y },
      ]);
    }
  });

  it("gives a Wall a left side, a right side and a top, drawn in that order", () => {
    const wall = tiles.find((t) => t.kind === TileKind.Wall)!;
    expect(wall.piece?.map((face) => face.role)).toEqual([FaceRole.Left, FaceRole.Right, FaceRole.Top]);
    const { x, y } = gridToWorld(wall.position);
    const [left, right, top] = wall.piece!;
    // A full-tile Wall: sides stand on the lower edges of the diamond, the top is the diamond lifted by the Wall height.
    expect(flatPoints(left!.points).slice(0, 2)).toEqual([
      { x, y: y + TILE_HEIGHT / 2 },
      { x: x - TILE_WIDTH / 2, y },
    ]);
    expect(flatPoints(right!.points).slice(0, 2)).toEqual([
      { x: x + TILE_WIDTH / 2, y },
      { x, y: y + TILE_HEIGHT / 2 },
    ]);
    expect(flatPoints(top!.points)[0]).toEqual({ x, y: y - TILE_HEIGHT / 2 - 64 });
  });

  it("gives Cover and the Overwatch Nest a standing piece and open floor none", () => {
    for (const kind of [TileKind.HalfCover, TileKind.FullCover, TileKind.OverwatchNest]) {
      const tile = tiles.find((t) => t.kind === kind);
      if (tile) expect(tile.piece, kind).toHaveLength(3);
    }
    expect(tiles.find((t) => t.kind === TileKind.OverwatchNest)).toBeDefined();
    expect(tiles.find((t) => t.kind === TileKind.Floor)?.piece).toBeUndefined();
  });

  it("marks Spawn tiles", () => {
    expect(tiles.filter((t) => t.kind === TileKind.Spawn).every((t) => t.marker)).toBe(true);
    expect(tiles.some((t) => t.kind === TileKind.Spawn)).toBe(true);
  });

  it("orders nearer tiles last, by column plus row", () => {
    const depths = tiles.map((t) => t.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
    for (const t of tiles) expect(t.depth).toBe(t.position.col + t.position.row);
  });

  it("draws a Half Cover lower than a Wall", () => {
    const grid = parseGrid(["...", ".H#", "..."]);
    const topOf = (kind: TileKind) => buildTerrain(grid).find((t) => t.kind === kind)!.piece!.find((f) => f.role === FaceRole.Top)!;
    const lift = (kind: TileKind) => {
      const tile = buildTerrain(grid).find((t) => t.kind === kind)!;
      return gridToWorld(tile.position).y - Math.min(...flatPoints(topOf(kind).points).map((p) => p.y));
    };
    expect(lift(TileKind.HalfCover)).toBeLessThan(lift(TileKind.Wall));
  });
});

describe("buildTerrain at another angle", () => {
  it("turns the board and keeps the depth order consistent with the turn", () => {
    const grid = parseGrid(["..", ".."]);
    const turned = buildTerrain(grid, 135);
    const depths = turned.map((t) => t.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
    // A quarter turn about the origin moves tile (1, 0) to where tile (0, 1) was.
    const centre = (tile: { floor: { points: number[] } }) => ({
      x: (tile.floor.points[0]! + tile.floor.points[4]!) / 2,
      y: (tile.floor.points[1]! + tile.floor.points[5]!) / 2,
    });
    const find = (tiles: ReturnType<typeof buildTerrain>, col: number, row: number) => tiles.find((t) => t.position.col === col && t.position.row === row)!;
    const before = centre(find(buildTerrain(grid), 0, 1));
    const after = centre(find(turned, 1, 0));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
});

describe("pickWallAt", () => {
  const grid = parseGrid(["...", ".#.", "..."]);
  const { x, y } = gridToWorld({ col: 1, row: 1 });

  it("picks a Wall by its top and its side faces", () => {
    expect(pickWallAt(x, y - 64, grid)).toEqual({ col: 1, row: 1 });
    expect(pickWallAt(x - 50, y - 10, grid)).toEqual({ col: 1, row: 1 });
    expect(pickWallAt(x + 50, y - 10, grid)).toEqual({ col: 1, row: 1 });
  });

  it("does not pick the empty corners of the sprite rectangle", () => {
    expect(pickWallAt(x - 60, y - 90, grid)).toBeUndefined();
    expect(pickWallAt(x + 60, y - 90, grid)).toBeUndefined();
  });
});
