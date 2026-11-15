import { AttackFailReason, EffectKind, EventKind, type GridPosition, HERO_DECKS, type MatchEvent } from "game-core";

// The effects of the attacks (docs/design/animation/README.md, "Effects"): which cue an event causes and when it starts and
// ends. Pure data and functions, so the scheduling is tested without a browser; `effects-layer.ts` draws the cues.
// All times are milliseconds from the start of the playback frame at normal clip speed.

export type Weapon = "slam" | "precision" | "long" | "tag";

const WEAPON_OF_CARD: Readonly<Record<string, Weapon>> = {
  "Handle With Care": "slam",
  "Buy One, Get Two": "slam",
  "Time for Coffee": "slam",
  "Shield Breaker": "precision",
  "Long Shot": "long",
  "Price Tag": "tag",
};

/** Cards that strike the target themselves: the target reacts at the beat of the blow, nothing flies. */
const MELEE_CARDS: ReadonlySet<string> = new Set(["Personal Space"]);

/** The weapon a card fires; cards without a projectile of their own (Urban Renewal) have none. */
export function weaponOf(card: string | undefined): Weapon | undefined {
  return card === undefined ? undefined : WEAPON_OF_CARD[card];
}

/** One tile of Range in px at design size (a tile step of a Pull slides 24 px). */
export const TILE_PX = 24;
/** Flight speed in design px per millisecond; the Long Shot has none, its line is there at once. */
export const PROJECTILE_SPEED: Readonly<Record<Weapon, number>> = { slam: 0.1, precision: 0.3, long: Infinity, tag: 0.3 };
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
/** The SCRAP label rises when Tilly's Scrap clip has pressed the pieces into her core. */
export const SCRAP_LABEL_MS = 2160;
/** The rubble circles the hand until the fist closes at 2020 ms of the Scrap clip. */
export const SCRAP_PULL_MS = 2020;
/** The rubble lifts off at 600 ms and the pieces fly in one after the other from 1100 ms, 70 ms apart, in 450 ms each. */
export const SCRAP_PIECES = 8;
export const STATUS_INTRO_MS = 300;

/** Milliseconds a projectile flies over `distance` tiles. */
export function flightMs(card: string | undefined, distance: number | undefined): number {
  if (card !== undefined && MELEE_CARDS.has(card)) return 0;
  const weapon = weaponOf(card);
  if (weapon === undefined) return UNARMED_FLIGHT_MS;
  return Math.round(((distance ?? 0) * TILE_PX) / PROJECTILE_SPEED[weapon]);
}

/** From the start of the frame to the impact on the target, given the `fire` beat of the attacker's clip. */
export function impactMs(card: string | undefined, distance: number | undefined, fireMs: number): number {
  return fireMs + flightMs(card, distance);
}

export type NumberStyle = "damage" | "bonus" | "shield" | "failed" | "scrap";

