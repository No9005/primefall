import { type Grid, type GridPosition, TileKind, tileAt } from "game-core";
import { Assets, Sprite, Texture } from "pixi.js";
import type { Container } from "pixi.js";
import { PIXEL_WORLD_SCALE } from "./board-layout";
import { gridToWorld } from "./terrain";

// The Reactor Deck of the Pixel art style, built from the tileset "Notstrom" (docs/design/reactor-deck/README.md; the rules of
// which tile goes where are those of tools/assemble.js). Tiles are 32 x 16 px art; the board's world is four times that, so a
// sprite scaled by `PIXEL_SCALE` and put on `gridToWorld` of its tile sits exactly where the art says.
//
// `pixelLayout` is pure (the grid in, sprite names and tiles out). The floor and its decals are baked once into one texture
// together with the light map; walls, Cover, plants and the core stay sprites, because Heroes walk between them and are sorted
// with them by depth. The texture is baked again only when the standing Cover of the map changes.

/** World pixels per art pixel. */
export const PIXEL_SCALE = 1 / PIXEL_WORLD_SCALE;
const FRAME_PREFIX = "deck.";
const ASSET_DIR = `${import.meta.env.BASE_URL}assets/reactor-deck/`;

export type LightKind = "core" | "breach" | "lamp" | "cover";

/** What `tileset.json` says that the sheet format cannot. */
export interface Tileset {
  lighting: { ambient: string; lights: Record<LightKind, { color: string; alpha: number; scale: number }> };
  groups: Record<string, string[]>;
  texts: Record<string, { text: string; tiles: number }>;
  sprites: Record<string, { glow?: string }>;
}

/** A frame placed on a tile; `dx` and `dy` move it by art pixels. */
export interface Placed {
  name: string;
  col: number;
  row: number;
  dx?: number;
  dy?: number;
}

export interface Standing extends Placed {
  kind: "wall" | "cover" | "plant" | "text";
  /** The sort order against Heroes (a Hero stands at the depth of its tile plus 0.5). */
  depth: number;
}

export interface PixelLayout {
  /** The floor and what is painted on it, in drawing order. */
  floors: Placed[];
  /** Everything that stands, in drawing order. */
  standing: Standing[];
  lights: { kind: LightKind; col: number; row: number; dx: number }[];
  /** The tile the core stands on: the middle of the Prime Zone. */
  core?: GridPosition;
}

/** The wall texts of the layout, as in the reference map: `south` runs towards larger columns, `east` towards smaller rows. */
const TEXTS: readonly { face: "south" | "east"; col: number; row: number; id: string }[] = [
  { face: "south", col: 2, row: 0, id: "hangar_06" },
  { face: "south", col: 14, row: 0, id: "deck_c" },
  { face: "south", col: 26, row: 0, id: "cargo_02" },
  { face: "south", col: 36, row: 0, id: "reactor_left" },
  { face: "east", col: 0, row: 8, id: "airlock" },
  { face: "east", col: 0, row: 22, id: "bay_03" },
];

