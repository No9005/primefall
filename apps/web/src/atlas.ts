// The scene atlas format (ADR 0026, rule 3): a PNG and a JSON in PixiJS v8's sprite sheet format. The match Heroes' sheets
// (`docs/design/heroes/README.md`) and the hangar atlases (`apps/web/scripts/ATLAS.md`) are read by the same code.

/** No atlas page is larger than this on either side (the texture limit of the weakest phones we care about). */
export const MAX_ATLAS_SIDE = 4096;

/** The pace of the match Heroes' sheets: 20 frames per second. An animation without timing in the JSON plays at it. */
export const DEFAULT_FRAME_MS = 50;

export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasFrame {
  frame: AtlasRect;
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: AtlasRect;
  sourceSize: { w: number; h: number };
  anchor: { x: number; y: number };
}

/** The timing of one animation: how many frames it has and how long all of them take together. */
export interface AtlasClipTiming {
  frames: number;
  durationMs: number;
}

export interface AtlasData {
  frames: Record<string, AtlasFrame>;
  /** Animation name to the frame names in playback order; a frame may be named several times. */
  animations: Record<string, string[]>;
  meta: {
    image: string;
    size: { w: number; h: number };
    scale: string;
    format?: string;
    /** Timing per animation name; the match sheets have none (they play at `DEFAULT_FRAME_MS`). */
    clips?: Record<string, AtlasClipTiming>;
  };
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${where} must be an object`);
  return value as Record<string, unknown>;
}

function count(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${where} must be a number of at least 0`);
  return value;
}

function rect(value: unknown, where: string): AtlasRect {
  const source = record(value, where);
  return { x: count(source.x, `${where}.x`), y: count(source.y, `${where}.y`), w: count(source.w, `${where}.w`), h: count(source.h, `${where}.h`) };
}

/** Checks a sprite sheet JSON and returns it typed. Throws an error that names the first thing wrong. */
export function parseAtlas(json: unknown): AtlasData {
  const root = record(json, "atlas");
  const meta = record(root.meta, "meta");
  if (typeof meta.image !== "string" || typeof meta.scale !== "string") throw new Error("meta.image and meta.scale must be strings");
  const size = record(meta.size, "meta.size");
  const width = count(size.w, "meta.size.w");
  const height = count(size.h, "meta.size.h");
  if (width > MAX_ATLAS_SIDE || height > MAX_ATLAS_SIDE) throw new Error(`atlas page ${width} x ${height} is larger than ${MAX_ATLAS_SIDE}`);

  const frames = parseFrames(record(root.frames, "frames"), width, height);
  const animations = parseAnimations(record(root.animations, "animations"), frames);
  const clips = meta.clips === undefined ? undefined : parseClips(record(meta.clips, "meta.clips"), animations);
  return { frames, animations, meta: { image: meta.image, size: { w: width, h: height }, scale: meta.scale, format: typeof meta.format === "string" ? meta.format : undefined, clips } };
}

function parseFrames(source: Record<string, unknown>, width: number, height: number): Record<string, AtlasFrame> {
  const frames: Record<string, AtlasFrame> = {};
  for (const [name, raw] of Object.entries(source)) {
    const entry = record(raw, `frame ${name}`);
    const frame = rect(entry.frame, `frame ${name}.frame`);
    if (frame.x + frame.w > width || frame.y + frame.h > height) throw new Error(`frame ${name} lies outside the page`);
    const sourceSize = record(entry.sourceSize, `frame ${name}.sourceSize`);
    const anchor = record(entry.anchor, `frame ${name}.anchor`);
    frames[name] = {
      frame,
      rotated: entry.rotated === true,
      trimmed: entry.trimmed === true,
      spriteSourceSize: rect(entry.spriteSourceSize, `frame ${name}.spriteSourceSize`),
      sourceSize: { w: count(sourceSize.w, "sourceSize.w"), h: count(sourceSize.h, "sourceSize.h") },
      anchor: { x: count(anchor.x, "anchor.x"), y: count(anchor.y, "anchor.y") },
    };
  }
  return frames;
}

function parseAnimations(source: Record<string, unknown>, frames: Record<string, AtlasFrame>): Record<string, string[]> {
  const animations: Record<string, string[]> = {};
  for (const [name, list] of Object.entries(source)) {
    if (!Array.isArray(list) || list.length === 0) throw new Error(`animation ${name} must be a list of frames`);
    for (const frameName of list) if (typeof frameName !== "string" || !frames[frameName]) throw new Error(`animation ${name} names an unknown frame ${String(frameName)}`);
    animations[name] = list as string[];
  }
  return animations;
}

function parseClips(source: Record<string, unknown>, animations: Record<string, string[]>): Record<string, AtlasClipTiming> {
  const clips: Record<string, AtlasClipTiming> = {};
  for (const [name, raw] of Object.entries(source)) {
    const timing = record(raw, `meta.clips.${name}`);
    const parsed = { frames: count(timing.frames, `${name}.frames`), durationMs: count(timing.durationMs, `${name}.durationMs`) };
    if (!animations[name]) throw new Error(`meta.clips names an animation that does not exist: ${name}`);
    if (animations[name].length !== parsed.frames) throw new Error(`animation ${name} has ${animations[name].length} frames, its timing says ${parsed.frames}`);
    if (parsed.durationMs <= 0) throw new Error(`animation ${name} must last longer than 0 ms`);
    clips[name] = parsed;
  }
  return clips;
}

/** How long one frame of an animation stands (the total duration is shared evenly, so 2.0 s over 40 frames and 0.55 s over 8 both come out right). */
export function frameMsOf(meta: AtlasData["meta"] | undefined, animation: string, frames: number): number {
  const timing = meta?.clips?.[animation];
  return timing ? timing.durationMs / frames : DEFAULT_FRAME_MS;
}
