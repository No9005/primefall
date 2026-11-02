import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REACTOR_DECK, TileKind } from "game-core";
import { describe, expect, it } from "vitest";
import {
  AssetAlias,
  beginMoveFraming,
  endMoveFraming,
  frameMoveCamera,
  takeOverFraming,
  boardBounds,
  buildPlacements,
  clampCamera,
  computeCamera,
  gridToWorld,
  HERO_PICK_TOLERANCE,
  HERO_ZOOM,
  isZoomed,
  Layer,
  MAX_ZOOM,
  panBy,
  pickTileAt,
  resolveTap,
  zoomAt,
  zoomOnPoint,
  TILE_HEIGHT,
  TILE_WIDTH,
  viewToWorld,
  worldToGrid,
} from "./board-layout";

const assetsDir = path.resolve(__dirname, "../public/assets");
const manifest = JSON.parse(readFileSync(path.join(assetsDir, "manifest.json"), "utf8")) as {
  bundles: { assets: { alias: string; src: string }[] }[];
};
const manifestAssets = new Map(manifest.bundles.flatMap((b) => b.assets).map((a) => [a.alias, a.src]));

describe("gridToWorld", () => {
  it("uses the 2:1 projection with 128 x 64 px tiles", () => {
    expect(gridToWorld({ col: 0, row: 0 })).toEqual({ x: 0, y: 0 });
    expect(gridToWorld({ col: 1, row: 0 })).toEqual({ x: 64, y: 32 });
    expect(gridToWorld({ col: 0, row: 1 })).toEqual({ x: -64, y: 32 });
  });
});

describe("buildPlacements for the Reactor Deck", () => {
  const placements = buildPlacements(REACTOR_DECK);
  const floors = placements.filter((p) => p.layer === Layer.Floor);
  const objects = placements.filter((p) => p.layer === Layer.Object);

  it("draws one floor sprite per tile", () => {
    expect(floors).toHaveLength(REACTOR_DECK.width * REACTOR_DECK.height);
  });

  it("only uses aliases that exist in the manifest with an existing file", () => {
    for (const alias of new Set([...placements.map((p) => p.alias), ...Object.values(AssetAlias)])) {
      const src = manifestAssets.get(alias);
      expect(src, alias).toBeDefined();
      expect(existsSync(path.join(assetsDir, src!)), alias).toBe(true);
    }
  });

  it("uses every tile and prop kind the Reactor Deck contains", () => {
    const used = new Set(placements.map((p) => p.alias));
    const expected = [AssetAlias.Floor01, AssetAlias.Floor02, AssetAlias.FloorDamaged01, AssetAlias.ReactorFloor01, AssetAlias.ReactorEdge01, AssetAlias.SpawnMarker01, AssetAlias.Wall01, AssetAlias.CoverHalf01, AssetAlias.OverwatchNest01];
    for (const alias of expected) {
      expect(used.has(alias), alias).toBe(true);
    }
  });

  it("puts props in front of objects further back, by column plus row", () => {
    const wallBack = objects.find((p) => p.alias === AssetAlias.Wall01 && p.depth === 2);
    const wallFront = objects.find((p) => p.alias === AssetAlias.Wall01 && p.depth === 20);
    expect(wallBack).toBeDefined();
    expect(wallFront).toBeDefined();
    expect(wallFront!.depth).toBeGreaterThan(wallBack!.depth);
    expect(wallFront!.y).toBeGreaterThan(wallBack!.y);
  });

  it("anchors a prop at the same bottom vertex as the floor tile below it", () => {
    const nest = objects.find((p) => p.alias === AssetAlias.OverwatchNest01)!;
    const floor = floors.find((p) => p.x === nest.x && p.y === nest.y);
    expect(floor).toBeDefined();
  });
});

