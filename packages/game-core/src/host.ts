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

/** Why a match ended (ADR 0010, ADR 0011, ADR 0019). */
export enum MatchEndReason {
  /** A Squad controlled the Prime Zone for three consecutive Resolutions. */
  PrimeZoneHeld = "primeZoneHeld",
  /** All three Heroes of a Squad are Exhausted. */
  AllHeroesExhausted = "allHeroesExhausted",
  /** The Round Limit passed; decided by the cards in all Decks. */
  RoundLimit = "roundLimit",
}

/** The result of a finished match. */
export interface MatchResult {
  /** Absent for a draw. */
  winner?: SquadId;
  reason: MatchEndReason;
  /** The Round in which the match ended. */
  round: number;
  /** Cards in all Decks of each Squad's Heroes at the end. */
  deckTotals: Record<SquadId, number>;
}

/** Consecutive Resolutions a Squad must control the Prime Zone to win (ADR 0010). */
export const PRIME_ZONE_WIN_RESOLUTIONS = 3;

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
  /** Slowed: the next Move 2 becomes a Move 1. */
  slowed: boolean;
}

/** How much a Squad knows about one enemy Hero (Fog of War, ADR 0005). */
export enum Visibility {
  /** Within sight range and Line of Sight of the Squad right now. */
  Visible = "visible",
  /** Out of sight, but seen before: last known position and counts. */
  Ghost = "ghost",
  /** Never seen: nothing is known beyond which Hero it is. */
  Unknown = "unknown",
}

/**
 * Which enemy Hero this is. Both Squads field one Hero of each class, so the identity reveals nothing
 * about the match; it lets the Squad panel list an Unknown enemy.
 */
interface EnemyIdentity {
  id: string;
  heroClass: HeroClass;
}

/** A currently seen enemy Hero: never its Hand, Energy, Queue or Deck order. */
export interface VisibleEnemyView extends EnemyIdentity {
  visibility: Visibility.Visible;
  position: GridPosition;
  shield: number;
  deckCount: number;
  discardCount: number;
  exileCount: number;
  exhausted: boolean;
  /** Slowed: shown only while the enemy is Visible. */
  slowed: boolean;
}

/** The last known position and counts of an enemy Hero that is no longer Visible. */
export interface GhostEnemyView extends EnemyIdentity {
  visibility: Visibility.Ghost;
  position: GridPosition;
  deckCount: number;
  discardCount: number;
  exileCount: number;
  /** The Round in which the Hero was last seen. */
  lastSeenRound: number;
}

export interface UnknownEnemyView extends EnemyIdentity {
  visibility: Visibility.Unknown;
}

export type EnemyView = VisibleEnemyView | GhostEnemyView | UnknownEnemyView;

/**
 * What one Squad may know about the match. Never contains enemy Hands, Energy, Queues, Deck order,
 * seed or PRNG state, and nothing about enemies the Squad has not seen.
 */
export interface SquadView {
  squad: SquadId;
  round: number;
  roundLimit: number;
  /** Consecutive Resolutions each Squad has controlled the Prime Zone (0 for the Squad that does not). */
  primeProgress: Record<SquadId, number>;
  /** Set once the match is over; no further plans are accepted. */
  result?: MatchResult;
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
  /** A queued action was illegal when it resolved (card not in the Hand, used twice, beyond the Queue limit). */
  ActionFailed = "actionFailed",
  /** `heroId` made `targetId` Slowed (Attack or Utility card). */
  SlowApplied = "slowApplied",
  /** A Slowed Hero's Move 2 was cut to a Move 1; the Slow is used up. */
  SlowUsed = "slowUsed",
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
