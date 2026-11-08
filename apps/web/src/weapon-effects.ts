import { AttackFailReason, EffectKind, EventKind, type GridPosition, HERO_DECKS, LONG_RANGE_FROM, type MatchEvent } from "game-core";

// The effects of the attacks (docs/design/animation/README.md, "Effects"): which cue an event causes and when it starts and
// ends. Pure data and functions, so the scheduling is tested without a browser; `effects-layer.ts` draws the cues.
// All times are milliseconds from the start of the playback frame at normal clip speed.

export type Weapon = "slam" | "precision" | "long" | "pulse" | "tag";

const WEAPON_OF_CARD: Readonly<Record<string, Weapon>> = {
  "Slam Shot": "slam",
  "Concussion Round": "slam",
  "Precision Shot": "precision",
  "Cover Breaker": "precision",
  "Shield Breaker": "precision",
  "Execution Round": "precision",
  "Ghost Shot": "precision",
  "Long Shot": "long",
  "Pulse Bolt": "pulse",
  "Shock Pulse": "pulse",
  "Tag Round": "tag",
  "Mark Target": "tag",
};

/** The weapon a card fires; cards without a projectile of their own (Breach Charge, Shockwave) have none yet. */
export function weaponOf(card: string | undefined): Weapon | undefined {
  return card === undefined ? undefined : WEAPON_OF_CARD[card];
}

/** One tile of Range in px at design size (a tile step of the Shockwave slides 24 px). */
export const TILE_PX = 24;
/** Flight speed in design px per millisecond; the Long Shot has none, its line is there at once. */
export const PROJECTILE_SPEED: Readonly<Record<Weapon, number>> = { slam: 0.1, precision: 0.3, long: Infinity, pulse: 0.1, tag: 0.3 };
/** A card without a weapon of its own: the target reacts this long after the shot. */
export const UNARMED_FLIGHT_MS = 480;

export const LASER_MS = 480;
export const GLINT_BEFORE_FIRE_MS = 280;
export const LONG_LINE_FADE_MS = 450;
export const SHAKE_MS = 150;
export const SHAKE_PX = 1.5;
export const NUMBER_DELAY_MS = 20;
export const NUMBER_RISE_MS = 800;
export const NUMBER_RISE_PX = 14;
/** The CROSSFIRE label: fixed 700 ms, rises 8 px and fades; it sits above the Shield and damage numbers, one step higher per earlier label on the target. */
export const CROSSFIRE_MS = 700;
export const CROSSFIRE_RISE_PX = 8;
export const CROSSFIRE_STEP_PX = 10;
export const FLASH_MS = 270;
export const IMPACT_BURST_MS = 330;
export const IMPACT_RING_MS = 500;
/** Marked and Slow are shown from the dart's arrival, or from the field beat of the Slow pulse clip. */
export const SLOW_FIELD_MS = 1200;
export const TAG_FIRE_MS = 730;
export const STATUS_INTRO_MS = 300;

/** Milliseconds a projectile flies over `distance` tiles. */
export function flightMs(card: string | undefined, distance: number | undefined): number {
  const weapon = weaponOf(card);
  if (weapon === undefined) return UNARMED_FLIGHT_MS;
  return Math.round(((distance ?? 0) * TILE_PX) / PROJECTILE_SPEED[weapon]);
}

/** From the start of the frame to the impact on the target, given the `fire` beat of the attacker's clip. */
export function impactMs(card: string | undefined, distance: number | undefined, fireMs: number): number {
  return fireMs + flightMs(card, distance);
}

export type NumberStyle = "damage" | "bonus" | "shield" | "failed";

