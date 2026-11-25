import { HeroClass } from "game-core";

// The shape of `public/assets/audio/<hero>/manifest.json` (see the README next to it): the sounds of one Hero and the cues
// that say when to play which.

export interface AudioAsset {
  /** Path relative to the Hero's folder; a shared sound points into another folder ("../tilly/sfx/hit-flesh.mp3"). */
  file: string;
  kind: "voice" | "sfx";
  durationMs: number;
  text?: string;
  what?: string;
}

/** A number that has to match exactly, or a comparison such as ">=2" or ">0". */
export type Amount = number | string;

export interface VoicePlay {
  /** The variants: one of them is picked at random, never the same twice in a row. */
  play: string[];
  /** Milliseconds from the start of the clip of the Hero (negative: before it). */
  atMs?: number;
  /** The chance (0 to 1) that the Hero says anything at all; default 1. */
  chance?: number;
}

export interface SfxPlay {
  play: string[];
  atMs?: number;
  /** At the moment the shot arrives at its target (and on the target's tile). */
  atImpact?: boolean;
}

export type CueOn =
  | "heroSelected"
  | "hangarClip"
  | "attack"
  | "cardPlayed"
  | "cardPitched"
  | "waitPlayed"
  | "attackHit"
  | "attackFailed"
  | "shieldGained"
  | "moveEndedOnCover"
  | "coverCrumbled"
  | "step"
  | "hiddenEnded"
  | "exhausted"
  | "matchEnd";

export interface AudioCue {
  on: CueOn;
  /** For `hangarClip`: the clip of the Hero Select (`idle`, `act`, `selecti`, `select`, ...) whose sounds this cue is. */
  clip?: string;
  card?: string;
  when?: { damage?: Amount; absorbed?: Amount };
  /** The cue is for the Hero that is hit (or whose Cover holds), not for the attacker. */
  asTarget?: boolean;
  whileHidden?: boolean;
  reason?: string;
  won?: boolean;
  voice?: VoicePlay;
  voiceLater?: VoicePlay;
  sfx?: SfxPlay[];
}

export interface AudioManifest {
  hero: string;
  name: string;
  assets: Record<string, AudioAsset>;
  cues: AudioCue[];
}

/** The folder of each Hero class under `assets/audio`. */
export const AUDIO_FOLDER: Record<HeroClass, string> = {
  [HeroClass.Bruiser]: "max",
  [HeroClass.Controller]: "tilly",
  [HeroClass.Assassin]: "kit",
};

const AUDIO_BASE = `${import.meta.env.BASE_URL}assets/audio/`;

export const manifestUrl = (heroClass: HeroClass) => `${AUDIO_BASE}${AUDIO_FOLDER[heroClass]}/manifest.json`;

/** The URL of an asset in a folder of `assets/audio`; `file` may climb out of it (a shared effect). */
export function assetUrl(folder: string, asset: Pick<AudioAsset, "file">): string {
  return new URL(`${AUDIO_BASE}${folder}/${asset.file}`, "http://localhost/").pathname;
}

/** The map and the cards: `assets/audio/map/manifest.json`. Not tied to a Hero. */
export const MAP_FOLDER = "map";
export const MAP_MANIFEST_URL = `${AUDIO_BASE}${MAP_FOLDER}/manifest.json`;

/** The sounds of the player's own actions and of the moments of the match; `ui` in the map manifest. */
export type UiSound = "cardPlayed" | "cardBack" | "cardDraw" | "cardBurn" | "energyUp" | "laserOff" | "zoneTaken" | "score" | "countdownTick" | "countdownFinal";

/** The details of the hangar that sound: a spark at one of the fuse boxes, the flicker of the light. */
export type HangarSound = "spark" | "flicker";

export interface MapManifest {
  assets: Record<string, Pick<AudioAsset, "file" | "durationMs">>;
  ambience: {
    /** Run for the whole match; the one marked `nearPrimeZone` is louder the nearer the player's Hero is to the Prime Zone. */
    loops: { play: string; gain: number; nearPrimeZone?: boolean }[];
    /** Quiet sounds at random now and then, `everyMs` apart (from, to). */
    oneShots: { play: string[]; everyMs: [number, number] };
    /** The laser barrier around the inactive Prime Zone: a loop that hums while the walls stand; `dissolve` is the sound in `ui` when they go. */
    barrier: { loop: string; gain: number; dissolve: string };
    /** The hum of the player's own Scout Drone: a loop that runs while the Squad has a Site Survey area out. */
    scoutDrone: { loop: string; gain: number };
    /** The sounds of the details of the hangar of the Hero Select, played when the scene tells (`HangarScene.sounds`). */
    hangar: Partial<Record<HangarSound, { play: string[]; gain: number }>>;
  };
  ui: Record<UiSound, { play: string[] }> & { shuffle: { play: string[]; atMs: number[] } };
}

/** True when `value` meets `spec`: a number matches exactly, a string is a comparison (">=2", ">0"). */
export function meets(value: number, spec: Amount | undefined): boolean {
  if (spec === undefined) return true;
  if (typeof spec === "number") return value === spec;
  const match = /^(>=|<=|>|<)(\d+)$/.exec(spec);
  if (!match) return false;
  const limit = Number(match[2]);
  switch (match[1]) {
    case ">=":
      return value >= limit;
    case "<=":
      return value <= limit;
    case ">":
      return value > limit;
    default:
      return value < limit;
  }
}

/** The music: `assets/audio/music/manifest.json`. One loop of `bars` bars in layers that run in sync; a level says how loud each layer is. */
export interface MusicManifest {
  bpm: number;
  bars: number;
  layers: Record<string, string>;
  /** The main-menu theme of the start screen: a loop of 177 s (docs: `archive/audio-source/music/menu-theme/`). */
  menu?: { file: string; gain: number };
  /** The sound of the Notstrom Intro after a tap on Start (8.9 s, plays once; docs: `archive/audio-source/music/notstrom-intro-cue/`). */
  notstromIntro?: { file: string; gain: number };
  /** The loop under the Hero Select. */
  intro?: { file: string; gain: number };
  /** Plays once when a match starts, hard from the first beat, and fades into the layers over its last bar. */
  opening?: { file: string; gain: number };
  /** The end screen: a jingle that plays once, then a quiet loop over its last `crossfadeSeconds`. */
  ending?: Record<"victory" | "defeat", { jingle: { file: string; gain: number }; loop: { file: string; gain: number }; crossfadeSeconds: number }>;
  levels: { name: string; gains: Record<string, number> }[];
}

export const MUSIC_FOLDER = "music";
export const MUSIC_MANIFEST_URL = `${AUDIO_BASE}${MUSIC_FOLDER}/manifest.json`;

export const musicFileUrl = (file: string) => new URL(`${AUDIO_BASE}${MUSIC_FOLDER}/${file}`, "http://localhost/").pathname;
