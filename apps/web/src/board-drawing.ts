import { type Grid, type GridPosition, tileAt, TileKind } from "game-core";
import { Container, Graphics, Text } from "pixi.js";
import { COVER_BLUE, drawCoverLook, drawCoverPanels } from "./cover-look";
import { buildTerrain, coverLook, coverMarks, depthOf, type Face, floorOutline, gridToWorld, hasCoverLook, TILE_HEIGHT, TILE_WIDTH, worldLineWidth } from "./terrain";
import { dashRuns } from "./shot-lines";
import { TERRAIN_STYLE } from "./terrain-style";
import { AREA_COLOR, AREA_PIPS, type ZoneLook } from "./vision-effects";

// The drawing of the board's own marks that the Board and the glossary screen both use, so a symbol in the glossary is the
// very shape the board draws. The Board decides when and where; these functions only make the Pixi shapes.

/** The areas of an enemy scan are outlined in this amber (docs/design/role-visuals/380/scout-drone-b.png). */
export const SCANNED_COLOR = 0xffb347;
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
  /**
   * The tiles of `placedCover` that belong to the Squad itself: they get four teal corner marks, so the player sees which one a
   * new placement can take. The rest is the enemy's and is not marked. Absent: all of it is the Squad's own.
   */
  ownPlacedCover?: readonly GridPosition[];
  /** Cover the Squad has seen destroyed: the tile keeps a scorched outline. */
  destroyedCover: readonly GridPosition[];
  /**
   * Pixel art: the floor, the Walls and the map's own Cover are drawn from the tileset (`PixelScenery`); only the fog over the
   * floor, Placed Cover, wrecks, destroyed Cover and the marks stay here.
   */
  pixel?: boolean;
}

/** The dark laid over the pixel floor where the Squad does not see; the Prime Zone stays a little brighter, as a landmark. */
const PIXEL_FOG = { color: 0x0b1016, alpha: 0.72, landmarkAlpha: 0.5 } as const;

/** Corner marks of the Squad's own Placed Cover and the tags of a planned placement (docs/design/role-visuals/380/placed-cover.png). */
export const COVER_OWN = 0x2ec4b6;
/** The size of the tags over a tile, in figure scale units (the same as the labels of the effects layer). */
const TAG_FONT = 9 * (128 / 46);

/** Four corner marks on the tile of Placed Cover: an angle at each corner of the diamond, a third of the way along each edge. */
export function coverCornerMarks(tile: GridPosition, angle: number, color: number, scale: number): Graphics {
  const outline = floorOutline(angle);
  const corners = [0, 1, 2, 3].map((i) => ({ x: outline[i * 2]! * 0.9, y: outline[i * 2 + 1]! * 0.9 }));
  const marks = new Graphics();
  corners.forEach((corner, i) => {
    const toward = (other: { x: number; y: number }) => ({ x: corner.x + (other.x - corner.x) * 0.36, y: corner.y + (other.y - corner.y) * 0.36 });
    const [before, after] = [toward(corners[(i + 3) % 4]!), toward(corners[(i + 1) % 4]!)];
    marks.moveTo(before.x, before.y).lineTo(corner.x, corner.y).lineTo(after.x, after.y);
  });
  marks.stroke({ width: Math.max(4, 4.5 / scale), color, alpha: 0.95, cap: "round", join: "round" });
  const { x, y } = gridToWorld(tile, angle);
  marks.position.set(x, y);
  return marks;
}

/** A small tag over a tile, in the style of the labels of the effects layer. */
export function coverTag(text: string, color: number, tile: GridPosition, angle: number): Text {
  const tag = new Text({ text, style: { fontFamily: "IBM Plex Mono", fontSize: TAG_FONT, fontWeight: "700", fill: color, stroke: { color: 0x0b1016, width: 3 } } });
  tag.anchor.set(0.5, 1);
  const { x, y } = gridToWorld(tile, angle);
  tag.position.set(x, y - TILE_HEIGHT * 1.7);
  return tag;
}

/** The outline of a tile in dashes: the oldest Placed Cover that is going (amber) and the tile the new one will stand on (teal). */
export function dashedTileOutline(tile: GridPosition, angle: number, color: number, scale: number): Graphics {
  const outline = floorOutline(angle);
  const outlineGraphics = new Graphics();
  for (let i = 0; i < 4; i++) {
    const from = { x: outline[i * 2]!, y: outline[i * 2 + 1]! };
    const to = { x: outline[((i + 1) % 4) * 2]!, y: outline[((i + 1) % 4) * 2 + 1]! };
    for (const run of dashRuns(from, to, 12, 8)) outlineGraphics.moveTo(run.from.x, run.from.y).lineTo(run.to.x, run.to.y);
  }
  outlineGraphics.stroke({ width: Math.max(3, 3 / scale), color, alpha: 0.95, cap: "round" });
  const { x, y } = gridToWorld(tile, angle);
  outlineGraphics.position.set(x, y);
  return outlineGraphics;
}

