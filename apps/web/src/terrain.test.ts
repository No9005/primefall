import { coverAt, CoverKind, parseGrid, REACTOR_DECK, tileAt, TileKind } from "game-core";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTerrain, choosePiece, coverLook, coverMarks, FaceRole, gridToWorld, Join, lineScale, litTiles, pickWallAt, TILE_HEIGHT, TILE_WIDTH, VIEW_ANGLE, withoutCover, worldLineWidth } from "./terrain";
import { HERO_REFERENCE_LUMINANCE, OUTLINE, PIECE_SHAPE, TERRAIN_STYLE } from "./terrain-style";

/** WCAG relative luminance of a 0xRRGGBB colour. */
function relativeLuminance(hex: number): number {
  const [r, g, b] = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

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

  it("gives Cover a standing piece and open floor none", () => {
    for (const kind of [TileKind.HalfCover, TileKind.FullCover]) {
      const tile = tiles.find((t) => t.kind === kind);
      if (tile) expect(tile.piece?.length, kind).toBeGreaterThanOrEqual(3);
    }
    expect(tiles.some((t) => t.kind === TileKind.OverwatchNest)).toBe(false);
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


  it("draws Full Cover at least twice as tall as Half Cover", () => {
    expect(PIECE_SHAPE.fullCover.height).toBeGreaterThanOrEqual(2 * PIECE_SHAPE.halfCover.height);
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

describe("tile brightness from sight", () => {
  const grid = parseGrid(["S.#.P", "....."]);
  const seen = [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 1, row: 1 },
  ];
  const tiles = buildTerrain(grid, VIEW_ANGLE, litTiles(seen, [{ col: 0, row: 1 }]));
  const at = (col: number, row: number) => tiles.find((t) => t.position.col === col && t.position.row === row)!;

  it("draws a visible tile lit and the tile of an own Hero lit even when it is not visible", () => {
    expect(at(1, 0).lit).toBe(true);
    expect(at(1, 0).floor.fill).toBe(TERRAIN_STYLE.floorLit.fill);
    expect(at(0, 1).lit).toBe(true);
  });

  it("draws a tile that is not visible, such as the one behind a Wall, dark", () => {
    expect(at(3, 0).lit).toBe(false);
    expect(at(3, 0).floor.fill).toBe(TERRAIN_STYLE.floorDark.fill);
  });

  it("keeps the Prime Zone, Spawns and Walls faintly visible in the fog", () => {
    expect(at(4, 0).floor.fill).toBe(TERRAIN_STYLE.primeZoneDark.fill);
    expect(at(4, 0).floor.fill).not.toBe(TERRAIN_STYLE.floorDark.fill);
    expect(at(2, 0).lit).toBe(false);
    expect(at(2, 0).piece).toBeDefined();
    const dark = buildTerrain(grid, VIEW_ANGLE, litTiles([], []));
    expect(dark.find((t) => t.kind === TileKind.Spawn)?.marker?.color).toBe(TERRAIN_STYLE.spawnMarkerDark);
  });

  it("draws every tile lit when no sight is given", () => {
    expect(buildTerrain(grid).every((t) => t.lit)).toBe(true);
  });
});

describe("the look of the terrain (artboard J)", () => {
  const faces = (rows: string[]) => buildTerrain(parseGrid(rows)).flatMap((tile) => tile.piece ?? []);

  it("outlines Wall faces dark, Full Cover with a bright top edge, Half Cover without one", () => {
    for (const face of faces(["#"])) expect(face.edge).toBe(OUTLINE.color);
    for (const face of faces(["F"])) expect(face.edge).toBe(face.role === FaceRole.Top ? TERRAIN_STYLE.fullCover.topEdge : OUTLINE.color);
    expect(faces(["F"]).some((face) => face.role === FaceRole.Top)).toBe(true);
    for (const face of faces(["H"])) expect(face.edge).toBe(TERRAIN_STYLE.halfCover.edge);
  });

  it("draws Cover outlines 1 px wide and Wall outlines at the outline width", () => {
    for (const face of [...faces(["F"]), ...faces(["H"])]) expect(face.edgeWidth).toBe(1);
    for (const face of faces(["#"])) expect(face.edgeWidth).toBe(OUTLINE.width);
  });

  it("keeps the Fog of War look", () => {
    expect(TERRAIN_STYLE.floorLit).toEqual({ fill: 0x2c4257, edge: 0x3d5a73 });
    expect(TERRAIN_STYLE.floorDark).toEqual({ fill: 0x0b1016, edge: 0x141c25 });
    expect(TERRAIN_STYLE.primeZoneDark).toEqual({ fill: 0x0f1f22, edge: 0x1d6b66 });
    expect(TERRAIN_STYLE.fogPieceAlpha).toBe(0.45);
    expect(relativeLuminance(TERRAIN_STYLE.floorLit.fill)).toBeGreaterThan(relativeLuminance(TERRAIN_STYLE.floorDark.fill));
  });

  it("ranks Hero > Full Cover > Half Cover > Wall > floor by luminance", () => {
    const mean = (s: { top: number; left: number; right: number }) => (relativeLuminance(s.top) + relativeLuminance(s.left) + relativeLuminance(s.right)) / 3;
    const { floor, fullCover, halfCover, wall } = TERRAIN_STYLE;
    expect(HERO_REFERENCE_LUMINANCE).toBeGreaterThan(mean(fullCover));
    expect(mean(fullCover)).toBeGreaterThan(mean(halfCover));
    expect(mean(halfCover)).toBeGreaterThan(mean(wall));
    expect(mean(wall)).toBeGreaterThan(Math.max(relativeLuminance(floor.fill), relativeLuminance(floor.fillAlt)));
    expect(relativeLuminance(floor.edge)).toBeLessThanOrEqual(0.1);
    expect(relativeLuminance(floor.edge)).toBeLessThan(mean(fullCover));
  });

  it("gives Cover no warm tint and no yellow", () => {
    const channels = (hex: number) => ({ r: (hex >> 16) & 255, b: hex & 255 });
    for (const style of [TERRAIN_STYLE.fullCover, TERRAIN_STYLE.halfCover]) {
      for (const hex of [style.top, style.left, style.right, style.edge, "topEdge" in style ? style.topEdge : style.edge]) {
        const { r, b } = channels(hex);
        expect(r - b).toBeLessThanOrEqual(12);
        expect(hex).not.toBe(0xe5b429);
      }
    }
  });

  it("marks the map's own Cover with a shield, once per Cover tile and none on built Cover", () => {
    const grid = parseGrid(["FH.", "#.F"]);
    const marks = coverMarks(grid);
    expect(marks.map((mark) => mark.kind).sort()).toEqual(["full", "full", "half"]);
    expect(new Set(marks.map((mark) => `${mark.position.col},${mark.position.row}`)).size).toBe(3);
    expect(coverMarks(grid, VIEW_ANGLE, new Set(["1,0"])).map((mark) => mark.kind).sort()).toEqual(["full", "full"]);
  });

  it("draws natural Cover as one panel across the front, 16 and 34 game px high, level on the screen", () => {
    const gamePx = TILE_WIDTH / 46;
    const height = (kind: "half" | "full") => {
      const [first] = coverLook({ col: 1, row: 1 }, kind, false).panels;
      return first!.foot[1]! - first!.top[1]!;
    };
    expect(coverLook({ col: 1, row: 1 }, "half", false).panels).toHaveLength(1);
    for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const [panel] = coverLook({ col: 1, row: 1 }, "half", false, angle).panels;
      expect(panel!.foot[1]).toBeCloseTo(panel!.foot[3]!);
      expect(panel!.foot[2]! - panel!.foot[0]!).toBeGreaterThan(0);
    }
    expect(height("half")).toBeCloseTo(16 * gamePx);
    expect(height("full")).toBeCloseTo(34 * gamePx);
  });

  it("draws built Cover as striped bars, 9 and 22 game px high, the Full one with a rail", () => {
    const gamePx = TILE_WIDTH / 46;
    const half = coverLook({ col: 1, row: 1 }, "half", true);
    const full = coverLook({ col: 1, row: 1 }, "full", true);
    expect(half.panels).toEqual([]);
    expect(half.bars.some((bar) => bar.stripes.length > 0)).toBe(true);
    expect(half.rails).toEqual([]);
    expect(full.rails.length).toBeGreaterThan(0);
    const centreY = gridToWorld({ col: 1, row: 1 }).y;
    const tops = (look: typeof half) => Math.min(...look.bars.flatMap((bar) => bar.points.filter((_, i) => i % 2 === 1)));
    expect(centreY - 32 - tops(half) - 0).toBeCloseTo(9 * gamePx, 0);
    expect(centreY - 32 - tops(full) - 0).toBeCloseTo(22 * gamePx, 0);
  });

  it("draws the floor with fine grid lines, thinner than the piece outline", () => {
    const [tile] = buildTerrain(parseGrid(["."]));
    expect(tile!.floor.edgeWidth).toBe(TERRAIN_STYLE.gridLineWidth);
    expect(tile!.floor.edgeWidth).toBeLessThan(OUTLINE.width);
  });

  it("keeps a line the same width on screen when the zoom changes", () => {
    for (const scale of [0.5, 1, 2, 3.5]) expect(worldLineWidth(OUTLINE.width, scale) * scale).toBeCloseTo(OUTLINE.width);
  });

  it("redraws per step of zoom, not per frame", () => {
    expect(lineScale(1.01)).toBe(lineScale(1.04));
    expect(lineScale(1.04)).not.toBe(lineScale(1.16));
    expect(lineScale(0)).toBeGreaterThan(0);
  });

  it("has no colour literal in the terrain and Hero drawing code outside the style files", () => {
    for (const file of ["terrain.ts", "hero-figure.ts"]) {
      expect(readFileSync(path.join(__dirname, file), "utf8"), file).not.toMatch(/0x[0-9a-fA-F]{6}|#[0-9a-fA-F]{6}\b/);
    }
  });
});

describe("the grid without Cover", () => {
  it("turns every Half and Full Cover tile into floor and keeps Walls and zones", () => {
    const grid = withoutCover(REACTOR_DECK);
    let covers = 0;
    let zones = 0;
    grid.tiles.forEach((line, row) => line.forEach((_, col) => {
      if (coverAt(grid, { col, row }) !== CoverKind.None) covers += 1;
      if (tileAt(grid, { col, row }) === TileKind.PrimeZone || tileAt(grid, { col, row }) === TileKind.Outpost) zones += 1;
    }));
    expect(covers).toBe(0);
    const before = (kind: TileKind) => REACTOR_DECK.tiles.flat().filter((tile) => tile === kind).length;
    expect(zones).toBe(before(TileKind.PrimeZone) + before(TileKind.Outpost));
    expect(grid.tiles.flat().filter((tile) => tile === TileKind.Wall).length).toBe(before(TileKind.Wall));
  });
});
