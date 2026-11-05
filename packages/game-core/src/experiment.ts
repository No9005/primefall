// EXPERIMENT ONLY (branch experiment/zone-variants, never merged): switches for Prime Zone rule variants.
// Every switch is off by default, so the real rules and the existing tests are unchanged.
import type { SquadId } from "./host";

export interface Experiment {
  /** Every Hero that ends a Resolution in the Prime Zone loses the top card of its Deck to the Exile. */
  zoneDecay: boolean;
  /** A Hero counts as holding the Prime Zone only if it pitched at least one card this Round. */
  holdNeedsPitch: boolean;
  /** AI: pitch one card for every Hero whose Queue ends in the Prime Zone (needed by holdNeedsPitch). */
  aiPitchInZone: boolean;
  /** The Squad whose Heroes start on the Prime Zone and defend it; absent: no Defender. */
  defender?: SquadId;
  /** The Defender wins when this Round has been played without an Attacker holding the Zone. */
  defenderRounds: number;
  /** Defender mode: the Attacker takes control when it has at least as many Heroes in the Zone as the Defender (not strictly more). */
  attackerWinsTies: boolean;
}

export const experiment: Experiment = {
  zoneDecay: false,
  holdNeedsPitch: false,
  aiPitchInZone: false,
  defenderRounds: 10,
  attackerWinsTies: false,
};

export const DEFAULT_EXPERIMENT: Experiment = { ...experiment };
