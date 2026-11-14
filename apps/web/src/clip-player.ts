import type { HeroClass } from "game-core";
import { type Clip, type ClipName, clipOf } from "./hero-clips";
import { STEP_MS } from "./playback";

/** Multiplies the time of every clip (default 1); the one constant that tunes the whole feel. */
export const CLIP_SPEED = 1.8;

/**
 * Says which clip one Hero plays and how far into it it is. A walk runs at the pace of the playback steps: half a cycle per step.
 */
export class ClipPlayer {
  private clip: Clip;
  private startMs: number;

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
    this.clip = clipOf(this.heroClass, name);
    this.startMs = at;
  }

  private timeOf(clip: Clip, startMs: number, now: number): number {
    // A Walk keeps the pace of the playback steps whatever the clip speed; every other clip runs at the clip speed.
    const pace = clip.perStep ? clip.durationMs / 2 / STEP_MS : this.speed;
    return (now - startMs) * pace;
  }

  /** How far into the playing clip it is at `now`, in clip time; call `update` first, which starts a clip that was delayed. */
  clipTimeMs(now: number): number {
    return this.timeOf(this.clip, this.startMs, now);
  }

  /** Starts a clip that was delayed once its time has come; call it every frame before `playing` and `clipTimeMs`. */
  update(now: number): void {
    if (this.pending !== undefined && now >= this.pending.at) {
      this.start(this.pending.name, this.pending.at);
      this.pending = undefined;
    }
  }
}
