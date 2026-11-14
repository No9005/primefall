import type { GridPosition } from "game-core";
import { Container, Graphics, Text } from "pixi.js";
import { CLIP_SPEED } from "./clip-player";
import { rubyPieces, shieldBubble } from "./hero-figure";
import { HERO_STYLE } from "./hero-style";
import { drawCoverLook } from "./cover-look";
import { coverLook, type CoverLook, TILE_HEIGHT } from "./terrain";
import {
  aegisBeamAt,
  AURA_SPARKS,
  auraGlowAt,
  auraRingAt,
  auraSparkAt,
  badgeAt,
  bigFireballAt,
  overdriveTagAt,
  puffAt,
  surgeBeamAt,
  chargeAt,
  chunkAt,
  COVER_WALL_UP_MS,
  coverDropAt,
  dustAt,
  type EffectCue,
  bubbleFormAt,
  BUBBLE_LEAD_MS,
  fireballAt,
  FLASH_MS,
  rippleAt,
  rubyBurstAt,
  rubyPopAt,
  shardAt,
  SHARDS,
  flightProgress,
  KNOCKBACK_TAG_MS,
  AEGIS_BEAM_MS,
  type BonusTone,
  CHARGE_STREAK_MS,
  PULL_ECHO_LAGS,
  PULL_MS,
  slideProgress,
  SLIDE_MS,
  OVERDRIVE_TAG_OUT_MS,
  SURGE_MS,
  sampleTrack,
  scorchAt,
  shockRingAt,
  skidAt,
  smokeAt,
  GLINT_BEFORE_FIRE_MS,
  IMPACT_BURST_MS,
  IMPACT_RING_MS,
  LASER_MS,
  LONG_LINE_FADE_MS,
  CROSSFIRE_STEP_PX,
  crossfireAt,
  type NumberStyle,
  numberAt,
  reticleAt,
  shakeAt,
  type Weapon,
} from "./weapon-effects";

// Draws the effect cues of a playback frame on the layer above the Heroes. Everything is a plain shape; the Graphics and
// Text objects are pooled (made once, cleared and redrawn), and the timing comes from `weapon-effects.ts`.

const F = HERO_STYLE.figureScale;
/** How high above the foot of a Hero a shot starts and lands: the chest. */
const CHEST_LIFT = TILE_HEIGHT * 1.05;
const HEAD_LIFT = 38 * F;
/** How high above the floor a shot lands on a Half Cover wall. */
const WALL_HIT_LIFT = 7 * F;

interface WeaponLook {
  color: number;
  flash: number;
  flashRadius: number;
  impact: number;
  sparks: number;
  rings: number;
}

const LOOK: Readonly<Record<Weapon, WeaponLook>> = {
  slam: { color: 0xff8a3d, flash: 0xffb066, flashRadius: 7, impact: 1.2, sparks: 4, rings: 1 },
  precision: { color: 0x9fd4ff, flash: 0x9fd4ff, flashRadius: 4, impact: 0.6, sparks: 3, rings: 1 },
  long: { color: 0xe8ffff, flash: 0xffffff, flashRadius: 9, impact: 1.5, sparks: 4, rings: 1 },
  tag: { color: 0xff8fb0, flash: 0xff8fb0, flashRadius: 3.5, impact: 0.5, sparks: 2, rings: 0 },
};
const GOLD = 0xffd24a;
const NUMBER_COLOR: Readonly<Record<NumberStyle, number>> = { damage: 0xff6b6b, bonus: 0xffb000, shield: 0x4da3ff, failed: 0x8a99a8 };
const MARKED_RED = 0xff6b6b;
const SLOW_VIOLET = 0xc18bff;
const OUTLINE = 0x0b1016;
/** Crossfire label colours: the enemy red for hits on the player's Heroes, teal for the player's hits. */
const CROSSFIRE_ENEMY = 0xe5484d;
const CROSSFIRE_OWN = 0x2ec4b6;
const CROSSFIRE_FONT = 9;
const SPARK_ANGLES = [0.6, 2.2, 3.7, 5.3];
/** The Pull is teal when the player's Squad pulls, enemy red when the player's Hero is pulled (docs/design/role-visuals/380/pull.png). */
/** CLOSE +1 is orange like the Slam Shot, CHARGE +1 gold (docs/design/role-visuals/380/charge.png). */
const BONUS_COLOR: Readonly<Record<BonusTone, number>> = { close: 0xff8a3d, charge: 0xffd24a };
const PULL_OWN = 0x2ec4b6;
const PULL_ENEMY = 0xe5484d;

export interface Point {
  x: number;
  y: number;
}

/** A glow: a few overlapping circles with falling alpha (no filters). */
function blob(g: Graphics, at: Point, radius: number, color: number, alpha: number): void {
  g.circle(at.x, at.y, radius).fill({ color, alpha: alpha * 0.3 });
  g.circle(at.x, at.y, radius * 0.66).fill({ color, alpha: alpha * 0.4 });
  g.circle(at.x, at.y, radius * 0.33).fill({ color, alpha });
}

interface Stroke {
  width: number;
  color: number;
  alpha: number;
}

function line(g: Graphics, from: Point, to: Point, stroke: Stroke): void {
  g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ ...stroke, cap: "round" });
}

/** A Marked or Slow state drawn on a Hero: `update(ms)` is the time since it locked on; a state from the start passes a large `ms`. */
export interface StatusMark {
  container: Container;
  update(ms: number): void;
}

const HIDDEN_SEEN_CYAN = 0x4fd1ff;

/**
 * The look of an enemy that is Hidden and shown by a Scout Drone (docs/design/role-visuals/380/hidden-seen.png): a cyan
 * ring inside the red Squad ring, an eye mark over the head and the tag HIDDEN · SEEN. The figure itself is drawn at about
 * 55 % by the board. It is shown, not unmasked: it stays Hidden and cannot be named as a target.
 */
export function hiddenSeenMark(): Container {
  const container = new Container();
  const ring = new Graphics().ellipse(0, -TILE_HEIGHT / 2 + 4 * F, 13 * F, 6.5 * F).stroke({ width: 2 * F, color: HIDDEN_SEEN_CYAN, alpha: 0.95 });
  const eye = new Graphics();
  eye.moveTo(-8 * F, 0).quadraticCurveTo(0, -7 * F, 8 * F, 0).quadraticCurveTo(0, 7 * F, -8 * F, 0).stroke({ width: 1.6 * F, color: HIDDEN_SEEN_CYAN });
  eye.circle(0, 0, 2.8 * F).fill(HIDDEN_SEEN_CYAN);
  eye.position.set(26 * F, -HEAD_LIFT - 18 * F);
  const tag = new Text({ text: "HIDDEN · SEEN", style: { fontFamily: "IBM Plex Mono", fontSize: 6 * F, fontWeight: "700", fill: HIDDEN_SEEN_CYAN, stroke: { color: OUTLINE, width: 2 * F } } });
  tag.anchor.set(0.5, 1);
  tag.position.set(0, -HEAD_LIFT - 6 * F);
  container.addChild(ring, eye, tag);
  return container;
}