export type EffectCue =
  /** `halfCover`: Half Cover on the target's tile reduced the damage, so the projectile hits the wall in front of the target. */
  | { kind: "shot"; weapon: Weapon; fromId: string; toId: string; fireMs: number; flightMs: number; overdrive: boolean; halfCover?: true; miss?: true }
  /** `drop`: design px the label sits below the usual place (a tag under a number). */
  | { kind: "number"; toId: string; startMs: number; text: string; style: NumberStyle; drop?: number }
  /** Marked and Slow lock on at `startMs` and last (as state) until the end of the next Resolution. */
  | { kind: "marked" | "slow"; toId: string; startMs: number; overdrive?: true }
  /** Shockwave: rings and dust around the Hero that plays it (Overdrive: a third, white ring and a screen shake). */
  | { kind: "shockwave"; casterId: string; startMs: number; overdrive?: true }
  /** One tile of Knockback: the Hero slides from `from` to `to` (the rules have moved it there already). */
  | { kind: "knockback"; toId: string; from: GridPosition; to: GridPosition; startMs: number; tag: string; overdrive?: true }
  /**
   * Breach Charge: the charge flies from the caster to the tile, which blows up at `fireMs + flightMs`. `cover`: Cover was
   * destroyed there, so its chunks fly. Overdrive: a much bigger gold blast.
   */
  | { kind: "breach"; casterId: string; tile: GridPosition; fireMs: number; flightMs: number; cover: boolean; overdrive: boolean }
  /** The gold aura of a Hero that plays a card in Overdrive, from the start of the frame until `endMs`. */
  | { kind: "aura"; heroId: string; endMs: number }
  /** Adrenal Surge in Overdrive: a gold beam from the caster to `toId` (none when they are the same), both glow, `toId` gets the badge. */
  | { kind: "surge"; casterId: string; toId: string; startMs: number }
  /** Aegis Protocol in Overdrive: a gold beam from the caster to an ally that gains Shield. */
  | { kind: "aegisBeam"; casterId: string; toId: string; startMs: number }
  /** Deploy Cover and Fortify: a flash on the tile at `startMs`, then the wall rises. */
  | { kind: "coverPlaced"; casterId: string; tile: GridPosition; startMs: number }
  /** A Hero gains Shield: the rubies pop and the bubble forms. `startMs` is when the rubies pop. */
  | { kind: "shieldGain"; toId: string; startMs: number; amount: number }
  /** A hit that the Shield absorbed (`absorbed` rubies burst) at `startMs`, the impact. */
  | { kind: "shieldHit"; toId: string; startMs: number; absorbed: number }
  /** A hit with Crossfire: the label "CROSSFIRE +N" above the numbers; `stack` counts the labels already on the target in this frame. */
  | { kind: "crossfire"; toId: string; startMs: number; amount: number; stack: number };

/** When a cue is over, for the length of the frame. */
export function cueEndMs(cue: EffectCue): number {
  switch (cue.kind) {
    case "shot": {
      const impact = cue.fireMs + cue.flightMs;
      const tail = Math.max(IMPACT_RING_MS, cue.weapon === "long" ? LONG_LINE_FADE_MS : 0);
      return impact + tail;
    }
    case "number":
      return cue.startMs + NUMBER_RISE_MS;
    case "crossfire":
      return cue.startMs + CROSSFIRE_MS;
    case "shockwave":
      return cue.startMs + SHOCKWAVE_MS;
    case "knockback":
      return cue.startMs + KNOCKBACK_TAG_MS;
    case "breach":
      return cue.fireMs + cue.flightMs + BREACH_AFTER_MS;
    case "coverPlaced":
      return cue.startMs + COVER_PLACED_MS;
    case "aura":
      return cue.endMs;
    case "surge":
      return cue.startMs + SURGE_MS;
    case "aegisBeam":
      return cue.startMs + AEGIS_BEAM_MS;
    case "shieldGain":
      return cue.startMs + SHIELD_POP_MS;
    case "shieldHit":
      return cue.startMs + SHIELD_HIT_MS;
    default:
      return cue.startMs + STATUS_INTRO_MS;
  }
}

// ---- Field effects: Shockwave and Knockback, Breach Charge, Cover placed, Half Cover and the Shield ----

export const SHOCKWAVE_CARD = "Shockwave";
export const BREACH_CARD = "Breach Charge";
export const AEGIS_CARD = "Aegis Protocol";
export const SHOCKWAVE_MS = 700;
/** One tile of Knockback slides 24 px (a tile step) in 300 ms; the `Knockback 2` tag and the skid line outlast it. */
export const SLIDE_MS = 300;
export const KNOCKBACK_TAG_MS = 800;
export const BREACH_FLIGHT_MS = UNARMED_FLIGHT_MS;
export const BREACH_ARC_PX = 26;
export const BREACH_AFTER_MS = 1464;
/** The Controller slams the ground at 950 ms; the crate falls (0.45 s), lands (0.22 s) and unfolds (0.5 s): the bars stand 1.17 s later. */
export const COVER_SLAM_MS = 950;
export const COVER_WALL_UP_MS = 1170;
export const COVER_PLACED_MS = 1400;
/** Overdrive: the aura lasts at least this long (the two rings rise in a 1200 ms loop), and until the shot has left. */
export const AURA_MIN_MS = 1200;
export const AURA_AFTER_FIRE_MS = 400;
export const OVERDRIVE_TAG_IN_MS = 150;
export const OVERDRIVE_TAG_OUT_MS = 800;
/** The gold beam of Adrenal Surge starts here, is gone 672 ms later; the badge pops in `BADGE_DELAY_MS` after the beam starts. */
export const SURGE_START_MS = 384;
export const SURGE_MS = 1056;
export const BADGE_DELAY_MS = 528;
/** The beam of Aegis Protocol grows over 256 ms from here (full at about 900 ms), holds and is gone 1024 ms later. */
export const AEGIS_BEAM_START_MS = 640;
export const AEGIS_BEAM_MS = 1024;
export const SHIELD_POP_MS = 900;
export const SHIELD_HIT_MS = 1100;
/** Rubies pop at the Block's crouch (700 ms); Aegis Protocol's dome closes at 1340 ms. */
export const BLOCK_RUBIES_MS = 700;
export const AEGIS_RUBIES_MS = 1340;
/** The bubble starts forming this long before the rubies pop. */
export const BUBBLE_LEAD_MS = 190;
export const RIPPLE_DELAY_MS = 110;

