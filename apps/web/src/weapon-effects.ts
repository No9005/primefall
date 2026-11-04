import { EventKind, HERO_DECKS, LONG_RANGE_FROM, type MatchEvent } from "game-core";

// The effects of the attacks (docs/design/animation/README.md, "Effects"): which cue an event causes and when it starts and
// ends. Pure data and functions, so the scheduling is tested without a browser; `effects-layer.ts` draws the cues.
// All times are milliseconds from the start of the playback frame at normal clip speed.

export type Weapon = "slam" | "precision" | "long" | "pulse" | "tag";

const WEAPON_OF_CARD: Readonly<Record<string, Weapon>> = {
  "Slam Shot": "slam",
  "Concussion Round": "slam",
  "Precision Shot": "precision",
  "Piercing Round": "precision",
  "Execution Round": "precision",
  "Ghost Shot": "precision",
  "Long Shot": "long",
  "Pulse Bolt": "pulse",
  "Shock Pulse": "pulse",
  "Tag Round": "tag",
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
  | { kind: "shot"; weapon: Weapon; fromId: string; toId: string; fireMs: number; flightMs: number; overdrive: boolean }
  | { kind: "number"; toId: string; startMs: number; text: string; style: NumberStyle }
  /** Marked and Slow lock on at `startMs` and last (as state) until the end of the next Resolution. */
  | { kind: "marked" | "slow"; toId: string; startMs: number };

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
    default:
      return cue.startMs + STATUS_INTRO_MS;
  }
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

/** Why a failed Attack failed, as the number shows it: beyond the Range of its card, or stopped on the way. */
export function failureText(event: MatchEvent): string {
  const card = Object.values(HERO_DECKS)
    .flat()
    .find((candidate) => candidate.name === event.card);
  return card?.range !== undefined && (event.distance ?? 0) > card.range ? "Out of range" : "Blocked";
}

/**
 * The cues of the events of one frame. `fireOf` gives the `fire` beat of the clip the attacker plays for a card. A Tag
 * Round or a Slow in the frame starts its state when the dart lands (or at the field beat of the Slow pulse).
 */
export function effectCuesOf(events: readonly MatchEvent[], fireOf: (heroId: string, card: string | undefined) => number): EffectCue[] {
  const cues: EffectCue[] = [];
  for (const event of events) {
    if (event.kind === EventKind.AttackHit || event.kind === EventKind.AttackFailed) {
      if (event.targetId === undefined) continue;
      const fire = fireOf(event.heroId, event.card);
      const weapon = weaponOf(event.card);
      const flight = flightMs(event.card, event.distance);
      if (event.kind === EventKind.AttackFailed) {
        cues.push({ kind: "number", toId: event.targetId, startMs: fire + NUMBER_DELAY_MS, text: failureText(event), style: "failed" });
        continue;
      }
      if (weapon !== undefined) {
        cues.push({
          kind: "shot",
          weapon,
          fromId: event.heroId,
          toId: event.targetId,
          fireMs: fire,
          flightMs: flight,
          overdrive: event.overdrive === true,
        });
      }
      cues.push(...hitNumbers(event, fire + flight + NUMBER_DELAY_MS));
    }
    if (event.kind === EventKind.MarkedApplied && event.targetId !== undefined) {
      const hit = events.find((other) => other.kind === EventKind.AttackHit && other.heroId === event.heroId && other.targetId === event.targetId);
      cues.push({ kind: "marked", toId: event.targetId, startMs: TAG_FIRE_MS + flightMs("Tag Round", hit?.distance) });
    }
    if (event.kind === EventKind.SlowApplied && event.targetId !== undefined) {
      cues.push({ kind: "slow", toId: event.targetId, startMs: SLOW_FIELD_MS });
    }
  }
  return cues;
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

/** The scale of a Marked reticle `ms` after it locks on: 2.4 x down to 1 x, turning 45 degrees. */
export function reticleAt(ms: number): { scale: number; rotation: number; alpha: number } {
  const t = Math.min(1, Math.max(0, ms / STATUS_INTRO_MS));
  return { scale: 2.4 - 1.4 * t, rotation: 45 * t, alpha: Math.min(1, t * 3) };
}