describe("computeCamera", () => {
  const viewports = [
    [844, 390],
    [667, 375],
    [2000, 920],
  ];
  const lastCol = REACTOR_DECK.width - 1;
  const lastRow = REACTOR_DECK.height - 1;
  const corners = [
    { col: 0, row: 0 },
    { col: lastCol, row: 0 },
    { col: 0, row: lastRow },
    { col: lastCol, row: lastRow },
  ];

  it.each(viewports)("shows every corner tile, including Wall height, on a %i x %i viewport", (width, height) => {
    const camera = computeCamera(width, height);
    for (const corner of corners) {
      const { x, y } = gridToWorld(corner);
      // Tile footprint (left, right, bottom vertex) and the top of a 128 px tall prop.
      const points = [
        { px: x - TILE_WIDTH / 2, py: y },
        { px: x + TILE_WIDTH / 2, py: y },
        { px: x, py: y + TILE_HEIGHT / 2 },
        { px: x, py: y + TILE_HEIGHT / 2 - 128 },
      ];
      for (const { px, py } of points) {
        const screenX = px * camera.scale + camera.x;
        const screenY = py * camera.scale + camera.y;
        expect(screenX).toBeGreaterThanOrEqual(0);
        expect(screenX).toBeLessThanOrEqual(width);
        expect(screenY).toBeGreaterThanOrEqual(0);
        expect(screenY).toBeLessThanOrEqual(height);
      }
    }
  });

  it.each(viewports)("uses the largest scale that fits and stays centred on %i x %i", (width, height) => {
    const camera = computeCamera(width, height);
    const bounds = boardBounds(REACTOR_DECK);
    const screenWidth = (bounds.right - bounds.left) * camera.scale;
    const screenHeight = (bounds.bottom - bounds.top) * camera.scale;
    // One axis is filled up to the margin, the other fits.
    expect(Math.max(screenWidth / width, screenHeight / height)).toBeCloseTo(1 - 2 * 0.03);
    expect(bounds.left * camera.scale + camera.x).toBeCloseTo(width - (bounds.right * camera.scale + camera.x));
    expect(bounds.top * camera.scale + camera.y).toBeCloseTo(height - (bounds.bottom * camera.scale + camera.y));
  });
});

describe("tile picking at the fitted scale", () => {
  const viewports = [
    { width: 844, height: 390 },
    { width: 667, height: 375 },
  ];
  // A point given in view pixels relative to the tile centre, converted back through the camera.
  const at = (tile: { col: number; row: number }, dx: number, dy: number, view: { width: number; height: number }) => {
    const camera = computeCamera(view.width, view.height);
    const { x, y } = gridToWorld(tile);
    return viewToWorld(x * camera.scale + camera.x + dx, y * camera.scale + camera.y + dy, view.width, view.height);
  };
  // A floor tile with no Wall in front of it on screen.
  const tile = { col: 10, row: 5 };

  it.each(viewports)("picks the tile at its centre and four corners ($width x $height)", (view) => {
    const scale = computeCamera(view.width, view.height).scale;
    const halfW = (TILE_WIDTH / 2) * scale;
    const halfH = (TILE_HEIGHT / 2) * scale;
    for (const [dx, dy] of [
      [0, 0],
      [halfW * 0.98, 0],
      [-halfW * 0.98, 0],
      [0, halfH * 0.98],
      [0, -halfH * 0.98],
    ]) {
      const point = at(tile, dx!, dy!, view);
      expect(pickTileAt(point.x, point.y)).toEqual(tile);
    }
  });

  it.each(viewports)("picks the neighbour just outside the diamond ($width x $height)", (view) => {
    const scale = computeCamera(view.width, view.height).scale;
    const halfW = (TILE_WIDTH / 2) * scale;
    const halfH = (TILE_HEIGHT / 2) * scale;
    // Just beyond the midpoint of each of the four edges.
    const beyond = 0.52;
    const cases = [
      { dx: halfW * beyond, dy: halfH * beyond, tile: { col: tile.col + 1, row: tile.row } },
      { dx: -halfW * beyond, dy: halfH * beyond, tile: { col: tile.col, row: tile.row + 1 } },
      { dx: -halfW * beyond, dy: -halfH * beyond, tile: { col: tile.col - 1, row: tile.row } },
      { dx: halfW * beyond, dy: -halfH * beyond, tile: { col: tile.col, row: tile.row - 1 } },
    ];
    for (const { dx, dy, tile: expected } of cases) {
      const point = at(tile, dx, dy, view);
      expect(pickTileAt(point.x, point.y)).toEqual(expected);
    }
  });

  it("picks a Wall in front of a tile, not the floor it hides", () => {
    const wall = { col: 4, row: 3 };
    expect(REACTOR_DECK.tiles[wall.row]?.[wall.col]).toBe(TileKind.Wall);
    // A point on the Wall sprite above its footprint lies over the floor tile behind it.
    const { x, y } = gridToWorld(wall);
    expect(pickTileAt(x, y - TILE_HEIGHT * 1.5)).toEqual(wall);
    expect(Math.round(worldToGrid(x, y - TILE_HEIGHT * 1.5).col)).not.toBe(wall.col);
  });

  it("returns nothing outside the grid", () => {
    expect(pickTileAt(0, -TILE_HEIGHT * 5)).toBeUndefined();
  });
});