/** A linear keyframe track: `[ms, value]` pairs in time order; before the first and after the last it holds the end value. */
export type Track = readonly (readonly [number, number])[];

export function sampleTrack(track: Track, ms: number): number {
  const first = track[0]!;
  if (ms <= first[0]) return first[1];
  for (let i = 1; i < track.length; i++) {
    const [t1, v1] = track[i]!;
    if (ms <= t1) {
      const [t0, v0] = track[i - 1]!;
      return v0 + ((v1 - v0) * (ms - t0)) / (t1 - t0);
    }
  }
  return track[track.length - 1]![1];
}

// ---- Overdrive: the aura, the beams and the badge (OverdriveEffects.html) ----

/** The gold glow around the Hero: fades in over 150 ms, holds, and fades out over the last 300 ms of the aura. */
export function auraGlowAt(ms: number, endMs: number): number {
  return sampleTrack([[0, 0], [150, 1], [Math.max(150, endMs - 300), 1], [endMs, 0]], ms);
}

/** One of the two gold rings rising from the ground (1200 ms loop, the second half a loop behind): 34 px up, 0.5 to 1.1 x. */
export function auraRingAt(ms: number, index: number): { rise: number; scale: number; alpha: number } | undefined {
  const t = ms - index * 600;
  if (t < 0) return undefined;
  const u = t % 1200;
  return { rise: sampleTrack([[0, 0], [1200, 34]], u), scale: sampleTrack([[0, 0.5], [1200, 1.1]], u), alpha: sampleTrack([[0, 0], [240, 0.9], [1200, 0]], u) };
}

/** Horizontal offsets (design px) of the rising sparks, and how long each waits in the loop. */
export const AURA_SPARKS = [{ dx: -10, delay: 0 }, { dx: -3, delay: 300 }, { dx: 5, delay: 600 }, { dx: 11, delay: 900 }] as const;

/** A spark of the aura: rises 40 px over a 1200 ms loop. */
export function auraSparkAt(ms: number, index: number): { rise: number; alpha: number } | undefined {
  const t = ms - AURA_SPARKS[index]!.delay;
  if (t < 0) return undefined;
  const u = t % 1200;
  return { rise: sampleTrack([[0, 0], [1200, 40]], u), alpha: sampleTrack([[0, 0], [240, 1], [1200, 0]], u) };
}

/** The `OVERDRIVE` tag: fades in over 150 ms, rises 10 px, gone by 800 ms. */
export function overdriveTagAt(ms: number): { rise: number; alpha: number } {
  return { rise: sampleTrack([[0, 0], [OVERDRIVE_TAG_OUT_MS, 10]], ms), alpha: ms >= OVERDRIVE_TAG_OUT_MS ? 0 : sampleTrack([[0, 0], [OVERDRIVE_TAG_IN_MS, 1], [OVERDRIVE_TAG_OUT_MS, 0]], ms) };
}

/** The gold beam from the caster to the ally, `ms` after it starts: grows over 192 ms, holds, gone by 672 ms. */
export function surgeBeamAt(ms: number): { length: number; alpha: number } {
  return { length: sampleTrack([[0, 0], [192, 1]], ms), alpha: ms < 0 ? 0 : sampleTrack([[0, 0.6], [192, 1], [480, 1], [672, 0]], ms) };
}

/** The `+1` badge `ms` after it appears: drops in from 2 x to 1 x over 192 ms; it stays until Exhaustion. */
export function badgeAt(ms: number): { scale: number; alpha: number } {
  return { scale: sampleTrack([[0, 2], [192, 1]], ms), alpha: sampleTrack([[0, 0], [192, 1]], ms) };
}

/** The beam of Aegis Protocol, `ms` after it starts. */
export function aegisBeamAt(ms: number): { length: number; alpha: number } {
  return { length: sampleTrack([[0, 0], [256, 1]], ms), alpha: ms < 0 ? 0 : sampleTrack([[0, 0], [256, 1], [768, 1], [AEGIS_BEAM_MS, 0]], ms) };
}

/** The gold blast of an Overdrive Breach Charge, much bigger than the normal one: grows from 0.2 to 2.1 x while it fades. */
export function bigFireballAt(ms: number): { scale: number; alpha: number } {
  return { scale: sampleTrack([[0, 0.2], [120, 1], [456, 1.6], [888, 2.1]], ms), alpha: sampleTrack([[0, 0], [120, 1], [456, 0.95], [888, 0]], ms) };
}

