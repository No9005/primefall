import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { cyclePercent } from "./hangar-scene";
import { WHIP_MS } from "./notstrom-intro";
import type { Scene, SceneEnv } from "./stage";
import { BURST_OFFSET, type Fireball, FIREBALLS, STAGE } from "./title-menu";

// The picture world of the title screen as a scene on the stage (ADR 0026; design: docs/design/title/README.md). The stars and the planet, the
// blinking stars, the haze, the falling crystals and their bursts, the bobbing logo, the tagline banner and the fly-away of the tap on Start.
// The menu rows are UI and stay DOM (TitleScreen.tsx); the screen asks for the fly-away with `fly` and takes its look per frame with `watchFly`.
// The frame is 960 x 444 design pixels, as high as the window ("height" fit). All motion follows the stage ticker.

export const TITLE_SCENE_NAME = "title";

const ART = `${import.meta.env.BASE_URL}assets/title/`;
const PICTURES = ["background", "stars", "haze", "logo", "tagline", "fireball", "impact", "hyperspace"].map((name) => `${ART}${name}.png`);
const BACKDROP = 0x04060f;
/** The point the fly-away pulls towards: 86 % across and 45 % down the frame. */
const ORIGIN = { x: STAGE.width * 0.86, y: STAGE.height * 0.45 };
const FIREBALL_BOX = { width: 225, height: 135, fromX: 300, fromY: -165 };
const BURST_BOX = { width: 120, height: 66 };
/** The logo bobs up by 0.7 % of the frame's height. */
const BOB = STAGE.height * 0.007;

// --- Motion that CSS animations made before: each is a pure function of the scene's time -----------------------------------------------

/** A value between keyframes `[percent, value]` that are joined by straight lines (`linear`). */
export function linearValue(keyframes: readonly (readonly [number, number])[], percent: number): number {
  const first = keyframes[0];
  if (!first || percent <= first[0]) return first?.[1] ?? 0;
  for (let index = 1; index < keyframes.length; index++) {
    const [to, toValue] = keyframes[index] as readonly [number, number];
    const [from, fromValue] = keyframes[index - 1] as readonly [number, number];
    if (percent <= to) return fromValue + ((toValue - fromValue) * (percent - from)) / (to - from);
  }
  return keyframes[keyframes.length - 1]?.[1] ?? 0;
}

/** Where an `alternate` animation of `seconds` is in its progress 0 to 1 at `timeMs`: it runs forward, then back. */
export function alternateProgress(timeMs: number, seconds: number): number {
  const cycle = timeMs / 1000 / seconds;
  const iteration = Math.floor(cycle);
  const part = cycle - iteration;
  return iteration % 2 === 0 ? part : 1 - part;
}

/** `steps(count, end)`: the progress jumps up at the end of each of `count` equal parts. */
export const stepsEnd = (progress: number, count: number): number => Math.min(1, Math.floor(progress * count) / count);

/** A cubic-bezier easing, as CSS evaluates it (x by bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, progress: number): number {
  const at = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 30; step++) {
    const middle = (low + high) / 2;
    if (at(middle, x1, x2) < progress) low = middle;
    else high = middle;
  }
  return at((low + high) / 2, y1, y2);
}

/** The twinkling stars: two steps of 1.2 s each way between full and a quarter of the opacity. */
export const twinkleOpacity = (timeMs: number): number => 1 - 0.75 * stepsEnd(alternateProgress(timeMs, 2.4), 2);

/** The haze pulses between 0.55 and 1 over 2 s, eased in and out. */
export const hazeOpacity = (timeMs: number): number => 0.55 + 0.45 * cubicBezier(0.42, 0, 0.58, 1, alternateProgress(timeMs, 2));

/** The logo bobs up and down in six steps over 3 s; the rise is in design pixels (positive: up). */
export const logoRise = (timeMs: number): number => BOB * stepsEnd(alternateProgress(timeMs, 3), 6);

/** A crystal falls from the top right onto the planet in 12 % of its round, goes out, and starts again after its period. Position is its box's top left. */
export function fireballAt(timeMs: number, ball: Fireball): { x: number; y: number; opacity: number } {
  const percent = cyclePercent(timeMs, ball.period, ball.delay);
  if (percent === undefined) return { x: ball.left, y: ball.top, opacity: 0 };
  const behind = linearValue([[0, 1], [12, 0], [100, 0]], percent);
  return {
    x: ball.left + FIREBALL_BOX.fromX * behind,
    y: ball.top + FIREBALL_BOX.fromY * behind,
    opacity: linearValue([[0, 0], [4, 1], [12, 1], [13, 0], [100, 0]], percent),
  };
}

