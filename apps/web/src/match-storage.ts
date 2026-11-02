// Persists the running match in localStorage. Storage can be missing or full (private mode, quotas):
// every failure is swallowed so the game itself never breaks.

import { type LocalMatchHost, restoreLocalHost } from "game-core/local-host";

const STORAGE_KEY = "primefall.match";

/** Minimal storage surface, so tests can pass a fake. */
type MatchStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): MatchStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function saveMatch(host: LocalMatchHost, storage: MatchStorage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, host.snapshot());
  } catch {
    // Ignored: the match just cannot be resumed.
  }
}

export function clearSavedMatch(storage: MatchStorage | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Ignored.
  }
}

/** The saved match, or undefined if there is none or its schema version differs (a stale one is discarded). */
export function loadSavedMatch(storage: MatchStorage | undefined = defaultStorage()): LocalMatchHost | undefined {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return undefined;
    const host = restoreLocalHost(text);
    if (!host) clearSavedMatch(storage);
    return host;
  } catch {
    return undefined;
  }
}
