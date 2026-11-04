// Picking a target (issue 208): the used card floats in the middle of the board, pulling it down cancels the use, and the
// tiles the target can be on pulse slowly. These are the pure parts; PlanningScreen and Board only draw them.

import { type CardDefinition, type GridPosition, isInCardRange } from "game-core";

/** Pulling the floating card further down than this (CSS pixels) cancels the use. */
export const CANCEL_PULL = 36;
/** A release with less movement than this is a tap, which cancels as well. */
const TAP_SLOP = 6;
/** A shorter pull springs the card back to its place in this time. */
export const SPRING_BACK_MS = 200;

export const PULSE_MIN_ALPHA = 0.35;
export const PULSE_MAX_ALPHA = 0.9;
/** One way of the pulse (dim to bright, or back); it alternates. */
export const PULSE_HALF_PERIOD_MS = 900;

export enum ReleaseOutcome {
  /** The card goes back to the Hand and nothing changes. */
  Cancel = "cancel",
  /** The card springs back to its place and the picking goes on. */
  SpringBack = "spring-back",
}

/**
 * The Heroes among `candidates` that can be tapped as target: inside the Range area of the card around `origin`
 * (decided by game-core) and, when the shot is drawn, with a shot that can hit.
 */
export function targetsInReach(
  candidates: readonly { id: string; position: GridPosition }[],
  origin: GridPosition,
  card: Pick<CardDefinition, "range">,
  canHit: (id: string) => boolean,
): string[] {
  return candidates
    .filter(({ id, position }) => isInCardRange(origin, card, position) && canHit(id))
    .map(({ id }) => id);
}

/** How far the card follows the finger: only downwards. */
export function pullOffset(startY: number, y: number): number {
  return Math.max(0, y - startY);
}

export function releaseOutcome(offset: number): ReleaseOutcome {
  return offset > CANCEL_PULL || offset < TAP_SLOP ? ReleaseOutcome.Cancel : ReleaseOutcome.SpringBack;
}

/** The opacity of a lit tile `ms` after the picking began: a smooth swing between the two limits. With reduced motion it does not move. */
export function pulseAlpha(ms: number, reducedMotion: boolean): number {
  const mid = (PULSE_MIN_ALPHA + PULSE_MAX_ALPHA) / 2;
  if (reducedMotion) return mid;
  const swing = (PULSE_MAX_ALPHA - PULSE_MIN_ALPHA) / 2;
  return mid - swing * Math.cos((Math.PI * ms) / PULSE_HALF_PERIOD_MS);
}
