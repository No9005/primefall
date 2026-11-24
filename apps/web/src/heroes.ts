import { HeroClass } from "game-core";
import { Assets, Container, Graphics, Sprite, type Spritesheet, type Texture } from "pixi.js";
import { baseFacing, type Facing } from "./facing";
import { type ClipName, clipOf } from "./hero-clips";
import { groundMarks, type HeroPose } from "./hero-figure";
import { CLIP_SPEED } from "./clip-player";
import { HERO_STYLE } from "./hero-style";

// The Heroes of the Pixel art style: sprite sheets (apps/web/public/assets/heroes, docs/design/heroes) played
// instead of the shape rig. Which clip plays when stays with `playback.ts` and `hero-clips.ts`; this module only decides
// which sheet a clip name is, and draws the frame. The sheets carry no team colour, so the ring under the feet stays the
// renderer's. Only the `figure` layer is used on the board (the effect layers of a Wait too): the game draws the Shield bubble,
// the numbers, the planned Wait mark, the Cover, the Scout Drone and the shots itself. The Hero Select, which draws none of these, also shows the effect layers.

/** What a sheet's `clips.json` says about one clip. */
interface ClipInfo {
  name: string;
  sheet: string;
  frames: number;
  durationMs: number;
  loop: boolean;
  shake?: [number, number][];
  ringAlpha?: number[];
  ringRedFrames?: number[];
}

/** A clip with its frames, ready to draw. */
export interface PixelClip extends ClipInfo {
  layers: Record<PixelLayer, Texture[] | undefined>;
}

export type PixelLayer = "fx_back" | "figure" | "fx_front";

/** The size of a frame and where the centre of the feet is in it. */
export const PIXEL_FRAME = { width: 136, height: 104, feetX: 58, feetY: 86 } as const;
/** World px per sprite px: whole, so that the pixels stay square. A Hero is then about 90 px tall at game size (the rig's is 100). */
export const PIXEL_SCALE = 2;

const PIXEL_ASSETS = `${import.meta.env.BASE_URL}assets/heroes/`;
const CLASS_FOLDER: Record<HeroClass, string> = { [HeroClass.Bruiser]: "bruiser", [HeroClass.Controller]: "controller", [HeroClass.Assassin]: "assassin" };

/** The sheets of the clips the game plays; a clip the game plays for a class but that is not here uses `PIXEL_FALLBACKS`. */
const SHEETS: Record<HeroClass, Partial<Record<ClipName, string>>> = {
  [HeroClass.Bruiser]: { idle: "idle", walk: "walk", wait: "wait", attack: "slam", block: "block", hit: "hit", absorb: "shield", takeCover: "half", takeCoverFull: "full", inCover: "half", inCoverFull: "full", exhausted: "exhausted" },
  [HeroClass.Controller]: {
    idle: "idle",
    walk: "walk",
    wait: "wait",
    attack: "pulse",
    tagRound: "tag",
    slowPulse: "slow",
    scoutDrone: "drone",
    aegis: "aegis",
    deploy: "deploy",
    deployFull: "deployfull",
    demolish: "demolish",
    scrapField: "scrapfield",
    scrapGain: "scrapforce",
    block: "block",
    hit: "hit",
    takeCover: "half",
    takeCoverFull: "full",
    inCover: "half",
    inCoverFull: "full",
    exhausted: "exhausted",
  },
  [HeroClass.Assassin]: { idle: "idle", walk: "walk", wait: "wait", attack: "precision", longShot: "long", longHidden: "longhidden", knockback: "knockback", shieldBreaker: "shieldbreaker", hitHidden: "hithidden", hidden: "hidden", block: "block", hit: "hit", takeCover: "half", takeCoverFull: "full", inCover: "half", inCoverFull: "full", exhausted: "exhausted" },
};