/** The burst on the atmosphere at the foot of the fall: its scale (about the middle of its box) and opacity. */
export function burstAt(timeMs: number, ball: Fireball): { scale: number; opacity: number } {
  const percent = cyclePercent(timeMs, ball.period, ball.delay);
  if (percent === undefined) return { scale: 0.3, opacity: 0 };
  return {
    scale: linearValue([[0, 0.3], [11, 0.3], [12, 0.5], [18, 1.3], [24, 1.6], [100, 1.6]], percent),
    opacity: linearValue([[0, 0], [11, 0], [12, 1], [18, 0.8], [24, 0], [100, 0]], percent),
  };
}

// --- The fly-away ---------------------------------------------------------------------------------------------------------------------------

/** The pull is eight steps of 75 ms; the layers have each their own scale at the nine keyframes (0 %, 12.5 % ... 100 %). */
const PULL_MS = 600;
const TUNNEL_MS = 1400;
const NEAR = [1, 1.12, 1.38, 1.8, 2.5, 3.7, 5.8, 9.5, 16] as const;
const MID = [1, 1.05, 1.14, 1.3, 1.5, 1.8, 2.3, 3, 4] as const;
const FAR = [1, 1.02, 1.05, 1.1, 1.17, 1.26, 1.38, 1.55, 1.8] as const;
const WHIP_OPACITY = [0, 0.4, 0.9, 1, 1, 1, 1, 0.6, 0] as const;
const WHIP_SCALE = [0.5, 0.6, 0.8, 1, 1.3, 1.7, 2.3, 3, 4] as const;

/** A value that jumps from keyframe to keyframe (`step-end`) over `durationMs`, and stays on the last one. */
export function stepKeyframe(values: readonly number[], timeMs: number, durationMs: number): number {
  const progress = timeMs / durationMs;
  const last = values.length - 1;
  return values[progress >= 1 ? last : Math.floor(progress * last)] ?? 1;
}

export interface FlyLook {
  /** The scales of the logo, the tagline and the menu rows (near), the stars, haze and crystals (middle) and the sky and planet (far). */
  near: number;
  mid: number;
  far: number;
  /** The opacity of the picture and the menu: it goes out in the last 150 ms of the pull. */
  paneAlpha: number;
  tunnelAlpha: number;
  whipAlpha: number;
  whipScale: number;
}

/** What the fly-away looks like `timeMs` after the tap. */
export function flyLook(timeMs: number): FlyLook {
  const progress = timeMs / PULL_MS;
  const tunnel = timeMs / TUNNEL_MS;
  return {
    near: stepKeyframe(NEAR, timeMs, PULL_MS),
    mid: stepKeyframe(MID, timeMs, PULL_MS),
    far: stepKeyframe(FAR, timeMs, PULL_MS),
    paneAlpha: progress < 0.875 ? 1 : progress < 1 ? 0.6 : 0,
    tunnelAlpha: tunnel >= 0.22 && tunnel < 0.88 ? 1 : 0,
    whipAlpha: stepKeyframe(WHIP_OPACITY, timeMs, PULL_MS),
    whipScale: stepKeyframe(WHIP_SCALE, timeMs, PULL_MS),
  };
}

/** A streak layer of the tunnel: six steps of 0.36 s from small and faint to large; the second layer runs half a round ahead. */
export function streakLook(timeMs: number, second: boolean): { scale: number; opacity: number } {
  const round = 0.36;
  const part = ((timeMs / 1000 + (second ? 0.18 : 0)) % round) / round;
  const opacity = part < 0.15 ? stepsEnd(part / 0.15, 6) : 1 - 0.8 * stepsEnd((part - 0.15) / 0.85, 6);
  return { scale: 0.5 + 2.9 * stepsEnd(part, 6), opacity };
}

// --- The scene --------------------------------------------------------------------------------------------------------------------------

/** What the scene needs of the loaded art; PixiJS's loader in the app, fakes in tests. */
export interface TitleArt {
  texture(url: string): Texture;
}

export const pixiTitleArt: TitleArt = { texture: (url) => Assets.get<Texture>(url) };

export interface TitleScene extends Scene {
  /** Starts the fly-away; `onDone` is called once, `WHIP_MS` of stage time later. Returns what cancels it (the screen is left). */
  fly(onDone: () => void): () => void;
  /** Gets the look of the fly-away in every frame of it (the screen scales its menu rows with it); `undefined` stops. */
  watchFly(listener: ((look: FlyLook) => void) | undefined): void;
}

