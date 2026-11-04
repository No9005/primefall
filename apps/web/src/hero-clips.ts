import { CoverKind, HeroClass } from "game-core";

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
  | "scoutDrone"
  | "aegis"
  | "deploy"
  | "hidden"
  | "block"
  | "hit"
  | "absorb"
  | "takeCover"
  | "takeCoverFull"
  | "inCover"
  | "inCoverFull"
  | "exhausted";

/**
 * `rig` moves the whole figure (the knock-back of a Hit, the fall of Exhaustion); `flash` is the white flash and `ring`
 * the red flash of the Squad ring, `teamRing` the Squad ring itself. `grey` is how far an Exhausted Hero has gone grey,
 * `dropGun` the rifle an Exhausted Assassin flings, `sparks` and `beaconRed` the Exhaustion of a Controller; `beacon` is
 * its yellow light (clip-driven only while Exhausted, otherwise the board blinks it). `drone` is the Scout Drone (a shape
 * of its own that flies its path, `rotor` its flickering blade) and `cloak` the cyan flash of a Hidden Assassin.
 */
export const PARTS = [
  "torso",
  "body",
  "head",
  "armF",
  "armB",
  "gun",
  "legL",
  "legR",
  "cape",
  "pause",
  "rig",
  "flash",
  "ring",
  "teamRing",
  "grey",
  "dropGun",
  "sparks",
  "beacon",
  "beaconRed",
  "drone",
  "rotor",
  "cloak",
] as const;
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
const HIDDEN_AT_REST: ReadonlySet<PartName> = new Set(["pause", "flash", "ring", "grey", "dropGun", "sparks", "beaconRed", "drone", "cloak"]);

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

// ---- Cover (the c-*, f-*, ch-*, cf-* and acf-* keyframes) ---------------------------------------------------------------

/** A Hero behind Cover keeps its knees bent and its arms up; these are the values the cover clips hold. */
const CROUCH = (): Track[] => [
  track("legL", "scaleY", "ease-in-out", [[0.5, [0, 100]]]),
  track("legL", "rotation", "ease-in-out", [[-14, [0, 100]]]),
  track("legR", "scaleY", "ease-in-out", [[0.5, [0, 100]]]),
  track("legR", "rotation", "ease-in-out", [[14, [0, 100]]]),
  track("armF", "rotation", "ease-in-out", [[-125, [0, 100]]]),
  track("armB", "rotation", "ease-in-out", [[-100, [0, 100]]]),
];

/** The half-cape of the Assassin hangs still behind Cover. */
const CAPE_STILL = (): Track[] => [track("cape", "rotation", "ease-in-out", [[-3, [0, 100]]]), track("cape", "scaleY", "ease-in-out", [[0.85, [0, 100]]])];

/** Take cover behind Half Cover: duck behind the low wall, peek both ways, stand up again. */
const TAKE_COVER_HALF = (): Track[] => [
  track("torso", "y", "ease-in-out", [[0, [0, 10, 82, 100]], [5, [24, 70]]]),
  track("legL", "scaleY", "ease-in-out", [[1, [0, 10, 82, 100]], [0.5, [24, 70]]]),
  track("legL", "rotation", "ease-in-out", [[0, [0, 10, 82, 100]], [-14, [24, 70]]]),
  track("legR", "scaleY", "ease-in-out", [[1, [0, 10, 82, 100]], [0.5, [24, 70]]]),
  track("legR", "rotation", "ease-in-out", [[0, [0, 10, 82, 100]], [14, [24, 70]]]),
  track("armF", "rotation", "ease-in-out", [[-30, [0, 10, 82, 100]], [-125, [24, 70]]]),
  track("armB", "rotation", "ease-in-out", [[4, [0, 10, 82, 100]], [-100, [24, 70]]]),
  track("head", "x", "ease-in-out", [[0, [0, 30, 70, 100]], [1, [38, 46]], [-1, [54, 62]]]),
  track("head", "y", "ease-in-out", [[0, [0, 30, 70, 100]], [-3, [38, 46, 54, 62]]]),
  track("head", "rotation", "ease-in-out", [[0, [0, 30, 70, 100]], [-12, [38, 46]], [12, [54, 62]]]),
  ...CAPE_STILL(),
];