/**
 * The clips a class has no sheet for. The Controller and the Assassin have no clip for a hit that the Shield absorbs: they
 * stand in the idle clip, and the Shield mark the game draws carries the hit. Every other clip a class lacks (a Long Shot of a
 * Bruiser, a Deploy of an Assassin) is its basic attack, as in `clipOf`.
 */
export const PIXEL_FALLBACKS: Partial<Record<ClipName, ClipName>> = { absorb: "idle" };

/** The sheet name of a game clip for a Hero class, after the fallbacks. */
export function pixelSheetOf(heroClass: HeroClass, name: ClipName): string {
  const sheets = SHEETS[heroClass];
  return sheets[name] ?? sheets[PIXEL_FALLBACKS[name] ?? "attack"]!;
}

/** Every sheet a class uses on the board, once. */
function boardSheets(heroClass: HeroClass): string[] {
  return [...new Set(Object.values(SHEETS[heroClass]))];
}

/** The sheets of the Hero Select. */
const SELECT_SHEETS = ["select_idle", "select_ready", "select_hold"] as const;

/** In a rest clip that is the loop of a Take Cover, the loop starts after the taking (the rig's `activeEndMs`: 24 % and 22 %). */
const COVER_LOOP_FROM: Partial<Record<ClipName, number>> = { inCover: 0.24, inCoverFull: 0.22 };

/**
 * ... and ends where the figure is back in the pose it starts the loop in. The sheets end with the Hero standing up (to run into
 * their first frame, which stands), so a loop that ran to the end showed a rise and then a jump back to crouching, every cycle: the
 * taking of cover again and again. The ends are the frames that lead back to the loop's start with the smallest jump (found by
 * comparing the frames; the jump from the last frame is 8 to 10 times a normal step, from these about 2.5 to 4).
 */
const COVER_LOOP_TO: Record<HeroClass, Partial<Record<ClipName, number>>> = {
  [HeroClass.Bruiser]: { inCover: 0.841, inCoverFull: 0.771 },
  [HeroClass.Assassin]: { inCover: 0.739, inCoverFull: 0.792 },
  [HeroClass.Controller]: { inCover: 0.841, inCoverFull: 0.833 },
};

/** Where in a sheet a rest clip is `progress` of the way through a cycle (the cycles wrap inside the loop of the Cover rest, not over the rise at the end of the sheet). */
export function restLoopProgress(heroClass: HeroClass, name: ClipName, progress: number): number {
  const from = COVER_LOOP_FROM[name];
  if (from === undefined) return progress;
  const to = COVER_LOOP_TO[heroClass][name] ?? 1;
  return from + (((progress % 1) + 1) % 1) * (to - from);
}

/**
 * The frames at the start of the Cover loop in which the Hero is just crouched (a few of them, so that the breathing moves a little
 * rather than the figure standing as a still image). The rest of the loop (looking up, for Max) plays only now and then.
 */
const COVER_HOLD_FRAMES: Record<HeroClass, Partial<Record<ClipName, number>>> = {
  [HeroClass.Bruiser]: { inCover: 9, inCoverFull: 3 },
  [HeroClass.Assassin]: { inCover: 3, inCoverFull: 15 },
  [HeroClass.Controller]: { inCover: 10, inCoverFull: 4 },
};
/** How long (at least) the Hero stays crouched between two passes of the loop, and how long one of those frames lasts. */
const COVER_HOLD_S = 6;
const COVER_HOLD_FRAME_S = 0.15;

/**
 * Where in a Cover rest sheet the figure is `clipMs` into the rest: crouched (moving between the first frames of the loop) for most of
 * the time, then the loop once, and crouched again. `offsetMs` shifts the cycle, so the Heroes of a board do not look up together.
 */
