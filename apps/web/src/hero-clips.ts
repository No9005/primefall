import { CoverKind, HeroClass } from "game-core";

// The timeline of the Hero clips: how long each clip of each class runs and when its beats come. The pictures are the sprite
// sheets of docs/design/heroes (`heroes.ts`); the game plays them at the pace given here, and the playback uses
// the beats to time shots and ticks (`playback.ts`). Times are in clip time, before `CLIP_SPEED`.

export type ClipName =
  | "idle"
  | "walk"
  | "wait"
  | "attack"
  | "longShot"
  | "longHidden"
  | "knockback"
  | "shieldBreaker"
  | "hitHidden"
  | "tagRound"
  | "slowPulse"
  | "scoutDrone"
  | "aegis"
  | "deploy"
  | "deployFull"
  | "demolish"
  | "scrapField"
  | "scrapGain"
  | "hidden"
  | "block"
  | "hit"
  | "absorb"
  | "takeCover"
  | "takeCoverFull"
  | "inCover"
  | "inCoverFull"
  | "exhausted";

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
}

/** A clip that loops. */
function loops(name: ClipName, durationMs: number, activeEndMs = durationMs): Clip {
  return { name, durationMs, loop: true, perStep: name === "walk", activeEndMs };
}

/** A clip that plays one pass and rests; `activeEndMs` is where the Hero is back at rest, `fireMs` where the shot leaves. */
function once(name: ClipName, durationMs: number, activeEndMs: number, fireMs?: number): Clip {
  return { name, durationMs, loop: false, perStep: false, activeEndMs, ...(fireMs !== undefined && { fireMs }) };
}

/** A Controller bolt: the shot leaves at 26 % of the clip. */
const bolt = (name: ClipName, durationMs: number, activeEndMs: number): Clip => once(name, durationMs, activeEndMs, Math.round((durationMs * 0.26) / 10) * 10);

/** The clips every class has. The Assassin is lighter and quicker: a shorter stride and its own Cover timing. */
function common(strideMs: number, takeHalfMs: number, takeFullMs: number, inHalfMs: number, inFullMs: number): Partial<Record<ClipName, Clip>> {
  return {
    idle: loops("idle", 2000),
    walk: loops("walk", strideMs),
    wait: loops("wait", 3200),
    block: once("block", 3200, 2900),
    hit: once("hit", 2600, 1350),
    absorb: once("absorb", 2600, 830),
    // A Take cover reaches its rest (ducked, or against the wall) at 24 % / 22 % of its loop.
    takeCover: loops("takeCover", takeHalfMs, Math.round(takeHalfMs * 0.24)),
    takeCoverFull: loops("takeCoverFull", takeFullMs, Math.round(takeFullMs * 0.22)),
    inCover: loops("inCover", inHalfMs),
    inCoverFull: loops("inCoverFull", inFullMs),
  };
}

const HEAVY = common(640, 4400, 4800, 3400, 3600);
const LIGHT = common(500, 3600, 4000, 2400, 4400);

/** The Exhausted clip is over for the Tick when the slab has formed (4860 ms). */
const EXHAUSTED = once("exhausted", 5400, 4860);

const CLIPS: Record<HeroClass, Partial<Record<ClipName, Clip>>> = {
  [HeroClass.Bruiser]: { ...HEAVY, attack: once("attack", 2400, 1540, 620), exhausted: EXHAUSTED },
  [HeroClass.Controller]: {
    ...HEAVY,
    attack: bolt("attack", 2400, 1630),
    tagRound: bolt("tagRound", 2800, 1400),
    slowPulse: bolt("slowPulse", 2600, 2180),
    scoutDrone: once("scoutDrone", 3600, 3380),
    aegis: once("aegis", 3200, 2560),
    deploy: once("deploy", 3400, 2720),
    deployFull: once("deployFull", 3400, 2720),
    // The bomb and the Scrap Field leave at 820 ms; the Scrap gain presses the pieces into the core at 2040 ms.
    demolish: once("demolish", 3400, 2700, 820),
    scrapField: once("scrapField", 3400, 2700, 820),
    scrapGain: once("scrapGain", 3400, 2800),
    exhausted: EXHAUSTED,
  },
  [HeroClass.Assassin]: {
    ...LIGHT,
    attack: once("attack", 2200, 1450, 570),
    longShot: once("longShot", 3600, 3170, 1650),
    // From Hidden the shot leaves at 2000 ms; the blow of Personal Space lands at 700 ms; Shield Breaker stands like the plain attack.
    longHidden: once("longHidden", 4200, 3300, 2000),
    knockback: once("knockback", 2800, 2000, 700),
    shieldBreaker: once("shieldBreaker", 2200, 1450, 570),
    // Damage ends Hidden: the figure flickers out of the after-image at 1500 ms.
    hitHidden: once("hitHidden", 3400, 2500),
    hidden: once("hidden", 4200, 4200),
    exhausted: EXHAUSTED,
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

/** The attack clip for a card: Long Shot, Personal Space, Shield Breaker, Price Tag and Urban Renewal have their own, every other card uses its class's basic attack. */
export function attackClipName(card: string | undefined): ClipName {
  if (card === "Long Shot") return "longShot";
  if (card === "Personal Space") return "knockback";
  if (card === "Shield Breaker") return "shieldBreaker";
  if (card === "Price Tag") return "tagRound";
  if (card === "Urban Renewal") return "demolish";
  return "attack";
}