/** The two rings that spread on the floor where a Pulled Hero arrives; `t` is 0 at the arrival and 1 when they are gone. */
function drawPullRing(g: Graphics, at: Point, color: number, t: number): void {
  for (const ring of [0, 1]) {
    const grow = Math.max(0, t - ring * 0.18);
    g.ellipse(at.x, at.y, (16 + 20 * grow) * F, (8 + 10 * grow) * F).stroke({ width: (ring === 0 ? 2.5 : 1.5) * F, color, alpha: (1 - t) * (ring === 0 ? 0.9 : 0.5) });
  }
}

/** The red reticle (22 px ring with a cross) that locks on from 2.4 x to 1 x, turning 45 degrees, with a small MARKED tag. */
export function markedMark(color = MARKED_RED): StatusMark {
  const container = new Container();
  const reticle = new Graphics();
  reticle.circle(0, 0, 11 * F).stroke({ width: 2 * F, color });
  reticle.moveTo(0, -11 * F).lineTo(0, 11 * F).moveTo(-11 * F, 0).lineTo(11 * F, 0).stroke({ width: 2 * F, color });
  reticle.position.set(0, -CHEST_LIFT);
  const tag = new Text({ text: "MARKED", style: { fontFamily: "IBM Plex Mono", fontSize: 6 * F, fontWeight: "700", fill: color, stroke: { color: OUTLINE, width: 2 * F } } });
  tag.anchor.set(0.5, 1);
  tag.position.set(0, -CHEST_LIFT - 13 * F);
  container.addChild(reticle, tag);
  return {
    container,
    update(ms) {
      const { scale, rotation, alpha } = reticleAt(ms);
      reticle.scale.set(scale);
      reticle.rotation = (rotation * Math.PI) / 180;
      reticle.alpha = alpha;
      tag.alpha = alpha;
    },
  };
}

/** The violet ground field (34 x 16 ellipse) that pulses, and three stacked downward chevrons above the head. */
export function slowMark(): StatusMark {
  const container = new Container();
  const field = new Graphics();
  field.ellipse(0, 0, 17 * F, 8 * F).fill({ color: SLOW_VIOLET, alpha: 0.2 }).stroke({ width: 2 * F, color: SLOW_VIOLET });
  const chevrons = new Graphics();
  for (let i = 0; i < 3; i++) {
    const y = -HEAD_LIFT - 14 * F + i * 4 * F;
    chevrons.moveTo(-4 * F, y).lineTo(0, y + 3 * F).lineTo(4 * F, y).stroke({ width: 1.8 * F, color: SLOW_VIOLET, alpha: 1 - i * 0.2, join: "round" });
  }
  container.addChild(field, chevrons);
  return {
    container,
    update(ms) {
      const t = Math.max(0, ms);
      const intro = Math.min(1, t / 300);
      // Three pulses at the start, then a slow breathing.
      field.scale.set(intro < 1 ? 0.3 + 0.7 * intro : 1 + 0.15 * Math.sin(((t - 300) / 1200) * 2 * Math.PI));
      field.alpha = intro < 1 ? intro : 0.7 + 0.3 * Math.sin(((t - 300) / 1200) * 2 * Math.PI);
      chevrons.alpha = intro;
      chevrons.y = ((t / 400) % 1) * 2 * F;
    },
  };
}

const OVERDRIVE_GOLD = 0xffb000;

/**
 * The small gold double-chevron badge with `+1` that stays beside the ring of a Hero with an Attack bonus (Adrenal Surge in
 * Overdrive) until its Exhaustion. `update(ms)` is the time since it appeared; state passes a large `ms`.
 */
export function attackBadge(): StatusMark {
  const container = new Container();
  const badge = new Container();
  // A 30 x 13 frame centred above the head; the double chevron is centred on the frame's middle line.
  const frame = new Graphics().roundRect(-15 * F, -6.5 * F, 30 * F, 13 * F, 4 * F).fill(OUTLINE).stroke({ width: 1.2 * F, color: GOLD });
  const chevrons = new Graphics();
  for (const y of [-1.8, 1.8]) {
    chevrons.moveTo(-9.5 * F, (y + 1.6) * F).lineTo(-6 * F, (y - 1.6) * F).lineTo(-2.5 * F, (y + 1.6) * F);
  }
  chevrons.stroke({ width: 1.5 * F, color: GOLD, join: "round", cap: "round" });
  const label = new Text({ text: "+1", style: { fontFamily: "Rajdhani", fontSize: 10 * F, fontWeight: "700", fill: GOLD } });
  label.anchor.set(0, 0.5);
  label.position.set(-0.5 * F, 0);
  badge.addChild(frame, chevrons, label);
  badge.position.set(0, -50 * F);
  container.addChild(badge);
  return {
    container,
    update(ms) {
      const { scale, alpha } = badgeAt(ms);
      badge.scale.set(scale);
      badge.alpha = alpha;
    },
  };
}

export interface ShieldMarkInput {
  /** The Shield the Hero holds after this frame. */
  held: number;
  /** The Hero gains `amount` Shield at `startMs`: the rubies pop and the bubble forms. */
  gain?: { startMs: number; amount: number };
  /** A hit that the Shield absorbed `absorbed` of, at `startMs`: a ripple, and as many rubies burst; at zero the bubble breaks. */
  hit?: { startMs: number; absorbed: number };
  cameraScale: number;
}

const SHIELD_BLUE = 0x4da3ff;

/**
 * The Shield of a Hero for a frame in which it changes: the rubies and the bubble, with the pop, the ripple and the
 * shards of docs/design/animation. `update(ms)` is the time since the frame started.
 */
