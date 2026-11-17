import type { GridPosition } from "game-core";
import type { CueOn } from "./audio-manifest";

// The rules of the mix: how important each sound is, which of them may play, and how loud they are. Pure code with no
// Web Audio in it, so the rules are tested. Times are milliseconds on one clock (the audio clock).

/** How important a sound is. A louder tier wins when the mix is full: it cuts a quieter one, a quieter one is dropped. */
export const Priority = { Background: 0, Ambient: 1, Minor: 2, Normal: 3, Important: 4, Critical: 5 } as const;

/**
 * The importance of the voice and of the effects of every cue. A Hero's own Squad hears its sounds one tier higher
 * (`OWN_SQUAD_BONUS`), so the player always hears what their own Heroes do first.
 *  - Critical: the Hero Select, an Exhausted Hero, the end of the match: they are never dropped by a cooldown.
 *  - Important: a hit (the cry and the impact) and the shots: the player must hear that something was hit.
 *  - Normal: the lines of the cards, a Shield, an end of Hidden.
 *  - Minor: taking cover, Cover that crumbles.
 *  - Ambient: steps, a Wait, a Pitch.
 */
export const CUE_PRIORITY: Record<CueOn, { voice: number; sfx: number }> = {
  heroSelected: { voice: Priority.Critical, sfx: Priority.Critical },
  matchEnd: { voice: Priority.Critical, sfx: Priority.Critical },
  exhausted: { voice: Priority.Critical, sfx: Priority.Critical },
  attackHit: { voice: Priority.Important, sfx: Priority.Important },
  attack: { voice: Priority.Normal, sfx: Priority.Important },
  cardPlayed: { voice: Priority.Normal, sfx: Priority.Important },
  attackFailed: { voice: Priority.Normal, sfx: Priority.Normal },
  shieldGained: { voice: Priority.Normal, sfx: Priority.Normal },
  hiddenEnded: { voice: Priority.Normal, sfx: Priority.Normal },
  moveEndedOnCover: { voice: Priority.Minor, sfx: Priority.Minor },
  coverCrumbled: { voice: Priority.Minor, sfx: Priority.Minor },
  waitPlayed: { voice: Priority.Ambient, sfx: Priority.Ambient },
  cardPitched: { voice: Priority.Ambient, sfx: Priority.Ambient },
  step: { voice: Priority.Ambient, sfx: Priority.Ambient },
};

export const OWN_SQUAD_BONUS = 1;

/** The voice rules. The defaults are the usual ones of games: a character does not "bark" more often than every few seconds. */
export interface VoiceRules {
  /** A Hero stays silent this long after its last line ended, unless the new line is far more important (see `outranks`). */
  cooldownMs: number;
  /** A new line may break the cooldown when it is at least this many tiers above the last line of the Hero. */
  outranks: number;
  /**
   * At most this many Heroes speak at once, wherever they stand: the player hears every voice from the same speaker, so
   * Heroes far apart on the map would still make a cacophony.
   */
  maxAtOnce: number;
}

export const DEFAULT_VOICE_RULES: VoiceRules = { cooldownMs: 4000, outranks: 2, maxAtOnce: 2 };

export interface VoiceRequest {
  heroId: string;
  startMs: number;
  durationMs: number;
  priority: number;
}

export interface Decision {
  play: boolean;
  /** The ids of sounds that were already on their way and must fade out, because this one is more important. */
  cut: number[];
  /** The id of the new sound, to hand to `cut` later; set when it plays. */
  id?: number;
}

interface Voice extends VoiceRequest {
  id: number;
  endMs: number;
}

const chebyshev = (a: GridPosition, b: GridPosition) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

/**
 * Decides which voice lines play. A Hero speaks one line at a time and not again before its cooldown is over; no more than
 * `maxAtOnce` Heroes speak at once. A more important line cuts a less important one instead of being dropped.
 */
export class VoiceDirector {
  private nextId = 1;
  private voices: Voice[] = [];

  constructor(private readonly rules: VoiceRules = DEFAULT_VOICE_RULES) {}