/** Take cover behind Full Cover: slide in against the tall wall, weapon upright, lean out to look around the edge. */
const TAKE_COVER_FULL = (): Track[] => [
  track("rig", "x", "ease-in-out", [[13, [0, 94, 100]], [-2, [22, 78]]]),
  track("torso", "x", "ease-in-out", [[0, [0, 22, 78, 100]], [3, [48, 60]]]),
  track("torso", "rotation", "ease-in-out", [[0, [0, 22, 78, 100]], [9, [48, 60]]]),
  track("head", "x", "ease-in-out", [[0, [0, 22, 78, 100]], [1, [48, 60]]]),
  track("head", "rotation", "ease-in-out", [[0, [0, 22, 78, 100]], [10, [30, 42]], [-12, [48, 60]]]),
  track("armF", "rotation", "ease-in-out", [[-30, [0, 22, 78, 100]], [-168, [30, 72]]]),
  track("armB", "rotation", "ease-in-out", [[4, [0, 22, 78, 100]], [82, [30, 72]]]),
  ...CAPE_STILL(),
];

/** In cover behind Half Cover: crouched, breathing, a peek now and then. */
const IN_COVER_HALF = (): Track[] => [
  ...CROUCH(),
  track("torso", "y", "ease-in-out", [[5, [0, 100]], [4, [50]]]),
  track("head", "x", "ease-in-out", [[0, [0, 38, 84, 100]], [1, [46, 56]], [-1, [64, 74]]]),
  track("head", "y", "ease-in-out", [[0, [0, 38, 84, 100]], [-3, [46, 56, 64, 74]]]),
  track("head", "rotation", "ease-in-out", [[0, [0, 38, 84, 100]], [-12, [46, 56]], [12, [64, 74]]]),
  ...CAPE_STILL(),
];

/** In cover behind Full Cover: back to the tall wall, weapon upright, a glance around the edge now and then. */
const IN_COVER_FULL = (): Track[] => [
  track("rig", "x", "ease-in-out", [[-2, [0, 100]]]),
  track("torso", "y", "ease-in-out", [[0, [0, 100]], [-0.8, [50]]]),
  track("head", "x", "ease-in-out", [[0, [0, 48, 84, 100]], [1, [56, 74]]]),
  track("head", "rotation", "ease-in-out", [[0, [0, 48, 84, 100]], [-12, [56, 74]]]),
  track("body", "x", "ease-in-out", [[0, [0, 48, 84, 100]], [2, [56, 74]]]),
  track("body", "rotation", "ease-in-out", [[0, [0, 48, 84, 100]], [6, [56, 74]]]),
  track("armF", "rotation", "ease-in-out", [[-168, [0, 100]]]),
  track("armB", "rotation", "ease-in-out", [[82, [0, 100]]]),
  ...CAPE_STILL(),
];

/** The Assassin in Full Cover kneels and scans left and right through the scope, then stands up (acf-*). */
const ASSASSIN_IN_COVER_FULL = (): Track[] => [
  track("rig", "x", "ease-in-out", [[-2, [0, 100]]]),
  track("torso", "x", "ease-in-out", [[0, [0, 10, 84, 100]], [1, [22, 34, 58, 74]]]),
  track("torso", "y", "ease-in-out", [[0, [0, 10, 84, 100]], [5, [22, 34, 58, 74]]]),
  track("torso", "rotation", "ease-in-out", [[0, [0, 10, 84, 100]], [5, [22, 74]], [2, [34]], [9, [58]]]),
  track("legL", "rotation", "ease-in-out", [[0, [0, 10, 84, 100]], [12, [22, 74]]]),
  track("legR", "rotation", "ease-in-out", [[0, [0, 10, 84, 100]], [-75, [22, 74]]]),
  track("armF", "rotation", "ease-in-out", [[-168, [0, 10, 84, 100]], [-91, [22, 74]], [-84, [34, 62]], [-99, [46, 50]]]),
  track("armB", "rotation", "ease-in-out", [[82, [0, 10, 84, 100]], [-84, [22, 74]]]),
  track("head", "rotation", "ease-in-out", [[0, [0, 10, 84, 100]], [8, [22, 74]], [2, [34, 62]], [12, [46, 50]]]),
  ...CAPE_STILL(),
];