export function shieldMark({ held, gain, hit, cameraScale }: ShieldMarkInput): StatusMark {
  const { bubble: look } = HERO_STYLE.marks;
  const container = new Container();
  const absorbed = hit?.absorbed ?? 0;
  const bubble = shieldBubble(cameraScale);
  const ripple = new Graphics().ellipse(0, look.centerY, look.radiusX, look.radiusY).stroke({ width: 1.5, color: SHIELD_BLUE });
  ripple.pivot.set(0, look.centerY);
  ripple.position.set(0, look.centerY * F);
  ripple.visible = false;
  const { row, rubies } = rubyPieces(held + absorbed, cameraScale);
  const shards = SHARDS.map(() => {
    const shard = new Graphics().poly([-2.5, -4, 2.5, -2, 1.5, 4, -3, 2]).fill({ color: look.fill, alpha: 0.7 }).stroke({ width: 0.8, color: SHIELD_BLUE });
    shard.scale.set(F);
    shard.visible = false;
    return shard;
  });
  container.addChild(bubble, row, ripple, ...shards);
  const breaks = hit !== undefined && held <= 0;
  return {
    container,
    update(ms) {
      // The bubble: it forms before the rubies pop, and breaks into shards when the last Shield is absorbed.
      const form = gain === undefined ? { scale: 1, alpha: 1 } : bubbleFormAt(ms - (gain.startMs - BUBBLE_LEAD_MS));
      const gone = breaks && ms >= hit.startMs;
      bubble.scale.set(F * form.scale);
      bubble.alpha = gone ? 0 : form.alpha;
      rubies.forEach((ruby, i) => {
        // The newest rubies of a gain pop; the ones an absorbed hit removes burst at its impact.
        let size = 1;
        if (gain !== undefined && i >= held - gain.amount && i < held) size = rubyPopAt(ms - gain.startMs, i - (held - gain.amount));
        if (hit !== undefined && i >= held) size = rubyBurstAt(ms - hit.startMs);
        ruby.scale.set(size);
        ruby.visible = size > 0;
      });
      const wave = hit === undefined ? undefined : rippleAt(ms - hit.startMs);
      ripple.visible = wave !== undefined && !breaks;
      if (wave) {
        ripple.scale.set(F * wave.scale);
        ripple.alpha = wave.alpha;
      }
      shards.forEach((shard, i) => {
        const state = breaks ? shardAt(ms - hit.startMs, i) : undefined;
        shard.visible = state !== undefined;
        if (!state) return;
        shard.position.set(state.x * F, look.centerY * F + state.y * F);
        shard.rotation = (state.turn * Math.PI) / 180;
        shard.alpha = state.alpha;
      });
    },
  };
}

/** The ms after which a persistent Marked or Slow is past its intro. */
export const STATUS_AT_REST_MS = 1_000_000;

/** Where a Hero stands in world pixels (its foot), or nothing when the Hero is not on the board (not perceived). */
export type Placer = (heroId: string) => Point | undefined;

/** What the layer needs to know about the board: where Heroes and tiles are, and whose Squad a Hero is in. */
export interface EffectsWorld {
  place: Placer;
  /** The centre of a tile on the floor, in world pixels. */
  tile(tile: GridPosition): Point;
  /** True for a Hero of the player's own Squad. */
  own(heroId: string): boolean;
  /** The look of built Cover on a tile, grown to `grow` (0 to 1) of its height. */
  builtCover(tile: GridPosition, grow: number): CoverLook;
}

const WALL_TOP = 0x77899b;
const SMOKE = 0x3a4653;
const DUST = 0x8a99a8;
const SHOCK_ORANGE = 0xff8a3d;
const CHIP_VECTORS = [[-10, -12], [12, -14], [-4, -18], [16, -6]] as const;
/** How long the chips and the flash of a hit on Half Cover last. */
const WALL_HIT_MS = 340;

function rotatedRect(g: Graphics, centre: Point, size: { w: number; h: number }, degrees: number): void {
  const { w, h } = size;
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const corners = [[-w, -h], [w, -h], [w, h], [-w, h]] as const;
  g.poly(corners.flatMap(([x, y]) => [centre.x + (x * cos - y * sin) / 2, centre.y + (x * sin + y * cos) / 2]));
}

function diamond(g: Graphics, at: Point, halfWidth: number, halfHeight: number): void {
  g.poly([at.x, at.y - halfHeight, at.x + halfWidth, at.y, at.x, at.y + halfHeight, at.x - halfWidth, at.y]);
}

/** The yellow dashed diamond that marks where built Cover drops. */
function drawDropTarget(g: Graphics, centre: Point): void {
  const corners = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  const dashes = 12;
  const at = (t: number): Point => {
    const side = Math.min(3, Math.floor(t));
    const [x1, y1] = corners[side]!;
    const [x2, y2] = corners[(side + 1) % 4]!;
    const u = t - side;
    return { x: centre.x + (x1 + (x2 - x1) * u) * 23 * F, y: centre.y + (y1 + (y2 - y1) * u) * 12 * F };
  };
  for (let i = 0; i < dashes; i++) {
    const from = at((i / dashes) * 4);
    const to = at(Math.min(((i + 0.55) / dashes) * 4, 3.999));
    g.moveTo(from.x, from.y).lineTo(to.x, to.y);
  }
  g.stroke({ width: 1.5 * F, color: GOLD, alpha: 0.9 });
}

/** The yellow ring and the grey dust of the crate landing; `landing` runs 0 to 1. */
function drawDropLanding(g: Graphics, centre: Point, landing: number): void {
  g.ellipse(centre.x, centre.y, (10 + 16 * landing) * F, (5 + 8 * landing) * F).stroke({ width: 1.5 * F, color: GOLD, alpha: 1 - landing });
  for (let puff = 0; puff < 4; puff++) {
    const side = puff < 2 ? -1 : 1;
    const out = (puff % 2 === 0 ? 12 : 20) + 10 * landing;
    g.ellipse(centre.x + side * out * F, centre.y - 2 * F * landing, 4 * F * (0.6 + landing), 2.4 * F * (0.6 + landing)).fill({ color: DUST, alpha: 0.7 * (1 - landing) });
  }
}

/** The striped crate (16 x 10 game px), `lift` world px above its tile. */
function drawCrate(g: Graphics, centre: Point, lift: number): void {
  const x = centre.x - 8 * F;
  const y = centre.y - 10 * F - lift;
  g.roundRect(x, y, 16 * F, 10 * F, F).fill(GOLD).stroke({ width: F, color: OUTLINE });
  for (const offset of [4, 10]) {
    const left = Math.max(x, x + (offset - 4) * F);
    const right = Math.min(x + 16 * F, x + (offset + 2) * F);
    g.poly([x + offset * F, y, right, y, x + (offset - 1) * F, y + 10 * F, left, y + 10 * F]).fill(0x14181e);
  }
}

/** Where a projectile flies: the muzzle, the end point and the unit direction. */
interface Flight {
  weapon: Weapon;
  color: number;
  muzzle: Point;
  target: Point;
  dir: Point;
}

/** What an impact needs to be drawn: where, in which colour and how strong. */
interface Impact {
  color: number;
  target: Point;
  look: WeaponLook;
  boost: number;
}

/** Length and width (design px) of the bolt of each weapon that draws one (the Long Shot is a line). */
const BOLT_SIZE: Readonly<Record<Weapon, readonly [number, number]>> = {
  slam: [11, 5],
  precision: [24, 2],
  long: [14, 3],
  tag: [14, 3],
};

/** Overdrive: stronger; the Long Shot's bright impact is the strongest. */
function overdriveBoost(cue: { overdrive?: boolean; weapon: Weapon }): number {
  if (!cue.overdrive) return 1;
  return cue.weapon === "long" ? 1.6 : 1.3;
}

