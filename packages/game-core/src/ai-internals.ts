// The inner parts of the AI that its tests look into on purpose: the Squad roles and weights, the Fog of War worlds
// and the numbers that bound them. They are not part of any package entry point; change them with their tests.
// Everything a client or a Match Host may use is in `ai-entry.ts`.

export { assignRoles, GHOST_MEMORY_ROUNDS, sampleWorlds, SIMULATIONS_PER_ROUND, SquadRole, weightsFor, WORLDS } from "./ai";
