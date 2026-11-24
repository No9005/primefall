import { Assets, Container, Graphics, Rectangle, type Spritesheet, Sprite, Texture } from "pixi.js";
import { parseAtlas } from "./atlas";
import { AtlasAnimator, type AtlasSheet } from "./atlas-animator";
import {
  type HangarHero,
  type HangarHeroes,
  HANGAR_HEROES,
  type HeroPlayer,
  isLooped,
} from "./hangar-select";
import { BRIDGE_SHADOWS, CLIP_SHADOWS, SHADOW_FLAT, SHADOW_LIFT, type ShadowSpot } from "./hangar-shadows";
import type { Scene, SceneEnv } from "./stage";

// The hangar of the Hero Select as a scene on the stage (ADR 0026; design: docs/design/decisions.md, the Hero Select rows).
// The picture is drawn in design pixels (the frame is 960 x 444), 104 above the frame and continued on all sides. The scene only shows: the
// machine of the three Heroes (hangar-select.ts) belongs to the screen, which hands it over with `attach`. All motion follows the stage ticker.

export const HANGAR_SCENE_NAME = "hangar";

const ART = `${import.meta.env.BASE_URL}assets/hangar/`;
/** How far the hangar's picture is moved up: the floor continues below the bottom edge of the frame. */
export const HANGAR_SHIFT = 104;
const PICTURE = { width: 960, height: 444, tall: 549 };
const BACKDROP = 0x080a12;

/** Where each Hero stands in the picture and where it is tapped (design pixels inside the moved picture). */
export const PLACE: Record<HangarHero, { left: number; top: number; width: number; height: number; hit: { left: number; top: number; width: number; height: number; z?: number } }> = {
  max: { left: 105, top: 89, width: 482.3, height: 284.3, hit: { left: 105, top: 150, width: 285, height: 230 } },
  tilly: { left: 332.8, top: 83.8, width: 345.2, height: 294.5, hit: { left: 400, top: 130, width: 200, height: 250, z: 3 } },
  kit: { left: 572.4, top: 140.4, width: 345.2, height: 299.5, hit: { left: 690, top: 190, width: 200, height: 230, z: 3 } },
};
/** The name plates on the floor: where each stands and how large, in the plain and the chosen state. */
const NAME_PLATE: Record<HangarHero, { left: number; top: number; width: number; height: number }> = {
  max: { left: 141.75, top: 346.5, width: 210, height: 88.5 },
  tilly: { left: 375, top: 346.5, width: 210, height: 88.5 },
  kit: { left: 677.25, top: 318.75, width: 135, height: 52.5 },
};
/**
 * The ring around Kit when he is chosen: on the floor around his feet (he lands in front of the crate). The crate stands behind him, so the part of
 * the ring that would lie on the crate (above its lower edge, y 386) is not drawn.
 */
const KIT_RING = { left: 639.75, top: 374.5, width: 210, height: 45 };
const CRATE_BOTTOM = 386;
const MOTES: readonly [number, number, number, number][] = [
  [443, 338, 10.8, -10.2], [269, 359, 10.7, -2.7], [287, 300, 6.7, -3.1], [436, 343, 9.3, -5.3], [257, 311, 8.4, -1.5], [546, 300, 10.6, -0.8], [589, 294, 6.8, -6.6], [251, 310, 10.6, -10.2],
  [374, 302, 7.7, -7.4], [404, 304, 11.6, -8.0], [542, 327, 6.1, -2.5], [359, 320, 6.4, -1.9], [250, 384, 10.1, -3.4], [485, 338, 10.9, -5.2], [490, 305, 8.9, -6.3], [291, 319, 11.9, -0.3],
];
/** The lamps and beacons: the file, the length of the blink in seconds and its delay (negative: the blink is already under way). */
const LAMPS: readonly [string, number, number][] = [["a", 1.6, 0], ["b", 2.1, -0.7], ["c", 2.9, -1.3], ["d", 1.6, -0.4]];
const SPARKS: readonly { left: number; top: number; seconds: number; delay: number }[] = [
  { left: 126, top: 319, seconds: 3.7, delay: 0.6 },
  { left: 111, top: 209, seconds: 5.3, delay: 2.1 },
];
const SPARK_FRAME = 84;
const SPARK_STEP_PERCENT = 2.4;
const SPARK_END_PERCENT = 14;
const GUIDE = { left: 90, top: 168.75, width: 78.75, height: 26.25, frames: 6, frameMs: 200 };
const DOOR = { left: 384, top: 103.5, width: 192, height: 172.5 };
const CRYSTAL = { size: 30, seconds: 11, delay: 3 };

