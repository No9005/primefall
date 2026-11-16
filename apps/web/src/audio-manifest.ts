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

/** The URL of an asset of a Hero; `file` may climb out of the Hero's folder (a shared effect). */
export function assetUrl(heroClass: HeroClass, asset: AudioAsset): string {
  return new URL(`${AUDIO_BASE}${AUDIO_FOLDER[heroClass]}/${asset.file}`, "http://localhost/").pathname;
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