/** The line of a shot: from the muzzle to `end`; with Half Cover it ends on the wall in front of the target, on the side of the attacker. */
function shotPath(from: Point, to: Point, halfCover: boolean): { muzzle: Point; end: Point; dir: Point; wallFoot: Point } {
  const a = { x: from.x, y: from.y - CHEST_LIFT };
  const toward = Math.hypot(from.x - to.x, from.y - to.y) || 1;
  const wallFoot = { x: to.x + ((from.x - to.x) / toward) * 14 * F, y: to.y + ((from.y - to.y) / toward) * 7 * F };
  const end = halfCover ? { x: wallFoot.x, y: wallFoot.y - WALL_HIT_LIFT } : { x: to.x, y: to.y - CHEST_LIFT };
  const length = Math.hypot(end.x - a.x, end.y - a.y) || 1;
  const dir = { x: (end.x - a.x) / length, y: (end.y - a.y) / length };
  const muzzle = { x: a.x + dir.x * 14 * F, y: a.y + dir.y * 14 * F };
  return { muzzle, end, dir, wallFoot };
}

/** The Breach Charge on its arc between two points. */
function drawCharge(g: Graphics, start: Point, end: Point, flight: { progress: number; lift: number }): void {
  const x = start.x + (end.x - start.x) * flight.progress;
  const y = start.y + (end.y - start.y) * flight.progress - flight.lift * F;
  g.circle(x, y, 3.2 * F).fill(SMOKE).stroke({ width: F, color: SHOCK_ORANGE });
}

/** The blast over the tile; in Overdrive a much bigger gold one that reaches the tiles around, with a white core. */
function drawFireball(g: Graphics, centre: Point, fire: { scale: number; alpha: number }, overdrive: boolean): void {
  if (fire.alpha <= 0) return;
  const burst = { x: centre.x, y: centre.y - 18 * F };
  if (overdrive) {
    blob(g, burst, 34 * F * fire.scale, OVERDRIVE_GOLD, fire.alpha * 0.8);
    blob(g, burst, 22 * F * fire.scale, GOLD, fire.alpha);
    g.circle(burst.x, burst.y, 8 * F * fire.scale).fill({ color: 0xffffff, alpha: fire.alpha });
    g.ellipse(centre.x, centre.y, 46 * F * fire.scale * 0.6, 24 * F * fire.scale * 0.6).stroke({ width: 2 * F, color: GOLD, alpha: fire.alpha * 0.8 });
    return;
  }
  blob(g, burst, 16 * F * fire.scale, SHOCK_ORANGE, fire.alpha);
  blob(g, burst, 9 * F * fire.scale, GOLD, fire.alpha);
  g.circle(burst.x, burst.y, 3 * F * fire.scale).fill({ color: 0xffffff, alpha: fire.alpha });
}

/** The four chunks of the broken Cover, `t` ms after the blast. */
function drawCoverChunks(g: Graphics, centre: Point, t: number): void {
  for (let chunk = 0; chunk < 4; chunk++) {
    const state = chunkAt(t, chunk);
    if (state.alpha <= 0) continue;
    rotatedRect(g, { x: centre.x + state.x * F, y: centre.y - 10 * F + state.y * F }, { w: 7 * F, h: 5 * F }, state.turn);
    g.fill({ color: SMOKE, alpha: state.alpha }).stroke({ width: F, color: OUTLINE, alpha: state.alpha });
  }
}

/** Muzzle flash: 0 to 1.5 x over 70 ms, gone by `FLASH_MS`. */
function drawMuzzleFlash(g: Graphics, muzzle: Point, flash: { radius: number; boost: number; color: number }, s: number): void {
  if (s < 0 || s >= FLASH_MS) return;
  const grow = Math.min(1, s / 70);
  const fade = s < 70 ? 1 : 1 - (s - 70) / (FLASH_MS - 70);
  blob(g, muzzle, flash.radius * F * 1.5 * grow * flash.boost, flash.color, fade);
}

/** The line a Long Shot leaves, fading over `LONG_LINE_FADE_MS`; in Overdrive a thick gold tracer, bright towards the target. */
function drawLongTracer(g: Graphics, path: { muzzle: Point; end: Point }, overdrive: boolean | undefined, color: number, s: number): void {
  if (s < 0 || s >= LONG_LINE_FADE_MS) return;
  const { muzzle, end } = path;
  const fade = 1 - s / LONG_LINE_FADE_MS;
  if (!overdrive) {
    line(g, muzzle, end, { width: 2 * F, color, alpha: fade });
    return;
  }
  line(g, muzzle, end, { width: 8 * F, color: GOLD, alpha: fade * 0.25 });
  line(g, muzzle, end, { width: 4 * F, color: OVERDRIVE_GOLD, alpha: fade });
  line(g, { x: muzzle.x + (end.x - muzzle.x) * 0.5, y: muzzle.y + (end.y - muzzle.y) * 0.5 }, end, { width: 2 * F, color: 0xffffff, alpha: fade });
}

/**
 * The layer itself. `play` starts the cues of one frame; `update` draws them at a time and returns the screen shake to
 * apply to the world. Pools grow to the most cues a frame had and are reused.
 */
export class EffectsLayer {
  readonly container = new Container();
  private readonly shapes: Graphics[] = [];
  private readonly texts: Text[] = [];
  private cues: readonly EffectCue[] = [];
  private statuses: { cue: Extract<EffectCue, { kind: "marked" | "slow" }>; mark: StatusMark }[] = [];
  private world: EffectsWorld = { place: () => undefined, tile: () => ({ x: 0, y: 0 }), own: () => true, builtCover: (tile, grow) => coverLook(tile, "half", true, grow) };
  private startMs = 0;
  private reduced = false;

  constructor(parent: Container) {
    this.container.zIndex = 1;
    parent.addChild(this.container);
  }

  private place(heroId: string): Point | undefined {
    return this.world.place(heroId);
  }

