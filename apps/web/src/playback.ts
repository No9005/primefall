import { cardInMode, CoverKind, type EnemyView, EventKind, type GridPosition, HERO_DECKS, type HeroClass, isAreaAttack, type MatchEvent, Visibility, type VisibleEnemyView } from "game-core";
import type { TokenHero } from "./Board";
import { attackClipName, type ClipName, clipOf, takeCoverClipName } from "./hero-clips";
import { type CoverEdit, coverEditsOf, cueEndMs, type EffectCue, effectCuesOf, impactMs } from "./weapon-effects";

/** How long the playback shows one step (one frame) at least; slow enough to follow who does what. The animation never changes it. */
export const STEP_MS = 650;

/**
 * How far a walking Hero has come on its tile (0 to 1), `ms` after its frame started. It glides at a constant speed for one
 * step, so the steps of a Move run into each other and the figure walks from A to B instead of jumping from tile to tile.
 */
export function walkProgress(ms: number): number {
  return Math.min(1, Math.max(0, ms / STEP_MS));
}

/** Where the hit flash is in the Exhausted clip (12 % of 5400 ms). */
const EXHAUSTED_HIT_FLASH_MS = 650;
/** The fire beat when the class of the attacker is not known. */
const DEFAULT_FIRE_MS = 620;

/**
 * The enemy tokens of the board: Visible ones as they are (`place` puts them where the playback has them), Ghosts
 * faded at their last known tile, and none at all for an Unknown Hero (ADR 0005).
 */
export function enemyTokens(enemies: readonly EnemyView[], place: (visible: VisibleEnemyView[]) => TokenHero[]): TokenHero[] {
  return enemies.flatMap((enemy): TokenHero[] => {
    if (enemy.visibility === Visibility.Unknown) return [];
    if (enemy.visibility === Visibility.Ghost) return [{ ...enemy, exhausted: false, ghost: true }];
    return place([enemy]);
  });
}

/** An Attack that hit, as the playback shows it on the target. */
export interface PlaybackHit {
  targetId: string;
  /** Cards removed from the target's Deck (Deck Damage). */
  damage: number;
  /** Damage the target's Shield absorbed. */
  absorbed: number;
  /** The card that caused the hit, whether it was played in Overdrive and the Range of the shot. */
  card?: string;
  overdrive?: boolean;
  distance?: number;
}

/** One visible change during playback: some Heroes arrive on new tiles within a Tick. */
export interface PlaybackFrame {
  tick: number;
  /** New tile per Hero id; Heroes that did not move are absent. */
  moves: Record<string, GridPosition>;
  /** The tile each Hero walks from in this frame (a Step only, not a Knockback): the board glides the figure from there to its new tile. */
  walks: Record<string, GridPosition>;
  /** The target of each attacker that aims at one Hero (not at a tile, not an area): the attacker turns towards it. */
  aims: Record<string, string>;
  /** Shield gained per Hero id in this frame. */
  shields: Record<string, number>;
  /** Attacks that hit in this frame. */
  hits: PlaybackHit[];
  /** Heroes that became Exhausted in this frame. */
  exhausted: string[];
  /** The clip of every Hero that does something to show: a Step walks, a Wait waits for its whole Tick. Others idle. */
  clips: Record<string, ClipName>;
  /** Milliseconds after the start of the frame at which a Hero's clip starts: a target reacts at the impact beat. */
  delays: Record<string, number>;
  /** The effects of the attacks of this frame (flash, projectile, impact, numbers, Marked and Slow). */
  effects: EffectCue[];
  /** Cover that is placed or destroyed in this frame, each at the moment its effect shows it. */
  coverEdits: CoverEdit[];
  /**
   * How long the frame lasts at normal clip speed: until the slowest clip of the frame has reached its active end,
   * and at least one step.
   */
  holdMs: number;
  /** The events of this frame, for the log. */
  events: MatchEvent[];
}

/**
 * Turns the events of a Resolution into frames, one per step: the first step of every Hero in Tick 1,
 * then their second step, and so on, so the Heroes of a Tick walk side by side, tile by tile.
 * A Tick with only blocked moves still yields a frame so the Tick indicator advances.
 */
export function buildPlaybackFrames(
  events: readonly MatchEvent[],
  classOf?: (heroId: string) => HeroClass | undefined,
  coverOf?: (tile: GridPosition) => CoverKind,
): PlaybackFrame[] {
  const ticks = [...new Set(events.map((event) => event.tick))].sort((a, b) => a - b);
  return ticks.flatMap((tick) =>
    buildTickFrames(
      events.filter((event) => event.tick === tick),
      tick,
      classOf,
      coverOf,
    ),
  );
}