const ATLASES: Record<HangarHero, string> = {
  max: `${ART}atlas/max.json`,
  tilly: `${ART}atlas/tilly.json`,
  kit: `${ART}atlas/kit.json`,
};
const PICTURES = [
  "hangar-wide", "fire", "lights-a", "lights-b", "lights-c", "lights-d", "lights-flicker", "guide", "spark", "shade-back", "shade-front", "glow", "shadow", "kit-ring",
  ...HANGAR_HEROES.flatMap((hero) => [`name-${hero}`, `name-${hero}-selected`]),
].map((name) => `${ART}${name}.png`);

// --- Motion that CSS animations made before: each is a pure function of the scene's time -----------------------------------------------

/** The value of a keyframe list at `percent` of a cycle when it jumps from one keyframe to the next (`steps(1, end)`). */
export function stepValue(keyframes: readonly (readonly [number, number])[], percent: number): number {
  let value = keyframes[0]?.[1] ?? 0;
  for (const [at, next] of keyframes) if (at <= percent) value = next;
  return value;
}

/** Where a looped animation of `seconds` and `delay` (seconds) is at `timeMs`, in percent of its cycle; undefined before a positive delay is over. */
export function cyclePercent(timeMs: number, seconds: number, delay: number): number | undefined {
  const time = timeMs / 1000 - delay;
  if (time < 0) return undefined;
  return ((time % seconds) / seconds) * 100;
}

/** A blinking lamp: lit for half of the cycle, dim for the other half. */
export const lampOpacity = (timeMs: number, seconds: number, delay: number): number => ((cyclePercent(timeMs, seconds, delay) ?? 0) < 50 ? 1 : 0.08);

const FLICKER: readonly (readonly [number, number])[] = [[0, 1], [7, 0.5], [9, 1], [40, 1], [43, 0.65], [45, 1], [71, 1], [72, 0.4], [74, 1]];
export const flickerOpacity = (timeMs: number): number => stepValue(FLICKER, cyclePercent(timeMs, 5.3, 0) ?? 0);

const BROWN: readonly (readonly [number, number])[] = [[0, 1], [61, 1], [61.5, 0.55], [63, 1], [64, 0.7], [65, 1]];
/** The shade in front of and behind the Heroes dims now and then. */
export const shadeOpacity = (timeMs: number): number => stepValue(BROWN, cyclePercent(timeMs, 9.4, 0) ?? 0);

/** The amber guide lights: one of six frames, each for 200 ms. */
export const guideFrame = (timeMs: number): number => Math.floor(timeMs / GUIDE.frameMs) % GUIDE.frames;

/** The frame of a spark, or undefined while it is out. */
export function sparkFrame(timeMs: number, seconds: number, delay: number): number | undefined {
  const percent = cyclePercent(timeMs, seconds, delay);
  if (percent === undefined || percent >= SPARK_END_PERCENT) return undefined;
  return Math.min(5, Math.floor(percent / SPARK_STEP_PERCENT));
}

/** The burning crystal falls head first past the door in ten steps, then goes out; undefined while it is not there. Position is inside the door. */
export function crystalAt(timeMs: number): { x: number; y: number; opacity: number } | undefined {
  const percent = cyclePercent(timeMs, CRYSTAL.seconds, CRYSTAL.delay);
  if (percent === undefined || percent >= 8.5) return undefined;
  if (percent >= 8) return { x: 30, y: 110, opacity: 1 - Math.floor(((percent - 8) / 0.5) * 10) / 10 };
  const step = Math.floor((percent / 8) * 10) / 10;
  return { x: 160 + (30 - 160) * step, y: -30 + (110 + 30) * step, opacity: 1 };
}