describe("resolveTap", () => {
  const heroes = [
    { id: "own", position: { col: 4, row: 4 } },
    { id: "enemy", position: { col: 6, row: 4 } },
  ];
  const candidates = { heroes, targetableIds: ["enemy"], highlights: [{ col: 5, row: 4 }] };
  const world = (col: number, row: number) => gridToWorld({ col, row });

  it("picks a targetable Hero on the neighbouring tile's edge, within HERO_PICK_TOLERANCE only", () => {
    const near = world(6 - HERO_PICK_TOLERANCE * 0.9, 4);
    expect(resolveTap(near.x, near.y, candidates)).toEqual({ kind: "hero", id: "enemy" });
    const far = world(6 - HERO_PICK_TOLERANCE * 1.1, 4);
    expect(resolveTap(far.x, far.y, { ...candidates, highlights: [] }).kind).toBe("none");
  });

  it("picks a highlighted tile and ignores tiles that are not valid targets", () => {
    const valid = world(5, 4);
    expect(resolveTap(valid.x, valid.y, { ...candidates, targetableIds: [] })).toEqual({ kind: "tile", tile: { col: 5, row: 4 } });
    const other = world(5, 6);
    expect(resolveTap(other.x, other.y, candidates)).toEqual({ kind: "none" });
  });

  describe("next to a Wall", () => {
    const wall = { col: 4, row: 6 };
    const target = { col: 4, row: 5 };
    const { x, y } = world(target.col, target.row);
    const inset = 4;
    const points = [
      [x, y],
      [x + TILE_WIDTH / 2 - inset, y],
      [x - TILE_WIDTH / 2 + inset, y],
      [x, y + TILE_HEIGHT / 2 - inset],
      [x, y - TILE_HEIGHT / 2 + inset],
    ] as const;
    const base = { heroes: [], targetableIds: [] };

    it("picks a highlighted tile over the Wall sprite that covers its diamond", () => {
      expect(REACTOR_DECK.tiles[wall.row]?.[wall.col]).toBe(TileKind.Wall);
      expect(pickTileAt(x - TILE_WIDTH / 2 + inset, y)).toEqual(wall);
      for (const [px, py] of points) expect(resolveTap(px, py, { ...base, highlights: [target] })).toEqual({ kind: "tile", tile: target });
    });

    it("without a highlight still picks the Wall as before, which is no target", () => {
      for (const [px, py] of points) expect(resolveTap(px, py, { ...base, highlights: [] })).toEqual({ kind: "none" });
    });

    it("still prefers a Hero target within tolerance over a highlighted tile", () => {
      const enemy = { id: "enemy", position: target };
      expect(resolveTap(x, y, { heroes: [enemy], targetableIds: ["enemy"], highlights: [target] })).toEqual({ kind: "hero", id: "enemy" });
    });
  });

  it("selects an own Hero by tapping its tile", () => {
    const point = world(4, 4);
    expect(resolveTap(point.x, point.y, candidates)).toEqual({ kind: "hero", id: "own" });
  });
});