export type EffectCue =
  /** `halfCover`: Half Cover on the target's tile reduced the damage, so the projectile hits the wall in front of the target. */
  | { kind: "shot"; weapon: Weapon; fromId: string; toId: string; fireMs: number; flightMs: number; halfCover?: true }
  /** `drop`: design px the label sits below the usual place (a tag under a number). */
  | { kind: "number"; toId: string; startMs: number; text: string; style: NumberStyle; drop?: number }
  /** Marked and Slow lock on at `startMs` and last (as state) until the end of the next Resolution. */
  | { kind: "marked" | "slow"; toId: string; startMs: number }
  /** The Bruiser has arrived next to its target after a Charge: speed streaks trail behind it, away from the target. */
  | { kind: "charge"; heroId: string; targetId: string; startMs: number }
  /**
   * One tile of Pull: the Hero slides from `from` to `to` toward `casterId`, with a tether to the caster, two fading echoes
   * behind it and a ring on arrival. A Squad that did not see where the Hero stood gets no `from` and no slide: the Hero
   * is just there, with the ring. A Squad that does not see the caster gets no `casterId` and so no tether.
   */
  | { kind: "pull"; toId: string; from?: GridPosition; to: GridPosition; startMs: number; casterId?: string; tag: string }
  /**
   * Urban Renewal: the bomb flies from the caster to the tile, which blows up at `fireMs + flightMs`; the blast covers `size`
   * by `size` tiles. `cover`: Cover was destroyed there, so its chunks fly.
   */
  | { kind: "breach"; casterId: string; tile: GridPosition; fireMs: number; flightMs: number; cover: boolean; size: number }
  /** The oldest Placed Cover of a Squad goes when a fourth is placed: it crumbles into four chunks (no fireball, no scorch). */
  | { kind: "coverCrumble"; tile: GridPosition; startMs: number }
  /** Scrap: rubble lifts off the blasted tile, flies into the open hand of the caster, circles there and is pressed into a ball. */
  | { kind: "scrapPull"; casterId: string; tile: GridPosition; startMs: number }
  /** Temporary Solution: a flash on the tile at `startMs`, then the wall rises. */
  | { kind: "coverPlaced"; casterId: string; tile: GridPosition; startMs: number }
  /** A Hero gains Shield: the rubies pop and the bubble forms. `startMs` is when the rubies pop. */
  | { kind: "shieldGain"; toId: string; startMs: number; amount: number }
  /** A hit that the Shield absorbed (`absorbed` rubies burst) at `startMs`, the impact. */
  | { kind: "shieldHit"; toId: string; startMs: number; absorbed: number }
  /** A hit with Crossfire: the label "CROSSFIRE +N" above the numbers; `stack` counts the labels already on the target in this frame. */
  | { kind: "crossfire"; toId: string; startMs: number; amount: number; stack: number }
  /** The label of extra damage that is not Crossfire (CLOSE +1 of a close-range effect), stacked like the CROSSFIRE label. */
  | { kind: "bonus"; toId: string; startMs: number; text: string; tone: BonusTone; stack: number };

export type BonusTone = "close" | "marked";

/** When a cue is over, for the length of the frame. */
export function cueEndMs(cue: EffectCue): number {
  switch (cue.kind) {
    case "shot": {
      const impact = cue.fireMs + cue.flightMs;
      const tail = Math.max(IMPACT_RING_MS, cue.weapon === "long" ? LONG_LINE_FADE_MS : 0);
      return impact + tail;
    }
    case "breach":
      return cue.fireMs + cue.flightMs + BREACH_AFTER_MS;
    default:
      return cue.startMs + (CUE_LENGTH_MS[cue.kind] ?? STATUS_INTRO_MS);
  }
}

// ---- Field effects: Pull and Charge, Urban Renewal, Cover placed, Half Cover and the Shield ----

export const BREACH_CARD = "Urban Renewal";
/** The card whose damage comes from a Scrap Field: its caster does not act when it lands. */
export const FIELD_CARD = "Heavy Metal";
export const CHARGE_CARD = "Express Delivery";
/** One tile of Pull slides 24 px (a tile step) in 300 ms. */
export const SLIDE_MS = 300;
/** A tile of Pull: the slide (`SLIDE_MS`), then the ring and the `PULL 2` tag; the whole cue is over after this. */
export const PULL_MS = 1100;
/** The speed streaks of a Charge grow over 150 ms and are gone after this. */
export const CHARGE_STREAK_MS = 600;
/** The tag over a Hero that gained Shield from a Charge. */
export const CHARGE_SHIELD_TAG = "SHIELD 2 · THIS ROUND";
/** The echoes of a pulled Hero trail behind it by these fractions of the slide. */
export const PULL_ECHO_LAGS = [0.2, 0.4] as const;
/** The bomb of Urban Renewal leaves at 820 ms and lands at 1160 ms of its clip. */
export const BREACH_FLIGHT_MS = 340;
export const BREACH_ARC_PX = 26;
export const BREACH_AFTER_MS = 1464;
/** The Controller slams the ground at 950 ms; the crate falls (0.45 s), lands (0.22 s) and unfolds (0.5 s): the bars stand 1.17 s later. */
export const COVER_SLAM_MS = 950;
export const COVER_WALL_UP_MS = 1170;
export const COVER_PLACED_MS = 1400;
/** The oldest Cover crumbles when the new crate has landed (0.45 s after the slam); the chunks are gone 0.9 s later. */
export const COVER_CRUMBLE_DELAY_MS = 450;
export const COVER_CRUMBLE_MS = 900;
export const SHIELD_POP_MS = 900;
export const SHIELD_HIT_MS = 1100;
/** Rubies pop at the Shield gesture's crouch (700 ms). */
export const BLOCK_RUBIES_MS = 700;
/** The bubble starts forming this long before the rubies pop. */
export const BUBBLE_LEAD_MS = 190;
export const RIPPLE_DELAY_MS = 110;