/** A stable number in [0, 1) for a tile and a salt: which variant of a tile is used must not change between draws. */
export function tileHash(col: number, row: number, salt = 0): number {
  let n = (Math.imul(col | 0, 374761393) + Math.imul(row | 0, 668265263) + Math.imul(salt | 0, 1274126177)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const depthOf = (col: number, row: number) => col + row;

/** The tile kind as characters of the reference layout: '#' wall, 'H', 'F', 'P', 'X', 'S', '.', ' ' outside. */
function kindAt(grid: Grid, col: number, row: number): TileKind | undefined {
  return tileAt(grid, { col, row });
}

const isOpen = (kind: TileKind | undefined) => kind !== undefined && kind !== TileKind.Wall;

function components(grid: Grid, kind: TileKind): GridPosition[][] {
  const seen = new Set<string>();
  const found: GridPosition[][] = [];
  grid.tiles.forEach((line, row) =>
    line.forEach((tile, col) => {
      if (tile !== kind || seen.has(`${col},${row}`)) return;
      const group: GridPosition[] = [];
      const queue = [{ col, row }];
      seen.add(`${col},${row}`);
      for (let next = queue.pop(); next; next = queue.pop()) {
        group.push(next);
        for (const [dCol, dRow] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const near = { col: next.col + dCol, row: next.row + dRow };
          if (kindAt(grid, near.col, near.row) !== kind || seen.has(`${near.col},${near.row}`)) continue;
          seen.add(`${near.col},${near.row}`);
          queue.push(near);
        }
      }
      found.push(group);
    }),
  );
  return found;
}

const middleOf = (tiles: readonly GridPosition[]): GridPosition => {
  const col = tiles.reduce((sum, tile) => sum + tile.col, 0) / tiles.length;
  const row = tiles.reduce((sum, tile) => sum + tile.row, 0) / tiles.length;
  return tiles.reduce((best, tile) => (Math.hypot(tile.col - col, tile.row - row) < Math.hypot(best.col - col, best.row - row) ? tile : best));
};

/** Whether a wall text has a wall block with an open face for each of its tiles. */
export function textFits(grid: Grid, text: (typeof TEXTS)[number], tiles: number): boolean {
  for (let i = 0; i < tiles; i++) {
    const [col, row] = text.face === "south" ? [text.col + i, text.row] : [text.col, text.row - i];
    const [faceCol, faceRow] = text.face === "south" ? [col, row + 1] : [col + 1, row];
    if (kindAt(grid, col, row) !== TileKind.Wall || !isOpen(kindAt(grid, faceCol, faceRow))) return false;
  }
  return true;
}

/** Which frame goes on which tile, by the rules of `tools/assemble.js`. Nothing is drawn for what the layout has no frame for. */
export function pixelLayout(grid: Grid, tileset: Pick<Tileset, "groups" | "texts">): PixelLayout {
  const pick = (group: string, col: number, row: number, salt: number) => {
    const names = tileset.groups[group]!;
    return names[Math.floor(tileHash(col, row, salt) * names.length)]!;
  };
  const kind = (col: number, row: number) => kindAt(grid, col, row);
  const layout: PixelLayout = { floors: [], standing: [], lights: [] };

  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const here = kind(col, row);
      if (here === TileKind.Wall || here === undefined) continue;
      const floor = (name: string) => layout.floors.push({ name, col, row });
      if (here === TileKind.PrimeZone) floor("prime_floor");
      else if (here === TileKind.Outpost) floor("outpost_floor");
      else if (here === TileKind.DropPoint) floor(pick("spawn_floor", col, row, 2));
      else {
        const v = tileHash(col, row, 3);
        floor(v < 0.12 ? pick("floor_grate", col, row, 4) : v < 0.3 ? pick("floor_rust", col, row, 4) : pick("floor_plate", col, row, 4));
      }
      if (here !== TileKind.PrimeZone) {
        const zone = (c: number, r: number) => kind(c, r) === TileKind.PrimeZone;
        const [n, s, w, e] = [zone(col, row - 1), zone(col, row + 1), zone(col - 1, row), zone(col + 1, row)];
        if (n) floor("hazard_edge_n");
        if (s) floor("hazard_edge_s");
        if (w) floor("hazard_edge_w");
        if (e) floor("hazard_edge_e");
        if (!n && !w && zone(col - 1, row - 1)) floor("hazard_corner_nw");
        if (!n && !e && zone(col + 1, row - 1)) floor("hazard_corner_ne");
        if (!s && !e && zone(col + 1, row + 1)) floor("hazard_corner_se");
        if (!s && !w && zone(col - 1, row + 1)) floor("hazard_corner_sw");
      }
      if (here === TileKind.Outpost) {
        const outside = (c: number, r: number) => kind(c, r) !== TileKind.Outpost;
        const [n, s, w, e] = [outside(col, row - 1), outside(col, row + 1), outside(col - 1, row), outside(col + 1, row)];
        if (n && w) floor("outpost_corner_nw");
        if (n && e) floor("outpost_corner_ne");
        if (s && e) floor("outpost_corner_se");
        if (s && w) floor("outpost_corner_sw");
      }
    }
  }

  // Guide lights lead from each Drop Point along its middle row to the Prime Zone, over the open floor in between.
  const zoneTiles = components(grid, TileKind.PrimeZone).flat();
  if (zoneTiles.length > 0) {
    const zoneMiddle = middleOf(zoneTiles);
    for (const dropPoint of components(grid, TileKind.DropPoint)) {
      const middle = middleOf(dropPoint);
      const towards = zoneMiddle.col > middle.col ? 1 : -1;
      const edge = towards === 1 ? Math.max(...dropPoint.map((tile) => tile.col)) : Math.min(...dropPoint.map((tile) => tile.col));
      for (let col = edge + towards; kind(col, middle.row) !== TileKind.PrimeZone && kind(col, middle.row) !== undefined; col += towards) {
        if (kind(col, middle.row) === TileKind.Floor) layout.floors.push({ name: "guide_col", col, row: middle.row });
      }
      layout.lights.push({ kind: "breach", col: middle.col, row: middle.row, dx: middle.col < grid.width / 2 ? -10 : 10 });
    }
  }

  const near = (col: number, row: number) => row === grid.height - 1 || col === grid.width - 1;
  for (let sum = 0; sum <= grid.width + grid.height - 2; sum++) {
    for (let row = 0; row < grid.height; row++) {
      const col = sum - row;
      if (col < 0 || col >= grid.width) continue;
      const here = kind(col, row)!;
      const stand = (kindOfSprite: Standing["kind"], name: string, extra: Partial<Placed> = {}, depth = depthOf(col, row)) =>
        layout.standing.push({ kind: kindOfSprite, name, col, row, depth, ...extra });
      if (here === TileKind.Wall) {
        const lampWall = tileHash(col, row, 10) < 0.3 && (isOpen(kind(col, row + 1)) || isOpen(kind(col + 1, row)));
        if (near(col, row)) stand("wall", pick("wall_cut", col, row, 9));
        else if (lampWall) {
          stand("wall", "wall_lamp");
          const facing = isOpen(kind(col, row + 1)) ? { col, row: row + 1 } : { col: col + 1, row };
          layout.lights.push({ kind: "lamp", col: facing.col, row: facing.row, dx: 0 });
        } else stand("wall", pick("wall", col, row, 9));
      } else if (here === TileKind.HalfCover) {
        stand("cover", pick("half_cover", col, row, 11));
        layout.lights.push({ kind: "cover", col, row, dx: 0 });
      } else if (here === TileKind.FullCover || here === TileKind.OverwatchNest) {
        // The Overwatch Nest is a Full Cover tile (ADR 0016) and the tileset has no frame of its own for it.
        stand("cover", "full_cover");
        layout.lights.push({ kind: "cover", col, row, dx: 0 });
      } else if (here !== TileKind.PrimeZone && tileHash(col, row, 12) < (here === TileKind.DropPoint ? 0.5 : 0.04)) {
        stand("plant", pick("fern", col, row, 13), { dx: Math.round((tileHash(col, row, 14) - 0.5) * 14), dy: Math.round(tileHash(row, col, 15) * 5) });
      }
    }
  }

  // A wall text is drawn once the last wall block of its run stands.
  for (const text of TEXTS) {
    const tiles = tileset.texts[text.id]?.tiles;
    if (tiles === undefined || !textFits(grid, text, tiles)) continue;
    const last = text.face === "south" ? { col: text.col + tiles - 1, row: text.row } : { col: text.col, row: text.row };
    layout.standing.push({ kind: "text", name: `text_${text.face}_${text.id}`, col: text.col, row: text.row, depth: depthOf(last.col, last.row) + 0.1 });
  }

  if (zoneTiles.length > 0) {
    layout.core = middleOf(zoneTiles);
    layout.lights.push({ kind: "core", col: layout.core.col, row: layout.core.row, dx: 0 });
  }
  return layout;
}

