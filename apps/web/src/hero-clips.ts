import { HeroClass } from "game-core";

// The Hero clips of docs/design/animation: plain keyframe data per rig part, and the pure sampling of it. The numbers
// are the CSS @keyframes of reference/*.html translated one to one (px at game size, CSS degrees, clockwise).

export type ClipName =
  | "idle"
  | "walk"
  | "wait"
  | "attack"
  | "longShot"
  | "tagRound"
  | "slowPulse"
  | "block"
  | "hit"
  | "absorb";

/** `rig` moves the whole figure (the knock-back of a Hit); `flash` is the white flash and `ring` the red flash of the Squad ring. */
export const PARTS = ["torso", "head", "armF", "armB", "legL", "legR", "cape", "pause", "rig", "flash", "ring"] as const;
export type PartName = (typeof PARTS)[number];

export const PROPS = ["x", "y", "rotation", "scaleX", "scaleY", "alpha"] as const;
export type PropName = (typeof PROPS)[number];

/** Offsets (x, y) from the rest position of the part, rotation in degrees, scale and alpha absolute. */
export type PartPose = Record<PropName, number>;
export type Pose = Record<PartName, PartPose>;

export type Easing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

/** From this time (a fraction of the duration) the value eases to the next keyframe with `ease`. */
export interface Keyframe {
  at: number;
  value: number;
  ease: Easing;
}

export interface Track {
  part: PartName;
  prop: PropName;
  keys: readonly Keyframe[];
}

export interface Clip {
  name: ClipName;
  durationMs: number;
  loop: boolean;
  /** A Walk: half a cycle is one tile step, so the player runs it at the pace of the playback steps. */
  perStep: boolean;
  /** Where the Hero is back at rest (the "active end"): the Tick lasts at least until then. Looping clips: one cycle. */
  activeEndMs: number;
  /** The beat of an attack where the shot leaves, from the start of the clip. */
  fireMs?: number;
  tracks: readonly Track[];
}

/** The pose a part has when no clip moves it; the arms hang at their rest angles, the grey II mark is hidden. */
const REST_PART: PartPose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 };
const REST_ROTATION: Partial<Record<PartName, number>> = { armF: -30, armB: 4 };
/** Overlays that show only while a clip moves them. */
const HIDDEN_AT_REST: ReadonlySet<PartName> = new Set(["pause", "flash", "ring"]);

export function restPart(part: PartName): PartPose {
  return { ...REST_PART, rotation: REST_ROTATION[part] ?? 0, alpha: HIDDEN_AT_REST.has(part) ? 0 : 1 };
}

export function createPose(): Pose {
  return Object.fromEntries(PARTS.map((part) => [part, restPart(part)])) as Pose;
}

/** Resets a pose to the rest pose without allocating. */
export function restPoseInto(pose: Pose): Pose {
  for (const part of PARTS) {
    const target = pose[part];
    target.x = 0;
    target.y = 0;
    target.rotation = REST_ROTATION[part] ?? 0;
    target.scaleX = 1;
    target.scaleY = 1;
    target.alpha = HIDDEN_AT_REST.has(part) ? 0 : 1;
  }
  return pose;
}

// ---- Easing: the CSS cubic beziers -----------------------------------------------------------------------------------