/** The puff of a Ghost Shot that found nobody: 0.3 to 1 to 2 x while it fades. */
export function puffAt(ms: number): { scale: number; alpha: number } | undefined {
  if (ms < 0 || ms >= 720) return undefined;
  return { scale: sampleTrack([[0, 0.3], [120, 1], [720, 2]], ms), alpha: sampleTrack([[0, 0], [120, 0.8], [720, 0]], ms) };
}

/** Shockwave ring `index` (0 to 2): orange, on the floor, 48 x 24 growing to 3 x over 580 ms, one every 100 ms. */
export function shockRingAt(ms: number, index: number): { scale: number; alpha: number } | undefined {
  const t = ms - index * 100;
  if (t < 0 || t >= 580) return undefined;
  return { scale: sampleTrack([[0, 0.5], [580, 3]], t), alpha: sampleTrack([[0, 1], [580, 0]], t) };
}

/** A dust puff of the Shockwave, `delay` ms after the rings: grows to 2.2 x and rises 4 px while it fades. */
export function dustAt(ms: number, delay: number): { scale: number; alpha: number; rise: number } | undefined {
  const t = ms - delay;
  if (t < 0 || t >= 500) return undefined;
  return {
    scale: sampleTrack([[0, 0.4], [120, 1], [500, 2.2]], t),
    alpha: sampleTrack([[0, 0], [120, 0.8], [500, 0]], t),
    rise: sampleTrack([[0, 0], [500, 4]], t),
  };
}

/** How far a Knockback slide has come (0 to 1), `ms` after it starts: it eases out over 300 ms. */
export function slideProgress(ms: number): number {
  const t = Math.min(1, Math.max(0, ms / SLIDE_MS));
  return 1 - (1 - t) * (1 - t);
}

/** The skid line behind a slid Hero: grows over 170 ms, fades by 560 ms. */
export function skidAt(ms: number): { length: number; alpha: number } {
  return { length: sampleTrack([[0, 0], [170, 1]], ms), alpha: ms <= 0 || ms >= 560 ? 0 : sampleTrack([[0, 0], [170, 0.8], [560, 0]], ms) };
}

/** The Breach Charge `ms` after it leaves: how far along the way it is (0 to 1) and how high the arc lifts it (26 px at most). */
export function chargeAt(ms: number): { progress: number; lift: number } {
  const progress = Math.min(1, Math.max(0, ms / BREACH_FLIGHT_MS));
  return { progress, lift: BREACH_ARC_PX * 4 * progress * (1 - progress) };
}

/** The four chunks of the broken Cover: where they fly (design px) and how they turn. `dyEnd` is where they come to rest. */
export const CHUNKS = [
  { dx: -22, dy: -22, dyEnd: 6, turn: -120 },
  { dx: 20, dy: -26, dyEnd: 4, turn: 140 },
  { dx: -8, dy: -30, dyEnd: 2, turn: 90 },
  { dx: 30, dy: -14, dyEnd: 6, turn: -60 },
] as const;

/** A chunk `ms` after the blast. */
export function chunkAt(ms: number, index: number): { x: number; y: number; turn: number; alpha: number } {
  const { dx, dy, dyEnd, turn } = CHUNKS[index]!;
  const fly = sampleTrack([[48, 0], [456, 1]], ms);
  return {
    x: dx * fly,
    y: dy * fly + (dyEnd - dy) * sampleTrack([[456, 0], [1250, 1]], ms),
    turn: turn * fly,
    alpha: sampleTrack([[0, 0], [48, 1], [1250, 1], [1440, 0]], ms),
  };
}

export function fireballAt(ms: number): { scale: number; alpha: number } {
  return { scale: sampleTrack([[0, 0.2], [120, 1], [456, 1.5], [888, 1.9]], ms), alpha: sampleTrack([[0, 0], [120, 1], [456, 0.9], [888, 0]], ms) };
}

export function smokeAt(ms: number): { scale: number; alpha: number; rise: number } {
  const t = ms - 120;
  return { scale: sampleTrack([[0, 0.5], [980, 2]], t), alpha: sampleTrack([[0, 0], [168, 0.7], [980, 0]], t), rise: sampleTrack([[0, 0], [980, 22]], t) };
}

/** The dark scorch diamond: appears 72 ms after the blast and stays until the end. */
export function scorchAt(ms: number): number {
  return sampleTrack([[0, 0], [72, 0], [264, 1], [1200, 1], [1464, 0]], ms);
}

/** The phases of the drop of built Cover (design `cover-drop.webp`): the crate falls, lands, unfolds into the bars. */
export const COVER_FALL_MS = 450;
export const COVER_LAND_MS = 220;
export const COVER_UNFOLD_MS = 500;

const easeIn = (u: number) => u * u;
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