// ---------------------------------------------------------------------------------------------------------------------
// Loading, baking and the sprites. Browser only.

interface FrameData {
  frame: { x: number; y: number; w: number; h: number };
  anchor: { x: number; y: number };
}

export interface PixelAtlas {
  tileset: Tileset;
  textures: Record<string, Texture>;
  frames: Record<string, FrameData>;
  image: HTMLImageElement;
}

let atlasReady: Promise<PixelAtlas> | undefined;

/** Loads the atlas, its sheet data and tileset.json once. */
export function loadPixelAtlas(): Promise<PixelAtlas> {
  atlasReady ??= (async () => {
    const [sheet, tileset, data, image] = await Promise.all([
      Assets.load(`${ASSET_DIR}notstrom.json`),
      fetch(`${ASSET_DIR}tileset.json`).then((response) => response.json() as Promise<Tileset>),
      fetch(`${ASSET_DIR}notstrom.json`).then((response) => response.json() as Promise<{ frames: Record<string, FrameData> }>),
      loadImage(`${ASSET_DIR}notstrom.png`),
    ]);
    sheet.textureSource.scaleMode = "nearest";
    return { tileset, textures: sheet.textures as Record<string, Texture>, frames: data.frames, image };
  })();
  return atlasReady;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

/** The ambient colour of the light map as a Pixi tint: whatever stands on the floor is multiplied by it, like the floor is. */
export const ambientTint = (tileset: Tileset) => Number.parseInt(tileset.lighting.ambient.slice(1), 16);

/** `tint` darkened to `share` of its brightness: the look of a standing piece the Squad does not see. */
export function dimmed(tint: number, share: number): number {
  const channel = (shift: number) => Math.round(((tint >> shift) & 255) * share) << shift;
  return channel(16) | channel(8) | channel(0);
}

/** Where the baked floor texture sits, in art pixels. */
function floorBounds(grid: Grid) {
  const pad = 8;
  return { x: -grid.height * 16 - pad, y: -8 - pad, width: (grid.width + grid.height) * 16 + 2 * pad, height: (grid.width + grid.height) * 8 + 16 + 2 * pad };
}

const artCentre = (col: number, row: number) => ({ x: (col - row) * 16, y: (col + row) * 8 });

/** Draws the floor and its decals, then the light map multiplied over it and the glow of the floor lights added: the three layers of the README. */
function bakeFloor(atlas: PixelAtlas, layout: PixelLayout, grid: Grid): HTMLCanvasElement {
  const bounds = floorBounds(grid);
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    return context;
  };
  const [map, glow, light, out] = [make(), make(), make(), make()];
  const draw = (context: CanvasRenderingContext2D, name: string, x: number, y: number) => {
    const { frame, anchor } = atlas.frames[FRAME_PREFIX + name]!;
    context.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, Math.round(x - anchor.x * frame.w - bounds.x), Math.round(y - anchor.y * frame.h - bounds.y), frame.w, frame.h);
  };
  for (const { name, col, row } of layout.floors) {
    const { x, y } = artCentre(col, row);
    draw(map, name, x, y);
    const glowName = atlas.tileset.sprites[name]?.glow;
    if (glowName) draw(glow, glowName, x, y);
  }

  const { lighting } = atlas.tileset;
  light.fillStyle = lighting.ambient;
  light.fillRect(0, 0, bounds.width, bounds.height);
  const { frame: lightFrame, anchor: lightAnchor } = atlas.frames[`${FRAME_PREFIX}light`]!;
  const pool = document.createElement("canvas");
  for (const lamp of layout.lights) {
    const kind = lighting.lights[lamp.kind];
    pool.width = Math.ceil(lightFrame.w * kind.scale);
    pool.height = Math.ceil(lightFrame.h * kind.scale);
    const poolContext = pool.getContext("2d")!;
    poolContext.imageSmoothingEnabled = false;
    poolContext.globalCompositeOperation = "source-over";
    poolContext.clearRect(0, 0, pool.width, pool.height);
    poolContext.drawImage(atlas.image, lightFrame.x, lightFrame.y, lightFrame.w, lightFrame.h, 0, 0, pool.width, pool.height);
    poolContext.globalCompositeOperation = "source-in";
    poolContext.fillStyle = kind.color;
    poolContext.fillRect(0, 0, pool.width, pool.height);
    const { x, y } = artCentre(lamp.col, lamp.row);
    light.globalCompositeOperation = "lighter";
    light.globalAlpha = kind.alpha;
    light.drawImage(pool, Math.round(x + lamp.dx - lightAnchor.x * pool.width - bounds.x), Math.round(y - lightAnchor.y * pool.height - bounds.y));
  }
  light.globalAlpha = 1;

  out.drawImage(map.canvas, 0, 0);
  out.globalCompositeOperation = "multiply";
  out.drawImage(light.canvas, 0, 0);
  out.globalCompositeOperation = "destination-in";
  out.drawImage(map.canvas, 0, 0);
  out.globalCompositeOperation = "lighter";
  out.drawImage(glow.canvas, 0, 0);
  return out.canvas;
}

