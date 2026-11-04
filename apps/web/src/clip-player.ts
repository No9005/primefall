import type { HeroClass } from "game-core";
import type { Container } from "pixi.js";
import { type Clip, type ClipName, clipOf, createPose, PARTS, type PartName, type Pose, restPoseInto, sampleClipInto } from "./hero-clips";
import { STEP_MS } from "./playback";

/** Multiplies the time of every clip (default 1); the one constant that tunes the whole feel. */
export const CLIP_SPEED = 1;
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

  /** Switches to a clip; asking for the one that already plays changes nothing (a Walk goes on from step to step). */
  play(name: ClipName, now: number): void {
    if (name === this.clip.name) return;
    this.previous = this.clip;
    this.previousStartMs = this.startMs;
    this.fadeStartMs = now;
    this.clip = clipOf(this.heroClass, name);
    this.startMs = now;
  }

  private timeOf(clip: Clip, startMs: number, now: number): number {
    const pace = clip.perStep ? clip.durationMs / 2 / STEP_MS : 1;
    return (now - startMs) * this.speed * pace;
  }

  /** The pose at `now`; the returned object is reused by the next call. */
  sample(now: number): Pose {
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
}

export function bindParts(figure: Container): BoundPart[] {
  return PARTS.flatMap((part) => {
    const node = figure.getChildByLabel(part, true);
    return node === null ? [] : [{ part, node, restX: node.x, restY: node.y }];
  });
}

const DEGREES = Math.PI / 180;

/** Puts a pose on a figure. */
export function applyPose(parts: readonly BoundPart[], pose: Pose): void {
  for (const { part, node, restX, restY } of parts) {
    const p = pose[part];
    node.position.set(restX + p.x, restY + p.y);
    node.rotation = p.rotation * DEGREES;
    node.scale.set(p.scaleX, p.scaleY);
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