  request(request: VoiceRequest): Decision {
    const endMs = request.startMs + request.durationMs;
    this.voices = this.voices.filter((voice) => voice.endMs + this.rules.cooldownMs > request.startMs - 60_000);
    const cut: number[] = [];

    const own = this.voices.filter((voice) => voice.heroId === request.heroId);
    const last = own.reduce<Voice | undefined>((latest, voice) => (latest === undefined || voice.endMs > latest.endMs ? voice : latest), undefined);
    const speaking = own.find((voice) => voice.startMs < endMs && voice.endMs > request.startMs);
    if (speaking) {
      // The Hero is mid-line: only a more important line interrupts it.
      if (request.priority <= speaking.priority) return DROP;
      cut.push(speaking.id);
    } else if (last && request.startMs < last.endMs + this.rules.cooldownMs && !this.mayBreakCooldown(request, last)) {
      return DROP;
    }

    const others = this.voices.filter((voice) => voice.heroId !== request.heroId && !cut.includes(voice.id) && voice.startMs < endMs && voice.endMs > request.startMs);
    const speakers = new Set(others.map((voice) => voice.heroId));
    if (speakers.size >= this.rules.maxAtOnce) {
      // Too many voices at once: the least important one makes room if this line is more important, else this one is dropped.
      const quietest = others.reduce((low, voice) => (voice.priority < low.priority ? voice : low));
      if (request.priority <= quietest.priority) return DROP;
      cut.push(...others.filter((voice) => voice.heroId === quietest.heroId).map((voice) => voice.id));
    }

    const id = this.nextId++;
    this.voices = this.voices.filter((voice) => !cut.includes(voice.id));
    // A cut line ends where the new one starts, so it does not hold up the cooldown of its Hero.
    for (const voice of own) if (cut.includes(voice.id)) voice.endMs = request.startMs;
    this.voices.push({ ...request, id, endMs });
    return { play: true, cut, id };
  }

  /** A line was cut: its Hero is silent from `atMs`. */
  cut(id: number, atMs: number): void {
    const voice = this.voices.find((candidate) => candidate.id === id);
    if (voice) voice.endMs = Math.min(voice.endMs, atMs);
  }

  clear(): void {
    this.voices = [];
  }

  private mayBreakCooldown(request: VoiceRequest, last: Voice): boolean {
    return request.priority >= Priority.Critical || request.priority >= last.priority + this.rules.outranks;
  }
}

const DROP: Decision = { play: false, cut: [] };

/** The limits of the effects. */
export interface SfxRules {
  /** At most this many effects at once. */
  maxAtOnce: number;
  /** The same effect is not started twice within this time (six Heroes taking the same step would hit the same instant). */
  minRepeatMs: number;
}

export const DEFAULT_SFX_RULES: SfxRules = { maxAtOnce: 10, minRepeatMs: 70 };

export interface SfxRequest {
  assetId: string;
  startMs: number;
  durationMs: number;
  priority: number;
}

interface Sfx extends SfxRequest {
  id: number;
  endMs: number;
}

/** Decides which effects play: the most important ones, up to `maxAtOnce`, and never the same one twice at the same instant. */
export class SfxLimiter {
  private nextId = 1;
  private sounds: Sfx[] = [];

  constructor(private readonly rules: SfxRules = DEFAULT_SFX_RULES) {}

  request(request: SfxRequest): Decision {
    const endMs = request.startMs + request.durationMs;
    this.sounds = this.sounds.filter((sound) => sound.endMs > request.startMs - 1000);
    if (this.sounds.some((sound) => sound.assetId === request.assetId && Math.abs(sound.startMs - request.startMs) < this.rules.minRepeatMs)) return DROP;
    const playing = this.sounds.filter((sound) => sound.startMs <= request.startMs && sound.endMs > request.startMs);
    const cut: number[] = [];
    if (playing.length >= this.rules.maxAtOnce) {
      const quietest = playing.reduce((low, sound) => (sound.priority < low.priority ? sound : low));
      if (request.priority <= quietest.priority) return DROP;
      cut.push(quietest.id);
      quietest.endMs = request.startMs;
    }
    const id = this.nextId++;
    this.sounds.push({ ...request, id, endMs });
    return { play: true, cut, id };
  }

  clear(): void {
    this.sounds = [];
  }
}

/** A random pick from `variants`, never the one that was `last` picked (unless there is only one). */
export function pickVariant(variants: readonly string[], last: string | undefined, random: () => number): string | undefined {
  const choices = variants.length > 1 ? variants.filter((variant) => variant !== last) : variants;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

/** The ambience of the map: a quiet sound at random every 10 to 25 s. */
export const AMBIENCE_GAP_MS = { min: 10_000, max: 25_000 };

export function nextAmbienceGapMs(random: () => number, { min, max } = AMBIENCE_GAP_MS): number {
  return min + random() * (max - min);
}

/** Within this many tiles of the listener a sound has full volume. */
export const FULL_VOLUME_TILES = 4;
/** From this many tiles on, a sound has `FAR_GAIN`. */
export const FAR_TILES = 14;
export const FAR_GAIN = 0.35;

/** How loud a sound is for the player: full near the player's Hero, fading with the distance to a quiet but still audible level. */
export function distanceGain(listener: GridPosition, source: GridPosition): number {
  const distance = chebyshev(listener, source);
  if (distance <= FULL_VOLUME_TILES) return 1;
  if (distance >= FAR_TILES) return FAR_GAIN;
  return 1 - ((distance - FULL_VOLUME_TILES) / (FAR_TILES - FULL_VOLUME_TILES)) * (1 - FAR_GAIN);
}