// ---- Exhausted (the x-*, ax-* and cox-* keyframes) -------------------------------------------------------------------

/** How a class falls: backwards for the Bruiser and the Assassin (quicker), forwards for the Controller. Times are percents of the clip. */
interface Fall {
  /** The knees have buckled. */
  buckle: number;
  /** The Hero leans into the fall. */
  tilt: number;
  /** The Hero lies on the ground. */
  fallen: number;
  /** The figure is gone: the slab has taken its place. */
  gone: number;
  /** The hit lands just before this (12 %); the Hero stands until then. */
  standsUntil: number;
  tiltAngle: number;
  fallenX: number;
  fallenY: number;
  fallenAngle: number;
  tiltX: number;
  greyHalf: number;
}

const BRUISER_FALL: Fall = { buckle: 34, tilt: 50, fallen: 62, gone: 74, standsUntil: 8, tiltAngle: -8, fallenX: -14, fallenY: 3, fallenAngle: -90, tiltX: -2, greyHalf: 0.6 };
const ASSASSIN_FALL: Fall = { buckle: 28, tilt: 40, fallen: 50, gone: 66, standsUntil: 8, tiltAngle: -10, fallenX: -14, fallenY: 3, fallenAngle: -90, tiltX: -2, greyHalf: 0.5 };
const CONTROLLER_FALL: Fall = { buckle: 34, tilt: 50, fallen: 62, gone: 74, standsUntil: 8, tiltAngle: 14, fallenX: 18, fallenY: 5, fallenAngle: 90, tiltX: 1, greyHalf: 0.6 };

/**
 * Exhausted: the hit flash at 12 % (650 ms), the knees buckle, the Hero falls and goes grey, and then the figure is gone,
 * as the body becomes the Half Cover slab the terrain draws. The Hero does not come back: the board shows the Exhausted
 * Hero as the existing flat pose afterwards.
 */
const EXHAUSTED_FALL = ({ buckle, tilt, fallen, gone, standsUntil, tiltAngle, fallenX, fallenY, fallenAngle, tiltX, greyHalf }: Fall): Track[] => {
  return [
    track("rig", "x", "ease-in-out", [[0, [0, standsUntil]], [-4, [12]], [-1, [18, buckle]], [tiltX, [tilt]], [fallenX, [fallen, gone, 100]]]),
    track("rig", "y", "ease-in-out", [[0, [0, standsUntil, 12, 18]], [5, [buckle]], [6, [tilt]], [fallenY, [fallen, gone, 100]]]),
    track("rig", "rotation", "ease-in-out", [[0, [0, buckle]], [tiltAngle, [tilt]], [fallenAngle, [fallen, gone, 100]]]),
    track("rig", "alpha", "ease-in-out", [[1, [0, fallen]], [0, [gone, 100]]]),
    track("flash", "alpha", "linear", [[0, [0, standsUntil, 18, 100]], [1, [12]]]),
    track("grey", "alpha", "ease-in-out", [[0, [0, buckle]], [greyHalf, [tilt]], [1, [fallen, 100]]]),
    track("teamRing", "alpha", "ease-in-out", [[1, [0, 56]], [0, [66, 100]]]),
    track("torso", "y", "ease-in-out", [[0, [0, 14]], [5, [30, 60]], [0, [100]]]),
    track("torso", "rotation", "ease-in-out", [[0, [0, 14]], [16, [30, 60]], [0, [100]]]),
    track("legL", "rotation", "ease-in-out", [[0, [0, 14]], [38, [30, 60]], [0, [100]]]),
    track("legR", "rotation", "ease-in-out", [[0, [0, 14]], [-38, [30, 60]], [0, [100]]]),
    track("head", "rotation", "ease-in-out", [[0, [0, 14]], [26, [30, 60]], [0, [100]]]),
    track("armF", "rotation", "ease-in-out", [[-30, [0, 14]], [14, [30, 60]], [-30, [100]]]),
    track("armB", "rotation", "ease-in-out", [[4, [0, 14]], [14, [30, 60]], [4, [100]]]),
  ];
};