export interface CoverDrop {
  /** The yellow dashed target and the growing shadow (0 to 1); gone once the bars stand. */
  target: number;
  /** Shadow size (0 to 1) under the falling crate. */
  shadow: number;
  /** How far above its tile the crate still is (1 at the start, 0 on landing); 0 when it is not drawn. */
  crateHeight: number;
  /** The landing ring and dust: 0 before the landing, then 0 to 1 over its 0.22 s. */
  landing: number;
  /** The tile flash (yellow) on landing, 0 to 1 to 0. */
  flash: number;
  /** The share of its final height the unfolding bars have (0 to 1); 0 before they start. */
  unfold: number;
  /** The crate itself is still visible (before it unfolds). */
  crate: boolean;
}

/** The state of the drop of built Cover `ms` after it starts. Ends with the terrain taking over at `COVER_WALL_UP_MS`. */
export function coverDropAt(ms: number): CoverDrop {
  const fall = Math.min(1, Math.max(0, ms / COVER_FALL_MS));
  const sinceLanding = ms - COVER_FALL_MS;
  const landing = Math.min(1, Math.max(0, sinceLanding / COVER_LAND_MS));
  const unfold = Math.min(1, Math.max(0, (sinceLanding - COVER_LAND_MS) / COVER_UNFOLD_MS));
  return {
    target: ms < COVER_WALL_UP_MS ? 1 : 0,
    shadow: easeIn(fall),
    crateHeight: ms >= COVER_FALL_MS ? 0 : 1 - easeIn(fall),
    landing: sinceLanding < 0 ? 0 : landing,
    flash: sinceLanding < 0 || sinceLanding > COVER_LAND_MS ? 0 : 1 - Math.abs(2 * landing - 1),
    unfold: easeOut(unfold),
    crate: unfold === 0,
  };
}

/** A ruby of the Shield pops (0 to 1.5 to 1) `ms` after its turn; `index` staggers them by 60 ms. */
export function rubyPopAt(ms: number, index: number): number {
  return sampleTrack([[0, 0], [256, 1.5], [448, 1]], ms - index * 60);
}

/** The bubble forms: grows 0.6 to 1.08 to 1 while it fades in; `ms` counts from the start of its formation. */
export function bubbleFormAt(ms: number): { scale: number; alpha: number } {
  return { scale: sampleTrack([[0, 0.6], [384, 1.08], [576, 1]], ms), alpha: sampleTrack([[0, 0], [384, 1]], ms) };
}

/** The ripple over the bubble after an absorbed hit: from the impact on, 110 ms later it runs 1 to 1.7 x while it fades. */
export function rippleAt(ms: number): { scale: number; alpha: number } | undefined {
  const t = ms - RIPPLE_DELAY_MS;
  if (t < 0 || t >= 990) return undefined;
  return { scale: sampleTrack([[0, 1], [990, 1.7]], t), alpha: sampleTrack([[0, 0], [104, 0.9], [990, 0]], t) };
}

/** The ruby an absorbed hit removes swells to 1.6 x and bursts: `ms` after the impact. */
export function rubyBurstAt(ms: number): number {
  return ms < 0 ? 1 : sampleTrack([[0, 1], [210, 1.6], [520, 0]], ms);
}

/** The shards the bubble breaks into when the last Shield is gone: design px, and how they turn. */
export const SHARDS = [
  { dx: -18, dy: -14, turn: -90 },
  { dx: 16, dy: -18, turn: 120 },
  { dx: -8, dy: -26, turn: 40 },
  { dx: 22, dy: -4, turn: -60 },
  { dx: -24, dy: 2, turn: 170 },
] as const;

export function shardAt(ms: number, index: number): { x: number; y: number; turn: number; alpha: number } | undefined {
  if (ms < 0 || ms >= 420) return undefined;
  const { dx, dy, turn } = SHARDS[index]!;
  const u = ms / 420;
  return { x: dx * u, y: dy * u, turn: turn * u, alpha: 1 - u };
}

/** Cover the playback adds to or takes off the board, and when in the frame (the terrain follows the effect). */
export interface CoverEdit {
  kind: "placed" | "destroyed";
  tile: GridPosition;
  atMs: number;
}

export function coverEditsOf(cues: readonly EffectCue[]): CoverEdit[] {
  return cues.flatMap((cue): CoverEdit[] => {
    if (cue.kind === "breach") return !cue.cover ? [] : [{ kind: "destroyed", tile: cue.tile, atMs: cue.fireMs + cue.flightMs }];
    if (cue.kind === "coverPlaced") return [{ kind: "placed", tile: cue.tile, atMs: cue.startMs + COVER_WALL_UP_MS }];
    return [];
  });
}

/** How many tiles a card pushes (its Knockback effect), for the tag. */
function pushOf(card: string | undefined): number {
  const definition = Object.values(HERO_DECKS)
    .flat()
    .find((candidate) => candidate.name === card);
  return definition?.effects.find((effect) => effect.kind === EffectKind.Knockback)?.amount ?? 1;
}

