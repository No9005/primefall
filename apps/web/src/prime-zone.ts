import { findTiles, type GridPosition, PRIME_ZONE_WIN_RESOLUTIONS, REACTOR_DECK, SquadId, TileKind, ZoneKind, type ZoneView } from "game-core";
import type { CalloutTone } from "./callout";
import { type ZoneLook, zoneLook } from "./vision-effects";

export const PRIME_ZONE_CALLOUT_MS = 1700;
/** The final VICTORY / DEFEAT stays a little longer; the end screen takes over right after it. */
export const PRIME_ZONE_END_CALLOUT_MS = 2400;

/** The Prime Zone becoming active is announced longer than the scoring callouts. */
export const PRIME_ZONE_ACTIVE_CALLOUT_MS = 2400;

export type PrimeProgress = Record<SquadId, number>;

export interface PrimeCallout {
  text: string;
  /** A second, smaller line under the text. */
  detail?: string;
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

/** The score pill, shown for the whole match (neutral with empty pips while nobody holds the count). `contested`: Heroes of both Squads stand in it. */
export function primeScore(progress: PrimeProgress, you: SquadId, contested: boolean): PrimeScore {
  const enemy = you === SquadId.Left ? SquadId.Right : SquadId.Left;
  if (contested) return { filled: 0, state: "contested", label: "CONTESTED" };
  if (progress[enemy] > 0) return { filled: progress[enemy], state: "enemy", label: "ENEMY HOLDS" };
  return { filled: progress[you], state: progress[you] > 0 ? "own" : "neutral", label: "PRIME ZONE" };
}

/**
 * Classic mode: the look of the Prime Zone from the Squad View. Teal when we control it, red when the enemy does, amber when
 * Heroes of both Squads stand in it (or the last Resolution left it Contested), grey while nobody controls it or it is inactive.
 */
export function pointsZoneScore(zones: readonly ZoneView[], you: SquadId, contestedNow: boolean): PrimeScore {
  const prime = zones.find((zone) => zone.kind === ZoneKind.PrimeZone);
  if (!prime?.active) return { filled: 0, state: "neutral", label: "VP" };
  if (contestedNow || prime.contested) return { filled: 0, state: "contested", label: "VP" };
  if (prime.controller === undefined) return { filled: 0, state: "neutral", label: "VP" };
  return { filled: 0, state: prime.controller === you ? "own" : "enemy", label: "VP" };
}

export type ZoneDotState = "nobody" | "own" | "enemy" | "contested" | "inactive";

export interface ZoneDot {
  kind: ZoneKind;
  state: ZoneDotState;
  /** Inactive zones: the Round from which they score (shown as `R4`). */
  unlockRound: number;
}

/** One dot per zone, the Prime Zone between the Outposts (the Squad View lists it first): the state of the zone for the viewing Squad. */
export function zoneDots(zones: readonly ZoneView[], you: SquadId): ZoneDot[] {
  const outposts = zones.filter((zone) => zone.kind === ZoneKind.Outpost);
  const middle = zones.filter((zone) => zone.kind === ZoneKind.PrimeZone);
  return [...outposts.slice(0, 1), ...middle, ...outposts.slice(1)].map((zone) => ({ kind: zone.kind, state: zoneDotState(zone, you), unlockRound: zone.unlockRound }));
}

function zoneDotState(zone: ZoneView, you: SquadId): ZoneDotState {
  if (!zone.active) return "inactive";
  if (zone.contested) return "contested";
  if (zone.controller === undefined) return "nobody";
  return zone.controller === you ? "own" : "enemy";
}

/** Rounds until the Prime Zone becomes active; undefined when it is active already (or there is none). */
export function primeCountdown(zones: readonly ZoneView[], round: number): number | undefined {
  const prime = zones.find((zone) => zone.kind === ZoneKind.PrimeZone);
  return prime && !prime.active ? prime.unlockRound - round : undefined;
}

const zoneName = (zone: ZoneView) => (zone.kind === ZoneKind.PrimeZone ? "PRIME ZONE" : "OUTPOST");

/**
 * What to show after a Resolution, from the zones before and after it: the Victory Points of every zone that scored
 * (Squad-coloured), CONTESTED for a zone both Squads stand in, and ACTIVE when the Prime Zone just unlocked.
 */
export function zoneCallouts(before: readonly ZoneView[], after: readonly ZoneView[], you: SquadId): PrimeCallout[] {
  const callouts: PrimeCallout[] = [];
  after.forEach((zone, i) => {
    if (!zone.active) return;
    if (zone.kind === ZoneKind.PrimeZone && before[i] && !before[i].active) {
      callouts.push({ text: "PRIME ZONE ACTIVE", detail: `${zone.value} VP per Resolution`, tone: "gold", durationMs: PRIME_ZONE_ACTIVE_CALLOUT_MS });
    }
    if (zone.contested) callouts.push({ text: "CONTESTED", detail: zoneName(zone), tone: "amber", durationMs: PRIME_ZONE_CALLOUT_MS });
    else if (zone.controller !== undefined) {
      const own = zone.controller === you;
      const name = own ? zoneName(zone) : `ENEMY ${zoneName(zone)}`;
      callouts.push({ text: `${name} +${zone.value}`, tone: own ? "teal" : "red", durationMs: PRIME_ZONE_CALLOUT_MS });
    }
  });
  return callouts;
}

/** The final VICTORY / DEFEAT once the Resolution ended the match (nothing for a draw or a running match). */
export function matchEndCallouts(result: { winner?: SquadId } | undefined, you: SquadId): PrimeCallout[] {
  if (result?.winner === undefined) return [];
  const won = result.winner === you;
  return [{ text: won ? "VICTORY" : "DEFEAT", tone: won ? "gold" : "red", durationMs: PRIME_ZONE_END_CALLOUT_MS }];
}

/** Which Squads have a Hero (not Exhausted) in the Prime Zone. */
export function zoneOccupancy(heroes: readonly { position: GridPosition; exhausted: boolean }[], enemies: readonly { position: GridPosition; exhausted: boolean; ghost?: boolean }[]) {
  const standing = (units: readonly { position: GridPosition; exhausted: boolean }[]) => units.some((unit) => !unit.exhausted && isInPrimeZone(unit.position));
  const own = standing(heroes);
  const enemy = standing(enemies.filter((unit) => !unit.ghost));
  return { own, enemy, occupied: own || enemy, contested: own && enemy };
}

/** The tint of the Prime Zone tiles on the board. */
export function zoneTint(score: PrimeScore): ZoneLook {
  if (score.state === "own") return zoneLook(score.filled >= PRIME_ZONE_WIN_RESOLUTIONS ? "gold" : "own", score.filled);
  return zoneLook(score.state, score.filled);
}
