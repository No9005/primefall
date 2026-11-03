/** What the player is doing with a card right now; the HUD pieces that are not needed fade accordingly. */
export enum CardUseStage {
  /** No card is in use. */
  Idle = "idle",
  /** A card is selected and waits for a tile or a target. */
  Selected = "selected",
  /** The use chooser or the mode choice of a card is open. */
  UseChosen = "use-chosen",
}

export interface HudFocusState {
  /** Energy available to the selected Hero. */
  energy: number;
  stage: CardUseStage;
}

/** Opacity per HUD group. */
export interface HudFocus {
  energyPill: number;
  /** The Deck group (piles). */
  deck: number;
  commit: number;
  /** The Hand cards other than the one in use. */
  otherCards: number;
}

const CONTEXT = 0.3;
const DIMMED = 0.55;

export function hudFocus({ energy, stage }: HudFocusState): HudFocus {
  if (stage !== CardUseStage.Idle) return { energyPill: 1, deck: CONTEXT, commit: CONTEXT, otherCards: DIMMED };
  return { energyPill: energy === 0 ? CONTEXT : 0.85, deck: 1, commit: 1, otherCards: 1 };
}