/** The number a hit puts above the target, in the order shown: Shield first, then Deck Damage. */
function hitNumbers(event: MatchEvent, startMs: number): EffectCue[] {
  const cues: EffectCue[] = [];
  const toId = event.targetId!;
  if ((event.absorbed ?? 0) > 0) cues.push({ kind: "number", toId, startMs, text: `Shield -${event.absorbed}`, style: "shield" });
  if ((event.damage ?? 0) > 0) {
    // The long-range bonus of the Long Shot (4 from Range 6) is gold.
    const bonus = event.card === "Long Shot" && (event.distance ?? 0) >= LONG_RANGE_FROM;
    cues.push({ kind: "number", toId, startMs, text: `-${event.damage}`, style: bonus ? "bonus" : "damage" });
  }
  return cues;
}

/** Why a failed Attack failed, as the number shows it: beyond the Range of its card, not visible, or stopped on the way. */
export function failureText(event: MatchEvent): string {
  if (event.reason === AttackFailReason.OutOfRange) return "Out of range";
  if (event.reason === AttackFailReason.TooClose) return "Too close";
  if (event.reason === AttackFailReason.NotVisible) return "Not visible";
  return "Blocked";
}

/**
 * The cues of the events of one frame. `fireOf` gives the `fire` beat of the clip the attacker plays for a card. A Tag
 * Round or a Slow in the frame starts its state when the dart lands (or at the field beat of the Slow pulse).
 */
export function effectCuesOf(events: readonly MatchEvent[], fireOf: (heroId: string, card: string | undefined) => number): EffectCue[] {
  const frame: CueFrame = { events, fireOf, cues: [], auras: new Map(), surgeCaster: undefined };
  for (const event of events) {
    if (event.overdrive) noteAura(event, frame);
    CUE_BUILDERS[event.kind]?.(event, frame);
  }
  for (const [heroId, endMs] of frame.auras) frame.cues.push({ kind: "aura", heroId, endMs });
  return frame.cues;
}

/** What the cue builders share while one frame is read: the events, the cues so far and the Overdrive state. */
interface CueFrame {
  events: readonly MatchEvent[];
  fireOf: (heroId: string, card: string | undefined) => number;
  cues: EffectCue[];
  auras: Map<string, number>;
  surgeCaster: string | undefined;
}

/** The Overdrive aura of the Hero who plays the card lasts until its action is over. */
function noteAura(event: MatchEvent, frame: CueFrame): void {
  const actor = overdriveActor(event, frame.events);
  if (actor === undefined) return;
  frame.auras.set(actor, Math.max(frame.auras.get(actor) ?? 0, auraEndMs(frame.fireOf(actor, event.card))));
}

/** The attack hit of the same Hero on the same target as `event` (the Tag Round and Slow cues time themselves by its distance). */
function hitBefore(event: MatchEvent, events: readonly MatchEvent[]): MatchEvent | undefined {
  return events.find((other) => other.kind === EventKind.AttackHit && other.heroId === event.heroId && other.targetId === event.targetId);
}

function failedAttackCues(event: MatchEvent, toId: string, frame: CueFrame): void {
  const fire = frame.fireOf(event.heroId, event.card);
  if (event.overdrive && event.card === GHOST_SHOT_CARD) {
    // A Ghost Shot at a tile with nobody on it: the bolt flies there and a grey puff answers.
    const flight = flightMs(event.card, event.distance);
    frame.cues.push({ kind: "shot", weapon: "precision", fromId: event.heroId, toId, fireMs: fire, flightMs: flight, overdrive: true, miss: true });
    frame.cues.push({ kind: "number", toId, startMs: fire + flight + NUMBER_DELAY_MS, text: NOBODY_THERE, style: "failed" });
    return;
  }
  frame.cues.push({ kind: "number", toId, startMs: fire + NUMBER_DELAY_MS, text: failureText(event), style: "failed" });
}

/** The CROSSFIRE label of a hit with Crossfire, stacked above the labels the target already has in this frame. */
function crossfireCue(event: MatchEvent, toId: string, startMs: number, cues: EffectCue[]): void {
  if ((event.crossfire ?? 0) <= 0) return;
  const stack = cues.filter((cue) => cue.kind === "crossfire" && cue.toId === toId).length;
  cues.push({ kind: "crossfire", toId, startMs, amount: event.crossfire!, stack });
}

