import { type Grid, type GridPosition, tileAt, TileKind } from "game-core";
import { Container, Graphics, Text } from "pixi.js";
import { COVER_BLUE, drawCoverLook, drawCoverPanels } from "./cover-look";
import { buildTerrain, coverLook, coverMarks, depthOf, type Face, floorOutline, gridToWorld, hasCoverLook, TILE_HEIGHT, TILE_WIDTH, worldLineWidth } from "./terrain";
import { TERRAIN_STYLE } from "./terrain-style";
import { AREA_COLOR, AREA_PIPS, type ZoneLook } from "./vision-effects";

// The drawing of the board's own marks that the Board and the glossary screen both use, so a symbol in the glossary is the
// very shape the board draws. The Board decides when and where; these functions only make the Pixi shapes.

/** The areas of an enemy scan are outlined in this colour. */
export const SCANNED_COLOR = 0xff4d4d;
/** The 5 by 5 area of an Overdrive Scout Drone is gold. */
const OVERDRIVE_AREA_COLOR = 0xffb000;

/** A shield glyph about 14 px wide on screen, centred on the origin: filled for Full Cover, outline only for Half Cover. */
export function shieldGlyph(kind: "full" | "half", scale: number): Graphics {
  const unit = 7 / scale;
  const scaled = (values: number[]) => values.map((value) => value * unit);
  const color = COVER_BLUE;
  const glyph = new Graphics().poly(scaled([-1, -0.8, 1, -0.8, 1, 0.2, 0, 1.1, -1, 0.2])).fill({ color: 0x0b1016 });
  if (kind === "full") glyph.poly(scaled([-1, -0.8, 1, -0.8, 1, 0.2, 0, 1.1, -1, 0.2])).fill({ color });
  else glyph.poly(scaled([-1, -0.3, 1, -0.3, 1, 0.2, 0, 1.1, -1, 0.2])).fill({ color });
  return glyph.poly(scaled([-1, -0.8, 1, -0.8, 1, 0.2, 0, 1.1, -1, 0.2])).stroke({ width: worldLineWidth(1.5, scale), color, join: "round" });
}

/** Fills a face and outlines it with a line that keeps its width on screen at the camera `scale`. */
export function fillFace(graphics: Graphics, { points, fill, edge, edgeWidth }: Face, scale: number): Graphics {
  return graphics.poly(points).fill(fill).stroke({ width: worldLineWidth(edgeWidth, scale), color: edge, join: "round" });
}

/** The dashed ring and the `last seen` tag of a Ghost. */
export function ghostMark(): Container {
  const mark = new Container();
  const ring = new Graphics();
  const rx = TILE_WIDTH * 0.42;
  const ry = TILE_HEIGHT * 0.42;
  const dashes = 16;
  for (let i = 0; i < dashes; i++) {
    const from = (i / dashes) * 2 * Math.PI;
    const to = from + Math.PI / dashes;
    ring.moveTo(Math.cos(from) * rx, -TILE_HEIGHT / 2 + Math.sin(from) * ry).lineTo(Math.cos(to) * rx, -TILE_HEIGHT / 2 + Math.sin(to) * ry);
  }
  ring.stroke({ width: 3, color: 0xe5484d, alpha: 0.8 });
  const tag = new Text({ text: "last seen", style: { fontFamily: "IBM Plex Mono", fontSize: 12, fill: 0x8a99a8, stroke: { color: 0x0b1016, width: 3 } } });
  tag.anchor.set(0.5, 0);
  tag.position.set(0, 4);
  mark.addChild(ring, tag);
  return mark;
}

/** The containers the terrain is drawn into: the floor, the standing pieces (sorted by depth) and the planning layer above the floor. */
export interface TerrainLayers {
  floor: Container;
  objects: Container;
  planning: Container;
}

export interface TerrainInput {
  /** The map as the Squad knows it (destroyed Cover gone, placed Cover standing). */
  grid: Grid;
  angle: number;
  strokeScale: number;
  /** The tiles the Squad sees (`litTiles`); Cover of the map is only drawn on those. */
  lit: ReadonlySet<string>;
  /** Cover a Hero placed (drawn as built Cover, remembered also in the fog). */
  placedCover: readonly GridPosition[];
  /** Cover the Squad has seen destroyed: the tile keeps a scorched outline. */
  destroyedCover: readonly GridPosition[];
}