/** A mote of dust rises 46 px in twelve steps over its cycle and fades in (first 15%) and out (last 15%), also in steps. */
export function moteAt(timeMs: number, seconds: number, delay: number): { rise: number; opacity: number } {
  const percent = cyclePercent(timeMs, seconds, delay) ?? 0;
  const stepped = (from: number, to: number, start: number, end: number) => from + (to - from) * (Math.floor(((percent - start) / (end - start)) * 12) / 12);
  const rise = -46 * (Math.floor((percent / 100) * 12) / 12);
  if (percent < 15) return { rise, opacity: stepped(0, 0.8, 0, 15) };
  if (percent < 85) return { rise, opacity: stepped(0.8, 0.5, 15, 85) };
  return { rise, opacity: stepped(0.5, 0, 85, 100) };
}

/** The rectangle of a contact shadow (design pixels inside the box of a Hero) from a spot of the bridge tables: [x of the middle, y of the contact, width]. */
function spotRect(spot: ShadowSpot): [number, number, number, number] | undefined {
  if (!spot) return undefined;
  const [x, y, width] = spot;
  const height = width * SHADOW_FLAT;
  return [x - width / 2, y - height * SHADOW_LIFT, width, height];
}

/** The shadow in one frame of a clip: its rectangle, or undefined while the Hero is off the ground. */
export function clipShadow(key: string, frame: number): [number, number, number, number] | undefined {
  const runs = CLIP_SHADOWS[key];
  if (!runs) return undefined;
  let found = runs[0];
  for (const run of runs) if (run[0] <= frame) found = run;
  return found && found.length === 5 ? [found[1], found[2], found[3], found[4]] : undefined;
}

export function bridgeShadow(hero: HangarHero, from: "idle" | "act", index: number): [number, number, number, number] | undefined {
  return spotRect(BRIDGE_SHADOWS[`${hero}-${from}`]?.[index] ?? null);
}

// --- The scene -------------------------------------------------------------------------------------------------------------------------

/** What the scene needs of the loaded art; PixiJS's loader in the app, fakes in tests. */
export interface HangarArt {
  texture(url: string): Texture;
  sheet(hero: HangarHero): AtlasSheet;
}

export const pixiHangarArt: HangarArt = {
  texture: (url) => Assets.get<Texture>(url),
  sheet: (hero) => Assets.get<Spritesheet>(ATLASES[hero]),
};

export interface HangarScene extends Scene {
  /** Hands over the three Heroes the screen owns (or takes them back with `undefined`); the scene moves their clock and shows their state. */
  attach(heroes: HangarHeroes | undefined): void;
  /** The Heroes changed while the ticker is not running (reduced motion): draws one more frame. */
  invalidate(): void;
}

interface HeroView {
  animator: AtlasAnimator;
  bridge: Sprite;
  shadow: Sprite;
  sheet: AtlasSheet;
  /** What is on show now, so that a change starts a clip. */
  shown: string;
}

const pictureOf = (art: HangarArt, name: string): Texture => {
  const texture = art.texture(`${ART}${name}.png`);
  texture.source.scaleMode = "nearest";
  return texture;
};

function placed(texture: Texture, left: number, top: number, width: number, height: number): Sprite {
  const sprite = new Sprite(texture);
  sprite.position.set(left, top);
  sprite.width = width;
  sprite.height = height;
  return sprite;
}

/** One frame of a strip of equal frames laid side by side. */
function stripFrame(texture: Texture, frames: number, index: number): Texture {
  const width = texture.width / frames;
  return new Texture({ source: texture.source, frame: new Rectangle(texture.frame.x + index * width, texture.frame.y, width, texture.height) });
}

interface HangarParts {
  lamps: { sprite: Sprite; seconds: number; delay: number }[];
  flicker: Sprite;
  guide: { sprite: Sprite; frames: Texture[] };
  crystal: Sprite;
  motes: { sprite: Sprite; seconds: number; delay: number; top: number }[];
  sparks: { sprite: Sprite; frames: Texture[]; seconds: number; delay: number }[];
  shades: Sprite[];
  plates: Record<HangarHero, { sprite: Sprite; plain: Texture; chosen: Texture }>;
  ring: Sprite;
  heroes: Record<HangarHero, HeroView>;
}

/** Where the scene's pieces go: the container that holds the picture (shifted up) and how a picture is looked up. */
interface BuildContext {
  shift: Container;
  picture: (name: string) => Texture;
}

const screen = (sprite: Sprite): Sprite => {
  sprite.blendMode = "screen";
  return sprite;
};

