import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { type AtlasClipTiming, type AtlasData, type AtlasFrame, MAX_ATLAS_SIDE, parseAtlas } from "../src/atlas";
import { BRIDGE_FRAME_MS, BRIDGES, CLIPS, HANGAR_HEROES, type HangarHero, RIG_HEROES } from "../src/hangar-select";

// Packs the hangar's strips (one frame after the other) into one trimmed atlas per Hero. See ATLAS.md.

/** Heroes whose atlas is packed from the strips in `archive/hangar/strips/`. */
export const STRIP_HEROES: readonly HangarHero[] = HANGAR_HEROES.filter((hero) => !RIG_HEROES.includes(hero));

export const HANGAR_FOLDER = path.resolve(import.meta.dirname, "../public/assets/hangar");
export const ATLAS_FOLDER = path.join(HANGAR_FOLDER, "atlas");
/** The strips the atlases are packed from; they are sources, so they live in the archive and not in the build (see archive/README.md). */
export const STRIP_FOLDER = path.resolve(import.meta.dirname, "../../../archive/hangar/strips");

/** Pixels left empty around every packed frame so that scaling never samples a neighbour. */
const PADDING = 1;

export interface Image {
  width: number;
  height: number;
  /** RGBA, 8 bits per channel, row after row. */
  data: Uint8Array;
}

// ---- PNG (RGBA8, not interlaced: what the strips and the atlases are) -------------------------------------------------------------

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

export function encodePng(image: Image): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = image.width * 4;
  const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y++) raw.set(image.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/** The Paeth filter of PNG: of left, up and up-left, the one closest to `left + up - upLeft` (left wins ties, then up). */
function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const [dl, du, dul] = [Math.abs(estimate - left), Math.abs(estimate - up), Math.abs(estimate - upLeft)];
  if (dl <= du && dl <= dul) return left;
  return du <= dul ? up : upLeft;
}