export function coverRestProgress(
  heroClass: HeroClass,
  name: ClipName,
  { clipMs, loopMs, frames, offsetMs = 0 }: { clipMs: number; loopMs: number; frames: number; offsetMs?: number },
): number {
  const from = COVER_LOOP_FROM[name];
  if (from === undefined) return clipMs / loopMs;
  const holdFrames = COVER_HOLD_FRAMES[heroClass][name] ?? 1;
  const frameMs = COVER_HOLD_FRAME_S * 1000 * CLIP_SPEED;
  const roundMs = Math.max(1, 2 * (holdFrames - 1)) * frameMs;
  const holdMs = Math.ceil((COVER_HOLD_S * 1000 * CLIP_SPEED) / roundMs) * roundMs;
  const cycleMs = holdMs + loopMs;
  const at = (((clipMs + offsetMs) % cycleMs) + cycleMs) % cycleMs;
  if (at >= holdMs) return restLoopProgress(heroClass, name, (at - holdMs) / loopMs);
  const step = (at % roundMs) / frameMs;
  const frame = holdFrames <= 1 ? 0 : Math.floor(step <= holdFrames - 1 ? step : 2 * (holdFrames - 1) - step);
  return from + (frame + 0.5) / frames;
}

/**
 * The clips whose effect layers the board draws as well. The pause mark and the puff of smoke of a Wait are in the sheet and nowhere
 * else (the game draws the shots, the Shield and the Cover itself, which is why the other clips show their figure only).
 */
const EFFECT_CLIPS: readonly ClipName[] = ["wait"];

const loaded = new Map<HeroClass, Map<string, PixelClip>>();
let loading: Promise<void> | undefined;

const sheetUrls: string[] = [];

/** The URLs of the loaded sheets, which the stage destroys when the scene that needs them is left. */
export function pixelHeroSheetUrls(): readonly string[] {
  return sheetUrls;
}

/** Forgets the loaded sheets (their textures were destroyed), so the next `loadPixelHeroes` loads them again. */
export function resetPixelHeroes(): void {
  loaded.clear();
  sheetUrls.length = 0;
  loading = undefined;
}

/** Loads every sheet the game plays once (nearest-neighbour, so the pixels stay sharp). */
export function loadPixelHeroes(): Promise<void> {
  loading ??= (async () => {
    for (const heroClass of Object.values(HeroClass)) {
      const folder = `${PIXEL_ASSETS}${CLASS_FOLDER[heroClass]}/`;
      const info = (await (await fetch(`${folder}clips.json`)).json()) as { clips: ClipInfo[] };
      const wanted = new Set<string>([...boardSheets(heroClass), ...SELECT_SHEETS]);
      const clips = new Map<string, PixelClip>();
      await Promise.all(
        info.clips
          .filter((clip) => wanted.has(clip.sheet.replace(".json", "")))
          .map(async (clip) => {
            sheetUrls.push(`${folder}${clip.sheet}`);
            const sheet = await Assets.load<Spritesheet>(`${folder}${clip.sheet}`);
            sheet.textureSource.scaleMode = "nearest";
            const layer = (name: PixelLayer) => sheet.animations[`${CLASS_FOLDER[heroClass]}.${clip.name}.${name}`];
            clips.set(clip.sheet.replace(".json", ""), { ...clip, layers: { fx_back: layer("fx_back"), figure: layer("figure"), fx_front: layer("fx_front") } });
          }),
      );
      loaded.set(heroClass, clips);
    }
  })();
  return loading;
}

function clipOfSheet(heroClass: HeroClass, sheet: string): PixelClip {
  const clip = loaded.get(heroClass)?.get(sheet);
  if (!clip) throw new Error(`Pixel Hero sheet ${CLASS_FOLDER[heroClass]}/${sheet} is not loaded`);
  return clip;
}

/** The frame of a clip `progress` of the way through (1 is the end of one cycle): loops wrap, a clip that plays once rests on its last frame. */
export function frameAt(frames: number, loop: boolean, progress: number): number {
  const index = Math.floor(progress * frames);
  return loop ? ((index % frames) + frames) % frames : Math.max(0, Math.min(frames - 1, index));
}