  /**
   * Starts a frame's cues at `now`. With reduced motion only the numbers fade and the states appear, nothing flies or
   * moves. The Shield (rubies and bubble) and the slide of a Knockback are drawn by the board on the Heroes themselves.
   */
  play(cues: readonly EffectCue[], now: number, world: EffectsWorld, reduced: boolean): void {
    this.cues = cues;
    this.world = world;
    this.startMs = now;
    this.reduced = reduced;
    for (const { mark } of this.statuses) mark.container.destroy({ children: true });
    this.statuses = [];
    for (const shape of this.shapes) shape.clear();
    cues.forEach((cue, i) => {
      if (cue.kind === "number") this.prepareLabel(i, cue.text, NUMBER_COLOR[cue.style]);
      else if (cue.kind === "crossfire") this.prepareCrossfire(i, `CROSSFIRE +${cue.amount}`, world.own(cue.toId) ? CROSSFIRE_ENEMY : CROSSFIRE_OWN);
      else if (cue.kind === "bonus") this.prepareCrossfire(i, cue.text, BONUS_COLOR[cue.tone]);
      else if (cue.kind === "knockback") this.prepareLabel(i, cue.tag, SHOCK_ORANGE);
      else if (cue.kind === "pull") this.prepareLabel(i, cue.tag, world.own(cue.toId) ? PULL_ENEMY : PULL_OWN);
      else if (cue.kind === "aura") this.prepareLabel(i, "OVERDRIVE", OVERDRIVE_GOLD);
      else if (cue.kind === "marked" || cue.kind === "slow") {
        const mark = cue.kind === "marked" ? markedMark(cue.overdrive ? GOLD : undefined) : slowMark();
        this.container.addChild(mark.container);
        this.statuses.push({ cue, mark });
      } else if (cue.kind !== "shieldGain" && cue.kind !== "shieldHit") this.shapeAt(i);
    });
    for (let i = 0; i < this.texts.length; i++) {
      const kind = cues[i]?.kind;
      if (kind !== "number" && kind !== "crossfire" && kind !== "bonus" && kind !== "knockback" && kind !== "pull" && kind !== "aura") this.texts[i]!.visible = false;
    }
  }

  private shapeAt(i: number): Graphics {
    while (this.shapes.length <= i) {
      const g = new Graphics();
      this.shapes.push(g);
      this.container.addChild(g);
    }
    return this.shapes[i]!;
  }

  private prepareLabel(i: number, text: string, color: number): void {
    while (this.texts.length <= i) {
      const label = new Text({ text: "", style: { fontFamily: "IBM Plex Mono", fontSize: 9 * F, fontWeight: "700", fill: 0xffffff, stroke: { color: OUTLINE, width: 2.5 * F } } });
      label.anchor.set(0.5, 1);
      label.visible = false;
      this.texts.push(label);
      this.container.addChild(label);
    }
    const label = this.texts[i]!;
    label.text = text;
    label.style.fill = color;
    // Pooled labels: undo what a Crossfire label set.
    label.style.fontFamily = "IBM Plex Mono";
    label.style.letterSpacing = 0;
  }

  /** Draws the cues `now`; returns the shake offset in world pixels. */
  update(now: number): Point {
    const ms = (now - this.startMs) * CLIP_SPEED;
    let shake: Point = { x: 0, y: 0 };
    this.cues.forEach((cue, i) => {
      if (cue.kind === "shot" || cue.kind === "shockwave") shake = this.drawShaking(i, cue, ms) ?? shake;
      else this.drawCue(cue, i, ms);
    });
    for (const { cue, mark } of this.statuses) {
      const at = this.place(cue.toId);
      mark.container.visible = at !== undefined && ms >= cue.startMs;
      if (at) mark.container.position.set(at.x, at.y);
      mark.update(this.reduced ? STATUS_AT_REST_MS : ms - cue.startMs);
    }
    return shake;
  }

  /** Draws one cue that does not shake the screen. */
  private drawCue(cue: EffectCue, i: number, ms: number): void {
    if (cue.kind === "number") this.drawNumber(this.texts[i]!, cue, ms);
    else if (cue.kind === "crossfire" || cue.kind === "bonus") this.drawCrossfire(this.texts[i]!, cue, ms);
    else if (cue.kind === "knockback") this.drawKnockback(this.shapeAt(i), this.texts[i]!, cue, ms);
    else if (cue.kind === "pull") this.drawPull(this.shapeAt(i), this.texts[i]!, cue, ms);
    else if (cue.kind === "charge") this.drawChargeStreaks(this.shapeAt(i), cue, ms);
    else if (cue.kind === "aura") this.drawAura(this.shapeAt(i), this.texts[i]!, cue, ms);
    else if (cue.kind === "surge") this.drawSurge(this.shapeAt(i), cue, ms);
    else if (cue.kind === "aegisBeam") this.drawAegisBeam(this.shapeAt(i), cue, ms);
    else if (cue.kind === "breach") this.drawBreach(this.shapeAt(i), cue, ms);
    else if (cue.kind === "coverPlaced") this.drawCoverPlaced(this.shapeAt(i), cue, ms);
    else if (cue.kind === "coverCrumble") this.drawCoverCrumble(this.shapeAt(i), cue, ms);
  }

  /** A shot or a shockwave: drawn, and the screen shake it causes (a Long Shot, an Overdrive Shockwave) in world pixels. */
  private drawShaking(i: number, cue: Extract<EffectCue, { kind: "shot" | "shockwave" }>, ms: number): Point | undefined {
    let offset;
    if (cue.kind === "shot") {
      const drawn = this.reduced ? undefined : this.drawShot(this.shapeAt(i), cue, ms);
      if (drawn && cue.weapon === "long") offset = shakeAt(ms - cue.fireMs);
    } else {
      this.drawShockwave(this.shapeAt(i), cue, ms);
      if (cue.overdrive && !this.reduced) offset = shakeAt(ms - cue.startMs);
    }
    return offset && { x: offset.x * F, y: offset.y * F };
  }

  /** "CROSSFIRE +1": the enemy red on a hit against the own Squad, teal on a hit by it; Rajdhani, with the dark outline of the numbers. */
  private prepareCrossfire(i: number, text: string, color: number): void {
    this.prepareLabel(i, text, color);
    const style = this.texts[i]!.style;
    style.fontFamily = "Rajdhani";
    style.letterSpacing = 0.08 * CROSSFIRE_FONT * F;
  }

  private drawCrossfire(label: Text, cue: Extract<EffectCue, { kind: "crossfire" | "bonus" }>, ms: number): void {
    const at = this.place(cue.toId);
    const { rise, alpha } = crossfireAt(ms - cue.startMs);
    label.visible = at !== undefined && ms >= cue.startMs && alpha > 0;
    if (!at) return;
    // Above the Shield and damage numbers; with reduced motion it stays where it appears and only fades.
    label.position.set(at.x, at.y - HEAD_LIFT - (this.reduced ? 0 : rise * F) - (CROSSFIRE_STEP_PX + cue.stack * CROSSFIRE_STEP_PX) * F);
    label.alpha = alpha;
  }

  private drawNumber(label: Text, cue: Extract<EffectCue, { kind: "number" }>, ms: number): void {
    const at = this.place(cue.toId);
    const { rise, alpha } = numberAt(ms - cue.startMs);
    label.visible = at !== undefined && ms >= cue.startMs && alpha > 0;
    if (!at) return;
    // With reduced motion the number stays where it appears and only fades.
    label.position.set(at.x, at.y - HEAD_LIFT - (this.reduced ? 0 : rise * F) + (cue.drop ?? 0) * F);
    label.alpha = alpha;
  }

