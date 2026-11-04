export type CalloutKind = "number" | "word";
export type CalloutTone = "teal" | "amber" | "red" | "gold";

/** CSS classes of a callout: the kind picks the keyframes (see styles.css), the tone the colour. */
export function calloutClassName(kind: CalloutKind, tone: CalloutTone): string {
  return `callout-${kind} callout-tone-${tone}`;
}

/** The seconds from which the time is a warning (amber) and the last seconds (red, pulsing). */
export const TIMER_AMBER_SECONDS = 10;
export const TIMER_RED_SECONDS = 5;

export const COUNTDOWN_CALLOUT_MS = 950;

export type TimerTone = "normal" | "amber" | "red";

export function timerTone(secondsLeft: number): TimerTone {
  if (secondsLeft <= TIMER_RED_SECONDS) return "red";
  return secondsLeft <= TIMER_AMBER_SECONDS ? "amber" : "normal";
}

/** `0:45`. */
export function formatTimer(secondsLeft: number): string {
  const seconds = Math.max(0, secondsLeft);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export interface CountdownCallout {
  text: string;
  tone: "amber" | "red";
}

/** The big number due at this many seconds left: once the 10, then 5 down to 1; nothing at any other second (also at 0). */
export function countdownCallout(secondsLeft: number): CountdownCallout | undefined {
  if (secondsLeft === TIMER_AMBER_SECONDS) return { text: String(secondsLeft), tone: "amber" };
  if (secondsLeft >= 1 && secondsLeft <= TIMER_RED_SECONDS) return { text: String(secondsLeft), tone: "red" };
  return undefined;
}

/** The animation length as the custom property the stylesheet reads; never shorter than 1 ms. */
export function calloutStyleVars(durationMs: number): Record<string, string> {
  return { "--callout-ms": `${Math.max(1, Math.round(durationMs))}ms` };
}
