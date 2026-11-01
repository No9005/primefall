import { EventKind, type GridPosition, type MatchEvent } from "game-core";

/** One visible change during playback: some Heroes arrive on new tiles within a Tick. */
export interface PlaybackFrame {
  tick: number;
  /** New tile per Hero id; Heroes that did not move are absent. */
  moves: Record<string, GridPosition>;
  /** Shield gained per Hero id in this frame. */
  shields: Record<string, number>;
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
      tickFrames[occurrence] ??= { tick, moves: {}, shields: {} };
      if (event.to) tickFrames[occurrence].moves[event.heroId] = event.to;
      if (event.kind === EventKind.ShieldGained) tickFrames[occurrence].shields[event.heroId] = event.amount ?? 0;
    }
    frames.push(...tickFrames);
  }
  return frames;
}

/** The highest Tick of the Resolution, shown as the total in the Tick indicator. */
export function tickCountOf(events: readonly MatchEvent[]): number {
  return Math.max(0, ...events.map((event) => event.tick));
}
