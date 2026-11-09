// Persists the running match in localStorage. Storage can be missing or full (private mode, quotas):
// every failure is swallowed so the game itself never breaks.

import { HeroClass } from "game-core";
import { type LocalMatchHost, restoreLocalHost } from "game-core/local-host";
import { aiPlanner } from "./ai-planner";

export const STORAGE_KEY = "primefall.match";
/** The Player Hero of the saved match, stored next to the snapshot. A save without it is a Bruiser save. */
export const PLAYER_HERO_STORAGE_KEY = "primefall.playerHero";

export const DEFAULT_PLAYER_HERO = HeroClass.Bruiser;

/** The Player Hero a start parameter names (`?hero=controller`); anything else is the Bruiser. */
export function parsePlayerHero(value: string | null | undefined): HeroClass {
  return Object.values(HeroClass).find((heroClass) => heroClass === value) ?? DEFAULT_PLAYER_HERO;
}

/** Minimal storage surface, so tests can pass a fake. */
type MatchStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): MatchStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function saveMatch(host: LocalMatchHost, storage: MatchStorage | undefined = defaultStorage(), playerHero: HeroClass = DEFAULT_PLAYER_HERO): void {
  try {
    storage?.setItem(STORAGE_KEY, host.snapshot());
    storage?.setItem(PLAYER_HERO_STORAGE_KEY, playerHero);
  } catch {
    // Ignored: the match just cannot be resumed.
  }
}

export function clearSavedMatch(storage: MatchStorage | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
    storage?.removeItem(PLAYER_HERO_STORAGE_KEY);
  } catch {
    // Ignored.
  }
}

/** The Player Hero of the saved match; the Bruiser for an old save that does not remember one. */
export function loadSavedPlayerHero(storage: MatchStorage | undefined = defaultStorage()): HeroClass {
  try {
    return parsePlayerHero(storage?.getItem(PLAYER_HERO_STORAGE_KEY));
  } catch {
    return DEFAULT_PLAYER_HERO;
  }
}

/** The saved match, or undefined if there is none or its schema version differs (a stale one is discarded). */
export function loadSavedMatch(storage: MatchStorage | undefined = defaultStorage()): LocalMatchHost | undefined {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return undefined;
    const host = restoreLocalHost(text, aiPlanner);
    if (!host) clearSavedMatch(storage);
    return host;
  } catch {
    return undefined;
  }
}