/** How long each cue that starts at `startMs` lasts; Marked and Slow (not listed) lock on within `STATUS_INTRO_MS`. */
const CUE_LENGTH_MS: Readonly<Partial<Record<EffectCue["kind"], number>>> = {
  number: NUMBER_RISE_MS,
  crossfire: CROSSFIRE_MS,
  bonus: CROSSFIRE_MS,
  pull: PULL_MS,
  charge: CHARGE_STREAK_MS,
  coverPlaced: COVER_PLACED_MS,
  scrapPull: SCRAP_PULL_MS,
  coverCrumble: COVER_CRUMBLE_MS,
  shieldGain: SHIELD_POP_MS,
  shieldHit: SHIELD_HIT_MS,
};

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

/** How far a slide has come (0 to 1), `ms` after it starts: it eases out over 300 ms. */
export function slideProgress(ms: number): number {
  const t = Math.min(1, Math.max(0, ms / SLIDE_MS));
  return 1 - (1 - t) * (1 - t);
}

/** The bomb of Urban Renewal `ms` after it leaves: how far along the way it is (0 to 1) and how high the arc lifts it (26 px at most). */
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
  /** The Hero that placed the Cover, for `placed`: the playback tells the Squad's own Cover from the enemy's. */
  casterId?: string;
  /** False for Placed Cover that goes because a fourth was placed: it leaves no scorched outline. */
  scorch?: boolean;
}

export function coverEditsOf(cues: readonly EffectCue[]): CoverEdit[] {
  return cues.flatMap((cue): CoverEdit[] => {
    if (cue.kind === "breach") return !cue.cover ? [] : [{ kind: "destroyed", tile: cue.tile, atMs: cue.fireMs + cue.flightMs }];
    if (cue.kind === "coverPlaced") return [{ kind: "placed", tile: cue.tile, atMs: cue.startMs + COVER_WALL_UP_MS, casterId: cue.casterId }];
    if (cue.kind === "coverCrumble") return [{ kind: "destroyed", tile: cue.tile, atMs: cue.startMs, scorch: false }];
    return [];
  });
}

/** The tag of a forced slide: `PULL 2` for a Pull, `PUSH 3` for a Knockback. */
function slideTag(card: string | undefined): string {
  const effects = Object.values(HERO_DECKS).flat().find((candidate) => candidate.name === card)?.effects ?? [];
  const push = effects.find((effect) => effect.kind === EffectKind.Knockback);
  return push ? `PUSH ${push.amount ?? 1}` : `PULL ${effects.find((effect) => effect.kind === EffectKind.Pull)?.amount ?? 1}`;
}

/** Whether a slide is a Knockback: the pushed Hero is not tethered to the caster. */
const isPush = (card: string | undefined) => slideTag(card).startsWith("PUSH");