const BEZIER: Record<Exclude<Easing, "linear">, readonly [number, number, number, number]> = {
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

function bezier(a: number, b: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

/** The eased progress (0 to 1) of a linear progress, as `cubic-bezier` does it in CSS. */
export function ease(easing: Easing, progress: number): number {
  if (easing === "linear") return progress;
  const [x1, y1, x2, y2] = BEZIER[easing];
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (bezier(x1, x2, mid) < progress) low = mid;
    else high = mid;
  }
  return bezier(y1, y2, (low + high) / 2);
}

// ---- Sampling --------------------------------------------------------------------------------------------------------

function sampleTrack(keys: readonly Keyframe[], fraction: number): number {
  const first = keys[0]!;
  if (fraction <= first.at) return first.value;
  for (let i = 1; i < keys.length; i++) {
    const to = keys[i]!;
    if (fraction <= to.at) {
      const from = keys[i - 1]!;
      const eased = ease(from.ease, (fraction - from.at) / (to.at - from.at));
      return from.value + (to.value - from.value) * eased;
    }
  }
  return keys[keys.length - 1]!.value;
}

/** Writes the value of every track of `clip` at `ms` into `pose` (rest where no track moves a property). Allocation free. */
export function sampleClipInto(clip: Clip, ms: number, pose: Pose): Pose {
  restPoseInto(pose);
  const time = clip.loop ? ms % clip.durationMs : Math.min(ms, clip.durationMs);
  const fraction = time / clip.durationMs;
  for (const track of clip.tracks) pose[track.part][track.prop] = sampleTrack(track.keys, fraction);
  return pose;
}

/** The pose of every part of a clip at a time in milliseconds from its start. Pure. */
export function sampleClip(clip: Clip, ms: number): Pose {
  return sampleClipInto(clip, ms, createPose());
}

// ---- Clip data -------------------------------------------------------------------------------------------------------

/** Keyframes the way the CSS writes them: a value and the percentages at which it holds, `[value, [0, 100]]`. */
type Frames = readonly (readonly [value: number, percents: readonly number[]])[];

function keys(easing: Easing, frames: Frames): Keyframe[] {
  return frames
    .flatMap(([value, percents]) => percents.map((percent) => ({ at: percent / 100, value, ease: easing })))
    .sort((a, b) => a.at - b.at);
}

function track(part: PartName, prop: PropName, easing: Easing, frames: Frames): Track {
  return { part, prop, keys: keys(easing, frames) };
}

const IDLE_TRACKS = (cape: boolean): Track[] => [
  track("torso", "x", "ease-in-out", [[0, [0, 100]], [0.8, [50]]]),
  track("torso", "y", "ease-in-out", [[0, [0, 100]], [-2, [50]]]),
  track("torso", "scaleY", "ease-in-out", [[1, [0, 100]], [1.05, [50]]]),
  track("head", "y", "ease-in-out", [[0, [0, 100]], [-1.4, [50]]]),
  track("head", "rotation", "ease-in-out", [[0, [0, 100]], [-4, [50]]]),
  track("armF", "rotation", "ease-in-out", [[-30, [0, 100]], [-40, [50]]]),
  track("armB", "rotation", "ease-in-out", [[4, [0, 100]], [14, [50]]]),
  track("legL", "rotation", "ease-in-out", [[0, [0, 100]], [-4, [50]]]),
  track("legR", "rotation", "ease-in-out", [[0, [0, 100]], [4, [50]]]),
  ...(cape ? [track("cape", "rotation", "ease-in-out", [[0, [0, 100]], [4, [50]]])] : []),
];

const WALK_TRACKS = (cape: boolean): Track[] => [
  track("legL", "rotation", "linear", [[-30, [0, 100]], [30, [50]]]),
  track("legR", "rotation", "linear", [[30, [0, 100]], [-30, [50]]]),
  track("torso", "rotation", "linear", [[5, [0, 25, 50, 75, 100]]]),
  track("torso", "y", "linear", [[0, [0, 50, 100]], [-1.5, [25, 75]]]),
  track("armF", "rotation", "linear", [[-48, [0, 100]], [-30, [50]]]),
  track("armB", "rotation", "linear", [[30, [0, 100]], [-30, [50]]]),
  track("head", "y", "linear", [[0, [0, 50, 100]], [-0.8, [25, 75]]]),
  // The Assassin's half-cape streams behind it while it runs.
  ...(cape ? [track("cape", "rotation", "ease-in-out", [[-16, [0, 100]], [-6, [50]]])] : []),
];

const WAIT_TRACKS = (cape: boolean): Track[] => [
  track("head", "rotation", "ease-in-out", [[0, [0, 18, 50, 62, 92, 100]], [-14, [26, 38]], [14, [70, 82]]]),
  track("legR", "rotation", "ease-in-out", [[0, [0, 6, 14, 22, 100]], [-10, [10, 18]]]),
  track("armF", "rotation", "ease-in-out", [[-12, [0, 100]]]),
  track("pause", "alpha", "ease-in-out", [[1, [0, 50, 100]], [0.45, [25, 75]]]),
  // The reference sways the cape with a 2 s loop; the Wait loop is 3.2 s, so the cape sways once per loop here.
  ...(cape ? [track("cape", "rotation", "ease-in-out", [[0, [0, 100]], [4, [50]]])] : []),
];

function clip(name: ClipName, durationMs: number, tracks: Track[]): Clip {
  return { name, durationMs, loop: true, perStep: name === "walk", activeEndMs: durationMs, tracks };
}

/** A clip that plays one pass and rests; `activeEndMs` is where the Hero is back at rest, `fireMs` where the shot leaves. */
function once(name: ClipName, durationMs: number, activeEndMs: number, tracks: Track[], fireMs?: number): Clip {
  return { name, durationMs, loop: false, perStep: false, activeEndMs, ...(fireMs !== undefined && { fireMs }), tracks };
}

function capeTrack(easing: Easing, frames: Frames): Track[] {
  return [track("cape", "rotation", easing, frames)];
}

// ---- Attacks (the a-*, ps-*, ls-* and pb-* keyframes of the reference pages) ------------------------------------------

/** Bruiser Slam Shot: a heavy lean back into the recoil. */
const SLAM_SHOT = (): Track[] => [
  track("torso", "x", "ease-out", [[0, [0, 10, 52, 64, 100]], [-1, [22]], [-3, [26]], [-2, [36]]]),
  track("torso", "rotation", "ease-out", [[0, [0, 10, 64, 100]], [-5, [22]], [-9, [26]], [-6, [36]], [-1, [52]]]),
  track("armF", "rotation", "ease-out", [[-30, [0, 10, 66, 100]], [-92, [22]], [-108, [26]], [-96, [38]], [-45, [56]]]),
  track("legL", "rotation", "ease-out", [[0, [0, 10, 60, 100]], [10, [22, 40]]]),
  track("legR", "rotation", "ease-out", [[0, [0, 10, 60, 100]], [-10, [22, 40]]]),
  track("head", "rotation", "ease-out", [[0, [0, 10, 60, 100]], [3, [22, 40]], [-4, [26]]]),
];

/** Assassin Precision Shot: light and quick, little recoil. */
const PRECISION_SHOT = (): Track[] => [
  track("torso", "x", "ease-out", [[0, [0, 12, 56, 100]], [-0.5, [22, 40]], [-1.5, [26]]]),
  track("torso", "rotation", "ease-out", [[0, [0, 12, 56, 100]], [-2, [22]], [-4, [26]], [-1, [40]]]),
  track("armF", "rotation", "ease-out", [[-30, [0, 12, 68, 100]], [-92, [22, 42]], [-98, [26]], [-40, [58]]]),
  ...capeTrack("ease-out", [[0, [0, 24, 50, 100]], [-10, [28]], [4, [38]]]),
];

/** Assassin Long Shot: kneels, holds the scope, the glint, the shot, stands up. */
const LONG_SHOT = (): Track[] => [
  track("torso", "x", "ease-in-out", [[0, [0, 8, 88, 100]], [2, [22, 44, 72]], [-1, [46]], [1.5, [54]]]),
  track("torso", "y", "ease-in-out", [[0, [0, 8, 88, 100]], [4, [22, 44, 46, 54, 72]]]),
  track("torso", "rotation", "ease-in-out", [[0, [0, 8, 88, 100]], [7, [22, 44, 72]], [1, [46]], [6, [54]]]),
  track("legL", "rotation", "ease-in-out", [[0, [0, 8, 88, 100]], [12, [22, 72]]]),
  track("legR", "rotation", "ease-in-out", [[0, [0, 8, 88, 100]], [-75, [22, 72]]]),
  track("armF", "rotation", "ease-in-out", [[-30, [0, 8, 88, 100]], [-91, [22, 44, 54, 72]], [-100, [46]]]),
  track("armB", "rotation", "ease-in-out", [[4, [0, 8, 88, 100]], [-84, [22, 72]]]),
  track("head", "rotation", "ease-in-out", [[0, [0, 8, 88, 100]], [6, [22, 72]]]),
  ...capeTrack("ease-in-out", [[0, [0, 8, 88, 100]], [12, [22, 72]], [-12, [46]]]),
  track("cape", "scaleY", "ease-in-out", [[1, [0, 8, 88, 100]], [0.7, [22, 46, 72]]]),
];

/** Controller Pulse Bolt, Tag Round and Slow pulse: the arm comes up steadily and the emitter fires. */
const PULSE_BOLT = (): Track[] => [
  track("torso", "x", "ease-out", [[0, [0, 10, 22, 56, 100]], [-2, [26]], [-1, [38]]]),
  track("torso", "rotation", "ease-out", [[0, [0, 10, 56, 100]], [-2, [22]], [-6, [26]], [-3, [38]]]),
  track("armF", "rotation", "ease-out", [[-30, [0, 10, 68, 100]], [-88, [22]], [-100, [26]], [-90, [40]], [-40, [58]]]),
];

// ---- Block and the reactions (b-*, h-*, s-*) --------------------------------------------------------------------------

/** Crouch behind both arms raised; the bubble and rubies come from the Shield marks. */
const BLOCK = (cape: boolean): Track[] => [
  track("torso", "y", "ease-out", [[0, [0, 10, 90, 100]], [3, [22, 78]]]),
  track("torso", "rotation", "ease-out", [[0, [0, 10, 90, 100]], [5, [22, 78]]]),
  track("legL", "rotation", "ease-out", [[0, [0, 10, 90, 100]], [28, [22, 78]]]),
  track("legR", "rotation", "ease-out", [[0, [0, 10, 90, 100]], [-28, [22, 78]]]),
  track("armF", "rotation", "ease-out", [[-30, [0, 10, 90, 100]], [-125, [22, 78]]]),
  track("armB", "rotation", "ease-out", [[4, [0, 10, 90, 100]], [-105, [22, 78]]]),
  ...(cape
    ? [
        track("cape", "rotation", "ease-out", [[0, [0, 10, 90, 100]], [22, [22, 78]]]),
        track("cape", "scaleX", "ease-out", [[1, [0, 10, 90, 100]], [1.3, [22, 78]]]),
      ]
    : []),
];

/** Hit: white flash, knock-back, the head snaps, the Squad ring flashes red. */
const HIT = (cape: boolean): Track[] => [
  track("rig", "x", "ease-out", [[0, [0, 10, 50, 100]], [-5, [14]], [-2, [24]], [-3, [34]]]),
  // The reference flashes brightness for 50 ms; a white overlay stands for it (no filters).
  track("flash", "alpha", "ease-out", [[0, [0, 12, 16, 100]], [1, [14]]]),
  track("ring", "alpha", "ease-out", [[0, [0, 10, 44, 100]], [1, [14, 30]]]),
  track("torso", "rotation", "ease-out", [[0, [0, 10, 52, 100]], [-16, [14]], [-8, [30]]]),
  track("head", "rotation", "ease-out", [[0, [0, 10, 56, 100]], [-22, [14]], [-8, [34]]]),
  track("armF", "rotation", "ease-out", [[-30, [0, 10, 52, 100]], [-5, [14]], [-15, [30]]]),
  track("armB", "rotation", "ease-out", [[4, [0, 10, 52, 100]], [50, [14]], [25, [30]]]),
  ...(cape ? capeTrack("ease-out", [[0, [0, 10, 50, 100]], [-34, [14]], [8, [30]]]) : []),
];

/** Hit, Shield absorbs: a small shake, no flash and no knock-back. */
const ABSORB = (): Track[] => [track("rig", "x", "ease-out", [[0, [0, 10, 24, 100]], [-1.5, [13]], [1, [18]]])];

const pulse = (name: ClipName, durationMs: number, activeEndMs: number): Clip =>
  once(name, durationMs, activeEndMs, PULSE_BOLT(), Math.round((durationMs * 0.26) / 10) * 10);

/** Bruiser and Controller share their basic clips: the antenna of the Controller sways because it hangs on the leaning torso. */
function basics(cape: boolean): Partial<Record<ClipName, Clip>> {
  return {
    idle: clip("idle", 2000, IDLE_TRACKS(cape)),
    walk: clip("walk", cape ? 500 : 640, WALK_TRACKS(cape)),
    wait: clip("wait", 3200, WAIT_TRACKS(cape)),
    block: once("block", 3200, 2900, BLOCK(cape)),
    hit: once("hit", 2600, 1350, HIT(cape)),
    absorb: once("absorb", 2600, 830, ABSORB()),
  };
}

const PLAIN = basics(false);
/** The Assassin is lighter and quicker: a 500 ms stride, and the cape moves. */
const CAPED = basics(true);

const CLIPS: Record<HeroClass, Partial<Record<ClipName, Clip>>> = {
  [HeroClass.Bruiser]: { ...PLAIN, attack: once("attack", 2400, 1540, SLAM_SHOT(), 620) },
  [HeroClass.Controller]: {
    ...PLAIN,
    attack: pulse("attack", 2400, 1630),
    tagRound: pulse("tagRound", 2800, 1400),
    slowPulse: pulse("slowPulse", 2600, 2180),
  },
  [HeroClass.Assassin]: {
    ...CAPED,
    attack: once("attack", 2200, 1450, PRECISION_SHOT(), 570),
    longShot: once("longShot", 3600, 3170, LONG_SHOT(), 1650),
  },
};

/** The clip of a Hero class; a clip the class does not have (a Long Shot of a Bruiser) is its basic attack. */
export function clipOf(heroClass: HeroClass, name: ClipName): Clip {
  const clips = CLIPS[heroClass];
  return clips[name] ?? clips.attack!;
}

/** The attack clip for a card: Long Shot and Tag Round have their own, every other card uses its class's basic attack. */
export function attackClipName(card: string | undefined): ClipName {
  if (card === "Long Shot") return "longShot";
  if (card === "Tag Round") return "tagRound";
  return "attack";
}
