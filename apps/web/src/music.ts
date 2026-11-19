// The rules of the in-game music (pure, so they are tested): which level the game wants and when a change lands. The player
// is in `audio.ts`. The music is a loop of 8 bars in layers; the game only says which level it wants, and the music
// changes on the next bar line so the change lands on the beat.

/** The situations of a match that have their own music. */
export type MusicPhase = "planning" | "countdown" | "resolution";

/** 0 planning, 1 the last seconds of planning, 2 Resolution, 3 the Prime Zone is contested. */
export type MusicLevel = 0 | 1 | 2 | 3;

export const CONTESTED_LEVEL: MusicLevel = 3;

/**
 * The level the game wants. A contested Prime Zone is the climax in every phase. The input is only what the player's own view
 * shows (the timer, the Resolution, the zone as the board shows it), so the music gives away nothing about hidden enemies.
 */
export function musicLevelFor(phase: MusicPhase, contested: boolean): MusicLevel {
  if (contested) return CONTESTED_LEVEL;
  return PHASE_LEVEL[phase];
}

const PHASE_LEVEL: Record<MusicPhase, MusicLevel> = { planning: 0, countdown: 1, resolution: 2 };

/** The phase of the game for the music: Resolution while it plays, the countdown in the last seconds of planning. */
export function musicPhaseOf(resolving: boolean, secondsLeft: number, countdownSeconds: number): MusicPhase {
  if (resolving) return "resolution";
  return secondsLeft > 0 && secondsLeft <= countdownSeconds ? "countdown" : "planning";
}

/**
 * The time of the next bar line of a loop that started at `startedAt` and is `loopSeconds` long with `bars` bars. A bar
 * line that is closer than `minLeadSeconds` is too late to schedule, so the one after it is taken.
 */
export function nextBarTime(now: number, startedAt: number, loopSeconds: number, bars: number, minLeadSeconds = 0.05): number {
  const bar = loopSeconds / bars;
  const intoLoop = (((now - startedAt) % loopSeconds) + loopSeconds) % loopSeconds;
  let wait = bar - (intoLoop % bar);
  if (wait < minLeadSeconds) wait += bar;
  return now + wait;
}

/** A stinger is one sound in three pitches that covers a change of the music: low for the return to planning, mid for the Resolution, high for a contested Prime Zone. */
export type Stinger = "low" | "mid" | "high";

export interface LevelChange {
  /** The sound that covers the change; none when something else already makes a sound (the countdown number) or the change is soft. */
  stinger?: Stinger;
  /** `now`: the layers change at once (a sound covers it); `bar`: they wait for the next bar line. */
  at: "now" | "bar";
}

/**
 * How the music gets from one level to the next. A step into the Resolution or into the contested climax, and the return to planning,
 * come with a stinger and change at once. The countdown has its own number sound and changes at once. A fall from the climax back
 * to the Resolution has no sound, so it waits for the bar line.
 */
export function levelChange(before: MusicLevel, after: MusicLevel): LevelChange | undefined {
  if (after === before) return undefined;
  if (after === CONTESTED_LEVEL) return { stinger: "high", at: "now" };
  if (after === 2) return before === CONTESTED_LEVEL ? { at: "bar" } : { stinger: "mid", at: "now" };
  if (after === 1) return { at: before === 0 ? "now" : "bar" };
  return before >= 2 ? { stinger: "low", at: "now" } : { at: "bar" };
}