/** How long one frame of the breathing halo of the core shows, in ms. */
const PULSE_FRAME_MS = 200;
const PULSE_FRAMES = 8;
/** The share of its brightness a wall, plant or text keeps where the Squad does not see. */
const FOG_SHARE = 0.45;

/** The Reactor Deck as sprites: one baked floor, the standing pieces, the core. `attach` puts them into the board's layers. */
export class PixelScenery {
  private readonly floor: Sprite;
  private readonly texture: Texture;
  private readonly sprites: { sprite: Sprite; tile?: GridPosition; kind?: Standing["kind"] }[] = [];
  /** Every sprite of the scenery that goes into the objects layer, glows included. */
  private readonly all: Sprite[] = [];
  private pulse?: Sprite;
  private readonly tint: number;

  constructor(
    private readonly atlas: PixelAtlas,
    grid: Grid,
  ) {
    const layout = pixelLayout(grid, atlas.tileset);
    this.tint = ambientTint(atlas.tileset);
    const bounds = floorBounds(grid);
    this.texture = Texture.from(bakeFloor(atlas, layout, grid));
    this.texture.source.scaleMode = "nearest";
    this.floor = new Sprite(this.texture);
    this.floor.scale.set(PIXEL_SCALE);
    this.floor.position.set(bounds.x * PIXEL_SCALE, bounds.y * PIXEL_SCALE);

    for (const piece of layout.standing) {
      const sprite = this.place(piece, piece.depth, this.tint);
      this.sprites.push({ sprite, tile: { col: piece.col, row: piece.row }, kind: piece.kind });
      const glow = atlas.tileset.sprites[piece.name]?.glow;
      if (glow) this.place({ ...piece, name: glow }, piece.depth + 0.05, 0xffffff, "add");
    }
    if (layout.core) {
      const depth = depthOf(layout.core.col, layout.core.row);
      const core = { col: layout.core.col, row: layout.core.row };
      this.place({ ...core, name: "core_claw_back" }, depth + 0.1, this.tint);
      this.place({ ...core, name: "core_claw_front" }, depth + 0.6, this.tint);
      const glowName = atlas.tileset.sprites.core_claw_back?.glow;
      if (glowName) this.place({ ...core, name: glowName }, depth + 0.15, 0xffffff, "add");
      this.place({ ...core, name: "core_beam" }, depth + 0.2, 0xffffff, "add");
      this.place({ ...core, name: "core_orb" }, depth + 0.3, 0xffffff, "add");
      this.pulse = this.place({ ...core, name: "core_pulse_2" }, depth + 0.35, 0xffffff, "add");
    }
  }

