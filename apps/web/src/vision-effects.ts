// The transitions of vision and the Prime Zone (docs/design/animation/README.md, "Scout Drone area", "Fog and Ghost",
// "Prime Zone"). Pure functions of time and state, tested without a browser; `Board.tsx` draws them. What is shown at all
// is still decided by the visibility rules (Fog of War): these only shape the change. They take real milliseconds;
// CLIP_SPEED multiplies every duration here, like in the clip player and the effects layer.
import { CLIP_SPEED } from "./clip-player";

/** Cyan tint of the Scout Drone area. */
export const AREA_COLOR = 0x5fd0e6;
/** The tiles of an area lift one ring after the other, from the middle outwards. */
export const AREA_RING_DELAY_MS = 140;
export const AREA_LIFT_MS = 300;
/** Every vision and zone transition (the longest: a zone ring or an area of up to 5 rings) is over within this many ms. */
export const TRANSITION_MS = 3000;
/** Pips above the area: one per Resolution it lasts. */
export const AREA_PIPS = 2;

/** 0 (fog) to 1 (lifted) of an area tile `ring` tiles from the centre, `ms` after the drone started to hover. */
export function areaLift(ms: number, ring: number): number {
  return Math.min(1, Math.max(0, (ms * CLIP_SPEED - ring * AREA_RING_DELAY_MS) / AREA_LIFT_MS));
}

/** Whether a tile lies in the square area around `center` (not clipped to the Grid). */
export function areaContains(center: { col: number; row: number }, size: number, tile: { col: number; row: number }): boolean {
  return areaRing(center, tile) <= Math.floor(size / 2);
}

/** The ring (Chebyshev distance) of a tile around the centre of an area. */
export function areaRing(center: { col: number; row: number }, tile: { col: number; row: number }): number {
  return Math.max(Math.abs(tile.col - center.col), Math.abs(tile.row - center.row));
}

export const GHOST_ALPHA = 0.45;
export const GHOST_FADE_MS = 600;

/** True once an animation of `durationMs` has run out after `ms` (at CLIP_SPEED). */
export function finished(ms: number, durationMs: number): boolean {
  return ms * CLIP_SPEED >= durationMs;
}

/** The alpha of an enemy figure `ms` after it left sight (to a Ghost), came back into sight (to the real figure) or appeared in a Scout Drone area. */
export function enemyFade(kind: "toGhost" | "toSeen" | "appear", ms: number): number {
  const t = Math.min(1, Math.max(0, (ms * CLIP_SPEED) / GHOST_FADE_MS));
  if (kind === "appear") return t;
  return kind === "toGhost" ? 1 + (GHOST_ALPHA - 1) * t : GHOST_ALPHA * (1 - t) + t;
}

export type ZoneState = "neutral" | "own" | "gold" | "contested" | "enemy";

export interface ZoneLook {
  /** Colour of the border, the emblem and the tile fill. */
  color: number;
  /** Alpha of the tile fill. */
  alpha: number;
  /** Alpha of the floor emblem. */
  emblemAlpha: number;
  /** The border pulses while the zone is on screen (every state; reduced motion holds it still). */
  pulse: boolean;
  /** A one-shot ring runs over the zone when the hold level is new: our Squad holds it (teal). */
  ring: boolean;
}

export const ZONE_RING_MS = 1600;
export const ZONE_BORDER_PERIOD_MS = 2400;
/** The 3 px border stroke pulses between this alpha and 1; in reduced motion it rests at ZONE_BORDER_REST_ALPHA. */
export const ZONE_BORDER_MIN_ALPHA = 0.65;
export const ZONE_BORDER_REST_ALPHA = 0.9;

/** The look of the Prime Zone: white when empty, teal (35 / 45 %) held by us, gold at the third Resolution, amber contested, red held by the enemy. */
export function zoneLook(state: ZoneState, filled: number): ZoneLook {
  switch (state) {
    case "own":
      return { color: 0x2ec4b6, alpha: filled >= 2 ? 0.45 : 0.35, emblemAlpha: 0.8, pulse: true, ring: true };
    case "gold":
      return { color: 0xffd24a, alpha: 0.5, emblemAlpha: 0.9, pulse: true, ring: false };
    case "contested":
      return { color: 0xffb347, alpha: 0.4, emblemAlpha: 0.8, pulse: true, ring: false };
    case "enemy":
      return { color: 0xe5484d, alpha: 0.35, emblemAlpha: 0.8, pulse: true, ring: false };
    default:
      return { color: 0xe8eef5, alpha: 0.12, emblemAlpha: 0.5, pulse: true, ring: false };
  }
}

/** Alpha of the zone border's 3 px stroke `ms` into the idle pulse (a sine, 2.4 s period); constant in reduced motion. The glow under it follows at a quarter of this. */
export function zoneBorderAlpha(ms: number, reducedMotion: boolean): number {
  if (reducedMotion) return ZONE_BORDER_REST_ALPHA;
  const wave = (1 - Math.cos((2 * Math.PI * ms) / ZONE_BORDER_PERIOD_MS)) / 2;
  return ZONE_BORDER_MIN_ALPHA + (1 - ZONE_BORDER_MIN_ALPHA) * wave;
}

/** The ring that runs once over the zone per Resolution: scale 0.4 to 1.4 and alpha 0.8 to 0, then it is gone. */
export function zoneRingAt(ms: number): { scale: number; alpha: number } {
  const u = Math.min(1, Math.max(0, (ms * CLIP_SPEED) / ZONE_RING_MS));
  return { scale: 0.4 + u, alpha: 0.8 * (1 - u) };
}