/** The Assassin's rifle leaves the arm at 26 %, flies forward (1400-2800 ms), clatters and lies next to the slab. */
const ASSASSIN_RIFLE = (): Track[] => [
  track("gun", "alpha", "linear", [[1, [0, 26]], [0, [27, 100]]]),
  track("dropGun", "alpha", "linear", [[0, [0, 26, 100]], [1, [27, 86]]]),
  track("dropGun", "x", "ease-in", [[0, [0, 26, 27]], [16, [36]], [27, [44]], [30, [48]], [32, [52, 100]]]),
  track("dropGun", "y", "ease-in", [[0, [0, 26, 27]], [-8, [36]], [14, [44]], [10, [48]], [22, [52, 100]]]),
  track("dropGun", "rotation", "ease-in", [[0, [0, 26, 27]], [-120, [36]], [-220, [44]], [-250, [48]], [-270, [52, 100]]]),
];

/** The Controller's backpack sparks and its beacon goes red, then out. */
const CONTROLLER_SPARKS = (): Track[] => [
  track("sparks", "alpha", "linear", [[0, [0, 11.9, 18.1, 19.9, 28.1, 29.9, 42.1, 100]], [1, [12, 18, 20, 28, 30, 42]]]),
  track("beacon", "alpha", "linear", [[1, [0, 12]], [0, [13, 100]]]),
  track("beaconRed", "alpha", "ease-in-out", [[0, [0, 12]], [1, [14, 45]], [0, [55, 100]]]),
];

// ---- Utility gestures (the dr-*, ae-*, dp-* and hd-* keyframes) -----------------------------------------------------------

/** The rotor of the drone flickers ten times a second: full width and a third of it, every 100 ms of the 3600 ms. */
const ROTOR_FLICKER = (): Track => ({
  part: "rotor",
  prop: "scaleX",
  keys: Array.from({ length: 37 }, (_, i) => ({ at: i / 36, value: i % 2 === 0 ? 1 : 0.3, ease: "linear" as const })),
});

/** Scout Drone: the Controller taps the wrist console, the drone lifts off the backpack, flies out, hovers and returns. */
const SCOUT_DRONE = (): Track[] => [
  track("armB", "rotation", "ease-in-out", [[4, [0, 8, 30, 100]], [-120, [14, 22]]]),
  track("drone", "x", "ease-in-out", [[0, [0, 10, 22, 94, 100]], [88, [46, 54, 62, 70]], [2, [84]]]),
  track("drone", "y", "ease-in-out", [[0, [0, 10, 94, 100]], [-12, [22]], [-22, [46]], [-18, [54]], [-23, [62]], [-19, [70]], [-14, [84]]]),
  // Stowed on the backpack again at the end: the drone is not drawn at rest.
  track("drone", "alpha", "linear", [[1, [0, 98]], [0, [100]]]),
  ROTOR_FLICKER(),
];

/** Aegis Protocol: points the emitter at an ally and holds the beam on it. */
const AEGIS = (): Track[] => [
  track("armF", "rotation", "ease-in-out", [[-30, [0, 12, 66, 100]], [-90, [22, 50]]]),
  track("torso", "rotation", "ease-in-out", [[0, [0, 12, 66, 100]], [3, [22, 50]]]),
];

/** Deploy Cover / Fortify: slams the deployer into the ground, then straightens up. */
const DEPLOY = (): Track[] => [
  track("torso", "y", "ease-in-out", [[0, [0, 10, 64, 100]], [2, [22, 44]], [3, [28]]]),
  track("torso", "rotation", "ease-in-out", [[0, [0, 10, 64, 100]], [8, [22, 44]], [14, [28]]]),
  track("armF", "rotation", "ease-in-out", [[-30, [0, 10, 44, 64, 100]], [-120, [22]], [-20, [28]]]),
];