  private place(piece: Placed, depth: number, tint: number, blendMode?: "add"): Sprite {
    const sprite = new Sprite(this.atlas.textures[FRAME_PREFIX + piece.name]);
    const { x, y } = gridToWorld(piece);
    sprite.scale.set(PIXEL_SCALE);
    sprite.position.set(x + (piece.dx ?? 0) * PIXEL_SCALE, y + (piece.dy ?? 0) * PIXEL_SCALE);
    sprite.zIndex = depth;
    sprite.tint = tint;
    if (blendMode) sprite.blendMode = blendMode;
    this.all.push(sprite);
    return sprite;
  }

  /** Puts the floor at the bottom of `floorLayer` and the standing pieces into `objects`, which sorts them with the Heroes. */
  attach(floorLayer: Container, objects: Container): void {
    floorLayer.addChildAt(this.floor, 0);
    objects.addChild(...this.all);
  }

  /** The Cover of the map shows only where the Squad sees; the rest of the standing pieces go dark in the fog. */
  setLit(lit: ReadonlySet<string>): void {
    for (const { sprite, tile, kind } of this.sprites) {
      const seen = tile ? lit.has(`${tile.col},${tile.row}`) : true;
      if (kind === "cover") sprite.visible = seen;
      else sprite.tint = seen ? this.tint : dimmed(this.tint, FOG_SHARE);
    }
  }

  /** Steps the halo of the core; with reduced motion it stands on one frame. */
  tick(now: number, reducedMotion: boolean): void {
    if (!this.pulse) return;
    const frame = reducedMotion ? 2 : Math.floor(now / PULSE_FRAME_MS) % PULSE_FRAMES;
    this.pulse.texture = this.atlas.textures[`${FRAME_PREFIX}core_pulse_${frame}`]!;
  }

  get animated(): boolean {
    return this.pulse !== undefined;
  }

  destroy(): void {
    this.floor.destroy();
    this.texture.destroy(true);
    for (const sprite of this.all) sprite.destroy();
  }
}
