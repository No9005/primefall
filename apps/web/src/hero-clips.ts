import { HeroClass } from "game-core";

// The Hero clips of docs/design/animation: plain keyframe data per rig part, and the pure sampling of it. The numbers
// are the CSS @keyframes of reference/*.html translated one to one (px at game size, CSS degrees, clockwise).

export type ClipName = "idle" | "walk" | "wait";

export const PARTS = ["torso", "head", "armF", "armB", "legL", "legR", "cape", "pause"] as const;
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
  tracks: readonly Track[];
}

/** The pose a part has when no clip moves it; the arms hang at their rest angles, the grey II mark is hidden. */
const REST_PART: PartPose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 };
const REST_ROTATION: Partial<Record<PartName, number>> = { armF: -30, armB: 4 };

export function restPart(part: PartName): PartPose {
  return { ...REST_PART, rotation: REST_ROTATION[part] ?? 0, alpha: part === "pause" ? 0 : 1 };
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
    target.alpha = part === "pause" ? 0 : 1;
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
  return { name, durationMs, loop: true, perStep: name === "walk", tracks };
}

/** Bruiser and Controller share their clips: the antenna of the Controller sways because it hangs on the leaning torso. */
const SHARED: Record<ClipName, Clip> = {
  idle: clip("idle", 2000, IDLE_TRACKS(false)),
  walk: clip("walk", 640, WALK_TRACKS(false)),
  wait: clip("wait", 3200, WAIT_TRACKS(false)),
};

/** The Assassin is lighter and quicker: a 500 ms stride, and the cape moves. */
const ASSASSIN: Record<ClipName, Clip> = {
  idle: clip("idle", 2000, IDLE_TRACKS(true)),
  walk: clip("walk", 500, WALK_TRACKS(true)),
  wait: clip("wait", 3200, WAIT_TRACKS(true)),
};

export function clipOf(heroClass: HeroClass, name: ClipName): Clip {
  return (heroClass === HeroClass.Assassin ? ASSASSIN : SHARED)[name];
}