describe("zoom and pan camera", () => {
  const view = { width: 844, height: 390 };
  const fitted = computeCamera(view.width, view.height);
  const bounds = boardBounds(REACTOR_DECK);
  const margin = (bounds.right - bounds.left) * 0.03;

  it("limits the zoom to the fitted scale and about three times it", () => {
    expect(zoomAt(fitted, fitted.scale * 0.5, 400, 200, view).scale).toBeCloseTo(fitted.scale);
    expect(zoomAt(fitted, fitted.scale * 10, 400, 200, view).scale).toBeCloseTo(fitted.scale * MAX_ZOOM);
  });

  it("keeps the world point under the pinch centre", () => {
    const centre = { x: 600, y: 150 };
    const before = viewToWorld(centre.x, centre.y, view.width, view.height);
    const zoomed = zoomAt(fitted, fitted.scale * 2, centre.x, centre.y, view);
    const after = viewToWorld(centre.x, centre.y, view.width, view.height, undefined, zoomed);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("does not pan at the fitted scale but pans when zoomed", () => {
    expect(isZoomed(fitted, view)).toBe(false);
    expect(panBy(fitted, 100, 50, view)).toEqual(fitted);
    const zoomed = zoomAt(fitted, fitted.scale * 2, 422, 195, view);
    expect(isZoomed(zoomed, view)).toBe(true);
    const moved = panBy(zoomed, -40, 20, view);
    expect(moved.x).toBeCloseTo(zoomed.x - 40);
    expect(moved.y).toBeCloseTo(zoomed.y + 20);
  });

  it("clamps the pan so no more than the board plus its margin shows", () => {
    const zoomed = zoomAt(fitted, fitted.scale * 2, 422, 195, view);
    const right = panBy(zoomed, 1e6, 1e6, view);
    expect(-right.x / right.scale).toBeCloseTo(bounds.left - margin);
    const left = panBy(zoomed, -1e6, -1e6, view);
    expect((view.width - left.x) / left.scale).toBeCloseTo(bounds.right + margin);
  });

  it("jumps to the Hero view and back to the fitted view", () => {
    const hero = gridToWorld({ col: 10, row: 5 });
    const zoomed = zoomOnPoint(hero, view);
    expect(zoomed.scale).toBeCloseTo(fitted.scale * HERO_ZOOM);
    expect(zoomed.x + hero.x * zoomed.scale).toBeCloseTo(view.width / 2);
    expect(zoomed.y + hero.y * zoomed.scale).toBeCloseTo(view.height / 2);
    const back = clampCamera({ scale: 0.01, x: 5, y: 5 }, view);
    expect(back.scale).toBeCloseTo(fitted.scale);
    expect(back.x).toBeCloseTo(fitted.x);
    expect(back.y).toBeCloseTo(fitted.y);
  });
});

describe("tile picking at zoomed and panned cameras", () => {
  const view = { width: 844, height: 390 };
  const tiles = [
    { col: 10, row: 5 },
    { col: 7, row: 8 },
  ];
  const fitted = computeCamera(view.width, view.height);
  const cameras = [
    zoomAt(fitted, fitted.scale * 1.8, 300, 200, view),
    panBy(zoomAt(fitted, fitted.scale * 3, 500, 100, view), -60, 40, view),
  ];

  it.each(cameras.map((camera, i) => ({ camera, name: `zoom level ${i + 1}` })))("picks the same tile and Hero as at the fitted scale ($name)", ({ camera }) => {
    for (const tile of tiles) {
      const { x, y } = gridToWorld(tile);
      for (const dx of [0, 0.4 * TILE_WIDTH]) {
        const world = viewToWorld((x + dx) * camera.scale + camera.x, y * camera.scale + camera.y, view.width, view.height, undefined, camera);
        expect(pickTileAt(world.x, world.y)).toEqual(tile);
        const candidates = { heroes: [{ id: "h", position: tile }], targetableIds: ["h"], highlights: [] };
        expect(resolveTap(world.x, world.y, candidates)).toEqual({ kind: "hero", id: "h" });
      }
    }
  });
});

describe("framing a Move", () => {
  const view = { width: 844, height: 390 };
  const fitted = computeCamera(view.width, view.height);

  it("shows the Hero and every highlight with a margin of one tile", () => {
    const hero = { col: 10, row: 8 };
    const highlights = [{ col: 11, row: 8 }, { col: 9, row: 8 }, { col: 10, row: 9 }, { col: 10, row: 7 }, { col: 11, row: 9 }];
    const camera = frameMoveCamera(hero, highlights, view);
    for (const tile of [hero, ...highlights]) {
      const { x, y } = gridToWorld(tile);
      const sx = x * camera.scale + camera.x;
      const sy = y * camera.scale + camera.y;
      const marginX = TILE_WIDTH * 1.5 * camera.scale;
      const marginY = TILE_HEIGHT * 1.5 * camera.scale;
      expect(sx - marginX).toBeGreaterThanOrEqual(-1e-6);
      expect(sx + marginX).toBeLessThanOrEqual(view.width + 1e-6);
      expect(sy - marginY).toBeGreaterThanOrEqual(-1e-6);
      expect(sy + marginY).toBeLessThanOrEqual(view.height + 1e-6);
    }
  });

  it("stays within the zoom limits", () => {
    const tight = frameMoveCamera({ col: 10, row: 8 }, [], view);
    expect(tight.scale).toBeCloseTo(fitted.scale * MAX_ZOOM);
    const wide = frameMoveCamera({ col: 10, row: 8 }, [{ col: 0, row: 0 }, { col: 20, row: 10 }], view);
    expect(wide.scale).toBeCloseTo(fitted.scale);
  });

  it("gives a legal camera for a Hero at the border of the board", () => {
    const hero = { col: 0, row: 0 };
    const camera = frameMoveCamera(hero, [{ col: 1, row: 0 }, { col: 0, row: 1 }], view);
    expect(clampCamera(camera, view)).toEqual(camera);
    const { x, y } = gridToWorld(hero);
    expect(x * camera.scale + camera.x).toBeGreaterThanOrEqual(0);
    expect(y * camera.scale + camera.y).toBeGreaterThanOrEqual(0);
  });

  it("restores the previous camera after the Move is placed or cancelled", () => {
    const before = zoomAt(fitted, fitted.scale * 1.5, 300, 200, view);
    const framing = beginMoveFraming(before);
    const framed = frameMoveCamera({ col: 10, row: 8 }, [{ col: 11, row: 8 }], view);
    expect(endMoveFraming(framing, framed)).toEqual(before);
  });

  it("stops framing automatically once the player pans or zooms", () => {
    const framing = takeOverFraming(beginMoveFraming(fitted));
    const byHand = zoomAt(fitted, fitted.scale * 2, 100, 100, view);
    expect(framing?.automatic).toBe(false);
    expect(endMoveFraming(framing!, byHand)).toEqual(byHand);
  });
});
