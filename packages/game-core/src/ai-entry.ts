// Entry point `game-core/ai`: what a client needs to plan for a Squad. The inner parts of the AI (roles, weights, the
// imagined worlds) are in `ai-internals.ts`, which is for the AI's own tests and not part of this entry point.

export { AiStyle, aiStyleFor, planSquad, planSquadGreedy } from "./ai";
