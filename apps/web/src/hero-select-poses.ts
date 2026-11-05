import { HeroClass } from "game-core";
import { createPose, type Easing, type Frames, keys, type Keyframe, type Pose, restPoseInto, sampleTrack, track, type Track } from "./hero-clips";

// The idle and ready poses of the Hero Select screen (docs/design/hero-select, reference/HeroSelectPoses.html). They are
// for this screen only; the board keeps its clips. The numbers are the CSS @keyframes of the reference: px at design size
// (the figure is magnified on the screen), CSS degrees, a part's offsets from its rest place. A ready pose plays once
// and then holds (`holdMs`), breathing.

/** Things the figure's rig does not draw itself: the muzzle flash and tracer of the Bruiser, the Assassin's glint and label. */
export const EXTRAS = ["muzzle", "muzzleScale", "tracer", "tracerScale", "glint", "glintScale", "label", "labelY"] as const;
export type ExtraName = (typeof EXTRAS)[number];

interface ExtraTrack {
  extra: ExtraName;
  keys: readonly Keyframe[];
}

interface PoseClip {
  durationMs: number;
  /** A ready pose stops here and holds its last frame; an idle pose loops (and has no hold). */
  holdMs?: number;
  tracks: readonly Track[];
  extras: readonly ExtraTrack[];
}

function extra(name: ExtraName, easing: Easing, frames: Frames): ExtraTrack {
  return { extra: name, keys: keys(easing, frames) };
}

/** The breath of the idle pose of every Hero: the torso rises and widens a little, the legs and the back arm sway. */
const BREATH = (): Track[] => [
  track("torso", "x", "ease-in-out", [[0, [0, 100]], [0.8, [50]]]),
  track("torso", "y", "ease-in-out", [[0, [0, 100]], [-2, [50]]]),
  track("torso", "scaleY", "ease-in-out", [[1, [0, 100]], [1.05, [50]]]),
  track("armB", "rotation", "ease-in-out", [[4, [0, 100]], [14, [50]]]),
  track("legL", "rotation", "ease-in-out", [[0, [0, 100]], [-4, [50]]]),
  track("legR", "rotation", "ease-in-out", [[0, [0, 100]], [4, [50]]]),
];

/** Where the Scout Drone sits in the Controller's hand, from the place it has on the backpack. */
const DRONE_IN_HAND = { x: 33, y: 12 };

const droneAt = (frames: readonly (readonly [dx: number, dy: number, percents: readonly number[]])[], ease: Easing): Track[] => [
  track("drone", "x", ease, frames.map(([dx, , at]) => [DRONE_IN_HAND.x + dx, at] as const)),
  track("drone", "y", ease, frames.map(([, dy, at]) => [DRONE_IN_HAND.y + dy, at] as const)),
];

