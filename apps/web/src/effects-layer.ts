import type { GridPosition } from "game-core";
import { Container, Graphics, Text } from "pixi.js";
import { CLIP_SPEED } from "./clip-player";
import { rubyPieces, shieldBubble } from "./hero-figure";
import { HERO_STYLE } from "./hero-style";
import { TILE_HEIGHT } from "./terrain";
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
  coverFlashAt,
  coverPipAt,
  coverWallAt,
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
  pulse: { color: 0xbfe0ff, flash: 0x5aa0ff, flashRadius: 6, impact: 1, sparks: 0, rings: 2 },
  tag: { color: 0xff8fb0, flash: 0xff8fb0, flashRadius: 3.5, impact: 0.5, sparks: 2, rings: 0 },
};
const GOLD = 0xffd24a;
const NUMBER_COLOR: Readonly<Record<NumberStyle, number>> = { damage: 0xff6b6b, bonus: 0xffb000, shield: 0x4da3ff, failed: 0x8a99a8 };
const MARKED_RED = 0xff6b6b;
const SLOW_VIOLET = 0xc18bff;
const OUTLINE = 0x0b1016;
const SPARK_ANGLES = [0.6, 2.2, 3.7, 5.3];

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

function line(g: Graphics, from: Point, to: Point, width: number, color: number, alpha: number): void {
  g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width, color, alpha, cap: "round" });
}

/** A Marked or Slow state drawn on a Hero: `update(ms)` is the time since it locked on; a state from the start passes a large `ms`. */
export interface StatusMark {
  container: Container;
  update(ms: number): void;
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
  const chevrons = new Graphics();
  for (const y of [-3, 2]) {
    chevrons.poly([-4 * F, y * F + 3 * F, 0, y * F - 1 * F, 4 * F, y * F + 3 * F]).fill(OVERDRIVE_GOLD).stroke({ width: F, color: OUTLINE });
  }
  const label = new Text({ text: "+1", style: { fontFamily: "IBM Plex Mono", fontSize: 6.5 * F, fontWeight: "700", fill: GOLD, stroke: { color: OUTLINE, width: 2 * F } } });
  label.anchor.set(0, 0.5);
  label.position.set(6 * F, 0);
  badge.addChild(chevrons, label);
  badge.position.set(24 * F, -4 * F);
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
}

const WALL_FILL = 0x5a6877;
const WALL_TOP = 0x77899b;
const SMOKE = 0x3a4653;
const DUST = 0x8a99a8;
const SHOCK_ORANGE = 0xff8a3d;
const CHIP_VECTORS = [[-10, -12], [12, -14], [-4, -18], [16, -6]] as const;
/** How long the chips and the flash of a hit on Half Cover last. */
const WALL_HIT_MS = 340;

function rotatedRect(g: Graphics, cx: number, cy: number, w: number, h: number, degrees: number): void {
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const corners = [[-w, -h], [w, -h], [w, h], [-w, h]] as const;
  g.poly(corners.flatMap(([x, y]) => [cx + (x * cos - y * sin) / 2, cy + (x * sin + y * cos) / 2]));
}

