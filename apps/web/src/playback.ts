import { EventKind, type GridPosition, type MatchEvent } from "game-core";

/** An Attack that hit, as the playback shows it on the target. */
export interface PlaybackHit {
  targetId: string;
  /** Cards removed from the target's Deck (Deck Damage). */
  damage: number;
  /** Damage the target's Shield absorbed. */
  absorbed: number;
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
  /** The events of this frame, for the log. */
  events: MatchEvent[];
}

/**
 * Turns the events of a Resolution into frames, one per step: the first step of every Hero in Tick 1,
 * then their second step, and so on, so the Heroes of a Tick walk side by side, tile by tile.
 * A Tick with only blocked moves still yields a frame so the Tick indicator advances.
 */
export function buildPlaybackFrames(events: readonly MatchEvent[]): PlaybackFrame[] {
  const frames: PlaybackFrame[] = [];
  const ticks = [...new Set(events.map((event) => event.tick))].sort((a, b) => a - b);
  for (const tick of ticks) {
    const seen = new Map<string, number>();
    const tickFrames: PlaybackFrame[] = [];
    for (const event of events.filter((candidate) => candidate.tick === tick)) {
      const occurrence = seen.get(event.heroId) ?? 0;
      seen.set(event.heroId, occurrence + 1);
      tickFrames[occurrence] ??= { tick, moves: {}, shields: {}, hits: [], exhausted: [], events: [] };
      const frame = tickFrames[occurrence];
      frame.events.push(event);
      if (event.to) frame.moves[event.heroId] = event.to;
      if (event.kind === EventKind.ShieldGained) frame.shields[event.heroId] = event.amount ?? 0;
      if (event.kind === EventKind.AttackHit) {
        frame.hits.push({ targetId: event.targetId!, damage: event.damage ?? 0, absorbed: event.absorbed ?? 0 });
      }
      if (event.kind === EventKind.Exhausted) frame.exhausted.push(event.heroId);
    }
    frames.push(...tickFrames);
  }
  return frames;
}

/** The highest Tick of the Resolution, shown as the total in the Tick indicator. */
export function tickCountOf(events: readonly MatchEvent[]): number {
  return Math.max(0, ...events.map((event) => event.tick));
}

/** One line of the Resolution log, or `undefined` for events that only move a Hero. */
export function describeEvent(event: MatchEvent, nameOf: (heroId: string) => string): string | undefined {
  const who = nameOf(event.heroId);
  switch (event.kind) {
    case EventKind.AttackHit:
      return `Tick ${event.tick}: ${who} hits ${nameOf(event.targetId!)}: Deck Damage ${event.damage}` +
        ((event.absorbed ?? 0) > 0 ? `, Shield absorbed ${event.absorbed}` : "");
    case EventKind.AttackFailed:
      return `Tick ${event.tick}: ${who}'s Attack on ${nameOf(event.targetId!)} fails (Range or Line of Sight)`;
    case EventKind.SlowApplied:
      return `Tick ${event.tick}: ${who} Slows ${nameOf(event.targetId!)}`;
    case EventKind.SlowUsed:
      return `Tick ${event.tick}: ${who} is Slowed: Move 2 becomes Move 1`;
    case EventKind.HiddenGained:
      return `Tick ${event.tick}: ${who} becomes Hidden`;
    case EventKind.HiddenEnded:
      return `Tick ${event.tick}: ${who} is no longer Hidden`;
    case EventKind.MarkedApplied:
      return `Tick ${event.tick}: ${who} Marks ${nameOf(event.targetId!)}`;
    case EventKind.Knockback:
      return `Tick ${event.tick}: ${who} is pushed back`;
    case EventKind.Exhausted:
      return `${who} is Exhausted`;
    default:
      return undefined;
  }
}
