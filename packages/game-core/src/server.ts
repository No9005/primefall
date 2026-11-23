// Server entry point: the full simulation (Match State, resolution, Squad Views, AI).
// Only a Match Host may import this; apps/web is forbidden to (ADR 0017). Stub for now.
// The list is explicit on purpose: this is the interface of the simulation, not every helper in it.

export const SERVER_ENTRY = "game-core/server" as const;

export { aiStyleFor, planSquad, type AiStyle } from "./ai";
export { buildSquadView, canSquadSeeHero, createMatch, recordSightings, startRound, type HeroState, type MatchState } from "./match";
export { getSquadEvents, resolveRound } from "./resolution";
