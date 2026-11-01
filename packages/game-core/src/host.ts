// The Match Host interface and the Squad View (ADR 0017). Shared by the web app, the local host and a
// later network host. Everything here is plain serializable data; the full Match State never leaves
// the host.

import type { HeroClass } from "./cards";
import type { SquadPlan } from "./plan";
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

export enum EventKind {
  /** A Hero moved one tile. */
  Step = "step",
  /** A Hero's step failed (Wall, Wall corner, another Hero or a conflict) and it stopped. */
  MoveBlocked = "moveBlocked",
  /** A Hero created Shield by Blocking; `amount` is the Shield gained. */
  ShieldGained = "shieldGained",
}

/** Something that happened during a Resolution, for playback. Events of the same Tick play together. */
export interface MatchEvent {
  kind: EventKind;
  /** 1-based Tick of the Resolution. */
  tick: number;
  heroId: string;
  /** Where the Hero stands before the step, or stays when blocked; absent for non-movement events. */
  from?: GridPosition;
  /** The tile entered; absent when blocked. */
  to?: GridPosition;
  /** Shield gained, for `ShieldGained`. */
  amount?: number;
}

export interface SubmitResult {
  /** The view after the Resolution, already at the start of the next Round. */
  view: SquadView;
  events: readonly MatchEvent[];
}

/** Asynchronous so a network host can replace the local one without changing callers. */
export interface MatchHost {
  getSquadView(squad: SquadId): Promise<SquadView>;
  submitPlan(plan: SquadPlan): Promise<SubmitResult>;
}
