// The Match Host interface and the Squad View (ADR 0017). Shared by the web app, the local host and a
// later network host. Everything here is plain serializable data; the full Match State never leaves
// the host.

import type { HeroClass } from "./cards";
import type { SquadPlan } from "./plan";
import type { Grid, GridPosition } from "./reactor-deck";

export enum SquadId {
  Left = "left",
  Right = "right",
}

/** Rounds per match in the classic mode (Round Limit; docs/design/game-goals.md). */
export const ROUND_LIMIT = 15;

/** Victory Points a Squad needs to win the classic mode at once. */
export const VICTORY_POINTS_TO_WIN = 30;

/** Victory Points per Resolution for controlling the Prime Zone. */
export const PRIME_ZONE_VALUE = 2;
/** Victory Points per Resolution for controlling one Outpost. */
export const OUTPOST_VALUE = 1;
/** The Round from which the Prime Zone scores (it is inactive before). */
export const PRIME_ZONE_UNLOCK_ROUND = 4;
/** The Round from which an Outpost scores. */
export const OUTPOST_UNLOCK_ROUND = 1;

/**
 * Takeover bonus (ADR 0024, off by default): the factor of the zone's value a Squad earns once when it takes a
 * zone that the enemy controlled at the end of the previous Resolution. 0 = off; the intended value when on is 1.
 */
export const TAKEOVER_BONUS_FACTOR = 0;
/** Resolutions after a takeover during which the same zone gives no further takeover bonus. */
export const TAKEOVER_COOLDOWN = 3;

export enum ZoneKind {
  PrimeZone = "primeZone",
  Outpost = "outpost",
}

/** Who controls a zone after the last Resolution (classic mode). Nobody when it is empty or inactive. */
export interface ZoneControl {
  controller?: SquadId;
  /** Both Squads have equally many non-Exhausted Heroes in it, at least one each: nobody scores. */
  contested: boolean;
}

/** One zone of the classic mode as a Squad sees it: public information, like the scores. */
export interface ZoneView extends ZoneControl {
  kind: ZoneKind;
  tiles: readonly GridPosition[];
  /** Victory Points per Resolution for the controlling Squad. */
  value: number;
  /** The Round from which the zone scores. */
  unlockRound: number;
  /** An inactive zone scores nothing yet. */
  active: boolean;
}

/** Rounds the Defender must survive in Attack and Defend (ADR 0022); replaces `ROUND_LIMIT` in that mode. */
export const DEFENDER_ROUND_LIMIT = 9;

export enum MatchMode {
  Classic = "classic",
  AttackAndDefend = "attackAndDefend",
}

/** Who wins a tie in the number of Heroes in the Zone in Attack and Defend (ADR 0022). */
export enum ZoneTie {
  Attacker = "attacker",
  Defender = "defender",
}

/** The tie rule of Attack and Defend. */
export const DEFENDER_ZONE_TIE: ZoneTie = ZoneTie.Attacker;

/** Cards each Hero that ends a Resolution in the Zone moves from the top of its Deck to the Exile in Attack and Defend; 0 = off. */
export const ZONE_DECAY_CARDS = 0;

/** The tunable numbers of Attack and Defend; each defaults to the constant above. The balance harness varies them. */
export interface AttackAndDefendRules {
  roundLimit?: number;
  zoneTie?: ZoneTie;
  zoneDecay?: number;
}

/** The tunable numbers of the classic mode; each defaults to the constant above. */
export interface ClassicRules {
  takeoverBonusFactor?: number;
  takeoverCooldown?: number;
}

/** The mode of a match; in Attack and Defend the other Squad is the Attacker (ADR 0022). */
export type MatchModeSetting =
  | ({ kind: MatchMode.Classic } & ClassicRules)
  | ({ kind: MatchMode.AttackAndDefend; defender: SquadId } & AttackAndDefendRules);

/** Seconds a Squad has to plan a Round before the host closes Planning with empty Queues (ADR 0017). */
export const PLANNING_TIMER_SECONDS = 60;

/** Why a match ended (ADR 0010, ADR 0011, ADR 0019). */
export enum MatchEndReason {
  /** Attack and Defend: the Attacker controlled the Prime Zone for three consecutive Resolutions. */
  PrimeZoneHeld = "primeZoneHeld",
  /** Classic: a Squad reached the Victory Points needed to win. */
  VictoryPoints = "victoryPoints",
  /** All three Heroes of a Squad are Exhausted. */
  AllHeroesExhausted = "allHeroesExhausted",
  /** Classic: the Round Limit passed; decided by Victory Points, then by the cards not in the Exile. */
  RoundLimit = "roundLimit",
  /** Attack and Defend: the Defender survived the Round limit of the mode (ADR 0022). */
  DefenceHeld = "defenceHeld",
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
  /** Classic only: the Victory Points at the end. */
  scores?: Record<SquadId, number>;
  /** Classic only: cards not in the Exile (Deck, Discard and Hand of all Heroes), the tiebreak of equal scores. */
  cardTotals?: Record<SquadId, number>;
}