/** The floor picture and the door with the falling crystal behind its mask. Returns the crystal. */
function addFloorAndDoor({ shift, picture }: BuildContext): Sprite {
  // The floor picture is the hangar continued on all sides (hangar-wide.png, 2080 x 1052 pixels at 0.75): 300 px to the sides, 90 above, 150 below.
  shift.addChild(placed(picture("hangar-wide"), -300, -90, 1560, 789));

  const door = new Container();
  door.position.set(DOOR.left, DOOR.top);
  const doorMask = new Graphics().rect(0, 0, DOOR.width, DOOR.height).fill(0xffffff);
  const crystal = new Sprite(picture("fire"));
  crystal.anchor.set(0.5);
  crystal.width = CRYSTAL.size;
  crystal.height = CRYSTAL.size;
  crystal.rotation = Math.PI; // the head leads: the picture has its head at the top right and falls to the lower left
  crystal.visible = false;
  door.addChild(doorMask, crystal);
  door.mask = doorMask;
  shift.addChild(door);
  return crystal;
}

/** The lamps, the flicker and the guide light, all added over the floor with the "screen" blend. */
function addLights({ shift, picture }: BuildContext): Pick<HangarParts, "lamps" | "flicker" | "guide"> {
  const lamps = LAMPS.map(([name, seconds, delay]) => {
    const sprite = screen(placed(picture(`lights-${name}`), 0, 0, PICTURE.width, PICTURE.height));
    shift.addChild(sprite);
    return { sprite, seconds, delay };
  });
  const flicker = screen(placed(picture("lights-flicker"), 0, 0, PICTURE.width, PICTURE.height));
  shift.addChild(flicker);

  const guideTexture = picture("guide");
  const guideFrames = Array.from({ length: GUIDE.frames }, (_, index) => stripFrame(guideTexture, GUIDE.frames, index));
  const guideSprite = screen(placed(guideFrames[0] as Texture, GUIDE.left, GUIDE.top, GUIDE.width, GUIDE.height));
  shift.addChild(guideSprite);
  return { lamps, flicker, guide: { sprite: guideSprite, frames: guideFrames } };
}

/** The dust motes and the sparks. */
function addDustAndSparks({ shift, picture }: BuildContext): Pick<HangarParts, "motes" | "sparks"> {
  const motes = MOTES.map(([left, top, seconds, delay]) => {
    const sprite = placed(Texture.WHITE, left, top, 2, 2);
    sprite.tint = 0x9cc8ff;
    sprite.alpha = 0;
    shift.addChild(sprite);
    return { sprite, seconds, delay, top };
  });

  const sparkTexture = picture("spark");
  const sparks = SPARKS.map(({ left, top, seconds, delay }) => {
    const frames = Array.from({ length: 6 }, (_, index) => stripFrame(sparkTexture, 6, index));
    const sprite = placed(frames[0] as Texture, left, top, SPARK_FRAME, SPARK_FRAME);
    sprite.visible = false;
    shift.addChild(sprite);
    return { sprite, frames, seconds, delay };
  });
  return { motes, sparks };
}

/** The name plates and, for Kit, the ring of the crate, cut at the bottom of the crate. */
function addPlatesAndRing({ shift, picture }: BuildContext): Pick<HangarParts, "plates" | "ring"> {
  const plates = Object.fromEntries(
    HANGAR_HEROES.map((hero) => {
      const { left, top, width, height } = NAME_PLATE[hero];
      const plain = picture(`name-${hero}`);
      const sprite = placed(plain, left, top, width, height);
      shift.addChild(sprite);
      return [hero, { sprite, plain, chosen: picture(`name-${hero}-selected`) }];
    }),
  ) as HangarParts["plates"];

  const ringTexture = picture("kit-ring");
  const cut = ((CRATE_BOTTOM - KIT_RING.top) / KIT_RING.height) * ringTexture.height;
  const ringCropped = new Texture({ source: ringTexture.source, frame: new Rectangle(ringTexture.frame.x, ringTexture.frame.y + cut, ringTexture.width, ringTexture.height - cut) });
  const ring = placed(ringCropped, KIT_RING.left, CRATE_BOTTOM, KIT_RING.width, KIT_RING.top + KIT_RING.height - CRATE_BOTTOM);
  ring.visible = false;
  shift.addChild(ring);
  return { plates, ring };
}