/**
 * A Hero drawn from the sprite sheets: the shadow and Squad ring of the renderer, and the sprite of the current frame.
 * `container` has its feet at (0, 0) and the scale of the rig figure, so cues, marks and the ring size stay where they are.
 */
export class PixelHero {
  readonly container = new Container();
  private readonly teamRing: Container;
  private readonly ringFlash: Container;
  private readonly body = new Container();
  private readonly sprites: Record<PixelLayer, Sprite>;
  private readonly side: number;
  /** Shifts the cycle of the Cover rest, so that the Heroes of the board do not all look up together. */
  private readonly restOffsetMs: number;
  /** The scale of the sprites inside `container`. */
  private readonly unit: number;
  private readonly layers: readonly PixelLayer[];

  constructor(
    private readonly heroClass: HeroClass,
    enemy: boolean,
    cameraScale: number,
    facing: Facing = baseFacing(enemy),
    {
      layers = ["figure"],
      figureScale = HERO_STYLE.figureScale,
      pixelScale = PIXEL_SCALE,
    }: {
      /** The layers of the sheets that are drawn. */
      layers?: readonly PixelLayer[];
      /** The scale of `container`: the rig's by default; 1 where a parent already magnifies (the Hero Select). */
      figureScale?: number;
      /** Screen px per sprite px as the figure ends up (before the camera): whole on the board. */
      pixelScale?: number;
    } = {},
  ) {
    const [shadow, teamRing, ringFlash] = groundMarks(enemy, cameraScale);
    this.teamRing = teamRing;
    this.ringFlash = ringFlash;
    this.layers = layers;
    this.container.scale.set(figureScale);
    this.side = facing === "left" ? -1 : 1;
    this.restOffsetMs = ((enemy ? 2400 : 0) + Object.values(HeroClass).indexOf(heroClass) * 1700) * CLIP_SPEED;
    // The sprites keep their own scale (whole on the board), whatever the figure scale is.
    this.unit = pixelScale / figureScale;
    this.body.scale.set(this.unit * this.side, this.unit);
    const make = () => {
      const sprite = new Sprite();
      sprite.anchor.set(PIXEL_FRAME.feetX / PIXEL_FRAME.width, PIXEL_FRAME.feetY / PIXEL_FRAME.height);
      return sprite;
    };
    this.sprites = { fx_back: make(), figure: make(), fx_front: make() };
    this.body.addChild(this.sprites.fx_back, this.sprites.figure, this.sprites.fx_front);
    this.container.addChild(shadow, teamRing, ringFlash, this.body);
  }

  /**
   * Hides what the front effects layer draws above sprite row `spriteY` (0 at the top of the 136 x 104 frame). The sheet of the
   * Assassin floats its Hidden label far above the head; the Hero Select draws its own label close above it instead.
   */
  clipFrontAbove(spriteY: number): void {
    const keep = new Graphics().rect(-PIXEL_FRAME.width, spriteY - PIXEL_FRAME.feetY, PIXEL_FRAME.width * 2, PIXEL_FRAME.height).fill(0xffffff);
    this.body.addChild(keep);
    this.sprites.fx_front.mask = keep;
  }

  /** Shows a clip of a sheet by name at a frame; the ring flash, the ring fade and the shake of that frame go with it. */
  /** `withEffects`: the effect layers of the sheet are drawn too, whatever layers this Hero draws. */
  private draw(clip: PixelClip, frame: number, withEffects = false): void {
    for (const layer of ["fx_back", "figure", "fx_front"] as const) {
      const sprite = this.sprites[layer];
      const textures = withEffects || this.layers.includes(layer) ? clip.layers[layer] : undefined;
      sprite.visible = textures !== undefined;
      if (textures) sprite.texture = textures[Math.min(frame, textures.length - 1)]!;
    }
    this.ringFlash.alpha = clip.ringRedFrames?.includes(frame) ? 1 : 0;
    this.teamRing.alpha = clip.ringAlpha?.[frame] ?? 1;
    const shake = clip.shake?.[frame];
    this.body.position.set((shake?.[0] ?? 0) * this.side * this.unit, (shake?.[1] ?? 0) * this.unit);
  }

