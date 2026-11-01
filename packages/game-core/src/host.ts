// The Match Host interface and the Squad View (ADR 0017). Shared by the web app, the local host and a
// later network host. Everything here is plain serializable data; the full Match State never leaves
// the host.

import type { HeroClass } from "./cards";
import type { GridPosition } from "./reactor-deck";

export enum SquadId {
  Left = "left",
  Right = "right",
}

/** Rounds per match (Round Limit, ADR 0019). */
export const ROUND_LIMIT = 30;

export interface HeroView {
  id: string;
  heroClass: HeroClass;
  position: GridPosition;
  deckCount: number;
  exileCount: number;
  /** Cards in the Hand, as indices into the Hero's fixed Deck list (`HERO_DECKS`). */
  hand: readonly number[];
}

/**
 * What one Squad may know about the match. For now only its own Heroes: enemy information (Visible,
 * Ghost, Unknown) comes with Fog of War. Never contains enemy Hands, Deck order, seed or PRNG state.
 */
export interface SquadView {
  squad: SquadId;
  round: number;
  roundLimit: number;
  heroes: readonly HeroView[];
}

/** Commands of one Squad for one Round. Commands are not defined yet, so a plan is empty for now. */
export interface SquadPlan {
  squad: SquadId;
}

/** Something that happened during a Resolution, for playback. No event kinds exist yet. */
export interface MatchEvent {
  kind: string;
}

export interface SubmitResult {
  view: SquadView;
  events: readonly MatchEvent[];
}

/** Asynchronous so a network host can replace the local one without changing callers. */
export interface MatchHost {
  getSquadView(squad: SquadId): Promise<SquadView>;
  submitPlan(plan: SquadPlan): Promise<SubmitResult>;
}