/** The three Heroes: first the shadows (below every figure), then the animated figures with their bridge frame. */
function addHeroes({ shift, picture }: BuildContext, art: HangarArt, reduced: boolean): HangarParts["heroes"] {
  const shadowTexture = picture("shadow");
  const views = {} as HangarParts["heroes"];
  for (const hero of HANGAR_HEROES) {
    const shadow = new Sprite(shadowTexture);
    shadow.visible = false;
    shift.addChild(shadow);
    views[hero] = { animator: undefined as unknown as AtlasAnimator, bridge: new Sprite(), shadow, sheet: art.sheet(hero), shown: "" };
  }
  for (const hero of HANGAR_HEROES) {
    const view = views[hero];
    const { left, top, width, height } = PLACE[hero];
    const sourceWidth = Object.values(parseAtlas(view.sheet.data).frames)[0]?.sourceSize.w ?? width;
    const scale = width / sourceWidth;
    const animator = new AtlasAnimator(view.sheet);
    animator.setScale(scale);
    animator.setReducedMotion(reduced);
    animator.container.position.set(left + width / 2, top + height);
    view.animator = animator;
    view.bridge.scale.set(scale);
    view.bridge.position.set(left + width / 2, top + height);
    view.bridge.visible = false;
    shift.addChild(animator.container, view.bridge);
  }
  return views;
}

/** Builds the whole scene, back to front: backdrop, floor and door, lights, dust and sparks, the shade behind, plates, Heroes, the shade in front. */
function buildHangar(art: HangarArt, reduced: boolean): { root: Container; parts: HangarParts } {
  const root = new Container();
  const backdrop = new Graphics().rect(-3000, -2000, 7000, 5000).fill(BACKDROP);
  const shift = new Container();
  shift.y = -HANGAR_SHIFT;
  root.addChild(backdrop, shift);
  const context: BuildContext = { shift, picture: (name) => pictureOf(art, name) };

  const crystal = addFloorAndDoor(context);
  const lights = addLights(context);
  const dust = addDustAndSparks(context);
  const shadeBack = placed(context.picture("shade-back"), 0, 0, PICTURE.width, PICTURE.tall);
  const glow = screen(placed(context.picture("glow"), 0, 0, PICTURE.width, PICTURE.tall));
  shift.addChild(shadeBack, glow);
  const platesAndRing = addPlatesAndRing(context);
  const heroes = addHeroes(context, art, reduced);
  const shadeFront = placed(context.picture("shade-front"), 0, 0, PICTURE.width, PICTURE.tall);
  shift.addChild(shadeFront);

  return { root, parts: { ...lights, ...dust, ...platesAndRing, crystal, shades: [shadeBack, shadeFront], heroes } };
}

/** The layers of a clip that has effects of its own (`<clip>.fx_back`, `<clip>.fx_front`), back to front with the figure between; a clip without them is the figure alone. */
function layersOf(sheet: AtlasSheet, clip: string): string[] {
  return [`${clip}.fx_back`, clip, `${clip}.fx_front`].filter((name) => sheet.animations[name]);
}

/** Puts what the machine says on the Heroes: a clip starts when the mode changes; a bridge shows one of its two frames. */
function showHeroes(parts: HangarParts, heroes: HangarHeroes, deltaMs: number): void {
  for (const hero of HANGAR_HEROES) showHero(parts, heroes.players[hero], hero, deltaMs);
  parts.ring.visible = heroes.players.kit.selected;
}

function showHero(parts: HangarParts, player: HeroPlayer, hero: HangarHero, deltaMs: number): void {
  const view = parts.heroes[hero];
  const { mode, bridgeEntry, bridgeHalf, bridgeFrom } = player.state;
  const key = mode === "bridge" ? `bridge-${bridgeFrom}-${bridgeEntry}-${bridgeHalf}` : mode;
  let advance = deltaMs;
  if (key !== view.shown) {
    view.shown = key;
    advance = 0;
    startShown(view, hero, player);
  }
  view.animator.update(advance);

  const rect = mode === "bridge" ? bridgeShadow(hero, bridgeFrom, bridgeEntry * 2 + bridgeHalf) : clipShadow(`${hero}-${mode}`, Math.max(0, view.animator.frame));
  view.shadow.visible = rect !== undefined;
  if (rect) {
    const { left, top } = PLACE[hero];
    view.shadow.position.set(left + rect[0], top + rect[1]);
    view.shadow.width = rect[2];
    view.shadow.height = rect[3];
  }
  const plate = parts.plates[hero];
  plate.sprite.texture = player.selected ? plate.chosen : plate.plain;
}