export function decodePng(file: Buffer): Image {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG file");
  let width = 0;
  let height = 0;
  const parts: Buffer[] = [];
  for (let at = 8; at < file.length; ) {
    const length = file.readUInt32BE(at);
    const type = file.toString("latin1", at + 4, at + 8);
    const body = file.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error("Only 8-bit RGBA PNG files that are not interlaced are supported");
    } else if (type === "IDAT") parts.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  const data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      const left = x >= 4 ? (data[at - 4] as number) : 0;
      const up = y > 0 ? (data[at - stride] as number) : 0;
      const upLeft = x >= 4 && y > 0 ? (data[at - stride - 4] as number) : 0;
      const byte = raw[y * (stride + 1) + 1 + x] as number;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) predicted = paethPredictor(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unknown PNG filter ${filter}`);
      data[at] = (byte + predicted) & 0xff;
    }
  }
  return { width, height, data };
}

// ---- What to pack: the hangar's own tables -----------------------------------------------------------------------------------------

/** One animation of a Hero's atlas: a strip file, its frame count and how long all frames take. */
export interface AtlasJob {
  animation: string;
  file: string;
  frames: number;
  durationMs: number;
}

/** The animations of a Hero, taken from `CLIPS` and `BRIDGES` (the hangar's tables stay the one place for them). */
function stripOf(hero: HangarHero, clip: string, file: string | undefined): string {
  if (!file) throw new Error(`${hero} ${clip} has no strip: the atlas of ${hero} is not packed from strips`);
  return file;
}

export function jobsOf(hero: HangarHero): AtlasJob[] {
  const jobs: AtlasJob[] = [];
  for (const [name, clip] of Object.entries(CLIPS[hero])) jobs.push({ animation: `${hero}.${name}`, file: stripOf(hero, name, clip.file), frames: clip.frames, durationMs: Math.round(clip.seconds * 1000) });
  for (const [name, bridge] of Object.entries(BRIDGES[hero])) jobs.push({ animation: `${hero}.bridge.${name}`, file: stripOf(hero, `bridge ${name}`, bridge.file), frames: bridge.frames, durationMs: bridge.frames * BRIDGE_FRAME_MS });
  return jobs;
}

// ---- Trim, dedupe, pack ------------------------------------------------------------------------------------------------------------

interface UniqueFrame {
  name: string;
  /** The trimmed pixels. */
  image: Image;
  /** Where the trimmed pixels sit in the whole frame. */
  offset: { x: number; y: number };
  source: { w: number; h: number };
  x: number;
  y: number;
}

function sliceFrame(strip: Image, index: number, width: number): Image {
  const data = new Uint8Array(width * strip.height * 4);
  for (let y = 0; y < strip.height; y++) data.set(strip.data.subarray((y * strip.width + index * width) * 4, (y * strip.width + (index + 1) * width) * 4), y * width * 4);
  return { width, height: strip.height, data };
}

/** Cuts the transparent border off. A frame without any pixel becomes one transparent pixel. */
function trim(frame: Image): { image: Image; offset: { x: number; y: number } } {
  let [left, top, right, bottom] = [frame.width, frame.height, -1, -1];
  for (let y = 0; y < frame.height; y++)
    for (let x = 0; x < frame.width; x++)
      if (frame.data[(y * frame.width + x) * 4 + 3] !== 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < 0) return { image: { width: 1, height: 1, data: new Uint8Array(4) }, offset: { x: 0, y: 0 } };
  const width = right - left + 1;
  const height = bottom - top + 1;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) data.set(frame.data.subarray(((top + y) * frame.width + left) * 4, ((top + y) * frame.width + left + width) * 4), y * width * 4);
  return { image: { width, height, data }, offset: { x: left, y: top } };
}

/** Rows of frames, tallest first; the page is as wide as gives the smallest area within the limit. */
function packFrames(frames: UniqueFrame[]): { width: number; height: number } {
  const order = frames.map((_, index) => index).sort((a, b) => (frames[b] as UniqueFrame).image.height - (frames[a] as UniqueFrame).image.height || a - b);
  let best: { width: number; height: number; places: [number, number][] } | undefined;
  for (let width = 64; width <= MAX_ATLAS_SIDE; width *= 2) {
    const places: [number, number][] = [];
    let [x, y, rowHeight, usedWidth] = [0, 0, 0, 0];
    let fits = true;
    for (const index of order) {
      const { image } = frames[index] as UniqueFrame;
      if (image.width + PADDING > width) {
        fits = false;
        break;
      }
      if (x + image.width + PADDING > width) {
        x = 0;
        y += rowHeight + PADDING;
        rowHeight = 0;
      }
      places[index] = [x, y];
      x += image.width + PADDING;
      usedWidth = Math.max(usedWidth, x);
      rowHeight = Math.max(rowHeight, image.height);
    }
    const height = y + rowHeight;
    if (fits && height <= MAX_ATLAS_SIDE && (!best || usedWidth * height < best.width * best.height)) best = { width: usedWidth, height, places };
  }
  if (!best) throw new Error(`The frames do not fit one ${MAX_ATLAS_SIDE} x ${MAX_ATLAS_SIDE} page`);
  frames.forEach((frame, index) => {
    [frame.x, frame.y] = best.places[index] as [number, number];
  });
  return { width: best.width, height: best.height };
}

export interface PackedAtlas {
  png: Buffer;
  json: string;
  data: AtlasData;
}

const digest = (image: Image): string => createHash("sha1").update(image.data).digest("hex");

/** Packs the animations of one Hero. `readStrip` returns the decoded strip of a file in the strip folder. */
export function packAtlas(hero: HangarHero, jobs: readonly AtlasJob[], readStrip: (file: string) => Image): PackedAtlas {
  const unique: UniqueFrame[] = [];
  const byHash = new Map<string, UniqueFrame>();
  const animations: Record<string, string[]> = {};
  const clips: Record<string, AtlasClipTiming> = {};
  let sourceSize = { w: 0, h: 0 };

  for (const job of jobs) {
    const strip = readStrip(job.file);
    if (strip.width % job.frames !== 0) throw new Error(`${job.file}: ${strip.width} px is not ${job.frames} whole frames`);
    const width = strip.width / job.frames;
    if (sourceSize.w !== 0 && (sourceSize.w !== width || sourceSize.h !== strip.height)) throw new Error(`${job.file}: frames of ${hero} differ in size`);
    sourceSize = { w: width, h: strip.height };
    animations[job.animation] = [];
    for (let index = 0; index < job.frames; index++) {
      const whole = sliceFrame(strip, index, width);
      const key = digest(whole);
      let frame = byHash.get(key);
      if (!frame) {
        const trimmed = trim(whole);
        frame = { name: `${hero}.${String(unique.length).padStart(3, "0")}`, image: trimmed.image, offset: trimmed.offset, source: { w: width, h: strip.height }, x: 0, y: 0 };
        byHash.set(key, frame);
        unique.push(frame);
      }
      (animations[job.animation] as string[]).push(frame.name);
    }
    clips[job.animation] = { frames: job.frames, durationMs: job.durationMs };
  }

  const page = packFrames(unique);
  const sheet: Image = { width: page.width, height: page.height, data: new Uint8Array(page.width * page.height * 4) };
  const frames: Record<string, AtlasFrame> = {};
  for (const frame of unique) {
    for (let y = 0; y < frame.image.height; y++) sheet.data.set(frame.image.data.subarray(y * frame.image.width * 4, (y + 1) * frame.image.width * 4), ((frame.y + y) * page.width + frame.x) * 4);
    frames[frame.name] = {
      frame: { x: frame.x, y: frame.y, w: frame.image.width, h: frame.image.height },
      rotated: false,
      trimmed: frame.image.width !== frame.source.w || frame.image.height !== frame.source.h,
      spriteSourceSize: { x: frame.offset.x, y: frame.offset.y, w: frame.image.width, h: frame.image.height },
      sourceSize: frame.source,
      // The origin of a hangar frame is the middle of its bottom edge: the feet stand there, in the place the screen puts the Hero.
      anchor: { x: 0.5, y: 1 },
    };
  }
  const data: AtlasData = { frames, animations, meta: { image: `${hero}.png`, size: { w: page.width, h: page.height }, scale: "1", format: "RGBA8888", clips } };
  return { png: encodePng(sheet), json: `${JSON.stringify(data)}\n`, data };
}

/** Puts a frame back into its whole size, as the strip has it (for the pixel-for-pixel test). */
export function untrimFrame(atlas: Image, frame: AtlasFrame): Image {
  const { sourceSize, spriteSourceSize: at, frame: from } = frame;
  const data = new Uint8Array(sourceSize.w * sourceSize.h * 4);
  for (let y = 0; y < from.h; y++) data.set(atlas.data.subarray(((from.y + y) * atlas.width + from.x) * 4, ((from.y + y) * atlas.width + from.x + from.w) * 4), ((at.y + y) * sourceSize.w + at.x) * 4);
  return { width: sourceSize.w, height: sourceSize.h, data };
}

// ---- The files ---------------------------------------------------------------------------------------------------------------------

export const atlasPaths = (hero: HangarHero, folder = ATLAS_FOLDER) => ({ png: path.join(folder, `${hero}.png`), json: path.join(folder, `${hero}.json`) });

export function packHero(hero: HangarHero): PackedAtlas {
  const strips = new Map<string, Image>();
  return packAtlas(hero, jobsOf(hero), (file) => {
    let strip = strips.get(file);
    if (!strip) {
      strip = decodePng(readFileSync(path.join(STRIP_FOLDER, file)));
      strips.set(file, strip);
    }
    return strip;
  });
}

export function writeAtlases(): void {
  mkdirSync(ATLAS_FOLDER, { recursive: true });
  for (const hero of STRIP_HEROES) {
    const packed = packHero(hero);
    writeFileSync(atlasPaths(hero).png, packed.png);
    writeFileSync(atlasPaths(hero).json, packed.json);
  }
}

/**
 * Lists what differs between the committed atlases and what the strips produce. The JSON is compared byte for byte; the picture by its
 * pixels (the compressed bytes may differ between zlib versions without the picture being different).
 */
export function checkAtlases(folder = ATLAS_FOLDER): string[] {
  const problems: string[] = [];
  for (const hero of STRIP_HEROES) {
    const { png, json } = atlasPaths(hero, folder);
    if (!existsSync(png) || !existsSync(json)) {
      problems.push(`${hero}: atlas files are missing`);
      continue;
    }
    const packed = packHero(hero);
    try {
      parseAtlas(JSON.parse(readFileSync(json, "utf8")));
    } catch (error) {
      problems.push(`${hero}.json is not a valid atlas: ${(error as Error).message}`);
    }
    if (readFileSync(json, "utf8") !== packed.json) problems.push(`${hero}.json differs from what the strips produce`);
    const committed = decodePng(readFileSync(png));
    const expected = decodePng(packed.png);
    if (committed.width !== expected.width || committed.height !== expected.height || !Buffer.from(committed.data).equals(Buffer.from(expected.data))) problems.push(`${hero}.png differs from what the strips produce`);
  }
  return problems;
}
