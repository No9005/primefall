// Server entry point: the full simulation (Match State, resolution, Squad Views, AI).
// Only a Match Host may import this; apps/web is forbidden to (ADR 0017). Stub for now.

export const SERVER_ENTRY = "game-core/server" as const;

export * from "./ai";
export * from "./match";
export * from "./resolution";
