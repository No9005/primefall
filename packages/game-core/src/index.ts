// Shared entry point: everything a client may import (types, planning-time validation,
// card display data). It must never expose the full Match State (ADR 0017).

export const GAME_NAME = "Primefall";

export * from "./cards";
export * from "./host";
export * from "./plan";
export * from "./notstrom-map";
