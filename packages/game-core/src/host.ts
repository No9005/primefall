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

/** Seconds a Squad has to plan a Round before the host closes Planning with empty Queues (ADR 0017). */
export const PLANNING_TIMER_SECONDS = 60;

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
  discardCount: number;
  exileCount: number;
  /** Cards in the Hand, as indices into the Hero's fixed Deck list (`HERO_DECKS`). */
  hand: readonly number[];
  /** An Exhausted Hero is out of the match: it plans and acts no more, occupies no tile and leaves Half Cover. */
  exhausted: boolean;
  /** Slowed: the next Move 2 becomes a Move 1. */
  slowed: boolean;
  /** Hidden: enemies do not see this Hero, and an Assassin sees 2 tiles further. */
  hidden: boolean;
  /** Marked: the enemy Squad sees this Hero until the end of the next Resolution. */
  marked: boolean;
  /** The permanent Attack bonus (Adrenal Surge); the board shows a badge while it is above zero. */
  attackBonus: number;
}

/** A square of tiles a Scout Drone shows the Squad for a while, regardless of walls and Cover. */
export interface RevealedArea {
  /** The centre tile. */
  center: GridPosition;
  /** Side length in tiles (3 or 5). */
  size: number;
  /** Resolution ends left before the area is hidden again. */
  remaining: number;
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
  /** Marked: shown only while the enemy is Visible, which a Marked Hero always is. */
  marked: boolean;
  /** The permanent Attack bonus of a Visible Hero (Adrenal Surge). */
  attackBonus: number;
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
  /**
   * Cover tiles of the Reactor Deck that this Squad has seen destroyed. Cover destroyed out of sight is
   * not listed until the Squad sees that tile (Fog of War).
   */
  destroyedCover: readonly GridPosition[];
  /**
   * Half Cover left by Exhausted Heroes that this Squad has seen (its own at once) and not seen destroyed since.
   * Used like other Half Cover; a wreck the Squad has not seen is not listed (Fog of War).
   */
  wreckCover: readonly GridPosition[];
  /** Temporary Half Cover this Squad placed or currently sees (Deploy Cover, Fortify). */
  placedCover: readonly GridPosition[];
  /** The areas this Squad's Scout Drones still reveal. */
  revealedAreas: readonly RevealedArea[];
  /**
   * The tiles this Squad sees right now (own Heroes' sight and Scout Drone areas). Tiles seen earlier are
   * not listed; only current sight is lit.
   */
  visibleTiles: readonly GridPosition[];
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
  /** `heroId` became Hidden. */
  HiddenGained = "hiddenGained",
  /** `heroId` is no longer Hidden: it attacked or was Marked. */
  HiddenEnded = "hiddenEnded",
  /** `heroId` made `targetId` Marked. */
  MarkedApplied = "markedApplied",
  /** Knockback pushed `heroId` one tile, from `from` to `to`; a push of two tiles gives two events. */
  Knockback = "knockback",
  /** `heroId` destroyed the Cover on the tile `to` (Breach Charge). */
  CoverDestroyed = "coverDestroyed",
  /** `heroId` placed temporary Half Cover on the tile `to`. */
  CoverPlaced = "coverPlaced",
  /** `heroId` sent a Scout Drone to reveal the area of `amount` by `amount` tiles centred on `to`. */
  AreaRevealed = "areaRevealed",
  /** `targetId` ignores the Half Cover damage reduction until the end of the Round (Overwatch Uplink). */
  CoverReductionIgnored = "coverReductionIgnored",
  /** `heroId` permanently gained `amount` Attack (Adrenal Surge). */
  AttackBonusGained = "attackBonusGained",
  /** The Discard of `heroId` was shuffled into its empty Deck; `amount` is the number of cards shuffled. */
  DeckShuffled = "deckShuffled",
  /** A Hero waited: it did nothing in this Tick (`ActionKind.Wait`). */
  Wait = "wait",
  /** A Hero has no card left in its Deck and Discard after the Resolution; it is removed from the match. */
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
  /** Shield gained, for `ShieldGained`; cards shuffled, for `DeckShuffled`. */
  amount?: number;
  /** The Hero attacked, for `AttackHit` and `AttackFailed`. */
  targetId?: string;
  /** Damage absorbed by Shield, for `AttackHit`. */
  absorbed?: number;
  /**
   * Cards removed from the target's Deck (Deck Damage), for `AttackHit`. An Attack that empties the Deck
   * gives AttackHit, DeckShuffled, AttackHit: the damage is the sum, the order is the order of the piles.
   */
  damage?: number;
  /** True when Half Cover on the target's tile reduced the damage, for `AttackHit`. */
  halfCover?: boolean;
  /** The Hero that played the card, for a `ShieldGained` from a card (`heroId` is the receiver of the Shield). */
  casterId?: string;
  /** The card that caused the event (for example "Slam Shot"); absent for events no card causes, such as Block. */
  card?: string;
  /** True when the card was played in Overdrive. */
  overdrive?: boolean;
  /** Range in tiles (Chebyshev) between attacker and target, for `AttackHit` and `AttackFailed`. */
  distance?: number;
  /** The tile a tile Attack (Breach Charge) was aimed at, for its `AttackHit` and `AttackFailed`. */
  tile?: GridPosition;
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
  /**
   * What the AI will plan for these allied Heroes of the Squad if the player leaves them out of the
   * submitted plan. It depends on the Squad View only, so it does not change with the player's plan.
   */
  getAllyPlan(squad: SquadId, heroIds: readonly string[]): Promise<SquadPlan>;
}