/** The number a hit puts above the target, in the order shown: Shield first, then Deck Damage. */
function hitNumbers(event: MatchEvent, startMs: number): EffectCue[] {
  const cues: EffectCue[] = [];
  const toId = event.targetId!;
  if ((event.absorbed ?? 0) > 0) cues.push({ kind: "number", toId, startMs, text: `Shield -${event.absorbed}`, style: "shield" });
  if ((event.damage ?? 0) > 0) {
    cues.push({ kind: "number", toId, startMs, text: `-${event.damage}`, style: "damage" });
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
  const frame: CueFrame = { events, fireOf, cues: [] };
  for (const event of events) {
    CUE_BUILDERS[event.kind]?.(event, frame);
  }
  return frame.cues;
}

/** What the cue builders share while one frame is read: the events, and the cues so far. */
interface CueFrame {
  events: readonly MatchEvent[];
  fireOf: (heroId: string, card: string | undefined) => number;
  cues: EffectCue[];
}

/** The attack hit of the same Hero on the same target as `event` (the Tag Round and Slow cues time themselves by its distance). */
function hitBefore(event: MatchEvent, events: readonly MatchEvent[]): MatchEvent | undefined {
  return events.find((other) => other.kind === EventKind.AttackHit && other.heroId === event.heroId && other.targetId === event.targetId);
}

function failedAttackCues(event: MatchEvent, toId: string, frame: CueFrame): void {
  const fire = frame.fireOf(event.heroId, event.card);
  frame.cues.push({ kind: "number", toId, startMs: fire + NUMBER_DELAY_MS, text: failureText(event), style: "failed" });
}

/** The CROSSFIRE label of a hit with Crossfire, stacked above the labels the target already has in this frame. */
function crossfireCue(event: MatchEvent, toId: string, startMs: number, cues: EffectCue[]): void {
  if ((event.crossfire ?? 0) <= 0) return;
  cues.push({ kind: "crossfire", toId, startMs, amount: event.crossfire!, stack: labelsOn(toId, cues) });
}

const labelsOn = (toId: string, cues: readonly EffectCue[]) => cues.filter((cue) => (cue.kind === "crossfire" || cue.kind === "bonus") && cue.toId === toId).length;

/** The label of the extra damage of a hit (CLOSE +1); the CROSSFIRE label goes on top of it. */
function bonusCues(event: MatchEvent, toId: string, startMs: number, cues: EffectCue[]): void {
  if ((event.closeBonus ?? 0) > 0) cues.push({ kind: "bonus", toId, startMs, text: `CLOSE +${event.closeBonus}`, tone: "close", stack: labelsOn(toId, cues) });
  if ((event.marked ?? 0) > 0) cues.push({ kind: "bonus", toId, startMs, text: `MARKED +${event.marked}`, tone: "marked", stack: labelsOn(toId, cues) });
}

function hitCues(event: MatchEvent, toId: string, frame: CueFrame): void {
  const { cues } = frame;
  // A Scrap Field hurts at once: nobody fires.
  const fieldDamage = event.card === FIELD_CARD;
  const fire = fieldDamage ? 0 : frame.fireOf(event.heroId, event.card);
  const weapon = weaponOf(event.card);
  const flight = fieldDamage ? 0 : flightMs(event.card, event.distance);
  if (weapon !== undefined) {
    cues.push({
      kind: "shot",
      weapon,
      fromId: event.heroId,
      toId,
      fireMs: fire,
      flightMs: flight,
      ...(event.halfCover && { halfCover: true as const }),
    });
  }
  cues.push(...hitNumbers(event, fire + flight + NUMBER_DELAY_MS));
  bonusCues(event, toId, fire + flight + NUMBER_DELAY_MS, cues);
  crossfireCue(event, toId, fire + flight + NUMBER_DELAY_MS, cues);
  if (event.halfCover) {
    cues.push({ kind: "number", toId, startMs: fire + flight + NUMBER_DELAY_MS, text: "Half Cover", style: "failed", drop: 9 });
  }
  if ((event.absorbed ?? 0) > 0) cues.push({ kind: "shieldHit", toId, startMs: fire + flight, absorbed: event.absorbed! });
}

function attackCues(event: MatchEvent, frame: CueFrame): void {
  if (event.targetId === undefined) return;
  if (event.kind === EventKind.AttackFailed) failedAttackCues(event, event.targetId, frame);
  else hitCues(event, event.targetId, frame);
}

/**
 * Pull slides the Hero toward the caster, one tile per event. What the Squad is not told is not drawn: without the tile it
 * stood on there is no slide (the Hero shows up on `to`), without the caster no tether; without either tile (an
 * intermediate tile out of sight) nothing, the next event or the Squad View has the end tile.
 */
function pullCues(event: MatchEvent, frame: CueFrame): void {
  if (!event.to) return;
  frame.cues.push({
    kind: "pull",
    toId: event.heroId,
    ...(event.from && { from: event.from }),
    to: event.to,
    startMs: 0,
    ...(event.casterId !== undefined && !isPush(event.card) && { casterId: event.casterId }),
    tag: slideTag(event.card),
  });
}

/** The cards that place Cover (Temporary Solution): the Cover they destroy is the oldest one going, not a blast. */
function placesCover(card: string | undefined): boolean {
  return Object.values(HERO_DECKS).flat().some((candidate) => candidate.name === card && candidate.effects.some((effect) => effect.kind === EffectKind.PlaceCover));
}

function coverDestroyedCues(event: MatchEvent, frame: CueFrame): void {
  if (!event.to) return;
  if (placesCover(event.card)) {
    frame.cues.push({ kind: "coverCrumble", tile: event.to, startMs: COVER_SLAM_MS + COVER_CRUMBLE_DELAY_MS });
    return;
  }
  addBreach(frame.cues, {
    kind: "breach",
    casterId: event.heroId,
    tile: event.to,
    fireMs: frame.fireOf(event.heroId, event.card),
    flightMs: BREACH_FLIGHT_MS,
    cover: true,
    size: 1,
  });
}

/** Urban Renewal blasts its area: the bomb arcs to the centre tile and the area blows up, whether or not it hits anything. */
function areaBlastedCues(event: MatchEvent, frame: CueFrame): void {
  if (!event.to) return;
  addBreach(frame.cues, {
    kind: "breach",
    casterId: event.heroId,
    tile: event.to,
    fireMs: frame.fireOf(event.heroId, event.card),
    flightMs: BREACH_FLIGHT_MS,
    cover: false,
    size: event.amount ?? 1,
  });
}

/** Scrap: the label SCRAP rises over the Hero that has it now. */
function scrapGainedCues(event: MatchEvent, frame: CueFrame): void {
  if (event.to) frame.cues.push({ kind: "scrapPull", casterId: event.heroId, tile: event.to, startMs: 0 });
  frame.cues.push({ kind: "number", toId: event.heroId, startMs: SCRAP_LABEL_MS, text: "SCRAP", style: "scrap", drop: -22 });
}

function shieldGainedCues(event: MatchEvent, frame: CueFrame): void {
  const startMs = BLOCK_RUBIES_MS;
  frame.cues.push({ kind: "shieldGain", toId: event.heroId, startMs, amount: event.amount ?? 0 });
  if (event.card === CHARGE_CARD) frame.cues.push({ kind: "number", toId: event.heroId, startMs, text: CHARGE_SHIELD_TAG, style: "shield", drop: -26 });
}

function coverPlacedCues(event: MatchEvent, frame: CueFrame): void {
  if (!event.to) return;
  frame.cues.push({ kind: "coverPlaced", casterId: event.heroId, tile: event.to, startMs: COVER_SLAM_MS });
}

function markedCues(event: MatchEvent, frame: CueFrame): void {
  if (event.targetId === undefined) return;
  const hit = hitBefore(event, frame.events);
  // Price Tag's dart leaves at 730 ms.
  frame.cues.push({ kind: "marked", toId: event.targetId, startMs: TAG_FIRE_MS + flightMs("Price Tag", hit?.distance) });
}

function slowCues(event: MatchEvent, frame: CueFrame): void {
  if (event.targetId === undefined) return;
  frame.cues.push({ kind: "slow", toId: event.targetId, startMs: SLOW_FIELD_MS });
}

function chargedCues(event: MatchEvent, frame: CueFrame): void {
  if (event.targetId === undefined) return;
  frame.cues.push({ kind: "charge", heroId: event.heroId, targetId: event.targetId, startMs: 0 });
}

/** The cue builder of each kind of event that has cues. */
const CUE_BUILDERS: Partial<Record<EventKind, (event: MatchEvent, frame: CueFrame) => void>> = {
  [EventKind.AttackHit]: attackCues,
  [EventKind.AttackFailed]: attackCues,
  [EventKind.Pull]: pullCues,
  [EventKind.Charged]: chargedCues,
  [EventKind.CoverDestroyed]: coverDestroyedCues,
  [EventKind.AreaBlasted]: areaBlastedCues,
  [EventKind.ScrapGained]: scrapGainedCues,
  [EventKind.ShieldGained]: shieldGainedCues,
  [EventKind.CoverPlaced]: coverPlacedCues,
  [EventKind.MarkedApplied]: markedCues,
  [EventKind.SlowApplied]: slowCues,
};

export const LONG_SHOT_CARD = "Long Shot";

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
