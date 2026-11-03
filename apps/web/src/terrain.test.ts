import { parseGrid, REACTOR_DECK, TileKind } from "game-core";
import { describe, expect, it } from "vitest";
import { buildTerrain, choosePiece, FaceRole, gridToWorld, Join, pickWallAt, TILE_HEIGHT, TILE_WIDTH, VIEW_ANGLE } from "./terrain";
import { PIECE_SHAPE, TERRAIN_STYLE } from "./terrain-style";

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

  it("gives a lone Wall a left side, a right side and a top, drawn in that order, as a pillar", () => {
    const [wall] = buildTerrain(parseGrid(["...", ".#.", "..."])).filter((t) => t.kind === TileKind.Wall);
    expect(wall!.piece?.map((face) => face.role)).toEqual([FaceRole.Left, FaceRole.Right, FaceRole.Top]);
    const { x, y } = gridToWorld(wall!.position);
    const [left, right, top] = wall!.piece!;
    // A pillar half a tile wide: its sides stand on the lower edges of the half-size diamond.
    expect(flatPoints(left!.points).slice(0, 2)).toEqual([
      { x, y: y + TILE_HEIGHT / 4 },
      { x: x - TILE_WIDTH / 4, y },
    ]);
    expect(flatPoints(right!.points).slice(0, 2)).toEqual([
      { x: x + TILE_WIDTH / 4, y },
      { x, y: y + TILE_HEIGHT / 4 },
    ]);
    expect(flatPoints(top!.points)[0]).toEqual({ x, y: y - TILE_HEIGHT / 4 - 64 });
  });

  it("draws a Wall run thinner than the tile and joined to the tile edge", () => {
    const [, wall] = buildTerrain(parseGrid(["...", "###", "..."])).filter((t) => t.kind === TileKind.Wall);
    const { col, row } = wall!.position;
    const tops = wall!.piece!.filter((face) => face.role === FaceRole.Top);
    // Three boxes (middle post and two arms); the east arm ends on the tile edge, a third of a tile wide.
    expect(tops).toHaveLength(3);
    const at = (c: number, r: number) => ({ x: ((c - r) * TILE_WIDTH) / 2, y: ((c + r) * TILE_HEIGHT) / 2 - 64 });
    const corner = at(col + 0.5, row - 1 / 6);
    const points = tops.flatMap((face) => flatPoints(face.points));
    expect(points.some((p) => Math.abs(p.x - corner.x) < 1e-6 && Math.abs(p.y - corner.y) < 1e-6)).toBe(true);
  });

  it("gives Cover and the Overwatch Nest a standing piece and open floor none", () => {
    for (const kind of [TileKind.HalfCover, TileKind.FullCover, TileKind.OverwatchNest]) {
      const tile = tiles.find((t) => t.kind === kind);
      if (tile) expect(tile.piece?.length, kind).toBeGreaterThanOrEqual(3);
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

describe("choosePiece", () => {
  const choose = (rows: string[], col: number, row: number) => choosePiece(parseGrid(rows), { col, row });
  const center = ["...", ".#.", "..."];

  it("draws an isolated Wall as a pillar and open floor as nothing", () => {
    expect(choose(center, 1, 1)).toEqual({ kind: "wall", form: "pillar", joins: 0 });
    expect(choose(center, 0, 0)).toBeUndefined();
  });

  it("draws the ends and the middle of a straight run", () => {
    const run = ["...", "###", "..."];
    expect(choose(run, 0, 1)).toEqual({ kind: "wall", form: "end", joins: Join.East });
    expect(choose(run, 1, 1)).toEqual({ kind: "wall", form: "straight", joins: Join.West | Join.East });
    expect(choose(["#", "#", "#"], 0, 1)).toEqual({ kind: "wall", form: "straight", joins: Join.North | Join.South });
  });

  it("draws an L at a right angle, a T and a cross", () => {
    expect(choose(["...", ".##", ".#."], 1, 1)).toEqual({ kind: "wall", form: "corner", joins: Join.East | Join.South });
    expect(choose(["...", "###", ".#."], 1, 1)).toEqual({ kind: "wall", form: "tee", joins: Join.West | Join.East | Join.South });
    expect(choose([".#.", "###", ".#."], 1, 1)).toEqual({ kind: "wall", form: "cross", joins: 15 });
  });

  it("does not join a Wall to Cover, and joins Cover of the same kind", () => {
    expect(choose(["#H"], 0, 0)?.form).toBe("pillar");
    expect(choose(["HH"], 0, 0)).toEqual({ kind: "halfCover", form: "end", joins: Join.East });
    expect(choose(["FF"], 1, 0)).toEqual({ kind: "fullCover", form: "end", joins: Join.West });
    expect(choose(["HF"], 0, 0)?.form).toBe("pillar");
  });

  it("keeps the Overwatch Nest alone", () => {
    expect(choose(["OO"], 0, 0)).toEqual({ kind: "overwatchNest", form: "pillar", joins: 0 });
  });

  it("draws Full Cover taller than Half Cover, both with the warning edge", () => {
    expect(PIECE_SHAPE.fullCover.height).toBeGreaterThan(PIECE_SHAPE.halfCover.height);
    expect(TERRAIN_STYLE.halfCover.edge).toBe(TERRAIN_STYLE.fullCover.edge);
  });
});

describe("pickWallAt", () => {
  const grid = parseGrid(["...", ".#.", "..."]);
  const { x, y } = gridToWorld({ col: 1, row: 1 });

  it("picks a Wall by its top and its side faces", () => {
    expect(pickWallAt(x, y - 64, grid)).toEqual({ col: 1, row: 1 });
    expect(pickWallAt(x - 20, y - 10, grid)).toEqual({ col: 1, row: 1 });
    expect(pickWallAt(x + 20, y - 10, grid)).toEqual({ col: 1, row: 1 });
  });

  it("leaves the floor around a thin Wall tappable", () => {
    expect(pickWallAt(x - 50, y - 10, grid)).toBeUndefined();
    expect(pickWallAt(x + 50, y - 10, grid)).toBeUndefined();
    expect(pickWallAt(x - 60, y - 90, grid)).toBeUndefined();
    expect(pickWallAt(x + 60, y - 90, grid)).toBeUndefined();
  });
});