/** Draws the floor, the Cover and the shield glyphs of the map; returns everything it made, for the caller to destroy. */
export function drawTerrain({ floor, objects, planning }: TerrainLayers, { grid, angle, strokeScale, lit, placedCover, ownPlacedCover, destroyedCover, pixel = false }: TerrainInput): Container[] {
  const created: Container[] = [];
  const ownTiles = new Set((ownPlacedCover ?? placedCover).map((p) => `${p.col},${p.row}`));
  // Floor tiles share one shape layer; standing pieces are drawn per tile and sort with the Heroes by depth.
  const ground = new Graphics();
  floor.addChild(ground);
  created.push(ground);
  for (const tile of buildTerrain(grid, angle, lit)) {
    if (!pixel) {
      fillFace(ground, tile.floor, strokeScale);
      if (tile.marker) ground.poly(tile.marker.points).stroke({ width: 2, color: tile.marker.color, alpha: 0.9 });
    } else if (!tile.lit) {
      // Pixel art: the baked floor is under this; the tiles the Squad does not see go dark.
      ground.poly(tile.floor.points).fill({ color: PIXEL_FOG.color, alpha: tile.kind === TileKind.PrimeZone ? PIXEL_FOG.landmarkAlpha : PIXEL_FOG.alpha });
    }
    if (!tile.piece) continue;
    // Pixel art: the Walls and the Cover of the map are sprites; Placed Cover and wrecks keep the game's own drawing.
    if (pixel && (tile.kind === TileKind.Wall || tile.kind === TileKind.OverwatchNest || (hasCoverLook(tile.kind) && !placedCover.some((p) => p.col === tile.position.col && p.row === tile.position.row)))) continue;
    const piece = new Graphics();
    if (hasCoverLook(tile.kind)) {
      const built = placedCover.some((p) => p.col === tile.position.col && p.row === tile.position.row);
      // Fog of War: the map's own Cover is not drawn where the Squad does not see; it shows when the tile is revealed.
      // Cover a Hero placed is remembered and stays.
      if (!built && !tile.lit) continue;
      const look = coverLook(tile.position, tile.kind === TileKind.FullCover ? "full" : "half", built, angle);
      drawCoverLook(piece, look, strokeScale);
      // Only the Squad's own Placed Cover is marked: it is the one a new placement can take (the oldest), and for a Hero in
      // cover it makes no difference whose Cover it is.
      if (built && ownTiles.has(`${tile.position.col},${tile.position.row}`)) {
        const marks = coverCornerMarks(tile.position, angle, COVER_OWN, strokeScale);
        // Above the bars of the Cover and below the Heroes (depth + 0.5), so the corners show round the foot of the piece.
        marks.zIndex = tile.depth + 0.2;
        objects.addChild(marks);
        created.push(marks);
      }
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

type Point2 = { x: number; y: number };

/** The four outer corners of an area (top, right, bottom, left on screen), relative to the world origin. */
function areaCorners(center: GridPosition, size: number, angle: number): [Point2, Point2, Point2, Point2] {
  const reach = Math.floor(size / 2);
  const outline = floorOutline(angle);
  const corner = (col: number, row: number, index: number): Point2 => {
    const { x, y } = gridToWorld({ col, row }, angle);
    return { x: x + outline[index * 2]!, y: y + outline[index * 2 + 1]! };
  };
  return [
    corner(center.col - reach, center.row - reach, 0),
    corner(center.col + reach, center.row - reach, 1),
    corner(center.col + reach, center.row + reach, 2),
    corner(center.col - reach, center.row + reach, 3),
  ];
}

const lerpPoint = (a: Point2, b: Point2, t: number): Point2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** A mark that changes with time: `update(ms)` redraws it at `ms` into its loop. */
export interface LoopingMark {
  container: Container;
  update(ms: number): void;
}

/** The loop of the scan marks: two scans in 3 s (docs/design/role-visuals/380/scout-drone-a.png and -b.png). */
export const SCAN_LOOP_MS = 3000;
const SCAN_PERIOD_MS = SCAN_LOOP_MS / 2;

/**
 * An area the enemy scans, as the scanned Squad sees it: a dashed amber outline, an amber sweep that runs across the square
 * twice per loop, and the tag SCANNED · n with the Resolutions left. Not who looks and not what was seen. With `still` there is no sweep.
 */
export function scannedMark(center: GridPosition, size: number, remaining: number, angle: number, still: boolean): LoopingMark {
  const container = new Container();
  const [top, right, bottom, left] = areaCorners(center, size, angle);
  const base = new Graphics().poly([top, right, bottom, left].flatMap(({ x, y }) => [x, y])).fill({ color: SCANNED_COLOR, alpha: 0.06 });
  for (const [from, to] of [[top, right], [right, bottom], [bottom, left], [left, top]] as const) {
    for (const run of dashRuns(from, to, 16, 10)) base.moveTo(run.from.x, run.from.y).lineTo(run.to.x, run.to.y);
  }
  base.stroke({ width: 4, color: SCANNED_COLOR, alpha: 0.95, cap: "round" });
  const sweep = new Graphics();
  const tag = new Text({ text: `SCANNED · ${remaining}`, style: { fontFamily: "IBM Plex Mono", fontSize: TAG_FONT, fontWeight: "700", fill: SCANNED_COLOR, stroke: { color: 0x0b1016, width: 3 } } });
  tag.anchor.set(0.5, 1);
  tag.position.set(top.x, top.y - TILE_HEIGHT * 0.5);
  container.addChild(base, sweep, tag);
  return {
    container,
    update(ms) {
      sweep.clear();
      if (still) return;
      const t = (ms % SCAN_PERIOD_MS) / SCAN_PERIOD_MS;
      const band = (at: number) => [lerpPoint(top, left, at), lerpPoint(right, bottom, at)] as const;
      const [a0, b0] = band(t);
      const [a1, b1] = band(Math.min(1, t + 0.16));
      sweep.poly([a0, b0, b1, a1].flatMap(({ x, y }) => [x, y])).fill({ color: SCANNED_COLOR, alpha: 0.3 * (1 - Math.abs(t - 0.5) * 1.2) });
      sweep.moveTo(a0.x, a0.y).lineTo(b0.x, b0.y).stroke({ width: 3, color: SCANNED_COLOR, alpha: 0.9 });
    },
  };
}

/**
 * The Scout Drone over its own area (docs/design/role-visuals/380/scout-drone-a.png): it circles above the square and, twice per
 * loop, sends scan rays down to the corners and a ring over the floor. The tag names it. With `still` it hangs over the middle.
 */
export function scoutDroneMark(center: GridPosition, size: number, angle: number, still: boolean): LoopingMark {
  const container = new Container();
  const rays = new Graphics();
  const drone = new Graphics();
  const tag = new Text({ text: "SCOUT DRONE · ANYWHERE", style: { fontFamily: "IBM Plex Mono", fontSize: TAG_FONT * 0.8, fontWeight: "700", fill: AREA_COLOR, stroke: { color: 0x0b1016, width: 3 } } });
  tag.anchor.set(0.5, 1);
  container.addChild(rays, drone, tag);
  const middle = gridToWorld(center, angle);
  const corners = areaCorners(center, size, angle);
  const lift = TILE_HEIGHT * (Math.floor(size / 2) + 1.7);
  return {
    container,
    update(ms) {
      rays.clear();
      drone.clear();
      const turn = still ? 0 : ((ms % SCAN_LOOP_MS) / SCAN_LOOP_MS) * 2 * Math.PI;
      const at = { x: middle.x + Math.cos(turn) * TILE_WIDTH * 0.6, y: middle.y - lift + Math.sin(turn) * TILE_HEIGHT * 0.6 };
      drone.ellipse(at.x, at.y, 20, 9).fill(0x4da3ff).stroke({ width: 3, color: 0x0b1016 });
      const rotor = still || Math.sin(ms / 28) > 0 ? 1 : 0.35;
      drone.ellipse(at.x, at.y - 9, 28 * rotor, 5).fill({ color: 0xcfe8ff, alpha: 0.7 });
      tag.position.set(at.x, at.y - 22);
      const s = ms % SCAN_PERIOD_MS;
      if (still || s >= 520) return;
      const u = s / 520;
      for (const corner of [corners[1], corners[2], corners[3]]) {
        rays.moveTo(at.x, at.y + 6).lineTo(corner.x, corner.y).stroke({ width: 2.5, color: AREA_COLOR, alpha: 0.7 * (1 - u) });
      }
      rays.ellipse(middle.x, middle.y, TILE_WIDTH * (0.3 + 0.9 * u) * (size / 3), TILE_HEIGHT * (0.3 + 0.9 * u) * (size / 3)).stroke({ width: 3, color: AREA_COLOR, alpha: 0.8 * (1 - u) });
    },
  };
}
