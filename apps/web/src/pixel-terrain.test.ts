import { parseGrid, REACTOR_DECK, TileKind, tileAt } from "game-core";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dimmed, pixelLayout, PIXEL_SCALE, textFits, tileHash, type Tileset } from "./pixel-terrain";
import { gridToWorld, TILE_WIDTH } from "./terrain";

const assets = path.join(__dirname, "..", "public", "assets", "reactor-deck");
const tileset = JSON.parse(readFileSync(path.join(assets, "tileset.json"), "utf8")) as Tileset;
const sheet = JSON.parse(readFileSync(path.join(assets, "notstrom.json"), "utf8")) as { frames: Record<string, unknown> };
const layout = pixelLayout(REACTOR_DECK, tileset);
const names = (list: { name: string }[]) => list.map((entry) => entry.name);

describe("the pixel scale", () => {
  it("makes a 32 px tile of the art one tile of the board's world", () => {
    expect(32 * PIXEL_SCALE).toBe(TILE_WIDTH);
    expect(gridToWorld({ col: 3, row: 1 })).toEqual({ x: (3 - 1) * 16 * PIXEL_SCALE, y: (3 + 1) * 8 * PIXEL_SCALE });
  });
});

describe("pixelLayout of the Reactor Deck", () => {
  it("only names frames that the atlas has", () => {
    for (const name of [...names(layout.floors), ...names(layout.standing)]) expect(sheet.frames[`deck.${name}`], name).toBeDefined();
  });

  it("puts a floor on every tile that is not a Wall and none under a Wall", () => {
    const floors = new Set(layout.floors.filter((floor) => !floor.name.startsWith("hazard") && !floor.name.startsWith("outpost_corner") && !floor.name.startsWith("guide")).map((floor) => `${floor.col},${floor.row}`));
    let open = 0;
    REACTOR_DECK.tiles.forEach((line, row) => line.forEach((kind, col) => {
      if (kind !== TileKind.Wall) open++;
      expect(floors.has(`${col},${row}`), `${col},${row}`).toBe(kind !== TileKind.Wall);
    }));
    expect(floors.size).toBe(open);
  });

  it("uses the floor of its kind for the Prime Zone, the Outposts and the Drop Points", () => {
    const floorOf = (col: number, row: number) => layout.floors.find((floor) => floor.col === col && floor.row === row)!.name;
    expect(floorOf(22, 12)).toBe("prime_floor");
    expect(floorOf(22, 2)).toBe("outpost_floor");
    expect(floorOf(1, 12)).toMatch(/^spawn_floor_/);
  });

  it("draws no prime_ring, which is for a 3 x 3 zone, and puts the core on the middle tile of the 5 x 5 zone", () => {
    expect(names(layout.floors)).not.toContain("prime_ring");
    expect(layout.core).toEqual({ col: 22, row: 12 });
  });

  it("puts the hazard band on the tiles round the Prime Zone and the brackets on the corners of each Outpost", () => {
    const at = (name: string) => layout.floors.filter((floor) => floor.name === name).map((floor) => `${floor.col},${floor.row}`);
    // A tile east of the zone has the zone on its west side.
    expect(at("hazard_edge_w")).toEqual(["25,10", "25,11", "25,12", "25,13", "25,14"]);
    expect(at("hazard_corner_nw")).toEqual(["25,15"]);
    expect(at("outpost_corner_nw")).toHaveLength(2);
    expect(at("outpost_corner_se")).toHaveLength(2);
  });

  it("cuts the Walls nearest the viewer low and never cuts the others", () => {
    for (const wall of layout.standing.filter((piece) => piece.kind === "wall")) {
      const near = wall.row === REACTOR_DECK.height - 1 || wall.col === REACTOR_DECK.width - 1;
      expect(wall.name.startsWith("wall_cut"), `${wall.col},${wall.row}`).toBe(near);
    }
  });

  it("stands one wall block on each Wall and one Cover piece on each Cover tile, sorted by col + row", () => {
    const count = (kinds: TileKind[]) => REACTOR_DECK.tiles.flat().filter((kind) => kinds.includes(kind)).length;
    expect(layout.standing.filter((piece) => piece.kind === "wall")).toHaveLength(count([TileKind.Wall]));
    expect(layout.standing.filter((piece) => piece.kind === "cover")).toHaveLength(count([TileKind.HalfCover, TileKind.FullCover, TileKind.OverwatchNest]));
    for (const piece of layout.standing.filter((entry) => entry.kind !== "text")) expect(piece.depth).toBe(piece.col + piece.row);
  });

  it("lights the Drop Points, the core, every Cover and the lamps", () => {
    const kinds = layout.lights.map((light) => light.kind);
    expect(kinds.filter((kind) => kind === "breach")).toHaveLength(2);
    expect(kinds.filter((kind) => kind === "core")).toHaveLength(1);
    expect(layout.lights.filter((light) => light.kind === "cover")).toHaveLength(layout.standing.filter((piece) => piece.kind === "cover").length);
    expect(kinds).toContain("lamp");
  });

  it("puts the guide lights on open floor between a Drop Point and the Prime Zone only", () => {
    const guides = layout.floors.filter((floor) => floor.name === "guide_col");
    expect(guides.length).toBeGreaterThan(10);
    for (const guide of guides) expect(tileAt(REACTOR_DECK, guide)).toBe(TileKind.Floor);
  });

  it("only places wall texts on a run of Wall blocks that has an open face", () => {
    const texts = layout.standing.filter((piece) => piece.kind === "text");
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(sheet.frames[`deck.${text.name}`]).toBeDefined();
    expect(textFits(parseGrid(["###", "..."]), { face: "south", col: 0, row: 0, id: "x" }, 3)).toBe(true);
    expect(textFits(parseGrid(["###", "###"]), { face: "south", col: 0, row: 0, id: "x" }, 3)).toBe(false);
    expect(textFits(parseGrid(["###", "..."]), { face: "south", col: 1, row: 0, id: "x" }, 3)).toBe(false);
  });

  it("is the same for the same grid and gives another variant of floor on other tiles", () => {
    expect(pixelLayout(REACTOR_DECK, tileset)).toEqual(layout);
    const plates = new Set(layout.floors.filter((floor) => floor.name.startsWith("floor_")).map((floor) => floor.name));
    expect(plates.size).toBeGreaterThan(3);
  });

  it("draws Cover only where the grid has it: destroyed Cover leaves a floor", () => {
    const destroyed = { ...REACTOR_DECK, tiles: REACTOR_DECK.tiles.map((line) => line.map((kind) => ([TileKind.HalfCover, TileKind.FullCover, TileKind.OverwatchNest].includes(kind) ? TileKind.Floor : kind))) };
    const bare = pixelLayout(destroyed, tileset);
    expect(bare.standing.some((piece) => piece.kind === "cover")).toBe(false);
    expect(bare.lights.some((light) => light.kind === "cover")).toBe(false);
  });
});

describe("tileHash", () => {
  it("is stable and in [0, 1)", () => {
    expect(tileHash(4, 9, 2)).toBe(tileHash(4, 9, 2));
    for (let i = 0; i < 200; i++) {
      expect(tileHash(i, i * 3, 1)).toBeGreaterThanOrEqual(0);
      expect(tileHash(i, i * 3, 1)).toBeLessThan(1);
    }
  });
});

describe("dimmed", () => {
  it("scales each colour channel", () => {
    expect(dimmed(0x80c040, 0.5)).toBe(0x406020);
    expect(dimmed(0x333341, 1)).toBe(0x333341);
  });
});