function hitCues(event: MatchEvent, toId: string, frame: CueFrame): void {
  const { cues } = frame;
  const fire = frame.fireOf(event.heroId, event.card);
  const weapon = weaponOf(event.card);
  const flight = flightMs(event.card, event.distance);
  if (weapon !== undefined) {
    cues.push({
      kind: "shot",
      weapon,
      fromId: event.heroId,
      toId,
      fireMs: fire,
      flightMs: flight,
      // A Long Shot in Overdrive at short range looks like the normal shot: the bonus needs the long range.
      overdrive: event.overdrive === true && !(event.card === LONG_SHOT_CARD && (event.distance ?? 0) < LONG_RANGE_FROM),
      ...(event.halfCover && { halfCover: true as const }),
    });
  }
  if (event.card === BREACH_CARD && event.overdrive && event.tile) {
    addBreach(cues, { kind: "breach", casterId: event.heroId, tile: event.tile, fireMs: fire, flightMs: BREACH_FLIGHT_MS, cover: false, overdrive: true });
  }
  cues.push(...hitNumbers(event, fire + flight + NUMBER_DELAY_MS));
  crossfireCue(event, toId, fire + flight + NUMBER_DELAY_MS, cues);
  if (event.halfCover) {
    cues.push({ kind: "number", toId, startMs: fire + flight + NUMBER_DELAY_MS, text: "Half Cover", style: "failed", drop: 9 });
  }
  if ((event.absorbed ?? 0) > 0) cues.push({ kind: "shieldHit", toId, startMs: fire + flight, absorbed: event.absorbed! });
  if (event.card === SHOCKWAVE_CARD && !cues.some((cue) => cue.kind === "shockwave" && cue.casterId === event.heroId)) {
    cues.push({ kind: "shockwave", casterId: event.heroId, startMs: fire, ...(event.overdrive && { overdrive: true as const }) });
  }
}

function attackCues(event: MatchEvent, frame: CueFrame): void {
  if (event.targetId === undefined) return;
  if (event.kind === EventKind.AttackFailed) failedAttackCues(event, event.targetId, frame);
  else hitCues(event, event.targetId, frame);
}

function knockbackCues(event: MatchEvent, frame: CueFrame): void {
  if (!event.from || !event.to) return;
  const shock = frame.events.find((other) => other.kind === EventKind.AttackHit && other.card === event.card);
  const start = shock === undefined ? 0 : frame.fireOf(shock.heroId, event.card);
  frame.cues.push({
    kind: "knockback",
    toId: event.heroId,
    from: event.from,
    to: event.to,
    startMs: start,
    tag: `Knockback ${pushOf(event.card)}`,
    ...(event.overdrive && { overdrive: true as const }),
  });
}

/** Pull slides the enemy toward the caster: the Knockback slide, tagged with the Pull of the card. */
function pullCues(event: MatchEvent, frame: CueFrame): void {
  if (!event.from || !event.to) return;
  frame.cues.push({
    kind: "knockback",
    toId: event.heroId,
    from: event.from,
    to: event.to,
    startMs: 0,
    tag: "Pull",
  });
}

function coverDestroyedCues(event: MatchEvent, frame: CueFrame): void {
  if (!event.to) return;
  addBreach(frame.cues, {
    kind: "breach",
    casterId: event.heroId,
    tile: event.to,
    fireMs: frame.fireOf(event.heroId, event.card),
    flightMs: BREACH_FLIGHT_MS,
    cover: true,
    overdrive: event.overdrive === true,
  });
}

function attackBonusCues(event: MatchEvent, frame: CueFrame): void {
  if (!event.overdrive) return;
  // Adrenal Surge in Overdrive: the first event is the caster's own bonus, the second the ally's.
  frame.surgeCaster ??= event.heroId;
  frame.cues.push({ kind: "surge", casterId: frame.surgeCaster, toId: event.heroId, startMs: SURGE_START_MS });
}

function shieldGainedCues(event: MatchEvent, frame: CueFrame): void {
  if (event.overdrive && event.card === AEGIS_CARD && event.casterId !== undefined && event.casterId !== event.heroId) {
    frame.cues.push({ kind: "aegisBeam", casterId: event.casterId, toId: event.heroId, startMs: AEGIS_BEAM_START_MS });
  }
  const startMs = event.card === AEGIS_CARD ? AEGIS_RUBIES_MS : BLOCK_RUBIES_MS;
  frame.cues.push({ kind: "shieldGain", toId: event.heroId, startMs, amount: event.amount ?? 0 });
}

function coverPlacedCues(event: MatchEvent, frame: CueFrame): void {
  if (!event.to) return;
  frame.cues.push({ kind: "coverPlaced", casterId: event.heroId, tile: event.to, startMs: COVER_SLAM_MS });
}

function markedCues(event: MatchEvent, frame: CueFrame): void {
  if (event.targetId === undefined) return;
  const hit = hitBefore(event, frame.events);
  const markTarget = event.card === MARK_TARGET_CARD;
  // Mark Target in Overdrive throws its own dart from the Assassin's clip; Tag Round's dart leaves at 730 ms.
  const startMs = markTarget ? frame.fireOf(event.heroId, event.card) + flightMs(event.card, hit?.distance) : TAG_FIRE_MS + flightMs("Tag Round", hit?.distance);
  frame.cues.push({ kind: "marked", toId: event.targetId, startMs, ...(event.overdrive && markTarget && { overdrive: true as const }) });
}

