import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REACTOR_DECK } from "game-core";
import { describe, expect, it } from "vitest";
import { BOARD_ALIASES, buildPlacements, CAMERA_FOCUS, computeCamera, gridToWorld } from "./board-layout";

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
  const floors = placements.filter((p) => p.layer === "floor");
  const objects = placements.filter((p) => p.layer === "object");

  it("draws one floor sprite per tile", () => {
    expect(floors).toHaveLength(REACTOR_DECK.width * REACTOR_DECK.height);
  });

  it("only uses aliases that exist in the manifest with an existing file", () => {
    for (const alias of new Set([...placements.map((p) => p.alias), ...BOARD_ALIASES])) {
      const src = manifestAssets.get(alias);
      expect(src, alias).toBeDefined();
      expect(existsSync(path.join(assetsDir, src!)), alias).toBe(true);
    }
  });

  it("uses every tile and prop kind the Reactor Deck contains", () => {
    const used = new Set(placements.map((p) => p.alias));
    for (const alias of ["tiles.floor_01", "tiles.floor_02", "tiles.floor_damaged_01", "tiles.reactor_floor_01", "tiles.reactor_edge_01", "tiles.spawn_marker_01", "props.wall_01", "props.cover_half_01", "props.overwatch_nest_01"]) {
      expect(used.has(alias), alias).toBe(true);
    }
  });

  it("puts props in front of objects further back, by column plus row", () => {
    const wallBack = objects.find((p) => p.alias === "props.wall_01" && p.depth === 2);
    const wallFront = objects.find((p) => p.alias === "props.wall_01" && p.depth === 20);
    expect(wallBack).toBeDefined();
    expect(wallFront).toBeDefined();
    expect(wallFront!.depth).toBeGreaterThan(wallBack!.depth);
    expect(wallFront!.y).toBeGreaterThan(wallBack!.y);
  });

  it("anchors a prop at the same bottom vertex as the floor tile below it", () => {
    const nest = objects.find((p) => p.alias === "props.overwatch_nest_01")!;
    const floor = floors.find((p) => p.x === nest.x && p.y === nest.y);
    expect(floor).toBeDefined();
  });
});

describe("computeCamera", () => {
  it.each([
    [844, 390],
    [1280, 720],
    [1920, 1080],
  ])("centres the focus tile on a %i x %i viewport", (width, height) => {
    const camera = computeCamera(width, height);
    const focus = gridToWorld(CAMERA_FOCUS);
    expect(focus.x * camera.scale + camera.x).toBeCloseTo(width / 2);
    expect(focus.y * camera.scale + camera.y).toBeCloseTo(height / 2);
    expect(camera.scale).toBeGreaterThan(0);
  });

  it("scales the frame down to fit a small viewport", () => {
    expect(computeCamera(844, 390).scale).toBeLessThan(computeCamera(1920, 1080).scale);
  });
});