  /**
   * The game clip `name` `clipMs` into its play (clip time, as the `ClipPlayer` counts it). The clip's own length rules the
   * pace, so the sheet and the rig agree on when a Hero is back at rest whatever their lengths.
   */
  show(name: ClipName, clipMs: number): void {
    const clip = clipOfSheet(this.heroClass, pixelSheetOf(this.heroClass, name));
    const progress = clipMs / clipOf(this.heroClass, name).durationMs;
    const loopMs = clipOf(this.heroClass, name).durationMs;
    const resting = COVER_LOOP_FROM[name] !== undefined;
    const frame = resting
      ? frameAt(clip.frames, clip.loop, coverRestProgress(this.heroClass, name, { clipMs, loopMs, frames: clip.frames, offsetMs: this.restOffsetMs }))
      : frameAt(clip.frames, clip.loop, progress);
    this.draw(clip, frame, EFFECT_CLIPS.includes(name));
    // A Hero that goes Hidden fades to the translucent look it keeps (the sheet's figure stays opaque).
    if (name === "hidden") this.body.alpha = 1 - 0.45 * Math.min(1, Math.max(0, (progress - 0.2) / 0.2));
    else this.body.alpha = 1;
  }

  /** The still of a clip: its first frame (the frame after the taking of a Cover), or its last when it ends on a rest pose. */
  showStill(name: ClipName | "hitImpact"): void {
    if (name === "hitImpact") {
      const clip = clipOfSheet(this.heroClass, "hit");
      // The frame of the impact, 310 ms into the clip.
      this.draw(clip, Math.round(310 / (clip.durationMs / clip.frames)));
      return;
    }
    const clip = clipOfSheet(this.heroClass, pixelSheetOf(this.heroClass, name));
    this.draw(clip, name === "exhausted" ? clip.frames - 1 : frameAt(clip.frames, clip.loop, COVER_LOOP_FROM[name] ?? 0), EFFECT_CLIPS.includes(name));
  }

  /** The Hero Select: idle loops; a chosen Hero plays its ready clip once and then holds. `sinceMs` is the time in the state. */
  showSelect(ready: boolean, sinceMs: number, reducedMotion: boolean): void {
    const idle = clipOfSheet(this.heroClass, "select_idle");
    const readyClip = clipOfSheet(this.heroClass, "select_ready");
    const hold = clipOfSheet(this.heroClass, "select_hold");
    if (!ready) this.draw(idle, reducedMotion ? 0 : frameAt(idle.frames, true, sinceMs / idle.durationMs));
    else if (reducedMotion) this.draw(hold, 0);
    else if (sinceMs < readyClip.durationMs) this.draw(readyClip, frameAt(readyClip.frames, false, sinceMs / readyClip.durationMs));
    else this.draw(hold, frameAt(hold.frames, true, (sinceMs - readyClip.durationMs) / hold.durationMs));
  }
}

/** A Hero figure and the pixel hero that animates it. The sheets must be loaded (`loadPixelHeroes`). */
export function styledHeroFigure(
  heroClass: HeroClass,
  enemy: boolean,
  pose: HeroPose,
  cameraScale: number,
  facing: Facing = baseFacing(enemy),
): { figure: Container; pixel: PixelHero } {
  const pixel = new PixelHero(heroClass, enemy, cameraScale, facing);
  if (pose === "exhausted") pixel.showStill("exhausted");
  else pixel.showStill(pose === "hit" ? "hitImpact" : "idle");
  return { figure: pixel.container, pixel };
}
