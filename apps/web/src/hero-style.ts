import { HeroClass } from "game-core";
import { OUTLINE } from "./terrain-style";

// The look of a Hero figure (docs/design/animation/README.md, "The figure rig"): the one place that holds Hero colours
// and proportions. Sizes are world pixels at game size, the feet are at (0, 0), y grows downwards.

/** The colours of one Hero: body / plate / legs / arms / accent (pads, helmet, hood, backpack) as in the README table. */
interface TeamColours {
  body: number;
  plate: number;
  legs: number;
  arms: number;
  accent: number;
}

/** Our Squad is the blue family, the enemy the red family; the class is a shade inside the family. */
const TEAM_COLOURS: Record<"own" | "enemy", Record<HeroClass, TeamColours>> = {
  own: {
    [HeroClass.Bruiser]: { body: 0x2a56a8, plate: 0x5f8fe0, legs: 0x173a78, arms: 0x234a94, accent: 0x1f4488 },
    [HeroClass.Controller]: { body: 0x4f8fe6, plate: 0xa9ccff, legs: 0x2d5aa8, arms: 0x3f78d0, accent: 0x2a5fb8 },
    [HeroClass.Assassin]: { body: 0x8ec3ff, plate: 0xd0e8ff, legs: 0x4a7ab8, arms: 0x6aa6ea, accent: 0x3a6ab0 },
  },
  enemy: {
    [HeroClass.Bruiser]: { body: 0xa3212c, plate: 0xd8606a, legs: 0x6e141c, arms: 0x8c1b25, accent: 0x7a1822 },
    [HeroClass.Controller]: { body: 0xe04a44, plate: 0xff9c96, legs: 0x9a2a2a, arms: 0xc93a38, accent: 0xb02e2e },
    [HeroClass.Assassin]: { body: 0xff9a92, plate: 0xffd0cc, legs: 0xb04a4a, arms: 0xe87a76, accent: 0xa63a3a },
  },
};

/** The visor of our Heroes by class; enemy visors glow red (the Controller's orange-red). */
const VISOR = {
  own: { [HeroClass.Bruiser]: 0x0b1016, [HeroClass.Controller]: 0xffd24a, [HeroClass.Assassin]: 0x7fe8ff },
  enemy: { [HeroClass.Bruiser]: 0xff5a5a, [HeroClass.Controller]: 0xff9a5a, [HeroClass.Assassin]: 0xff5a5a },
} as const;

/** What differs between the classes in the shared parts; the weapon colours do not depend on the team. */
const CLASS_SHAPE = {
  [HeroClass.Bruiser]: { bodyWidth: 18, legWidth: 6, armWidth: 4, plate: { x: 3, width: 8 }, visorRight: 0, gun: { width: 6, height: 13, color: 0x2a323c } },
  [HeroClass.Controller]: { bodyWidth: 18, legWidth: 6, armWidth: 4, plate: { x: 3, width: 8 }, visorRight: 1, gun: { width: 5, height: 11, color: 0x27407f } },
  [HeroClass.Assassin]: { bodyWidth: 14, legWidth: 5, armWidth: 3.5, plate: { x: 2, width: 6 }, visorRight: 1, gun: { width: 4, height: 20, color: 0x1d242c } },
} as const;

/** The palette of one Hero: `head` is the skin of a Bruiser and the helmet or hood colour of the others. */
export interface HeroLook extends TeamColours {
  head: number;
  visor: number;
}

/** The colours of a Hero of a class in our Squad (blue family) or the enemy Squad (red family). */
export function heroLook(heroClass: HeroClass, enemy: boolean): HeroLook {
  const colours = TEAM_COLOURS[enemy ? "enemy" : "own"][heroClass];
  return {
    ...colours,
    head: heroClass === HeroClass.Bruiser ? HERO_STYLE.skin : colours.accent,
    visor: VISOR[enemy ? "enemy" : "own"][heroClass],
  };
}

export const HERO_STYLE = {
  outline: OUTLINE,
  /** Skin: the Bruiser's head and every hand. */
  skin: 0xe8d3b9,
  /** Body colour of an Exhausted Hero and of one that has just been hit (every part takes it). */
  exhausted: 0x4a5560,
  hit: 0xffffff,
  /** Height factor of the torso group of an Exhausted Hero (it slumps). */
  exhaustedSquash: 0.65,
  /** The ring under the figure, by Squad. */
  ring: { own: 0x2ec4b6, enemy: 0xe5484d, width: 2.5, radiusX: 16, radiusY: 8 },
  /** Soft contact shadow under the feet. */
  shadow: { color: 0x000000, alpha: 0.4, radiusX: 18, radiusY: 8 },
  /** Outline widths in screen px: body and head, limbs and small parts. */
  line: { body: 1.5, limb: 1 },
  shape: CLASS_SHAPE,
  /** The rig, relative to the feet. The torso group's origin is the hip; arms and legs turn about their pivots. */
  rig: {
    hipY: -10,
    legs: { xs: [-8, 2], height: 10, radius: 3 },
    body: { y: -26, height: 16, radius: 6, plateY: 3, plateHeight: 5, plateRadius: 2 },
    head: { y: -37, size: 10, pivotY: -27, visorWidth: 5, visorHeight: 2, visorY: 3 },
    /** Arm box: from 2 px left of the shoulder, 1 px above it. The hand is a circle at its end. */
    arm: { height: 11, radius: 2, back: { shoulderX: -10, angle: 4 }, front: { shoulderX: 10, angle: -30 }, shoulderY: -24, hand: 5 },
    weapon: { x: -1, y: 11, radius: 2 },
    /** Bruiser. */
    pad: { width: 11, height: 9, y: -29, xs: [-15, 4], radius: 4, highlight: 2 },
    /** Assassin: the scope sits on the rifle; hood and cape are polygons in fractions of their box. */
    scope: { x: -1, y: 3, width: 6, height: 3, color: 0x7fe8ff },
    hood: {
      x: -11,
      y: -43,
      width: 18,
      height: 16,
      points: [0.12, 1, 0, 0.62, 0.08, 0.24, 0.4, 0, 0.72, 0.06, 1, 0.3, 1, 0.58, 0.74, 0.5, 0.58, 1],
    },
    cape: { x: -16, y: -27, width: 12, height: 18, points: [1, 0, 1, 0.14, 0.66, 1, 0.4, 0.66, 0, 0.94, 0.16, 0.42, 0.32, 0] },
    /** Controller. */
    pack: { x: -14, y: -27, width: 7, height: 11, radius: 2 },
    antenna: { x: -12, y: -42, width: 2, height: 15, color: 0x8fb2ff },
    beacon: { x: -11, y: -42, radius: 3, color: 0xffd24a, periodMs: 1400, minAlpha: 0.25 },
    console: { x: -1, y: 7, width: 6, height: 5, color: 0x7fe8ff },
  },
  /** Shield rubies, the shield bubble and the planned-action icons above the Hero. */
  marks: {
    ruby: { fill: 0x2f7bff, facet: 0x9cc4ff, size: 7, gap: 3, rowY: -64, dash: 3 },
    bubble: { fill: 0x4aa3ff, fillAlpha: 0.22, edgeAlpha: 0.75, radiusX: 26, radiusY: 32, centerY: -22, appearMs: 250 },
    icon: { fill: 0xe8eef5, size: 9, rowY: -84, gap: 6 },
    /** The grey badge of a planned Wait ("n II"). */
    waitBadge: { fill: 0x8a99a8, text: 0x12161c, size: 12 },
    tickText: { fill: 0xe8eef5, size: 12 },
  },
} as const;