/** The mode changed: a bridge stops the clip and shows one still frame, any other mode plays its clip. */
function startShown(view: HeroView, hero: HangarHero, { state }: HeroPlayer): void {
  const { mode, bridgeEntry, bridgeHalf, bridgeFrom } = state;
  if (mode !== "bridge") {
    view.bridge.visible = false;
    view.animator.play(layersOf(view.sheet, `${hero}.${mode}`), { loop: isLooped(mode) });
    return;
  }
  const texture = view.sheet.animations[`${hero}.bridge.${bridgeFrom}`]?.[bridgeEntry * 2 + bridgeHalf];
  view.animator.stop();
  if (texture) {
    view.bridge.texture = texture;
    if (texture.defaultAnchor) view.bridge.anchor.copyFrom(texture.defaultAnchor);
  }
  view.bridge.visible = true;
}

/** The lamps, the flicker, the dust, the sparks, the crystal and the shade at the scene's time; without motion everything stands in its first state. */
function showDecor(parts: HangarParts, reduced: boolean, time: number): void {
  const t = reduced ? 0 : time;
  parts.lamps.forEach(({ sprite, seconds, delay }) => (sprite.alpha = reduced ? 1 : lampOpacity(t, seconds, delay)));
  parts.flicker.alpha = reduced ? 1 : flickerOpacity(t);
  parts.guide.sprite.texture = parts.guide.frames[reduced ? 0 : guideFrame(t)] as Texture;
  parts.shades.forEach((sprite) => (sprite.alpha = reduced ? 1 : shadeOpacity(t)));
  const crystal = reduced ? undefined : crystalAt(t);
  parts.crystal.visible = crystal !== undefined;
  if (crystal) {
    parts.crystal.position.set(crystal.x + CRYSTAL.size / 2, crystal.y + CRYSTAL.size / 2);
    parts.crystal.alpha = crystal.opacity;
  }
  for (const mote of parts.motes) {
    mote.sprite.visible = !reduced;
    if (reduced) continue;
    const { rise, opacity } = moteAt(t, mote.seconds, mote.delay);
    mote.sprite.y = mote.top + rise;
    mote.sprite.alpha = opacity;
  }
  for (const spark of parts.sparks) {
    const frame = reduced ? undefined : sparkFrame(t, spark.seconds, spark.delay);
    spark.sprite.visible = frame !== undefined;
    if (frame !== undefined) spark.sprite.texture = spark.frames[frame] as Texture;
  }
}

export function createHangarScene(art: HangarArt = pixiHangarArt): HangarScene {
  let env: SceneEnv | undefined;
  let heroes: HangarHeroes | undefined;
  let reduced = false;
  let time = 0;
  let synced = false;
  let parts: HangarParts | undefined;

  const scene: HangarScene = {
    name: HANGAR_SCENE_NAME,
    assets: [...PICTURES, ...Object.values(ATLASES)],
    create(sceneEnv) {
      env = sceneEnv;
      reduced = sceneEnv.reducedMotion();
      time = 0;
      synced = false;
      const built = buildHangar(art, reduced);
      parts = built.parts;
      return built.root;
    },
    enter() {
      scene.update(0);
    },
    leave() {
      parts = undefined;
      synced = false;
    },
    update(deltaMs) {
      if (!parts) return;
      if (!reduced) {
        time += deltaMs;
        heroes?.advance(deltaMs);
      }
      if (heroes) {
        showHeroes(parts, heroes, deltaMs);
        synced = true;
      }
      showDecor(parts, reduced, time);
    },
    ready: () => parts !== undefined && synced,
    animating: () => parts !== undefined && !reduced,
    reducedMotionChanged(value) {
      reduced = value;
      if (!parts) return;
      for (const hero of HANGAR_HEROES) parts.heroes[hero].animator.setReducedMotion(value);
      showDecor(parts, reduced, time);
      env?.invalidate();
    },
    attach(next) {
      heroes = next;
      synced = false;
      if (parts) scene.update(0);
      env?.invalidate();
    },
    invalidate: () => env?.invalidate(),
  };
  return scene;
}

export const hangarScene = createHangarScene();