/** The Assassin's Hidden: a cloak sweep with the back arm and a cyan flash, a faint flickering ghost, a flash on the return. */
const HIDDEN = (): Track[] => [
  track("rig", "alpha", "ease-in-out", [[1, [0, 10, 22, 92, 100]], [0.35, [30]], [0.22, [40]], [0.38, [50]], [0.24, [60]], [0.36, [70]], [0.26, [80]], [0.3, [86]]]),
  track("rig", "x", "ease-in-out", [[0, [0, 10, 80, 100]], [0.6, [40, 60]], [-0.6, [50]], [-0.4, [70]]]),
  track("cloak", "alpha", "ease-in-out", [[0, [0, 10, 100]], [0.7, [22, 92]], [0.25, [30, 86]]]),
  track("armB", "rotation", "ease-in-out", [[4, [0, 10, 32, 100]], [-112, [16, 24]]]),
  track("teamRing", "alpha", "ease-in-out", [[1, [0, 10, 96, 100]], [0.25, [30, 86]]]),
  track("cape", "rotation", "ease-in-out", [[0, [0, 10, 34, 100]], [34, [16, 24]]]),
  track("cape", "scaleX", "ease-in-out", [[1, [0, 10, 34, 100]], [1.5, [16, 24]]]),
];

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

/** The cover clips loop. A Take cover reaches its rest (ducked, or against the wall) at 24 % / 22 % of its loop. */
function covers(takeHalfMs: number, takeFullMs: number, inHalfMs: number, inFullMs: number, inFull: Track[]): Partial<Record<ClipName, Clip>> {
  return {
    takeCover: { ...clip("takeCover", takeHalfMs, TAKE_COVER_HALF()), activeEndMs: Math.round(takeHalfMs * 0.24) },
    takeCoverFull: { ...clip("takeCoverFull", takeFullMs, TAKE_COVER_FULL()), activeEndMs: Math.round(takeFullMs * 0.22) },
    inCover: clip("inCover", inHalfMs, IN_COVER_HALF()),
    inCoverFull: clip("inCoverFull", inFullMs, inFull),
  };
}

const PLAIN = { ...basics(false), ...covers(4400, 4800, 3400, 3600, IN_COVER_FULL()) };
/** The Assassin is lighter and quicker: a 500 ms stride, the cape moves, and it is nervous and quick in cover. */
const CAPED = { ...basics(true), ...covers(3600, 4000, 2400, 4400, ASSASSIN_IN_COVER_FULL()) };

const EXHAUSTED_MS = 5400;
/** The Exhausted clip is over for the Tick when the slab has formed (4860 ms). */
const EXHAUSTED_ACTIVE_END_MS = 4860;

const CLIPS: Record<HeroClass, Partial<Record<ClipName, Clip>>> = {
  [HeroClass.Bruiser]: {
    ...PLAIN,
    attack: once("attack", 2400, 1540, SLAM_SHOT(), 620),
    exhausted: once("exhausted", EXHAUSTED_MS, EXHAUSTED_ACTIVE_END_MS, EXHAUSTED_FALL(BRUISER_FALL)),
  },
  [HeroClass.Controller]: {
    ...PLAIN,
    attack: pulse("attack", 2400, 1630),
    tagRound: pulse("tagRound", 2800, 1400),
    slowPulse: pulse("slowPulse", 2600, 2180),
    scoutDrone: once("scoutDrone", 3600, 3380, SCOUT_DRONE()),
    aegis: once("aegis", 3200, 2560, AEGIS()),
    deploy: once("deploy", 3400, 2720, DEPLOY()),
    exhausted: once("exhausted", EXHAUSTED_MS, EXHAUSTED_ACTIVE_END_MS, [...EXHAUSTED_FALL(CONTROLLER_FALL), ...CONTROLLER_SPARKS()]),
  },
  [HeroClass.Assassin]: {
    ...CAPED,
    attack: once("attack", 2200, 1450, PRECISION_SHOT(), 570),
    longShot: once("longShot", 3600, 3170, LONG_SHOT(), 1650),
    hidden: once("hidden", 4200, 4200, HIDDEN()),
    exhausted: once("exhausted", EXHAUSTED_MS, EXHAUSTED_ACTIVE_END_MS, [...EXHAUSTED_FALL(ASSASSIN_FALL), ...ASSASSIN_RIFLE()]),
  },
};

/** The Take cover clip for a Move that ends on this Cover. */
export function takeCoverClipName(cover: CoverKind): ClipName {
  return cover === CoverKind.Full ? "takeCoverFull" : "takeCover";
}

/** What a Hero does when nothing is asked of it: stand, or stand behind the Cover it is on. */
export function restClipName(cover: CoverKind): ClipName {
  return cover === CoverKind.Full ? "inCoverFull" : cover === CoverKind.Half ? "inCover" : "idle";
}

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