type ClassOf = ((heroId: string) => HeroClass | undefined) | undefined;

/** The frames of one Tick: its n-th event of every Hero lands in its n-th frame. */
function buildTickFrames(tickEvents: readonly MatchEvent[], tick: number, classOf: ClassOf, coverOf: ((tile: GridPosition) => CoverKind) | undefined): PlaybackFrame[] {
  const seen = new Map<string, number>();
  const tickFrames: PlaybackFrame[] = [];
  /** The last Step of each Hero in the Tick: where its Move ends. */
  const lastStep = new Map<string, { frame: PlaybackFrame; to: GridPosition }>();
  for (const event of tickEvents) {
    const occurrence = seen.get(event.heroId) ?? 0;
    seen.set(event.heroId, occurrence + 1);
    tickFrames[occurrence] ??= emptyFrame(tick);
    const frame = tickFrames[occurrence];
    addEventToFrame(frame, event);
    if (event.kind === EventKind.Step && event.to) lastStep.set(event.heroId, { frame, to: event.to });
  }
  takeCoverAtMoveEnd(lastStep, coverOf);
  for (const frame of tickFrames) addEffects(frame, classOf);
  // A Wait lasts the whole Tick; a Step in the same frame wins over it.
  for (const event of tickEvents) {
    if (event.kind !== EventKind.Wait) continue;
    for (const frame of tickFrames) frame.clips[event.heroId] ??= "wait";
  }
  for (const frame of tickFrames) frame.holdMs = holdOf(frame, classOf);
  return tickFrames;
}

/** A Move that ends on Cover takes cover (the Hero has walked there in this frame). */
function takeCoverAtMoveEnd(lastStep: ReadonlyMap<string, { frame: PlaybackFrame; to: GridPosition }>, coverOf: ((tile: GridPosition) => CoverKind) | undefined): void {
  for (const [heroId, { frame, to }] of lastStep) {
    const cover = coverOf?.(to) ?? CoverKind.None;
    if (cover !== CoverKind.None && frame.clips[heroId] === "walk") frame.clips[heroId] = takeCoverClipName(cover);
  }
}

function emptyFrame(tick: number): PlaybackFrame {
  return { tick, moves: {}, walks: {}, aims: {}, shields: {}, hits: [], exhausted: [], clips: {}, delays: {}, effects: [], coverEdits: [], holdMs: STEP_MS, events: [] };
}

/** Records what one event changes in its frame: moves, Shield, hits, Exhaustion and the clip of the Hero. */
function addEventToFrame(frame: PlaybackFrame, event: MatchEvent): void {
  frame.events.push(event);
  // `to` of a Cover or area event is a tile of the board, not a place the Hero moves to.
  if (event.to && !TILE_EVENTS.includes(event.kind)) frame.moves[event.heroId] = event.to;
  if (event.kind === EventKind.Step && event.from) frame.walks[event.heroId] = event.from;
  if (event.kind === EventKind.ShieldGained) frame.shields[event.heroId] = event.amount ?? 0;
  if (event.kind === EventKind.AttackHit) frame.hits.push(hitOf(event));
  if (event.kind === EventKind.Exhausted) frame.exhausted.push(event.heroId);
  const clip = clipOfEvent(event);
  if (clip) frame.clips[clip.heroId] = clip.clip;
  // The Utility gestures belong to the Hero that played the card; the Shield of an Aegis Protocol is on its target.
  const gesture = utilityClipName(event);
  if (gesture !== undefined) frame.clips[gesture.heroId] = gesture.clip;
}

function hitOf(event: MatchEvent): PlaybackHit {
  return {
    targetId: event.targetId!,
    damage: event.damage ?? 0,
    absorbed: event.absorbed ?? 0,
    ...(event.card !== undefined && { card: event.card }),
    ...(event.overdrive && { overdrive: true }),
    ...(event.distance !== undefined && { distance: event.distance }),
  };
}

/** The clip of the acting Hero for the events that have one of their own, before the Utility gestures. */
function clipOfEvent(event: MatchEvent): { heroId: string; clip: ClipName } | undefined {
  switch (event.kind) {
    case EventKind.Exhausted:
      return { heroId: event.heroId, clip: "exhausted" };
    case EventKind.Step:
      return { heroId: event.heroId, clip: "walk" };
    case EventKind.AttackHit:
    case EventKind.AttackFailed:
      return { heroId: event.heroId, clip: attackClipName(event.card) };
    case EventKind.ShieldGained:
      // A Block (a Shield without a card) crouches.
      return event.card === undefined ? { heroId: event.heroId, clip: "block" } : undefined;
    default:
      return undefined;
  }
}