const POSES: Record<HeroClass, { idle: PoseClip; ready: PoseClip }> = {
  [HeroClass.Bruiser]: {
    // Muzzle to the sky, head tilted up, breathing: 2 s.
    idle: {
      durationMs: 2000,
      tracks: [
        ...BREATH(),
        track("armF", "rotation", "ease-in-out", [[-168, [0, 100]], [-175, [50]]]),
        track("head", "rotation", "ease-in-out", [[-8, [0, 100]], [-12, [50]]]),
        track("head", "y", "ease-in-out", [[0, [0, 100]], [-1.4, [50]]]),
      ],
      extras: [],
    },
    // The front arm swings to the side (6 to 16 % of 6 s), three shots at 22, 34 and 46 %, the aim is held at -93 deg.
    ready: {
      durationMs: 6000,
      holdMs: 4200,
      tracks: [
        track("armF", "rotation", "ease-in-out", [
          [-168, [0, 6]], [-94, [16]], [-92, [20, 32, 44]], [-108, [22, 34, 46]], [-96, [25, 37, 49]], [-93, [70]],
        ]),
        track("torso", "x", "ease-out", [[0, [0, 6, 16, 32, 44, 70]], [-3, [22, 34, 46]], [-1, [25, 37, 49]]]),
        track("torso", "rotation", "ease-out", [
          [0, [0, 6]], [-3, [16, 32, 44]], [-9, [22, 34, 46]], [-4, [25, 37, 49]], [-2, [70]],
        ]),
        track("head", "rotation", "ease-in-out", [[-8, [0, 6]], [0, [16, 70]]]),
      ],
      extras: [
        extra("muzzle", "linear", [
          [0, [0, 21.5, 26, 26.1, 33.5, 38, 38.1, 45.5, 50, 50.1, 100]], [1, [22.5, 34.5, 46.5]],
        ]),
        extra("muzzleScale", "linear", [
          [0, [0, 21.5, 26.1, 33.5, 38.1, 45.5, 50.1, 100]], [1.6, [22.5, 34.5, 46.5]], [2, [26, 38, 50]],
        ]),
        extra("tracer", "linear", [[0, [0, 21.5, 28, 33.5, 40, 45.5, 52, 100]], [1, [22.5, 26, 34.5, 38, 46.5, 50]]]),
        extra("tracerScale", "ease-out", [[0, [0, 21.5, 27.1, 33.5, 39.1, 45.5, 51.1, 100]], [1, [27, 39, 51]]]),
      ],
    },
  },
  [HeroClass.Controller]: {
    // Plays with the Scout Drone in the hand: tosses it 9 px up and catches it, the head follows: 2.4 s.
    idle: {
      durationMs: 2400,
      tracks: [
        ...BREATH(),
        track("armF", "rotation", "ease-in-out", [[-72, [0, 55, 100]], [-86, [30]]]),
        track("head", "rotation", "ease-in-out", [[10, [0, 55, 100]], [-6, [30]]]),
        track("gun", "alpha", "linear", [[0, [0, 100]]]),
        track("drone", "alpha", "linear", [[1, [0, 100]]]),
        ...droneAt([[0, 0, [0, 55, 100]], [1, -9, [30]]], "ease-in-out"),
      ],
      extras: [],
    },
    // Lets the drone go; it flies out and hovers about 30 px over the Hero while the emitter comes up and the arm comes down.
    ready: {
      durationMs: 6000,
      holdMs: 4680,
      tracks: [
        track("armF", "rotation", "ease-in-out", [[-72, [0, 6]], [-86, [12]], [-150, [18]], [-165, [26]], [-110, [40]], [-78, [56, 78]]]),
        track("head", "rotation", "ease-in-out", [[10, [0, 6]], [-6, [12]], [-14, [20, 70]], [-12, [78]]]),
        track("torso", "rotation", "ease-in-out", [[0, [0, 12, 40, 100]], [-4, [22]]]),
        track("gun", "alpha", "ease-in-out", [[0, [0, 36]], [1, [48, 100]]]),
        track("drone", "alpha", "linear", [[1, [0, 100]]]),
        ...droneAt(
          [[0, 0, [0, 6]], [1, -9, [12]], [3, -12, [18]], [8, -22, [26]], [34, -28, [38]], [-6, -32, [52]], [30, -30, [66]], [8, -32, [78]]],
          "ease-in-out",
        ),
      ],
      extras: [],
    },
  },
  [HeroClass.Assassin]: {
    // Calm and casual: looks at the rifle held up in front of the face, a glint over the scope: 3.2 s.
    idle: {
      durationMs: 3200,
      tracks: [
        track("torso", "x", "ease-in-out", [[0, [0, 100]], [0.8, [50]]]),
        track("torso", "y", "ease-in-out", [[0, [0, 100]], [-1.6, [50]]]),
        track("torso", "rotation", "ease-in-out", [[2, [0, 100]], [0, [50]]]),
        track("armB", "rotation", "ease-in-out", [[4, [0, 100]], [14, [50]]]),
        track("legL", "rotation", "ease-in-out", [[0, [0, 100]], [-4, [50]]]),
        track("legR", "rotation", "ease-in-out", [[0, [0, 100]], [4, [50]]]),
        track("armF", "rotation", "ease-in-out", [[-128, [0, 100]], [-116, [50]]]),
        track("head", "rotation", "ease-in-out", [[14, [0, 100]], [10, [50]]]),
        track("cape", "rotation", "ease-in-out", [[0, [0, 100]], [4, [50]]]),
      ],
      extras: [
        extra("glint", "ease-out", [[0, [0, 48, 66, 100]], [1, [56]]]),
        extra("glintScale", "ease-out", [[0, [0, 48, 66, 100]], [1.4, [56]]]),
      ],
    },
    // Lowers the rifle, a cyan shimmer, then turns invisible: about 35 % visible, the ring faint, a small "Hidden" floats up.
    ready: {
      durationMs: 6000,
      holdMs: 4800,
      tracks: [
        track("armF", "rotation", "ease-in-out", [[-128, [0, 6]], [-70, [18]], [-30, [30, 80]]]),
        track("head", "rotation", "ease-in-out", [[14, [0, 6]], [0, [22, 80]]]),
        track("rig", "alpha", "ease-in-out", [[1, [0, 24, 30]], [0.35, [38, 70, 80]], [0.25, [46]], [0.38, [54]], [0.3, [62]]]),
        track("cloak", "alpha", "ease-in-out", [[0, [0, 24, 38, 100]], [0.7, [30]]]),
        track("teamRing", "alpha", "ease-in-out", [[1, [0, 26]], [0.25, [40, 80]]]),
        track("cape", "rotation", "ease-in-out", [[0, [0, 100]]]),
      ],
      extras: [
        extra("label", "ease-out", [[0, [0, 28]], [1, [36, 80]]]),
        extra("labelY", "ease-out", [[0, [0, 28]], [-8, [80]]]),
      ],
    },
  },
};