function slowCues(event: MatchEvent, frame: CueFrame): void {
  if (event.targetId === undefined) return;
  // Tag Round in Overdrive: Marked and Slow at the same time, when the dart lands.
  const hit = hitBefore(event, frame.events);
  const together = event.overdrive && event.card === "Tag Round";
  frame.cues.push({ kind: "slow", toId: event.targetId, startMs: together ? TAG_FIRE_MS + flightMs("Tag Round", hit?.distance) : SLOW_FIELD_MS });
}

/** The cue builder of each kind of event that has cues. */
const CUE_BUILDERS: Partial<Record<EventKind, (event: MatchEvent, frame: CueFrame) => void>> = {
  [EventKind.AttackHit]: attackCues,
  [EventKind.AttackFailed]: attackCues,
  [EventKind.Knockback]: knockbackCues,
  [EventKind.Pull]: pullCues,
  [EventKind.CoverDestroyed]: coverDestroyedCues,
  [EventKind.AttackBonusGained]: attackBonusCues,
  [EventKind.ShieldGained]: shieldGainedCues,
  [EventKind.CoverPlaced]: coverPlacedCues,
  [EventKind.MarkedApplied]: markedCues,
  [EventKind.SlowApplied]: slowCues,
};

export const LONG_SHOT_CARD = "Long Shot";
export const GHOST_SHOT_CARD = "Ghost Shot";
export const MARK_TARGET_CARD = "Mark Target";
export const NOBODY_THERE = "nobody there";

/** How long the aura of an Overdrive action lasts when the Hero fires at `fireMs`. */
function auraEndMs(fireMs: number): number {
  return Math.max(AURA_MIN_MS, fireMs + AURA_AFTER_FIRE_MS);
}

/** The Hero that plays the card an Overdrive event comes from; the events that name the receiver or the victim first do not give it away. */
function overdriveActor(event: MatchEvent, events: readonly MatchEvent[]): string | undefined {
  switch (event.kind) {
    case EventKind.Knockback:
    case EventKind.Pull:
    case EventKind.CoverReductionIgnored:
    case EventKind.HiddenGained:
      return undefined;
    case EventKind.AttackBonusGained:
      // The caster's own bonus comes first.
      return events.find((other) => other.kind === EventKind.AttackBonusGained && other.card === event.card)?.heroId;
    case EventKind.ShieldGained:
      return event.casterId ?? event.heroId;
    default:
      return event.heroId;
  }
}

type BreachCue = Extract<EffectCue, { kind: "breach" }>;

/** One cue per caster and tile: the hits of the blast and the destroyed Cover are the same explosion. */
function addBreach(cues: EffectCue[], cue: BreachCue): void {
  const i = cues.findIndex((other) => other.kind === "breach" && other.casterId === cue.casterId && other.tile.col === cue.tile.col && other.tile.row === cue.tile.row);
  const previous = cues[i];
  if (previous?.kind === "breach") cues[i] = { ...cue, cover: cue.cover || previous.cover };
  else cues.push(cue);
}

/** Position in `0..1` along the way of a projectile `ms` after the fire beat; the Long Shot is at the target at once. */
export function flightProgress(ms: number, flight: number): number {
  if (ms < 0) return 0;
  return flight <= 0 ? 1 : Math.min(1, ms / flight);
}

/** The offset in px (design size) the screen shakes by `ms` after a Long Shot lands; deterministic, none after 150 ms. */
export function shakeAt(ms: number): { x: number; y: number } {
  if (ms < 0 || ms >= SHAKE_MS) return { x: 0, y: 0 };
  const fade = 1 - ms / SHAKE_MS;
  return { x: Math.sin(ms * 0.9) * SHAKE_PX * fade, y: Math.cos(ms * 1.3) * SHAKE_PX * fade };
}

/** How far a number has risen and how visible it is, `ms` after its first frame (20 ms after the impact). */
export function numberAt(ms: number): { rise: number; alpha: number } {
  if (ms < 0 || ms >= NUMBER_RISE_MS) return { rise: ms < 0 ? 0 : NUMBER_RISE_PX, alpha: 0 };
  const t = ms / NUMBER_RISE_MS;
  return { rise: NUMBER_RISE_PX * t, alpha: t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5 };
}

/** The CROSSFIRE label `ms` after it appears: rises 8 px and fades out over 700 ms. */
export function crossfireAt(ms: number): { rise: number; alpha: number } {
  if (ms < 0 || ms >= CROSSFIRE_MS) return { rise: ms < 0 ? 0 : CROSSFIRE_RISE_PX, alpha: 0 };
  const t = ms / CROSSFIRE_MS;
  return { rise: CROSSFIRE_RISE_PX * t, alpha: t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6 };
}

/** The scale of a Marked reticle `ms` after it locks on: 2.4 x down to 1 x, turning 45 degrees. */
export function reticleAt(ms: number): { scale: number; rotation: number; alpha: number } {
  const t = Math.min(1, Math.max(0, ms / STATUS_INTRO_MS));
  return { scale: 2.4 - 1.4 * t, rotation: 45 * t, alpha: Math.min(1, t * 3) };
}
