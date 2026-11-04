import { CoverKind, type EnemyView, EventKind, type GridPosition, type HeroClass, type MatchEvent, Visibility, type VisibleEnemyView } from "game-core";
import type { TokenHero } from "./Board";
import { attackClipName, type ClipName, clipOf, takeCoverClipName } from "./hero-clips";
import { cueEndMs, type EffectCue, effectCuesOf, impactMs } from "./weapon-effects";

/** How long the playback shows one step (one frame) at least; slow enough to follow who does what. The animation never changes it. */
export const STEP_MS = 1200;

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
  const frames: PlaybackFrame[] = [];
  const ticks = [...new Set(events.map((event) => event.tick))].sort((a, b) => a - b);
  for (const tick of ticks) {
    const seen = new Map<string, number>();
    const tickFrames: PlaybackFrame[] = [];
    /** The last Step of each Hero in the Tick: where its Move ends. */
    const lastStep = new Map<string, { frame: PlaybackFrame; to: GridPosition }>();
    for (const event of events.filter((candidate) => candidate.tick === tick)) {
      const occurrence = seen.get(event.heroId) ?? 0;
      seen.set(event.heroId, occurrence + 1);
      tickFrames[occurrence] ??= { tick, moves: {}, shields: {}, hits: [], exhausted: [], clips: {}, delays: {}, effects: [], holdMs: STEP_MS, events: [] };
      const frame = tickFrames[occurrence];
      frame.events.push(event);
      // `to` of a Cover or area event is a tile of the board, not a place the Hero moves to.
      if (event.to && !TILE_EVENTS.includes(event.kind)) frame.moves[event.heroId] = event.to;
      if (event.kind === EventKind.ShieldGained) frame.shields[event.heroId] = event.amount ?? 0;
      if (event.kind === EventKind.AttackHit) {
        frame.hits.push({
          targetId: event.targetId!,
          damage: event.damage ?? 0,
          absorbed: event.absorbed ?? 0,
          ...(event.card !== undefined && { card: event.card }),
          ...(event.overdrive && { overdrive: true }),
          ...(event.distance !== undefined && { distance: event.distance }),
        });
      }
      if (event.kind === EventKind.Exhausted) {
        frame.exhausted.push(event.heroId);
        frame.clips[event.heroId] = "exhausted";
      }
      if (event.kind === EventKind.Step) {
        frame.clips[event.heroId] = "walk";
        if (event.to) lastStep.set(event.heroId, { frame, to: event.to });
      }
      if (event.kind === EventKind.AttackHit || event.kind === EventKind.AttackFailed) {
        frame.clips[event.heroId] = attackClipName(event.card);
      }
      // A Block (a Shield without a card) crouches.
      if (event.kind === EventKind.ShieldGained && event.card === undefined) frame.clips[event.heroId] = "block";
      // The Utility gestures belong to the Hero that played the card; the Shield of an Aegis Protocol is on its target.
      const gesture = utilityClipName(event);
      if (gesture !== undefined) frame.clips[gesture.heroId] = gesture.clip;
    }
    // A Move that ends on Cover takes cover (the Hero has walked there in this frame).
    for (const [heroId, { frame, to }] of lastStep) {
      const cover = coverOf?.(to) ?? CoverKind.None;
      if (cover !== CoverKind.None && frame.clips[heroId] === "walk") frame.clips[heroId] = takeCoverClipName(cover);
    }
    // The targets react at the impact beat of the attacker's clip, unless they do something of their own in the frame.
    for (const frame of tickFrames) {
      for (const event of frame.events) {
        if (event.kind !== EventKind.AttackHit || event.targetId === undefined) continue;
        const attackerClass = classOf?.(event.heroId);
        const fire = attackerClass === undefined ? undefined : clipOf(attackerClass, attackClipName(event.card)).fireMs;
        const absorbed = (event.absorbed ?? 0) > 0 && (event.damage ?? 0) === 0;
        // The target reacts when the projectile arrives.
        const arrival = impactMs(event.card, event.distance, fire ?? DEFAULT_FIRE_MS);
        if (frame.clips[event.targetId] === "exhausted") {
          // The Exhausted clip has its own hit flash: it starts early enough for the flash to land with the impact.
          frame.delays[event.targetId] = Math.max(0, arrival - EXHAUSTED_HIT_FLASH_MS);
          continue;
        }
        if (frame.clips[event.targetId] !== undefined) continue;
        frame.clips[event.targetId] = absorbed ? "absorb" : "hit";
        frame.delays[event.targetId] = arrival;
      }
      const fireOf = (heroId: string, card: string | undefined) => {
        const heroClass = classOf?.(heroId);
        return heroClass === undefined ? DEFAULT_FIRE_MS : clipOf(heroClass, attackClipName(card)).fireMs ?? DEFAULT_FIRE_MS;
      };
      frame.effects = effectCuesOf(frame.events, fireOf);
    }
    // A Wait lasts the whole Tick; a Step in the same frame wins over it.
    for (const event of events) {
      if (event.tick !== tick || event.kind !== EventKind.Wait) continue;
      for (const frame of tickFrames) frame.clips[event.heroId] ??= "wait";
    }
    for (const frame of tickFrames) frame.holdMs = holdOf(frame, classOf);
    frames.push(...tickFrames);
  }
  return frames;
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

