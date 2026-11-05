import type { HeroClass } from "game-core";
import type { Container } from "pixi.js";
import { type Clip, type ClipName, clipOf, createPose, PARTS, type PartName, type Pose, restPoseInto, sampleClipInto } from "./hero-clips";
import { STEP_MS } from "./playback";

/** Multiplies the time of every clip (default 1); the one constant that tunes the whole feel. */
export const CLIP_SPEED = 1.8;
/** How long the pose blends from the clip that was playing to the new one. */
export const CROSSFADE_MS = 100;

/**
 * Plays one clip at a time for one Hero, with a short cross-fade when the clip changes. Reads and writes only its own
 * buffers, so a frame allocates nothing. A walk runs at the pace of the playback steps: half a cycle per step.
 */
export class ClipPlayer {
  private clip: Clip;
  private startMs: number;
  private previous: Clip | undefined;
  private previousStartMs = 0;
  private fadeStartMs = 0;
  private readonly current = createPose();
  private readonly before = createPose();

  constructor(
    private readonly heroClass: HeroClass,
    now: number,
    private readonly speed = CLIP_SPEED,
  ) {
    this.clip = clipOf(heroClass, "idle");
    this.startMs = now;
  }

  get playing(): ClipName {
    return this.clip.name;
  }

  private pending: { name: ClipName; at: number } | undefined;
  private requestedFrame: object | undefined;

  /**
   * Switches to a clip, `delayMs` from now (a target reacts at the impact beat). Asking for the clip that already plays
   * changes nothing (a Walk goes on from step to step), except that a one-shot clip starts again in a new `frame`
   * (the same card twice in a row plays twice).
   */
  play(name: ClipName, now: number, delayMs = 0, frame?: object): void {
    const asked = this.pending?.name ?? this.clip.name;
    const sameFrame = frame === undefined || frame === this.requestedFrame;
    this.requestedFrame = frame;
    if (name === asked && (sameFrame || clipOf(this.heroClass, name).loop)) return;
    // Delays are in clip time, so a faster clip speed shortens them too.
    this.pending = delayMs > 0 ? { name, at: now + delayMs / this.speed } : undefined;
    if (delayMs <= 0) this.start(name, now);
  }

  private start(name: ClipName, at: number): void {
    this.previous = this.clip;
    this.previousStartMs = this.startMs;
    this.fadeStartMs = at;
    this.clip = clipOf(this.heroClass, name);
    this.startMs = at;
  }

  private timeOf(clip: Clip, startMs: number, now: number): number {
    // A Walk keeps the pace of the playback steps whatever the clip speed; every other clip runs at the clip speed.
    const pace = clip.perStep ? clip.durationMs / 2 / STEP_MS : this.speed;
    return (now - startMs) * pace;
  }

  /** The pose at `now`; the returned object is reused by the next call. */
  sample(now: number): Pose {
    if (this.pending !== undefined && now >= this.pending.at) {
      this.start(this.pending.name, this.pending.at);
      this.pending = undefined;
    }
    sampleClipInto(this.clip, this.timeOf(this.clip, this.startMs, now), this.current);
    if (this.previous === undefined) return this.current;
    const weight = (now - this.fadeStartMs) / CROSSFADE_MS;
    if (weight >= 1) {
      this.previous = undefined;
      return this.current;
    }
    sampleClipInto(this.previous, this.timeOf(this.previous, this.previousStartMs, now), this.before);
    for (const part of PARTS) {
      const to = this.current[part];
      const from = this.before[part];
      to.x = from.x + (to.x - from.x) * weight;
      to.y = from.y + (to.y - from.y) * weight;
      to.rotation = from.rotation + (to.rotation - from.rotation) * weight;
      to.scaleX = from.scaleX + (to.scaleX - from.scaleX) * weight;
      to.scaleY = from.scaleY + (to.scaleY - from.scaleY) * weight;
      to.alpha = from.alpha + (to.alpha - from.alpha) * weight;
    }
    return this.current;
  }
}

/** The movable parts of one drawn figure, found once when it is built, with the place each has at rest. */
export interface BoundPart {
  part: PartName;
  node: Container;
  restX: number;
  restY: number;
  /** The scale the part has at rest: the rig of an enemy is mirrored (-1), and its offsets are mirrored with it. */
  restScaleX: number;
  restScaleY: number;
}

/**
 * `driveBeacon`: the clip moves the yellow beacon of a Controller (only while it is Exhausted); otherwise the board
 * blinks it and no clip may touch its opacity.
 */
export function bindParts(figure: Container, driveBeacon = false): BoundPart[] {
  return PARTS.filter((part) => driveBeacon || part !== "beacon").flatMap((part) => {
    const node = figure.getChildByLabel(part, true);
    return node === null ? [] : [{ part, node, restX: node.x, restY: node.y, restScaleX: node.scale.x, restScaleY: node.scale.y }];
  });
}

const DEGREES = Math.PI / 180;

/** The colour multiplied over a figure that has gone grey (Exhausted): white is untouched. */
const GREY_TINT = 0x7a828b;

/** The tint of a figure that is `grey` (0 to 1) of the way to the Exhausted grey; integer maths, no allocation. */
export function greyTint(grey: number): number {
  const channel = (shift: number) => Math.round(255 + (((GREY_TINT >> shift) & 0xff) - 255) * grey);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Puts a pose on a figure. The rig of an enemy is mirrored, and so are its offsets and its turn. */
export function applyPose(parts: readonly BoundPart[], pose: Pose): void {
  for (const { part, node, restX, restY, restScaleX, restScaleY } of parts) {
    const p = pose[part];
    node.position.set(restX + p.x * Math.sign(restScaleX), restY + p.y);
    node.rotation = p.rotation * DEGREES * Math.sign(restScaleX);
    if (part === "rig") node.tint = greyTint(pose.grey.alpha);
    node.scale.set(restScaleX * p.scaleX, restScaleY * p.scaleY);
    node.alpha = p.alpha;
  }
}

const rest = createPose();

/**
 * The rest frame for `prefers-reduced-motion`: nothing moves. The grey II of a Wait still shows, as it says what the
 * Hero chose and moves nothing.
 */
export function applyRestPose(parts: readonly BoundPart[], name: ClipName): void {
  restPoseInto(rest);
  if (name === "wait") rest.pause.alpha = 1;
  applyPose(parts, rest);
}
