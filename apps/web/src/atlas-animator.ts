import { Container, Sprite, type Texture } from "pixi.js";
import { type AtlasData, frameMsOf, parseAtlas } from "./atlas";

/** What the animator needs of a loaded sprite sheet (PixiJS's `Spritesheet` has both): the textures per animation and the JSON. */
export interface AtlasSheet {
  animations: Record<string, Texture[]>;
  data: unknown;
}

export interface PlayOptions {
  /** Loop until stopped; otherwise play once, rest on the last frame and call `onComplete`. */
  loop?: boolean;
}

/**
 * Plays one animation of a loaded atlas on the stage ticker: a container with one sprite per layer, moved only by `update(deltaMs)`
 * (ADR 0026, rule 4). Several layers (the match Heroes' `fx_back`, `figure`, `fx_front`) show the same frame at all times. The container's
 * origin is the feet anchor of the frames. Not related to `ClipPlayer`, which is the match's state holder for which clip a Hero plays.
 */
export class AtlasAnimator {
  readonly container = new Container();
  /** Called once when a one-shot animation has played to its end (also in reduced motion, at once). */
  onComplete: (() => void) | undefined;

  private readonly meta: AtlasData["meta"];
  private layers: { sprite: Sprite; frames: Texture[] }[] = [];
  private frameMs = 0;
  private frameCount = 0;
  private elapsed = 0;
  private looping = false;
  private active = false;
  private paused = false;
  private reduced = false;
  private scale = 1;
  private mirrored = false;

  constructor(private readonly sheet: AtlasSheet) {
    this.meta = parseAtlas(sheet.data).meta;
    for (const textures of Object.values(sheet.animations)) for (const texture of textures) texture.source.scaleMode = "nearest";
  }

  /** The index of the frame on show (the same in every layer). */
  get frame(): number {
    return Math.min(this.frameCount - 1, Math.floor(this.elapsed / this.frameMs));
  }

  /** Whether the stage must keep its ticker running for this animation (rule 6). */
  get animating(): boolean {
    return this.active && !this.paused && !this.reduced;
  }

  /** Starts an animation from its first frame. A list of names plays them as layers, back to front, in lockstep. */
  play(animation: string | readonly string[], options: PlayOptions = {}): void {
    const names = typeof animation === "string" ? [animation] : animation;
    const lists = names.map((name) => {
      const frames = this.sheet.animations[name];
      if (!frames) throw new Error(`The atlas has no animation ${name}`);
      return frames;
    });
    const count = lists[0]?.length ?? 0;
    if (count === 0 || lists.some((frames) => frames.length !== count)) throw new Error(`Layers ${names.join(", ")} must have the same number of frames`);

    this.clearLayers();
    this.layers = lists.map((frames) => {
      const sprite = new Sprite(frames[0]);
      this.container.addChild(sprite);
      return { sprite, frames };
    });
    this.frameCount = count;
    this.frameMs = frameMsOf(this.meta, names[0] as string, count);
    this.looping = options.loop === true;
    this.elapsed = 0;
    this.active = true;
    this.paused = false;
    this.apply();
    if (this.reduced) this.showStill();
  }

  /** Starts the current animation again from its first frame. */
  restart(): void {
    if (this.layers.length === 0) return;
    this.elapsed = 0;
    this.active = true;
    this.paused = false;
    this.apply();
    if (this.reduced) this.showStill();
  }

  stop(): void {
    this.active = false;
    this.paused = false;
    this.elapsed = 0;
    this.clearLayers();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Reduced motion (rule 9): a still frame (the first of a loop, the last of a one-shot) and no ticks. */
  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
    if (reduced && this.layers.length > 0) this.showStill();
  }

  /** Whole numbers only, or the pixels blur. */
  setScale(scale: number): void {
    this.scale = scale;
    this.container.scale.set(this.mirrored ? -scale : scale, scale);
  }

  /** The frames face right; a mirrored animation faces left. */
  setMirrored(mirrored: boolean): void {
    this.mirrored = mirrored;
    this.setScale(this.scale);
  }

  update(deltaMs: number): void {
    if (!this.animating) return;
    const total = this.frameMs * this.frameCount;
    this.elapsed += deltaMs;
    if (this.looping) this.elapsed %= total;
    else if (this.elapsed >= total) {
      this.finish();
      return;
    }
    this.apply();
  }

  private showStill(): void {
    if (this.looping) {
      this.elapsed = 0;
      this.apply();
    } else this.finish();
  }

  private finish(): void {
    this.elapsed = this.frameMs * (this.frameCount - 1);
    this.active = false;
    this.apply();
    this.onComplete?.();
  }

  private apply(): void {
    const index = this.frame;
    for (const { sprite, frames } of this.layers) {
      const texture = frames[index] as Texture;
      sprite.texture = texture;
      // A sprite takes the anchor of a texture only when it is made, so every frame sets it again.
      if (texture.defaultAnchor) sprite.anchor.copyFrom(texture.defaultAnchor);
    }
  }

  private clearLayers(): void {
    for (const { sprite } of this.layers) sprite.destroy();
    this.layers = [];
  }
}