/** The pose of a figure at a moment, and the extras the screen draws around it. */
export interface SelectPose {
  pose: Pose;
  extras: Record<ExtraName, number>;
}

export function createSelectPose(): SelectPose {
  return { pose: createPose(), extras: Object.fromEntries(EXTRAS.map((name) => [name, 0])) as Record<ExtraName, number> };
}

/** The extras that are scales: they are 1 (full size) when nothing moves them. */
const SCALE_EXTRAS: ReadonlySet<ExtraName> = new Set(["muzzleScale", "tracerScale", "glintScale"]);

/** The time inside the clip: an idle loops, a ready pose stops at its hold, and with reduced motion nothing runs (first frame / hold frame). */
function clipTime(clip: PoseClip, ms: number, reducedMotion: boolean): number {
  if (reducedMotion) return clip.holdMs ?? 0;
  return clip.holdMs === undefined ? ms % clip.durationMs : Math.min(ms, clip.holdMs);
}

/** The breath of a held ready pose: a loop of 2 s. */
const BREATH_MS = 2000;

/**
 * The pose of a Hero `ms` after it entered a state ("idle" loops; "ready" plays once and holds, breathing). With
 * `reducedMotion` nothing moves: the idle pose is its first frame, the ready pose the last frame of the transition.
 * `clockMs` is the page clock, which the small flickers (the drone's rotor) run on. Writes into `out` and returns it.
 */
export function sampleSelectPose(heroClass: HeroClass, state: "idle" | "ready", ms: number, reducedMotion: boolean, out: SelectPose, clockMs = ms): SelectPose {
  const clip = POSES[heroClass][state];
  restPoseInto(out.pose);
  for (const name of EXTRAS) out.extras[name] = SCALE_EXTRAS.has(name) ? 1 : 0;
  const holdMs = clip.holdMs;
  const fraction = clipTime(clip, ms, reducedMotion) / clip.durationMs;
  for (const t of clip.tracks) out.pose[t.part][t.prop] = sampleTrack(t.keys, fraction);
  for (const t of clip.extras) out.extras[t.extra] = sampleTrack(t.keys, fraction);
  // Held, a ready pose breathes (and the drone bobs) so it stays alive; it is part of "no animation" being switched off.
  if (state === "ready" && !reducedMotion && holdMs !== undefined && ms > holdMs) {
    const wave = 0.5 - 0.5 * Math.cos(((ms - holdMs) / BREATH_MS) * 2 * Math.PI);
    out.pose.torso.y += -2 * wave;
    out.pose.torso.scaleY *= 1 + 0.05 * wave;
    if (heroClass === HeroClass.Controller) out.pose.drone.y += -2 + 4 * wave;
  }
  if (!reducedMotion && heroClass === HeroClass.Controller) out.pose.rotor.scaleX = Math.floor(clockMs / 100) % 2 === 0 ? 1 : 0.3;
  return out;
}

/** Where the feet of a Hero stand inside its area: the selected Bruiser steps left so its tracer stays inside the area. */
export function feetX(heroClass: HeroClass, selected: boolean): number {
  return heroClass === HeroClass.Bruiser && selected ? 62 : 120;
}
