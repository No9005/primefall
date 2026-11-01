// Shared entry point: everything a client may import (types, planning-time validation,
// card display data). It must never expose the full Match State (ADR 0017).

export const GAME_NAME = "Primefall";

/** Short description of the rules package, shown by the web app to prove the wiring works. */
export function describeRules(): string {
  return `${GAME_NAME} rules package, shared entry point`;
}

export * from "./cards";
export * from "./host";
export * from "./plan";
export * from "./reactor-deck";
