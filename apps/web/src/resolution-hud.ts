/** How long the RESOLUTION callout is shown before the Ticks play. */
export const RESOLUTION_CALLOUT_MS = 800;

/** Opacity of the Hand, the Energy pill and the Deck group while the Resolution runs. */
export const RESOLUTION_DIM = 0.55;

/** Where a Queue row stands in the Resolution: the Tick playing now, one that is over, or one still to come. */
export type QueueRowState = "current" | "past" | "future";

/** The Queue slot `slot` (0 based) resolves in Tick `slot + 1`; `tick` is the Tick on screen (0 before the first). */
export function queueRowState(slot: number, tick: number): QueueRowState {
  const rowTick = slot + 1;
  if (rowTick === tick) return "current";
  return rowTick < tick ? "past" : "future";
}

/** The steps between Commit and the next Round. */
export type ResolutionStage = "waiting" | "callout" | "ticks" | "done";

/** The text of the Commit button during the Resolution. */
export function resolutionCommitLabel(stage: ResolutionStage, tick: number): string {
  if (stage === "waiting") return "Waiting...";
  if (stage === "done") return "Done";
  return `Tick ${Math.max(tick, 1)}`;
}

/** The text of the Resolution bar: `RESOLUTION  ·  TICK n / 4` while the Ticks play, `RESOLUTION COMPLETE` when done. */
export function resolutionBarText(stage: ResolutionStage, tick: number, tickCount: number): string {
  if (stage === "done") return "RESOLUTION COMPLETE";
  const total = Math.max(tickCount, 1);
  return `RESOLUTION  ·  TICK ${Math.min(Math.max(tick, 1), total)} / ${total}`;
}