  /** The gold glow around the Hero, two rings rising from the ground, rising sparks and the `OVERDRIVE` tag. */
  private drawAura(g: Graphics, label: Text, cue: Extract<EffectCue, { kind: "aura" }>, ms: number): void {
    g.clear();
    const at = this.place(cue.heroId);
    const tag = overdriveTagAt(ms);
    label.visible = at !== undefined && ms < OVERDRIVE_TAG_OUT_MS && tag.alpha > 0;
    if (!at) return;
    label.position.set(at.x, at.y - HEAD_LIFT - 6 * F - (this.reduced ? 0 : tag.rise * F));
    label.alpha = tag.alpha;
    if (ms >= cue.endMs) return;
    const glow = auraGlowAt(ms, cue.endMs);
    if (glow > 0) blob(g, { x: at.x, y: at.y - 16 * F }, 26 * F, OVERDRIVE_GOLD, glow * 0.7);
    if (this.reduced) return;
    for (let ring = 0; ring < 2; ring++) {
      const state = auraRingAt(ms, ring);
      if (state) g.ellipse(at.x, at.y - state.rise * F, 16 * F * state.scale, 8 * F * state.scale).stroke({ width: 2 * F, color: OVERDRIVE_GOLD, alpha: state.alpha });
    }
    AURA_SPARKS.forEach(({ dx }, index) => {
      const state = auraSparkAt(ms, index);
      if (state) g.circle(at.x + dx * F, at.y - 6 * F - state.rise * F, 1.3 * F).fill({ color: GOLD, alpha: state.alpha });
    });
  }

  /** A gold beam with a soft wide line under it, `length` (0 to 1) of the way from one point to the other. */
  private goldBeam(g: Graphics, from: Point, to: Point, length: number, alpha: number): void {
    const end = { x: from.x + (to.x - from.x) * length, y: from.y + (to.y - from.y) * length };
    line(g, from, end, { width: 7 * F, color: OVERDRIVE_GOLD, alpha: alpha * 0.25 });
    line(g, from, end, { width: 2 * F, color: GOLD, alpha });
  }

  /** Adrenal Surge in Overdrive: a gold beam to the ally, and both Heroes glow. The badge is state, drawn on the token. */
  private drawSurge(g: Graphics, cue: Extract<EffectCue, { kind: "surge" }>, ms: number): void {
    g.clear();
    const to = this.place(cue.toId);
    const s = ms - cue.startMs;
    if (!to || s < 0 || s >= SURGE_MS) return;
    const glow = sampleTrack([[0, 0], [192, 1], [480, 1], [SURGE_MS, 0]], s);
    blob(g, { x: to.x, y: to.y - 16 * F }, 22 * F, OVERDRIVE_GOLD, glow * 0.7);
    const from = this.place(cue.casterId);
    if (this.reduced || !from || cue.casterId === cue.toId) return;
    const beam = surgeBeamAt(s);
    this.goldBeam(g, { x: from.x, y: from.y - CHEST_LIFT }, { x: to.x, y: to.y - CHEST_LIFT }, beam.length, beam.alpha);
  }

  /** Aegis Protocol in Overdrive: a gold beam from the Controller to each ally (the domes are the Shield's own). */
  private drawAegisBeam(g: Graphics, cue: Extract<EffectCue, { kind: "aegisBeam" }>, ms: number): void {
    g.clear();
    const from = this.place(cue.casterId);
    const to = this.place(cue.toId);
    const s = ms - cue.startMs;
    if (this.reduced || !from || !to || s < 0 || s >= AEGIS_BEAM_MS) return;
    const beam = aegisBeamAt(s);
    this.goldBeam(g, { x: from.x, y: from.y - CHEST_LIFT }, { x: to.x, y: to.y - CHEST_LIFT }, beam.length, beam.alpha);
  }

  /** The orange rings along the floor, and the dust puffs around the Hero that plays the Shockwave. */
  private drawShockwave(g: Graphics, cue: Extract<EffectCue, { kind: "shockwave" }>, ms: number): void {
    g.clear();
    const at = this.place(cue.casterId);
    if (this.reduced || !at) return;
    const s = ms - cue.startMs;
    for (let ring = 0; ring < 3; ring++) {
      const state = shockRingAt(s, ring);
      if (state) g.ellipse(at.x, at.y, 24 * F * state.scale, 12 * F * state.scale).stroke({ width: 3 * F, color: SHOCK_ORANGE, alpha: state.alpha });
    }
    // Overdrive: one more ring, white.
    const extra = cue.overdrive ? shockRingAt(s, 3) : undefined;
    if (extra) g.ellipse(at.x, at.y, 24 * F * extra.scale, 12 * F * extra.scale).stroke({ width: 3.5 * F, color: 0xffffff, alpha: extra.alpha });
    for (let puff = 0; puff < 6; puff++) {
      const state = dustAt(s, 20 + puff * 25);
      if (!state) continue;
      const angle = (puff / 6) * 2 * Math.PI + 0.4;
      g.ellipse(at.x + Math.cos(angle) * 24 * F, at.y + Math.sin(angle) * 12 * F - state.rise * F, 5 * F * state.scale, 3 * F * state.scale).fill({ color: DUST, alpha: state.alpha });
    }
  }

  /**
   * The speed streaks of a Charge (docs/design/role-visuals/380/charge.png): three teal lines trail behind the Bruiser, away from
   * its target, longest nearest the middle. Not with reduced motion.
   */
  private drawChargeStreaks(g: Graphics, cue: Extract<EffectCue, { kind: "charge" }>, ms: number): void {
    g.clear();
    const s = ms - cue.startMs;
    const hero = this.place(cue.heroId);
    const target = this.place(cue.targetId);
    if (this.reduced || !hero || !target || s < 0 || s >= CHARGE_STREAK_MS) return;
    const dx = hero.x - target.x;
    const dy = hero.y - target.y;
    const length = Math.hypot(dx, dy) || 1;
    const along = { x: dx / length, y: dy / length };
    const across = { x: -along.y, y: along.x };
    const grow = sampleTrack([[0, 0], [150, 1]], s);
    const alpha = sampleTrack([[0, 0.9], [CHARGE_STREAK_MS * 0.5, 0.7], [CHARGE_STREAK_MS, 0]], s);
    [[0, 34], [-9, 26], [9, 20]].forEach(([side, size], index) => {
      const start = { x: hero.x + along.x * (12 + index * 2) * F + across.x * side! * F, y: hero.y - CHEST_LIFT * 0.55 + along.y * (12 + index * 2) * F + across.y * side! * F };
      line(g, start, { x: start.x + along.x * size! * F * grow, y: start.y + along.y * size! * F * grow }, { width: 2 * F, color: 0x2ec4b6, alpha });
    });
  }