/** The targets react at the impact beat of the attacker's clip, unless they do something of their own in the frame; then the effects. */
function addEffects(frame: PlaybackFrame, classOf: ClassOf): void {
  for (const event of frame.events) {
    if (isAimedAtOneHero(event, classOf)) frame.aims[event.heroId] = event.targetId!;
  }
  for (const event of frame.events) {
    if (event.kind === EventKind.AttackHit && event.targetId !== undefined) reactToHit(frame, event, event.targetId, classOf);
  }
  const fireOf = (heroId: string, card: string | undefined) => {
    const heroClass = classOf?.(heroId);
    return heroClass === undefined ? DEFAULT_FIRE_MS : clipOf(heroClass, attackClipName(card)).fireMs ?? DEFAULT_FIRE_MS;
  };
  frame.effects = effectCuesOf(frame.events, fireOf);
  frame.coverEdits = coverEditsOf(frame.effects);
}

/** An Attack at one chosen Hero: the attacker turns to it. An area Attack (Shockwave) and a tile Attack have no one target. */
function isAimedAtOneHero(event: MatchEvent, classOf: ClassOf): boolean {
  if (event.kind !== EventKind.AttackHit && event.kind !== EventKind.AttackFailed) return false;
  if (event.targetId === undefined || event.tile !== undefined) return false;
  const heroClass = classOf?.(event.heroId);
  const card = heroClass === undefined ? undefined : HERO_DECKS[heroClass].find((candidate) => candidate.name === event.card);
  return card === undefined || !isAreaAttack(cardInMode(card, event.overdrive));
}

function reactToHit(frame: PlaybackFrame, event: MatchEvent, targetId: string, classOf: ClassOf): void {
  const attackerClass = classOf?.(event.heroId);
  const fire = attackerClass === undefined ? undefined : clipOf(attackerClass, attackClipName(event.card)).fireMs;
  const absorbed = (event.absorbed ?? 0) > 0 && (event.damage ?? 0) === 0;
  // The target reacts when the projectile arrives.
  const arrival = impactMs(event.card, event.distance, fire ?? DEFAULT_FIRE_MS);
  if (frame.clips[targetId] === "exhausted") {
    // The Exhausted clip has its own hit flash: it starts early enough for the flash to land with the impact.
    frame.delays[targetId] = Math.max(0, arrival - EXHAUSTED_HIT_FLASH_MS);
    return;
  }
  if (frame.clips[targetId] !== undefined) return;
  frame.clips[targetId] = absorbed ? "absorb" : "hit";
  frame.delays[targetId] = arrival;
}

/** A frame lasts until its slowest one-shot clip has reached its active end (looping Walk and Wait clips run per step). */
function holdOf(frame: PlaybackFrame, classOf: ((heroId: string) => HeroClass | undefined) | undefined): number {
  let hold = Math.max(STEP_MS, ...frame.effects.map(cueEndMs));
  for (const [heroId, name] of Object.entries(frame.clips)) {
    const heroClass = classOf?.(heroId);
    if (heroClass === undefined) continue;
    const clip = clipOf(heroClass, name);
    if (!clip.loop) hold = Math.max(hold, (frame.delays[heroId] ?? 0) + clip.activeEndMs);
  }
  return hold;
}

/** The gesture a Utility card makes and the Hero that makes it, or undefined for an event without one. */
export function utilityClipName(event: MatchEvent): { heroId: string; clip: ClipName } | undefined {
  switch (event.kind) {
    case EventKind.AreaRevealed:
      return { heroId: event.heroId, clip: "scoutDrone" };
    case EventKind.CoverPlaced:
      return { heroId: event.heroId, clip: "deploy" };
    case EventKind.HiddenGained:
      return { heroId: event.heroId, clip: "hidden" };
    case EventKind.ShieldGained:
      return event.card === "Aegis Protocol" ? { heroId: event.casterId ?? event.heroId, clip: "aegis" } : undefined;
    default:
      return undefined;
  }
}

/** An enemy that plays the Hidden clip is not drawn at all (Fog of War); its own Squad sees the ghost instead. */
export function enemyIsDrawn(clip: ClipName | undefined): boolean {
  return clip !== "hidden";
}

/** Events whose `to` names a tile they act on, not the Hero's destination. */
const TILE_EVENTS = [EventKind.CoverDestroyed, EventKind.CoverPlaced, EventKind.AreaRevealed];

/** The highest Tick of the Resolution, shown as the total in the Tick indicator. */
export function tickCountOf(events: readonly MatchEvent[]): number {
  return Math.max(0, ...events.map((event) => event.tick));
}