/** Consecutive Resolutions the Attacker must control the Prime Zone to win Attack and Defend (ADR 0010, ADR 0022). */
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
/** A Squad has at most this many Placed Cover tiles; placing another removes its oldest. */
export const MAX_PLACED_COVER_PER_SQUAD = 3;

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
  /** Hidden: a Hidden enemy is Visible only inside a Scout Drone area of the Squad, shown but not unmasked. */
  hidden: boolean;
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
  /**
   * The map (public information): terrain only. Destroyed, wreck and placed Cover are not in it; they stay in
   * `destroyedCover`, `wreckCover` and `placedCover`.
   */
  grid: Grid;
  /**
   * Only in Attack and Defend (public information): the Defender, the Rounds left until Defence Held, and the tiles
   * of the Zone to take or hold (the same shape as the tiles of a `ZoneView`).
   */
  attackAndDefend?: { defender: SquadId; roundsLeft: number; zone: readonly GridPosition[] };
  /** Attack and Defend: consecutive Resolutions each Squad has controlled the Prime Zone (0 for the Squad that does not). Always 0 in the classic mode. */
  primeProgress: Record<SquadId, number>;
  /** Classic only: the Victory Points of both Squads. */
  scores?: Record<SquadId, number>;
  /** Classic only: the Prime Zone and the Outposts. Control is the result of the last Resolution; enemy Hero positions stay in the Fog. */
  zones?: readonly ZoneView[];
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
  /** Cover built with a card (Deploy Cover, Fortify, Barricade) that this Squad placed or currently sees; it stays until destroyed. */
  placedCover: readonly GridPosition[];
  /** The Placed Cover tiles of this Squad itself, in the order of placing (the oldest goes first when a fourth is placed). The enemy's are the rest of `placedCover`. */
  ownPlacedCover: readonly GridPosition[];
  /** The areas this Squad's Scout Drones still reveal. */
  revealedAreas: readonly RevealedArea[];
  /** Areas the enemy Squad's Scout Drones scan right now: where, how big and for how many more Resolutions, never what is in them. */
  scannedAreas: readonly Pick<RevealedArea, "center" | "size" | "remaining">[];
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
  /** An Attack missed: it was checked in the Tick it fired and was not allowed; `reason` says why. */
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
  /** Pull moved `heroId` one tile toward the caster, from `from` to `to`; a pull of two tiles gives two events. */
  Pull = "pull",
  /** `heroId` charged at `targetId`: its steps are `Step` events, this one follows them (also when it could not move). */
  Charged = "charged",
  /** `heroId` destroyed the Cover on the tile `to` (Breach Charge, Wrecking Blow). */
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
  /** Classic: `squad` took the zone `zone` (index in `ZONES`) from the enemy and earned `amount` Victory Points (0 when the bonus is off). Public; `heroId` is empty. */
  ZoneTakenOver = "zoneTakenOver",
}

/** Why an Attack missed when it fired (a Declared Target is checked in that Tick, ADR 0013). */
export enum AttackFailReason {
  /** The Declared Target was not visible to the attacker's Squad any more. Reveals nothing about the real target. */
  NotVisible = "notVisible",
  TargetExhausted = "targetExhausted",
  OutOfRange = "outOfRange",
  TooClose = "tooClose",
  NoLineOfSight = "noLineOfSight",
  FullCover = "fullCover",
  /** A Ghost Shot found nobody on the remembered tile. */
  EmptyTile = "emptyTile",
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
  /** Crossfire damage added to this hit (0 or 1), for `AttackHit`. Set on the first event of a hit that splits at a shuffle. */
  crossfire?: number;
  /**
   * Cards removed from the target's Deck (Deck Damage), for `AttackHit`. An Attack that empties the Deck
   * gives AttackHit, DeckShuffled, AttackHit: the damage is the sum, the order is the order of the piles.
   */
  damage?: number;
  /** True when Half Cover on the target's tile reduced the damage, for `AttackHit`. */
  halfCover?: boolean;
  /** Damage a close-range effect added to this hit (the "CLOSE +1" of Slam Shot at Range 1), for `AttackHit`; absent when none. */
  closeBonus?: number;
  /** Damage a Charge added to this hit (its once-only bonus at Range 1), for `AttackHit`; absent when none. */
  chargeBonus?: number;
  /**
   * The Hero that played the card, for a `ShieldGained` from a card and for a `Pull` (`heroId` is the receiver of the
   * Shield, or the pulled Hero). A Squad that does not see the caster of a `Pull` does not get this field.
   */
  casterId?: string;
  /** The card that caused the event (for example "Slam Shot"); absent for events no card causes, such as Block. */
  card?: string;
  /** True when the card was played in Overdrive. */
  overdrive?: boolean;
  /** Why the Attack missed, for `AttackFailed`. */
  reason?: AttackFailReason;
  /** Range in tiles (Chebyshev) between attacker and target, for `AttackHit` and `AttackFailed` (not for `NotVisible`). */
  distance?: number;
  /** The tile a tile Attack (Breach Charge) was aimed at, for its `AttackHit` and `AttackFailed`. */
  tile?: GridPosition;
  /** The Squad that took the zone, for `ZoneTakenOver`. */
  squad?: SquadId;
  /** The index of the zone in `ZONES`, for `ZoneTakenOver`. */
  zone?: number;
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