  /**
   * One tile of Pull (docs/design/role-visuals/380/pull.png): while the Hero slides, a solid tether from the caster (if the
   * Squad sees it) and two fading echoes behind the figure with the tag PULLED; then a ground ring and the tag PULL 2.
   * Teal when the player's Squad pulls, red when the player's Hero is pulled. The slide itself is the token's.
   */
  private drawPull(g: Graphics, label: Text, cue: Extract<EffectCue, { kind: "pull" }>, ms: number): void {
    g.clear();
    const s = ms - cue.startMs;
    const to = this.world.tile(cue.to);
    const color = this.world.own(cue.toId) ? PULL_ENEMY : PULL_OWN;
    label.visible = s >= 0 && s < PULL_MS - 100;
    label.text = s < SLIDE_MS ? "PULLED" : cue.tag;
    label.style.fill = color;
    const slide = cue.from === undefined || this.reduced ? 1 : slideProgress(s);
    const from = cue.from === undefined ? to : this.world.tile(cue.from);
    const now = { x: from.x + (to.x - from.x) * slide, y: from.y + (to.y - from.y) * slide };
    label.position.set(now.x, now.y - HEAD_LIFT - 10 * F);
    label.alpha = sampleTrack([[0, 0], [100, 1], [PULL_MS - 400, 1], [PULL_MS - 100, 0]], s);
    if (this.reduced || s < 0 || s >= PULL_MS) return;
    if (s < SLIDE_MS + 120) this.drawPullTrail(g, cue, { from, to, now, slide, color, fade: sampleTrack([[0, 1], [SLIDE_MS, 1], [SLIDE_MS + 120, 0]], s) });
    if (s >= SLIDE_MS) drawPullRing(g, to, color, Math.min(1, (s - SLIDE_MS) / (PULL_MS - SLIDE_MS)));
  }

  /** The tether from the caster to the sliding Hero and the two echoes behind it. */
  private drawPullTrail(g: Graphics, cue: Extract<EffectCue, { kind: "pull" }>, slid: { from: Point; to: Point; now: Point; slide: number; color: number; fade: number }): void {
    const { from, to, now, slide, color, fade } = slid;
    const caster = cue.casterId === undefined ? undefined : this.place(cue.casterId);
    if (caster) {
      line(g, { x: caster.x, y: caster.y - CHEST_LIFT }, { x: now.x, y: now.y - CHEST_LIFT }, { width: 3 * F, color, alpha: 0.9 * fade });
      g.circle(now.x, now.y - CHEST_LIFT, 3.5 * F).fill({ color, alpha: fade });
    }
    if (cue.from === undefined) return;
    PULL_ECHO_LAGS.forEach((lag, index) => {
      const behind = Math.max(0, slide - lag);
      const at = { x: from.x + (to.x - from.x) * behind, y: from.y + (to.y - from.y) * behind };
      const alpha = (index === 0 ? 0.32 : 0.16) * fade;
      g.ellipse(at.x, at.y + 2 * F, 14 * F, 7 * F).stroke({ width: 2 * F, color, alpha });
      g.roundRect(at.x - 8 * F, at.y - 30 * F, 16 * F, 26 * F, 5 * F).fill({ color, alpha: alpha * 0.8 });
      g.circle(at.x, at.y - 35 * F, 6 * F).fill({ color, alpha: alpha * 0.8 });
    });
  }

  /** The skid line behind a Hero that slides one tile, and the `Knockback 2` tag over it. The slide itself is the token's. */
  private drawKnockback(g: Graphics, label: Text, cue: Extract<EffectCue, { kind: "knockback" }>, ms: number): void {
    g.clear();
    const at = this.place(cue.toId);
    const s = ms - cue.startMs;
    label.visible = at !== undefined && s >= 0 && s < KNOCKBACK_TAG_MS;
    if (!at) return;
    label.position.set(at.x, at.y - HEAD_LIFT - 10 * F);
    label.alpha = sampleTrack([[0, 0], [100, 1], [500, 1], [KNOCKBACK_TAG_MS, 0]], s);
    if (this.reduced) return;
    const skid = skidAt(s);
    if (skid.alpha <= 0) return;
    const from = this.world.tile(cue.from);
    const to = this.world.tile(cue.to);
    const end = { x: from.x + (to.x - from.x) * skid.length, y: from.y + (to.y - from.y) * skid.length };
    line(g, from, end, { width: (cue.overdrive ? 5 : 3) * F, color: cue.overdrive ? 0xffffff : DUST, alpha: skid.alpha });
  }

  /** The charge arcs to the tile (26 px high), a fireball and smoke, the Cover breaks into four chunks and a scorch stays. */
  private drawBreach(g: Graphics, cue: Extract<EffectCue, { kind: "breach" }>, ms: number): void {
    g.clear();
    const from = this.place(cue.casterId);
    if (this.reduced || !from) return;
    const centre = this.world.tile(cue.tile);
    const s = ms - cue.fireMs;
    if (s >= 0 && s < cue.flightMs) drawCharge(g, { x: from.x, y: from.y - CHEST_LIFT }, { x: centre.x, y: centre.y - 4 * F }, chargeAt(s));
    const t = s - cue.flightMs;
    if (t < 0) return;
    const scorch = scorchAt(t);
    if (scorch > 0) {
      diamond(g, centre, 23 * F, 12 * F);
      g.fill({ color: 0x1a1f26, alpha: scorch * 0.85 });
    }
    drawFireball(g, centre, cue.overdrive ? bigFireballAt(t) : fireballAt(t), cue.overdrive);
    for (const [dx, dy, radius] of [[-4, -8, 7], [10, -4, 6]] as const) {
      const smoke = smokeAt(t);
      if (smoke.alpha > 0) g.circle(centre.x + dx * F, centre.y + dy * F - smoke.rise * F, radius * F * smoke.scale).fill({ color: SMOKE, alpha: smoke.alpha });
    }
    if (cue.cover) drawCoverChunks(g, centre, t);
  }

  /** The oldest Placed Cover crumbles into four chunks, with no fireball and no scorch (docs/design/role-visuals/380/placed-cover.png). */
  private drawCoverCrumble(g: Graphics, cue: Extract<EffectCue, { kind: "coverCrumble" }>, ms: number): void {
    g.clear();
    const t = ms - cue.startMs;
    if (this.reduced || t < 0) return;
    drawCoverChunks(g, this.world.tile(cue.tile), t);
  }

