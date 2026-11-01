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
  /** An Exhausted Hero is removed from the match: it plans and acts no more. */
  exhausted: boolean;
}

/** What a Squad knows about an enemy Hero: its tile and Deck size, never its Hand or Deck order. */
export interface EnemyView {
  id: string;
  heroClass: HeroClass;
  position: GridPosition;
  deckCount: number;
  exhausted: boolean;
}

/**
 * What one Squad may know about the match. Without Fog of War every enemy counts as Visible; the
 * Visible, Ghost and Unknown states replace `enemies` later. Never contains enemy Hands, Deck order,
 * seed or PRNG state.
 */
export interface SquadView {
  squad: SquadId;
  round: number;
  roundLimit: number;
  heroes: readonly HeroView[];
  enemies: readonly EnemyView[];
}

export enum EventKind {
  /** A Hero moved one tile. */
  Step = "step",
  /** A Hero's step failed (Wall, Wall corner, another Hero or a conflict) and it stopped. */
  MoveBlocked = "moveBlocked",
  /** A Hero created Shield by Blocking; `amount` is the Shield gained. */
  ShieldGained = "shieldGained",
  /** An Attack hit: `heroId` attacked `targetId`; Shield absorbed `absorbed`, `damage` cards left the Deck. */
  AttackHit = "attackHit",
  /** An Attack failed (target out of Range, without Line of Sight or already Exhausted). */
  AttackFailed = "attackFailed",
  /** A Hero's Deck is empty after the Resolution; it is removed from the match. */
  Exhausted = "exhausted",
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
  /** The Hero attacked, for `AttackHit` and `AttackFailed`. */
  targetId?: string;
  /** Damage absorbed by Shield, for `AttackHit`. */
  absorbed?: number;
  /** Cards removed from the target's Deck (Deck Damage), for `AttackHit`. */
  damage?: number;
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