/** Draws the floor, the Cover and the shield glyphs of the map; returns everything it made, for the caller to destroy. */
export function drawTerrain({ floor, objects, planning }: TerrainLayers, { grid, angle, strokeScale, lit, placedCover, destroyedCover }: TerrainInput): Container[] {
  const created: Container[] = [];
  // Floor tiles share one shape layer; standing pieces are drawn per tile and sort with the Heroes by depth.
  const ground = new Graphics();
  floor.addChild(ground);
  created.push(ground);
  for (const tile of buildTerrain(grid, angle, lit)) {
    fillFace(ground, tile.floor, strokeScale);
    if (tile.marker) ground.poly(tile.marker.points).stroke({ width: 2, color: tile.marker.color, alpha: 0.9 });
    if (!tile.piece) continue;
    const piece = new Graphics();
    if (hasCoverLook(tile.kind)) {
      const built = placedCover.some((p) => p.col === tile.position.col && p.row === tile.position.row);
      // Fog of War: the map's own Cover is not drawn where the Squad does not see; it shows when the tile is revealed.
      // Cover a Hero placed is remembered and stays.
      if (!built && !tile.lit) continue;
      const look = coverLook(tile.position, tile.kind === TileKind.FullCover ? "full" : "half", built, angle);
      drawCoverLook(piece, look, strokeScale);
      if (look.panels.length > 0) {
        // The panel stands in front of the Heroes on the tile (they sit at depth + 0.5) and behind the next tile.
        const front = new Graphics();
        drawCoverPanels(front, look, strokeScale);
        front.zIndex = tile.depth + 0.75;
        if (!tile.lit) front.alpha = TERRAIN_STYLE.fogPieceAlpha;
        objects.addChild(front);
        created.push(front);
      }
    } else for (const face of tile.piece) fillFace(piece, face, strokeScale);
    piece.zIndex = tile.depth;
    if (!tile.lit) piece.alpha = TERRAIN_STYLE.fogPieceAlpha;
    objects.addChild(piece);
    created.push(piece);
  }

  // Standing Cover has its own look (panels or bars); only the broken tile keeps a floor outline.
  grid.tiles.forEach((line, row) =>
    line.forEach((_, col) => {
      const isTile = (tile: GridPosition) => tile.col === col && tile.row === row;
      const destroyed = !placedCover.some(isTile) && destroyedCover.some(isTile);
      if (!destroyed) return;
      const { x, y } = gridToWorld({ col, row }, angle);
      const outline = new Graphics().poly(floorOutline(angle)).stroke({ width: 2, color: TERRAIN_STYLE.coverOutline.destroyed, alpha: 0.6 });
      outline.position.set(x, y);
      planning.addChild(outline);
      created.push(outline);
    }),
  );

  // A shield glyph sits above each piece of the map's own Cover.
  const builtTiles = new Set(placedCover.map((p) => `${p.col},${p.row}`));
  for (const mark of coverMarks(grid, angle, builtTiles)) {
    if (!lit.has(`${mark.position.col},${mark.position.row}`)) continue;
    const glyph = shieldGlyph(mark.kind, strokeScale);
    glyph.position.set(mark.x, mark.y);
    // Above its own piece and the Heroes on it (depth + 0.9), under the pieces in front; not under the props, which lie on
    // the objects layer and would cut it off.
    glyph.zIndex = depthOf(mark.position, angle) + 0.9;
    objects.addChild(glyph);
    created.push(glyph);
  }
  return created;
}

export interface ZoneDrawing {
  created: Container[];
  /** The Prime Zone tiles of the grid. */
  tiles: GridPosition[];
  /** The border and the glow under it; the board pulses their alpha. */
  border?: Graphics;
  glow?: Graphics;
}