  /**
   * The drop of built Cover: a yellow dashed target and a growing shadow, a striped crate falls onto it, lands with a yellow
   * ring and grey dust (the tile flashes yellow) and unfolds into the bars. With reduced motion the bars fade in.
   */
  private drawCoverPlaced(g: Graphics, cue: Extract<EffectCue, { kind: "coverPlaced" }>, ms: number): void {
    g.clear();
    g.alpha = 1;
    const s = ms - cue.startMs;
    if (s < 0 || s >= COVER_WALL_UP_MS) return;
    if (this.reduced) {
      g.alpha = Math.min(1, s / 300);
      drawCoverLook(g, this.world.builtCover(cue.tile, 1), 1);
      return;
    }
    const centre = this.world.tile(cue.tile);
    const drop = coverDropAt(s);
    drawDropTarget(g, centre);
    if (drop.flash > 0) {
      diamond(g, centre, 23 * F, 12 * F);
      g.fill({ color: GOLD, alpha: drop.flash * 0.45 });
    }
    if (drop.crateHeight > 0) g.ellipse(centre.x, centre.y, 14 * F * drop.shadow, 7 * F * drop.shadow).fill({ color: 0x000000, alpha: 0.45 * drop.shadow });
    if (drop.landing > 0 && drop.landing < 1) drawDropLanding(g, centre, drop.landing);
    if (drop.crate) drawCrate(g, centre, drop.crateHeight * 60 * F);
    else drawCoverLook(g, this.world.builtCover(cue.tile, drop.unfold), 1);
  }

  private drawShot(g: Graphics, cue: Extract<EffectCue, { kind: "shot" }>, ms: number): boolean {
    g.clear();
    const from = this.place(cue.fromId);
    const to = this.place(cue.toId);
    if (!from || !to) return false;
    const look = LOOK[cue.weapon];
    const color = cue.overdrive ? GOLD : look.color;
    const path = shotPath(from, to, cue.halfCover === true);
    const s = ms - cue.fireMs;
    if (cue.weapon === "long") this.drawLongBefore(g, path.muzzle, path.end, s, cue.overdrive ? GOLD : 0xffffff);
    drawMuzzleFlash(g, path.muzzle, { radius: look.flashRadius, boost: overdriveBoost(cue), color: cue.overdrive ? GOLD : look.flash }, s);
    if (s >= 0 && s < cue.flightMs && cue.weapon !== "long") {
      this.drawProjectile(g, { weapon: cue.weapon, color, muzzle: path.muzzle, target: path.end, dir: path.dir }, flightProgress(s, cue.flightMs));
    }
    if (cue.weapon === "long") drawLongTracer(g, path, cue.overdrive, color, s);
    const arrived = s - cue.flightMs;
    if (arrived < 0) return true;
    const impact: Impact = { color, target: to, look, boost: overdriveBoost(cue) };
    if (cue.miss) {
      // A Ghost Shot at a tile with nobody on it: a grey puff.
      const puff = puffAt(arrived);
      if (puff) blob(g, { x: to.x, y: to.y - 8 * F }, 12 * F * puff.scale, 0x8a99a8, puff.alpha);
    } else if (cue.halfCover) this.drawWallHit(g, { ...impact, target: path.wallFoot }, arrived);
    else this.drawImpact(g, impact, arrived, CHEST_LIFT);
    return true;
  }

  /** A shot that hits Half Cover: the wall flashes, chips fly off it and a small burst shows where it landed. */
  private drawWallHit(g: Graphics, impact: Impact, ms: number): void {
    const foot = impact.target;
    if (ms < WALL_HIT_MS) {
      const u = ms / WALL_HIT_MS;
      const flash = sampleTrack([[0, 0], [70, 0.7], [WALL_HIT_MS * 0.5, 0.2], [WALL_HIT_MS, 0]], ms);
      g.roundRect(foot.x - 17 * F, foot.y + 4 * F - 12 * F, 34 * F, 12 * F, 2 * F).fill({ color: 0xaebccb, alpha: flash });
      CHIP_VECTORS.forEach(([dx, dy]) => g.rect(foot.x + dx * F * u - F, foot.y - WALL_HIT_LIFT + dy * F * u - F, 2 * F, 2 * F).fill({ color: WALL_TOP, alpha: 1 - u }));
    }
    this.drawImpact(g, { ...impact, boost: impact.boost * 0.6 }, ms, WALL_HIT_LIFT);
  }

  /** Long Shot: the red dotted laser for 480 ms before the shot, and a glint of the scope. */
  private drawLongBefore(g: Graphics, muzzle: Point, target: Point, s: number, glintColor: number): void {
    if (s >= -LASER_MS && s < 0) {
      const length = Math.hypot(target.x - muzzle.x, target.y - muzzle.y);
      const step = 6 * F;
      const dx = (target.x - muzzle.x) / length;
      const dy = (target.y - muzzle.y) / length;
      for (let d = 0; d < length; d += step) {
        const end = Math.min(length, d + step / 2);
        g.moveTo(muzzle.x + dx * d, muzzle.y + dy * d).lineTo(muzzle.x + dx * end, muzzle.y + dy * end);
      }
      g.stroke({ width: F, color: 0xe5484d, alpha: 0.85 });
    }
    const u = (s + GLINT_BEFORE_FIRE_MS + 150) / 290;
    if (u >= 0 && u < 1) blob(g, muzzle, 4 * F * (0.5 + 1.7 * u), glintColor, u < 0.5 ? u * 2 : (1 - u) * 2);
  }

  private drawProjectile(g: Graphics, flight: Flight, progress: number): void {
    const { weapon, color, muzzle, target, dir } = flight;
    const p = { x: muzzle.x + (target.x - muzzle.x) * progress, y: muzzle.y + (target.y - muzzle.y) * progress };
    const [length, width] = BOLT_SIZE[weapon];
    const h = { x: (dir.x * length * F) / 2, y: (dir.y * length * F) / 2 };
    line(g, { x: p.x - h.x, y: p.y - h.y }, { x: p.x + h.x, y: p.y + h.y }, { width: width * F, color, alpha: 1 });
  }

  /** The burst, the sparks and the ground ring where the projectile lands. */
  private drawImpact(g: Graphics, impact: Impact, ms: number, lift: number): void {
    const { color, target, look, boost } = impact;
    const chest = { x: target.x, y: target.y - lift };
    const scale = look.impact * boost;
    if (ms < IMPACT_BURST_MS) {
      const u = ms / IMPACT_BURST_MS;
      blob(g, chest, 9 * F * scale * (0.2 + 1.7 * u), color, 1 - u);
      for (let k = 0; k < look.sparks; k++) {
        const reach = (9 + (k % 2) * 9) * F * u * scale;
        const angle = SPARK_ANGLES[k]!;
        g.circle(chest.x + Math.cos(angle) * reach, chest.y + Math.sin(angle) * reach * 0.8, 1.3 * F).fill({ color, alpha: 1 - u });
      }
    }
    for (let ring = 0; ring < look.rings; ring++) {
      const u = (ms - ring * 120) / IMPACT_RING_MS;
      if (u < 0 || u >= 1) continue;
      const grow = 0.5 + 1.7 * u;
      g.ellipse(target.x, target.y, 12 * F * scale * grow, 6 * F * scale * grow).stroke({ width: 1.5 * F, color, alpha: 0.8 * (1 - u) });
    }
  }
}