/** The colour of the tunnel's glow at `share` of its radius (a radial gradient over the dark): the colour stops of the style it replaces. */
function glowColor(share: number): number {
  const stops: readonly (readonly [number, number, number, number, number])[] = [
    [0, 120, 130, 255, 0.55],
    [0.22, 50, 30, 130, 0.35],
    [0.6, 6, 6, 20, 0],
  ];
  const base = [(BACKDROP >> 16) & 255, (BACKDROP >> 8) & 255, BACKDROP & 255] as const;
  const upper = stops.findIndex(([at]) => at >= share);
  const to = stops[upper < 0 ? stops.length - 1 : upper] as (typeof stops)[number];
  const from = stops[Math.max(0, upper - 1)] as (typeof stops)[number];
  const mix = to[0] === from[0] ? 0 : Math.min(1, (share - from[0]) / (to[0] - from[0]));
  const alpha = from[4] + (to[4] - from[4]) * mix;
  const channel = (index: 0 | 1 | 2) => {
    const [start, end] = [from[index + 1] as number, to[index + 1] as number];
    const color = start + (end - start) * mix;
    return Math.round(color * alpha + base[index] * (1 - alpha));
  };
  return (channel(0) << 16) | (channel(1) << 8) | channel(2);
}

export function createTitleScene(art: TitleArt = pixiTitleArt): TitleScene {
  let env: SceneEnv | undefined;
  let reduced = false;
  let time = 0;
  let flyTime: number | undefined;
  let flyDone: (() => void) | undefined;
  let listener: ((look: FlyLook) => void) | undefined;
  let drawn = false;

  interface Parts {
    twinkle: Sprite;
    haze: Sprite;
    logo: Sprite;
    balls: { fall: Sprite; burst: Sprite; ball: Fireball }[];
    groups: { near: Container; mid: Container; far: Container; pane: Container };
    tunnel: Container;
    streaks: [Container, Sprite][];
    whip: Container;
  }
  let parts: Parts | undefined;

  const picture = (name: string): Texture => {
    const texture = art.texture(`${ART}${name}.png`);
    texture.source.scaleMode = "nearest";
    return texture;
  };
  const cover = (name: string): Sprite => {
    const sprite = new Sprite(picture(name));
    sprite.width = STAGE.width;
    sprite.height = STAGE.height;
    return sprite;
  };
  /** A group that is scaled about the point the fly-away pulls towards. */
  const aboutOrigin = (...children: Container[]): Container => {
    const group = new Container();
    group.pivot.set(ORIGIN.x, ORIGIN.y);
    group.position.set(ORIGIN.x, ORIGIN.y);
    group.addChild(...children);
    return group;
  };

  function build(): Container {
    const root = new Container();
    const backdrop = new Graphics().rect(-3000, -2000, 7000, 5000).fill(BACKDROP);
    // What is pulled beyond the frame is cut off: the picture is the frame (a narrower window cuts its sides, a wider one has dark sides).
    const frame = new Container();
    const frameMask = new Graphics().rect(0, 0, STAGE.width, STAGE.height).fill(0xffffff);
    frame.addChild(frameMask);
    frame.mask = frameMask;
    root.addChild(backdrop, frame);

    const tunnelBack = new Graphics().rect(0, 0, STAGE.width, STAGE.height).fill(BACKDROP);
    const radius = Math.hypot(Math.max(ORIGIN.x, STAGE.width - ORIGIN.x), Math.max(ORIGIN.y, STAGE.height - ORIGIN.y));
    const rings = 40;
    for (let ring = rings; ring >= 1; ring--) {
      tunnelBack.circle(ORIGIN.x, ORIGIN.y, (0.6 * ring * radius) / rings).fill(glowColor(0.6 * ((ring - 0.5) / rings)));
    }
    const streaks = [cover("hyperspace"), cover("hyperspace")].map((sprite): [Container, Sprite] => {
      sprite.blendMode = "screen";
      return [aboutOrigin(sprite), sprite];
    });
    const tunnel = new Container();
    tunnel.addChild(tunnelBack, ...streaks.map(([group]) => group));
    tunnel.alpha = 0;

    const twinkle = cover("stars");
    const haze = cover("haze");
    haze.blendMode = "screen";
    const balls = FIREBALLS.map((ball) => {
      const fall = new Sprite(picture("fireball"));
      fall.width = FIREBALL_BOX.width;
      fall.height = FIREBALL_BOX.height;
      fall.alpha = 0;
      const burst = new Sprite(picture("impact"));
      burst.anchor.set(0.5);
      burst.alpha = 0;
      return { fall, burst, ball };
    });
    const logo = cover("logo");
    const tagline = cover("tagline");

    const far = aboutOrigin(cover("background"));
    const mid = aboutOrigin(twinkle, ...balls.flatMap(({ fall, burst }) => [fall, burst]), haze);
    const near = aboutOrigin(logo, tagline);
    const pane = new Container();
    pane.addChild(far, mid, near);

    const whipSprite = cover("hyperspace");
    whipSprite.blendMode = "screen";
    const whip = aboutOrigin(whipSprite);
    whip.alpha = 0;

    frame.addChild(tunnel, pane, whip);
    parts = { twinkle, haze, logo, balls, groups: { near, mid, far, pane }, tunnel, streaks, whip };
    return root;
  }

  /** The stars, haze, logo and crystals at the scene's time; still (the first state) without motion, and while the fly-away pulls the picture. */
  function showDecor(): void {
    if (!parts) return;
    const still = reduced || flyTime !== undefined;
    const t = still ? 0 : time;
    parts.twinkle.alpha = still ? 1 : twinkleOpacity(t);
    parts.haze.alpha = still ? 1 : hazeOpacity(t);
    parts.logo.y = still ? 0 : -logoRise(t);
    for (const { fall, burst, ball } of parts.balls) {
      const falling = still ? { x: ball.left, y: ball.top, opacity: 0 } : fireballAt(t, ball);
      const bursting = still ? { scale: 0.3, opacity: 0 } : burstAt(t, ball);
      fall.position.set(falling.x, falling.y);
      fall.alpha = falling.opacity;
      burst.position.set(ball.left + BURST_OFFSET.left + BURST_BOX.width / 2, ball.top + BURST_OFFSET.top + BURST_BOX.height / 2);
      burst.scale.set((bursting.scale * BURST_BOX.width) / burst.texture.width, (bursting.scale * BURST_BOX.height) / burst.texture.height);
      burst.alpha = bursting.opacity;
    }
  }

  /** The fly-away at `flyTime`: the layers pulled each at their own speed, the picture fading out, the tunnel of streaks behind it. */
  function showFly(): FlyLook | undefined {
    if (!parts || flyTime === undefined) return undefined;
    const look = flyLook(flyTime);
    parts.groups.near.scale.set(look.near);
    parts.groups.mid.scale.set(look.mid);
    parts.groups.far.scale.set(look.far);
    parts.groups.pane.alpha = look.paneAlpha;
    parts.tunnel.alpha = look.tunnelAlpha;
    parts.streaks.forEach(([group, sprite], index) => {
      const { scale, opacity } = streakLook(flyTime ?? 0, index === 1);
      group.scale.set(scale);
      sprite.alpha = opacity;
    });
    parts.whip.alpha = look.whipAlpha;
    parts.whip.scale.set(look.whipScale);
    return look;
  }

  const scene: TitleScene = {
    name: TITLE_SCENE_NAME,
    fit: "height",
    assets: PICTURES,
    create(sceneEnv) {
      env = sceneEnv;
      reduced = sceneEnv.reducedMotion();
      time = 0;
      drawn = false;
      return build();
    },
    enter() {
      scene.update(0);
    },
    leave() {
      parts = undefined;
      drawn = false;
    },
    update(deltaMs) {
      if (!parts) return;
      if (!reduced) time += deltaMs;
      let look: FlyLook | undefined;
      if (flyTime !== undefined) {
        flyTime += deltaMs;
        look = showFly();
      }
      showDecor();
      drawn = true;
      if (look) listener?.(look);
      if (flyTime !== undefined && flyTime >= WHIP_MS && flyDone) {
        const done = flyDone;
        flyDone = undefined;
        done();
      }
    },
    ready: () => parts !== undefined && drawn,
    // The fly-away plays also with reduced motion, as it did before.
    animating: () => parts !== undefined && (!reduced || flyDone !== undefined),
    reducedMotionChanged(value) {
      reduced = value;
      showDecor();
      env?.invalidate();
    },
    fly(onDone) {
      if (flyTime !== undefined) return () => {};
      flyTime = 0;
      flyDone = onDone;
      env?.invalidate();
      return () => {
        flyTime = undefined;
        flyDone = undefined;
      };
    },
    watchFly(next) {
      listener = next;
    },
  };
  return scene;
}

export const titleScene = createTitleScene();
