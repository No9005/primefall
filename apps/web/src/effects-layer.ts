import { Container, Graphics, Text } from "pixi.js";
import { CLIP_SPEED } from "./clip-player";
import { HERO_STYLE } from "./hero-style";
import { TILE_HEIGHT } from "./terrain";
import {
  type EffectCue,
  FLASH_MS,
  flightProgress,
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
export function markedMark(): StatusMark {
  const container = new Container();
  const reticle = new Graphics();
  reticle.circle(0, 0, 11 * F).stroke({ width: 2 * F, color: MARKED_RED });
  reticle.moveTo(0, -11 * F).lineTo(0, 11 * F).moveTo(-11 * F, 0).lineTo(11 * F, 0).stroke({ width: 2 * F, color: MARKED_RED });
  reticle.position.set(0, -CHEST_LIFT);
  const tag = new Text({ text: "MARKED", style: { fontFamily: "IBM Plex Mono", fontSize: 6 * F, fontWeight: "700", fill: MARKED_RED, stroke: { color: OUTLINE, width: 2 * F } } });
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

/** The ms after which a persistent Marked or Slow is past its intro. */
export const STATUS_AT_REST_MS = 1_000_000;

/** Where a Hero stands in world pixels (its foot), or nothing when the Hero is not on the board (not perceived). */
export type Placer = (heroId: string) => Point | undefined;

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
  private place: Placer = () => undefined;
  private startMs = 0;
  private reduced = false;

  constructor(parent: Container) {
    this.container.zIndex = 1;
    parent.addChild(this.container);
  }

  /** Starts a frame's cues at `now`. With reduced motion only the numbers fade and the states appear, nothing flies or moves. */
  play(cues: readonly EffectCue[], now: number, place: Placer, reduced: boolean): void {
    this.cues = cues;
    this.place = place;
    this.startMs = now;
    this.reduced = reduced;
    for (const { mark } of this.statuses) mark.container.destroy({ children: true });
    this.statuses = [];
    cues.forEach((cue, i) => {
      if (cue.kind === "shot") this.shapeAt(i);
      else if (cue.kind === "number") this.prepareNumber(i, cue.text, cue.style);
      else {
        const mark = cue.kind === "marked" ? markedMark() : slowMark();
        this.container.addChild(mark.container);
        this.statuses.push({ cue, mark });
      }
    });
    for (let i = cues.length; i < this.shapes.length; i++) this.shapes[i]!.clear();
    for (let i = 0; i < this.texts.length; i++) if (cues[i]?.kind !== "number") this.texts[i]!.visible = false;
  }

  private shapeAt(i: number): Graphics {
    while (this.shapes.length <= i) {
      const g = new Graphics();
      this.shapes.push(g);
      this.container.addChild(g);
    }
    return this.shapes[i]!;
  }

  private prepareNumber(i: number, text: string, style: NumberStyle): void {
    while (this.texts.length <= i) {
      const label = new Text({ text: "", style: { fontFamily: "IBM Plex Mono", fontSize: 9 * F, fontWeight: "700", fill: 0xffffff, stroke: { color: OUTLINE, width: 2.5 * F } } });
      label.anchor.set(0.5, 1);
      label.visible = false;
      this.texts.push(label);
      this.container.addChild(label);
    }
    const label = this.texts[i]!;
    label.text = text;
    label.style.fill = NUMBER_COLOR[style];
  }

  /** Draws the cues `now`; returns the shake offset in world pixels. */
  update(now: number): Point {
    const ms = (now - this.startMs) * CLIP_SPEED;
    let shake: Point = { x: 0, y: 0 };    this.cues.forEach((cue, i) => {
      if (cue.kind === "shot") {
        const s = this.reduced ? undefined : this.drawShot(this.shapeAt(i), cue, ms);
        if (s && cue.weapon === "long") {
          const offset = shakeAt(ms - cue.fireMs);
          shake = { x: offset.x * F, y: offset.y * F };
        }
      } else if (cue.kind === "number") this.drawNumber(this.texts[i]!, cue, ms);
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
    label.position.set(at.x, at.y - HEAD_LIFT - (this.reduced ? 0 : rise * F));
    label.alpha = alpha;
  }

  private drawShot(g: Graphics, cue: Extract<EffectCue, { kind: "shot" }>, ms: number): boolean {
    g.clear();
    const from = this.place(cue.fromId);
    const to = this.place(cue.toId);
    if (!from || !to) return false;
    const look = LOOK[cue.weapon];
    const color = cue.overdrive ? GOLD : look.color;
    const flashColor = cue.overdrive ? GOLD : look.flash;
    const boost = cue.overdrive ? 1.3 : 1;
    const a = { x: from.x, y: from.y - CHEST_LIFT };
    const b = { x: to.x, y: to.y - CHEST_LIFT };
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const muzzle = { x: a.x + dir.x * 14 * F, y: a.y + dir.y * 14 * F };
    const s = ms - cue.fireMs;
    if (cue.weapon === "long") this.drawLongBefore(g, muzzle, b, s);
    // Muzzle flash: 0 to 1.5 x over 70 ms, gone by 270 ms.
    if (s >= 0 && s < FLASH_MS) {
      const grow = Math.min(1, s / 70);
      const fade = s < 70 ? 1 : 1 - (s - 70) / (FLASH_MS - 70);
      blob(g, muzzle, look.flashRadius * F * 1.5 * grow * boost, flashColor, fade);
    }
    const flown = flightProgress(s, cue.flightMs);
    if (s >= 0 && s < cue.flightMs && cue.weapon !== "long") this.drawProjectile(g, cue.weapon, color, muzzle, b, flown, dir);
    if (s >= 0 && cue.weapon === "long" && s < LONG_LINE_FADE_MS) {
      line(g, muzzle, b, 2 * F, color, 1 - s / LONG_LINE_FADE_MS);
    }
    const arrived = s - cue.flightMs;
    if (arrived >= 0) this.drawImpact(g, color, to, look, boost, arrived);
    return true;
  }

  /** Long Shot: the red dotted laser for 480 ms before the shot, and a glint of the scope. */
  private drawLongBefore(g: Graphics, muzzle: Point, target: Point, s: number): void {
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
    if (u >= 0 && u < 1) blob(g, muzzle, 4 * F * (0.5 + 1.7 * u), 0xffffff, u < 0.5 ? u * 2 : (1 - u) * 2);
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
  private drawImpact(g: Graphics, color: number, target: Point, look: WeaponLook, boost: number, ms: number): void {
    const chest = { x: target.x, y: target.y - CHEST_LIFT };
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
