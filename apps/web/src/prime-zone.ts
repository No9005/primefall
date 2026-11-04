import { findTiles, type GridPosition, PRIME_ZONE_WIN_RESOLUTIONS, REACTOR_DECK, SquadId, TileKind } from "game-core";
import type { CalloutTone } from "./callout";
import { type ZoneLook, zoneLook } from "./vision-effects";

export const PRIME_ZONE_CALLOUT_MS = 1700;
/** The final VICTORY / DEFEAT stays a little longer; the end screen takes over right after it. */
export const PRIME_ZONE_END_CALLOUT_MS = 2400;

export type PrimeProgress = Record<SquadId, number>;

export interface PrimeCallout {
  text: string;
  tone: CalloutTone;
  durationMs: number;
}

const PRIME_ZONE_TILES = findTiles(REACTOR_DECK, TileKind.PrimeZone);

export const isInPrimeZone = ({ col, row }: GridPosition): boolean => PRIME_ZONE_TILES.some((tile) => tile.col === col && tile.row === row);

/** What to show after a Resolution, given the counts before and after: the new count, then VICTORY / DEFEAT, or CONTESTED after a reset. */
export function primeCallouts(before: PrimeProgress, after: PrimeProgress, you: SquadId): PrimeCallout[] {
  const callouts: PrimeCallout[] = [];
  for (const squad of [SquadId.Left, SquadId.Right]) {
    if (after[squad] <= before[squad]) continue;
    const own = squad === you;
    callouts.push({ text: `PRIME ZONE ${after[squad]} / ${PRIME_ZONE_WIN_RESOLUTIONS}`, tone: own ? "teal" : "red", durationMs: PRIME_ZONE_CALLOUT_MS });
    if (after[squad] >= PRIME_ZONE_WIN_RESOLUTIONS) {
      callouts.push({ text: own ? "VICTORY" : "DEFEAT", tone: own ? "gold" : "red", durationMs: PRIME_ZONE_END_CALLOUT_MS });
    }
  }
  const reset = [SquadId.Left, SquadId.Right].some((squad) => before[squad] > 0 && after[squad] === 0);
  if (callouts.length === 0 && reset) callouts.push({ text: "CONTESTED", tone: "amber", durationMs: PRIME_ZONE_CALLOUT_MS });
  return callouts;
}

export type PrimeState = "neutral" | "own" | "enemy" | "contested";

export interface PrimeScore {
  /** Pips filled for the Squad that holds the count. */
  filled: number;
  state: PrimeState;
  label: string;
}

/** The score pill, or undefined while no Hero stands in the Prime Zone. `contested`: Heroes of both Squads stand in it. */
export function primeScore(progress: PrimeProgress, you: SquadId, occupied: boolean, contested: boolean): PrimeScore | undefined {
  if (!occupied && !contested) return undefined;
  const enemy = you === SquadId.Left ? SquadId.Right : SquadId.Left;
  if (contested) return { filled: 0, state: "contested", label: "CONTESTED" };
  if (progress[enemy] > 0) return { filled: progress[enemy], state: "enemy", label: "ENEMY HOLDS" };
  return { filled: progress[you], state: progress[you] > 0 ? "own" : "neutral", label: "PRIME ZONE" };
}

/** Which Squads have a Hero (not Exhausted) in the Prime Zone. */
export function zoneOccupancy(heroes: readonly { position: GridPosition; exhausted: boolean }[], enemies: readonly { position: GridPosition; exhausted: boolean; ghost?: boolean }[]) {
  const standing = (units: readonly { position: GridPosition; exhausted: boolean }[]) => units.some((unit) => !unit.exhausted && isInPrimeZone(unit.position));
  const own = standing(heroes);
  const enemy = standing(enemies.filter((unit) => !unit.ghost));
  return { own, enemy, occupied: own || enemy, contested: own && enemy };
}

/** The tint of the Prime Zone tiles on the board. */
export function zoneTint(score: PrimeScore | undefined): ZoneLook {
  if (score?.state === "own") return zoneLook(score.filled >= PRIME_ZONE_WIN_RESOLUTIONS ? "gold" : "own", score.filled);
  return zoneLook(score?.state === "contested" || score?.state === "enemy" ? score.state : "neutral", score?.filled ?? 0);
}
