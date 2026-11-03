// Exhaustion in the HUD (issue 205): the skull on the Deck pile and the greyed-out, inert Hand and piles.

/** The Hero's own flag or the playback has Exhausted it. The skull waits until the Deck Damage animations have ended. */
export function exhaustionHud(input: { exhausted: boolean; exhaustedInPlayback: boolean; animationsQueued: boolean }): { skull: boolean; greyed: boolean } {
  const skull = (input.exhausted || input.exhaustedInPlayback) && !input.animationsQueued;
  return { skull, greyed: skull };
}