/** The Prime Zone: a tint on each tile, one outline around the outer edge with a glow under it, and a flat emblem on the middle. */
export function drawZone(planning: Container, grid: Grid, angle: number, { color, alpha, emblemAlpha }: Pick<ZoneLook, "color" | "alpha" | "emblemAlpha">): ZoneDrawing {
  const created: Container[] = [];
  const tiles: GridPosition[] = [];
  grid.tiles.forEach((line, row) =>
    line.forEach((kind, col) => {
      if (kind !== TileKind.PrimeZone) return;
      tiles.push({ col, row });
      const { x, y } = gridToWorld({ col, row }, angle);
      const tint = new Graphics().poly(floorOutline(angle)).fill({ color, alpha });
      tint.position.set(x, y);
      planning.addChild(tint);
      created.push(tint);
    }),
  );
  if (tiles.length === 0) return { created, tiles };
  const cols = tiles.map((tile) => tile.col);
  const rows = tiles.map((tile) => tile.row);
  const [minCol, maxCol, minRow, maxRow] = [Math.min(...cols) - 0.5, Math.max(...cols) + 0.5, Math.min(...rows) - 0.5, Math.max(...rows) + 0.5];
  const outer = [[minCol, minRow], [maxCol, minRow], [maxCol, maxRow], [minCol, maxRow]].flatMap(([col, row]) => {
    const { x, y } = gridToWorld({ col: col!, row: row! }, angle);
    return [x, y];
  });
  const glow = new Graphics().poly(outer).stroke({ width: 7, color, join: "round" });
  const border = new Graphics().poly(outer).stroke({ width: 3, color, join: "round" });
  const middleTile = gridToWorld({ col: (minCol + maxCol) / 2, row: (minRow + maxRow) / 2 }, angle);
  const emblem = new Graphics()
    .ellipse(0, 0, TILE_WIDTH * 0.275, TILE_HEIGHT * 0.275)
    .stroke({ width: 2, color })
    .poly([-TILE_WIDTH * 0.125, 0, 0, -TILE_HEIGHT * 0.125, TILE_WIDTH * 0.125, 0, 0, TILE_HEIGHT * 0.125])
    .fill({ color });
  emblem.position.set(middleTile.x, middleTile.y);
  emblem.alpha = emblemAlpha;
  for (const graphic of [glow, border, emblem]) {
    planning.addChild(graphic);
    created.push(graphic);
  }
  return { created, tiles, border, glow };
}

export interface ScoutAreaDrawing {
  created: Container[];
  /** Each lifted tile with its ring from the middle (0 is the middle), so the board can lift them one ring after the other. */
  tints: { tint: Graphics; ring: number }[];
}

/** The tiles of a Scout Drone area `size` wide round `center` that exist on the grid. */
export function areaTilesOf(grid: Grid, center: GridPosition, size: number): GridPosition[] {
  const reach = Math.floor(size / 2);
  const tiles: GridPosition[] = [];
  for (let row = center.row - reach; row <= center.row + reach; row++) {
    for (let col = center.col - reach; col <= center.col + reach; col++) if (tileAt(grid, { col, row }) !== undefined) tiles.push({ col, row });
  }
  return tiles;
}

export const areaColorOf = (size: number): number => (size >= 5 ? OVERDRIVE_AREA_COLOR : AREA_COLOR);

/** A Scout Drone area: its tiles in cyan (gold for the Overdrive 5 by 5) and two pips for the Resolutions it has left. */
export function drawScoutArea(planning: Container, grid: Grid, angle: number, { center, size, remaining }: { center: GridPosition; size: number; remaining: number }, ringOf: (tile: GridPosition) => number): ScoutAreaDrawing {
  const created: Container[] = [];
  const tints: ScoutAreaDrawing["tints"] = [];
  const color = areaColorOf(size);
  for (const tile of areaTilesOf(grid, center, size)) {
    const { x, y } = gridToWorld(tile, angle);
    const tint = new Graphics().poly(floorOutline(angle)).fill({ color, alpha: 0.28 }).stroke({ width: 1, color, alpha: 0.6 });
    tint.position.set(x, y);
    planning.addChild(tint);
    created.push(tint);
    tints.push({ tint, ring: ringOf(tile) });
  }
  const top = gridToWorld(center, angle);
  const pips = new Graphics();
  for (let pip = 0; pip < AREA_PIPS; pip++) pips.circle((pip - 0.5) * 12, 0, 3.5).fill({ color: AREA_COLOR, alpha: pip < remaining ? 1 : 0.25 }).stroke({ width: 1, color: 0x0b1016 });
  pips.position.set(top.x, top.y - TILE_HEIGHT * (Math.floor(size / 2) + 2.2));
  planning.addChild(pips);
  created.push(pips);
  return { created, tints };
}

/** The outline round an area the enemy scans. */
export function scannedFrame(center: GridPosition, size: number, angle: number): Graphics {
  const reach = Math.floor(size / 2);
  const outline = floorOutline(angle);
  const corner = (col: number, row: number, index: number) => {
    const { x, y } = gridToWorld({ col, row }, angle);
    return [x + outline[index * 2]!, y + outline[index * 2 + 1]!];
  };
  const points = [
    corner(center.col - reach, center.row - reach, 0),
    corner(center.col + reach, center.row - reach, 1),
    corner(center.col + reach, center.row + reach, 2),
    corner(center.col - reach, center.row + reach, 3),
  ].flat();
  return new Graphics().poly(points).fill({ color: SCANNED_COLOR, alpha: 0.08 }).stroke({ width: 2, color: SCANNED_COLOR, alpha: 0.9 });
}
