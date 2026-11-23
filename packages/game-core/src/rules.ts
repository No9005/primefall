// The numbers of the rules, in one place. Change a number here and every rule, the AI and the UI follow.
// Card values (`HERO_DECKS`) and the map (`NOTSTROM_MAP`) are data with their own structure and stay in their files.

/** Rounds per match (Round Limit; docs/design/game-goals.md). */
export const ROUND_LIMIT = 15;

/** Credits a Squad needs to win at once. */
export const CREDITS_TO_WIN = 30;

/** Credits per Resolution for controlling the Prime Zone. */
export const PRIME_ZONE_VALUE = 2;

/** Credits per Resolution for controlling one Outpost. */
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

/** Seconds a Squad has to plan a Round before the host closes Planning with empty Queues (ADR 0017). */
export const PLANNING_TIMER_SECONDS = 60;

/** A Squad has at most this many Placed Cover tiles; placing another removes its oldest. */
export const MAX_PLACED_COVER_PER_SQUAD = 3;

/** A Hero's Queue holds at most 4 actions (the maximum Hand size, ADR 0020). */
export const MAX_QUEUE_LENGTH = 4;

/** Tiles a Move 3 covers at most. */
export const MOVE_DISTANCE = 3;

/** Energy one Pitch produces (ADR 0007). */
export const PITCH_ENERGY = 1;

/** Sight range of every Hero in tiles (ADR 0005). */
export const SIGHT_RANGE = 7;

/** Extra sight range of a Hidden Assassin: 9 tiles in total. */
export const HIDDEN_SIGHT_BONUS = 2;

/** Half Cover reduces incoming damage by this much. */
export const HALF_COVER_REDUCTION = 1;

/** Attackers at this Range or closer ignore Cover. */
export const COVER_IGNORED_RANGE = 1;

/** Maximum Hand size a Draw fills up to. */
export const HAND_SIZE = 4;