function diamond(g: Graphics, at: Point, halfWidth: number, halfHeight: number): void {
  g.poly([at.x, at.y - halfHeight, at.x + halfWidth, at.y, at.x, at.y + halfHeight, at.x - halfWidth, at.y]);
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
  private world: EffectsWorld = { place: () => undefined, tile: () => ({ x: 0, y: 0 }), own: () => true };
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
      else if (cue.kind === "knockback") this.prepareLabel(i, cue.tag, SHOCK_ORANGE);
      else if (cue.kind === "aura") this.prepareLabel(i, "OVERDRIVE", OVERDRIVE_GOLD);
      else if (cue.kind === "marked" || cue.kind === "slow") {
        const mark = cue.kind === "marked" ? markedMark(cue.overdrive ? GOLD : undefined) : slowMark();
        this.container.addChild(mark.container);
        this.statuses.push({ cue, mark });
      } else if (cue.kind !== "shieldGain" && cue.kind !== "shieldHit") this.shapeAt(i);
    });
    for (let i = 0; i < this.texts.length; i++) {
      const kind = cues[i]?.kind;
      if (kind !== "number" && kind !== "knockback" && kind !== "aura") this.texts[i]!.visible = false;
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
  }

  /** Draws the cues `now`; returns the shake offset in world pixels. */
  update(now: number): Point {
    const ms = (now - this.startMs) * CLIP_SPEED;
    let shake: Point = { x: 0, y: 0 };
    this.cues.forEach((cue, i) => {
      if (cue.kind === "number") this.drawNumber(this.texts[i]!, cue, ms);
      else if (cue.kind === "knockback") this.drawKnockback(this.shapeAt(i), this.texts[i]!, cue, ms);
      else if (cue.kind === "shot") {
        const s = this.reduced ? undefined : this.drawShot(this.shapeAt(i), cue, ms);
        if (s && cue.weapon === "long") {
          const offset = shakeAt(ms - cue.fireMs);
          shake = { x: offset.x * F, y: offset.y * F };
        }
      } else if (cue.kind === "shockwave") {
        this.drawShockwave(this.shapeAt(i), cue, ms);
        if (cue.overdrive && !this.reduced) {
          const offset = shakeAt(ms - cue.startMs);
          shake = { x: offset.x * F, y: offset.y * F };
        }
      } else if (cue.kind === "aura") this.drawAura(this.shapeAt(i), this.texts[i]!, cue, ms);
      else if (cue.kind === "surge") this.drawSurge(this.shapeAt(i), cue, ms);
      else if (cue.kind === "aegisBeam") this.drawAegisBeam(this.shapeAt(i), cue, ms);
      else if (cue.kind === "breach") this.drawBreach(this.shapeAt(i), cue, ms);
      else if (cue.kind === "coverPlaced") this.drawCoverPlaced(this.shapeAt(i), cue, ms);
    });
    for (const { cue, mark } of this.statuses) {
      const at = this.place(cue.toId);
      mark.container.visible = at !== undefined && ms >= cue.startMs;
      if (at) mark.container.position.set(at.x, at.y);
      mark.update(this.reduced ? STATUS_AT_REST_MS : ms - cue.startMs);
    }
    return shake;
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
    line(g, from, end, 7 * F, OVERDRIVE_GOLD, alpha * 0.25);
    line(g, from, end, 2 * F, GOLD, alpha);
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
    line(g, from, { x: from.x + (to.x - from.x) * skid.length, y: from.y + (to.y - from.y) * skid.length }, (cue.overdrive ? 5 : 3) * F, cue.overdrive ? 0xffffff : DUST, skid.alpha);
  }

  /** The charge arcs to the tile (26 px high), a fireball and smoke, the Cover breaks into four chunks and a scorch stays. */
  private drawBreach(g: Graphics, cue: Extract<EffectCue, { kind: "breach" }>, ms: number): void {
    g.clear();
    const from = this.place(cue.casterId);
    if (this.reduced || !from) return;
    const centre = this.world.tile(cue.tile);
    const s = ms - cue.fireMs;
    if (s >= 0 && s < cue.flightMs) {
      const { progress, lift } = chargeAt(s);
      const start = { x: from.x, y: from.y - CHEST_LIFT };
      const end = { x: centre.x, y: centre.y - 4 * F };
      const x = start.x + (end.x - start.x) * progress;
      const y = start.y + (end.y - start.y) * progress - lift * F;
      g.circle(x, y, 3.2 * F).fill(SMOKE).stroke({ width: F, color: SHOCK_ORANGE });
    }
    const t = s - cue.flightMs;
    if (t < 0) return;
    const scorch = scorchAt(t);
    if (scorch > 0) {
      diamond(g, centre, 23 * F, 12 * F);
      g.fill({ color: 0x1a1f26, alpha: scorch * 0.85 });
    }
    const burst = { x: centre.x, y: centre.y - 18 * F };
    const fire = cue.overdrive ? bigFireballAt(t) : fireballAt(t);
    if (fire.alpha > 0 && cue.overdrive) {
      // Overdrive: a much bigger gold blast that reaches the tiles around, with a white core.
      blob(g, burst, 34 * F * fire.scale, OVERDRIVE_GOLD, fire.alpha * 0.8);
      blob(g, burst, 22 * F * fire.scale, GOLD, fire.alpha);
      g.circle(burst.x, burst.y, 8 * F * fire.scale).fill({ color: 0xffffff, alpha: fire.alpha });
      g.ellipse(centre.x, centre.y, 46 * F * fire.scale * 0.6, 24 * F * fire.scale * 0.6).stroke({ width: 2 * F, color: GOLD, alpha: fire.alpha * 0.8 });
    } else if (fire.alpha > 0) {
      blob(g, burst, 16 * F * fire.scale, SHOCK_ORANGE, fire.alpha);
      blob(g, burst, 9 * F * fire.scale, GOLD, fire.alpha);
      g.circle(burst.x, burst.y, 3 * F * fire.scale).fill({ color: 0xffffff, alpha: fire.alpha });
    }
    for (const [dx, dy, radius] of [[-4, -8, 7], [10, -4, 6]] as const) {
      const smoke = smokeAt(t);
      if (smoke.alpha > 0) g.circle(centre.x + dx * F, centre.y + dy * F - smoke.rise * F, radius * F * smoke.scale).fill({ color: SMOKE, alpha: smoke.alpha });
    }
    for (let chunk = 0; chunk < (cue.cover ? 4 : 0); chunk++) {
      const state = chunkAt(t, chunk);
      if (state.alpha <= 0) continue;
      rotatedRect(g, centre.x + state.x * F, centre.y - 10 * F + state.y * F, 7 * F, 5 * F, state.turn);
      g.fill({ color: SMOKE, alpha: state.alpha }).stroke({ width: F, color: OUTLINE, alpha: state.alpha });
    }
  }

  /** A team-coloured flash on the tile, then a wall rises out of the ground (0 to 1.15 to 1) with dust; two pips count its Resolutions. */
  private drawCoverPlaced(g: Graphics, cue: Extract<EffectCue, { kind: "coverPlaced" }>, ms: number): void {
    g.clear();
    if (this.reduced) return;
    const s = ms - cue.startMs;
    if (s < 0) return;
    const centre = this.world.tile(cue.tile);
    const color = this.world.own(cue.casterId) ? HERO_STYLE.ring.own : HERO_STYLE.ring.enemy;
    const flash = coverFlashAt(s);
    if (flash > 0) {
      diamond(g, centre, 23 * F, 12 * F);
      g.fill({ color, alpha: flash * 0.6 });
    }
    // The terrain's own wall stands from the moment it is up; until then this one rises, and it is the one shown a while longer.
    const wall = coverWallAt(s);
    if (wall.alpha > 0 && s < COVER_WALL_UP_MS + 150) {
      const height = 12 * F * wall.scaleY;
      g.roundRect(centre.x - 17 * F, centre.y + 4 * F - height, 34 * F, height, 2 * F).fill(WALL_FILL).stroke({ width: 1.5 * F, color: OUTLINE });
      g.rect(centre.x - 15 * F, centre.y + 4 * F - height + 1.5 * F, 30 * F, Math.min(3 * F, height)).fill(WALL_TOP);
    }
    for (let puff = 0; puff < 3; puff++) {
      const state = dustAt(s - 70, puff * 50);
      if (state) g.ellipse(centre.x + (puff - 1) * 16 * F, centre.y + 2 * F - state.rise * F, 5 * F * state.scale, 3 * F * state.scale).fill({ color: DUST, alpha: state.alpha });
    }
    for (let pip = 0; pip < 2; pip++) {
      const alpha = coverPipAt(s, pip);
      if (alpha > 0) g.circle(centre.x + (pip === 0 ? -5 : 5) * F, centre.y - 22 * F, 2.2 * F).fill({ color, alpha }).stroke({ width: F, color: OUTLINE, alpha });
    }
  }

  private drawShot(g: Graphics, cue: Extract<EffectCue, { kind: "shot" }>, ms: number): boolean {
    g.clear();
    const from = this.place(cue.fromId);
    const to = this.place(cue.toId);
    if (!from || !to) return false;
    const look = LOOK[cue.weapon];
    const color = cue.overdrive ? GOLD : look.color;
    const flashColor = cue.overdrive ? GOLD : look.flash;
    // Overdrive: gold and stronger; the Long Shot's bright impact is the strongest.
    const boost = cue.overdrive ? (cue.weapon === "long" ? 1.6 : 1.3) : 1;
    const a = { x: from.x, y: from.y - CHEST_LIFT };
    // Half Cover: the shot ends on the wall in front of the target, on the side of the attacker.
    const toward = Math.hypot(from.x - to.x, from.y - to.y) || 1;
    const wallFoot = { x: to.x + ((from.x - to.x) / toward) * 14 * F, y: to.y + ((from.y - to.y) / toward) * 7 * F };
    const lift = cue.halfCover ? WALL_HIT_LIFT : CHEST_LIFT;
    const b = cue.halfCover ? { x: wallFoot.x, y: wallFoot.y - lift } : { x: to.x, y: to.y - CHEST_LIFT };
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const muzzle = { x: a.x + dir.x * 14 * F, y: a.y + dir.y * 14 * F };
    const s = ms - cue.fireMs;
    if (cue.weapon === "long") this.drawLongBefore(g, muzzle, b, s, cue.overdrive ? GOLD : 0xffffff);
    // Muzzle flash: 0 to 1.5 x over 70 ms, gone by 270 ms.
    if (s >= 0 && s < FLASH_MS) {
      const grow = Math.min(1, s / 70);
      const fade = s < 70 ? 1 : 1 - (s - 70) / (FLASH_MS - 70);
      blob(g, muzzle, look.flashRadius * F * 1.5 * grow * boost, flashColor, fade);
    }
    const flown = flightProgress(s, cue.flightMs);
    if (s >= 0 && s < cue.flightMs && cue.weapon !== "long") this.drawProjectile(g, cue.weapon, color, muzzle, b, flown, dir);
    if (s >= 0 && cue.weapon === "long" && s < LONG_LINE_FADE_MS) {
      const fade = 1 - s / LONG_LINE_FADE_MS;
      // Overdrive: a thick gold tracer, bright towards the target.
      if (cue.overdrive) {
        line(g, muzzle, b, 8 * F, GOLD, fade * 0.25);
        line(g, muzzle, b, 4 * F, OVERDRIVE_GOLD, fade);
        line(g, { x: muzzle.x + (b.x - muzzle.x) * 0.5, y: muzzle.y + (b.y - muzzle.y) * 0.5 }, b, 2 * F, 0xffffff, fade);
      } else line(g, muzzle, b, 2 * F, color, fade);
    }
    const arrived = s - cue.flightMs;
    if (arrived >= 0 && cue.miss) {
      // A Ghost Shot at a tile with nobody on it: a grey puff.
      const puff = puffAt(arrived);
      if (puff) blob(g, { x: to.x, y: to.y - 8 * F }, 12 * F * puff.scale, 0x8a99a8, puff.alpha);
    } else if (arrived >= 0 && cue.halfCover) this.drawWallHit(g, color, wallFoot, look, boost, arrived);
    else if (arrived >= 0) this.drawImpact(g, color, to, look, boost, arrived, CHEST_LIFT);
    return true;
  }

  /** A shot that hits Half Cover: the wall flashes, chips fly off it and a small burst shows where it landed. */
  private drawWallHit(g: Graphics, color: number, foot: Point, look: WeaponLook, boost: number, ms: number): void {
    if (ms < WALL_HIT_MS) {
      const u = ms / WALL_HIT_MS;
      const flash = sampleTrack([[0, 0], [70, 0.7], [WALL_HIT_MS * 0.5, 0.2], [WALL_HIT_MS, 0]], ms);
      g.roundRect(foot.x - 17 * F, foot.y + 4 * F - 12 * F, 34 * F, 12 * F, 2 * F).fill({ color: 0xaebccb, alpha: flash });
      CHIP_VECTORS.forEach(([dx, dy]) => g.rect(foot.x + dx * F * u - F, foot.y - WALL_HIT_LIFT + dy * F * u - F, 2 * F, 2 * F).fill({ color: WALL_TOP, alpha: 1 - u }));
    }
    this.drawImpact(g, color, foot, look, boost * 0.6, ms, WALL_HIT_LIFT);
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

  private drawProjectile(g: Graphics, weapon: Weapon, color: number, muzzle: Point, target: Point, progress: number, dir: Point): void {
    const p = { x: muzzle.x + (target.x - muzzle.x) * progress, y: muzzle.y + (target.y - muzzle.y) * progress };
    const half = (length: number) => ({ x: (dir.x * length * F) / 2, y: (dir.y * length * F) / 2 });
    if (weapon === "pulse") {
      blob(g, p, 7 * F * (0.8 + 0.6 * progress), color, 0.9);
      return;
    }
    const [length, width] = weapon === "slam" ? [11, 5] : weapon === "precision" ? [24, 2] : [14, 3];
    const h = half(length);
    line(g, { x: p.x - h.x, y: p.y - h.y }, { x: p.x + h.x, y: p.y + h.y }, width * F, color, 1);
  }

  /** The burst, the sparks and the ground ring where the projectile lands. */
  private drawImpact(g: Graphics, color: number, target: Point, look: WeaponLook, boost: number, ms: number, lift: number): void {
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
