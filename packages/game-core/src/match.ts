// Match setup and the card economy of a Round (ADR 0007, ADR 0017). Pure and deterministic:
// every function returns a new Match State and all randomness comes from the seeded PRNG in it.

import { type CardIndex, HAND_SIZE, HERO_DECKS, HeroClass } from "./cards";
import {
  type EnemyView,
  type MatchResult,
  type RevealedArea,
  ROUND_LIMIT,
  SquadId,
  type HeroView,
  type SquadView,
  Visibility,
} from "./host";
import { chebyshevDistance } from "./plan";
import { destroyedCoverTiles, findTiles, type Grid, type GridPosition, hasLineOfSight, REACTOR_DECK, TileKind } from "./reactor-deck";

export interface HeroState {
  id: string;
  squad: SquadId;
  heroClass: HeroClass;
  position: GridPosition;
  /** Top of the Deck is the end of the array. */
  deck: CardIndex[];
  hand: CardIndex[];
  discard: CardIndex[];
  exile: CardIndex[];
  /** Round-scoped: created by Block, cleared at the end of every Resolution (ADR 0002). */
  shield: number;
  /**
   * Resolution ends left before Slow expires; 0 means not Slowed. Slow applied during a Resolution lasts
   * until the end of the next one, so it starts at 2. A Move 2 that uses it up sets it to 0.
   */
  slow: number;
  /** Resolution ends left before Hidden expires (0: not Hidden); an Attack or being Marked ends it at once. */
  hidden: number;
  /** Resolution ends left before Marked expires (0: not Marked); a Marked Hero is Visible to the enemy Squad. */
  marked: number;
  /** Suppress: this Hero cannot become Hidden for the rest of the Round. */
  hiddenPrevented: boolean;
  /** Adrenal Surge: extra damage of every Attack this Hero plays; lasts until Exhaustion (ADR 0003). */
  attackBonus: number;
  /** Overwatch Uplink: this Hero's Attacks ignore the Half Cover damage reduction until the end of the Round. */
  ignoresHalfCover: boolean;
  /** Reposition: the Hero's next Move action covers this many tiles; absent when none is pending. */
  extendedMove?: number;
  /** Set after a Resolution that leaves the Deck empty; an Exhausted Hero is out of the match (ADR 0006). */
  exhausted: boolean;
}

/** What a Squad last saw of an enemy Hero (Ghost memory, ADR 0005). */
export interface GhostMemory {
  position: GridPosition;
  deckCount: number;
  discardCount: number;
  exileCount: number;
  lastSeenRound: number;
}

/** Sight range of every Hero in tiles (ADR 0005). */
export const SIGHT_RANGE = 7;
/** Extra sight range of a Hidden Assassin: 9 tiles in total. */
export const HIDDEN_SIGHT_BONUS = 2;

/** How many tiles a Hero sees: the Hidden Assassin sees further. */
export function sightRange(hero: HeroState): number {
  return SIGHT_RANGE + (hero.hidden > 0 && hero.heroClass === HeroClass.Assassin ? HIDDEN_SIGHT_BONUS : 0);
}

/** Temporary Half Cover (Deploy Cover, Fortify) that gives the tile back its kind when it expires. */
export interface PlacedCover {
  squad: SquadId;
  position: GridPosition;
  /** The tile kind to restore on expiry. */
  originalKind: TileKind;
  /** Resolution ends left before the Cover expires. */
  remaining: number;
}

/** An area a Squad's Scout Drone reveals. */
export interface ActiveReveal extends RevealedArea {
  squad: SquadId;
  /** Resolution ends left before the area is hidden again. */
  remaining: number;
}

/** Plain serializable data: it survives `JSON.stringify` / `JSON.parse` unchanged. */
export interface MatchState {
  seed: number;
  /** State of the seeded PRNG; advances with every shuffle. */
  rngState: number;
  round: number;
  heroes: HeroState[];
  /** Per Squad: Ghost memory of the enemy Heroes it has seen, by Hero id. */
  ghosts: Record<SquadId, Record<string, GhostMemory>>;
  /** The Grid as it is now: Cover can be destroyed during the match, so rules read Cover and Line of Sight from here. */
  grid: Grid;
  /** Per Squad: the destroyed Cover tiles it has seen destroyed or looked at since (Fog of War). */
  knownDestroyedCover: Record<SquadId, GridPosition[]>;
  placedCover: PlacedCover[];
  revealedAreas: ActiveReveal[];
  /** The Squad that controls the Prime Zone and for how many consecutive Resolutions (ADR 0010). */
  primeZone: { controller?: SquadId; progress: number };
  /** Set when a victory condition is met; the match accepts no further Rounds. */
  result?: MatchResult;
}

const SQUAD_ORDER: readonly HeroClass[] = [HeroClass.Bruiser, HeroClass.Controller, HeroClass.Assassin];

/** mulberry32: returns a number in [0, 1) and advances the state held in the Match State. */
function nextRandom(state: MatchState): number {
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Fisher-Yates shuffle in place. */
function shuffle(state: MatchState, cards: CardIndex[]): void {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
}

function spawnTiles(squad: SquadId): GridPosition[] {
  const middle = REACTOR_DECK.width / 2;
  return findTiles(REACTOR_DECK, TileKind.Spawn)
    .filter(({ col }) => (squad === SquadId.Left ? col < middle : col > middle))
    .sort((a, b) => a.row - b.row);
}

/** Creates two Squads of three Heroes on their Spawn tiles, each with a freshly shuffled Deck. */
export function createMatch(seed: number): MatchState {
  const match: MatchState = {
    seed,
    rngState: seed >>> 0,
    round: 0,
    heroes: [],
    ghosts: { [SquadId.Left]: {}, [SquadId.Right]: {} },
    grid: REACTOR_DECK,
    knownDestroyedCover: { [SquadId.Left]: [], [SquadId.Right]: [] },
    placedCover: [],
    revealedAreas: [],
    primeZone: { progress: 0 },
  };
  for (const squad of [SquadId.Left, SquadId.Right]) {
    const spawns = spawnTiles(squad);
    SQUAD_ORDER.forEach((heroClass, i) => {
      const deck = HERO_DECKS[heroClass].map((_, index) => index);
      shuffle(match, deck);
      match.heroes.push({
        id: `${squad}-${heroClass}`,
        squad,
        heroClass,
        position: { ...spawns[i]! },
        deck,
        hand: [],
        discard: [],
        exile: [],
        shield: 0,
        slow: 0,
        hidden: 0,
        marked: 0,
        hiddenPrevented: false,
        attackBonus: 0,
        ignoresHalfCover: false,
        exhausted: false,
      });
    });
  }
  recordSightings(match);
  return match;
}

/**
 * Starts the next Round: every Hero draws up to a Hand of 4 and keeps unused cards. When the Deck runs
 * out, the Discard (never the Exile) is shuffled into a new Deck cycle; drawing resumes next Round.
 */
export function startRound(previous: MatchState): MatchState {
  const match = structuredClone(previous);
  match.round += 1;
  for (const hero of match.heroes.filter((candidate) => !candidate.exhausted)) {
    while (hero.hand.length < HAND_SIZE && hero.deck.length > 0) {
      hero.hand.push(hero.deck.pop()!);
    }
    if (hero.deck.length === 0 && hero.discard.length > 0) {
      hero.deck = hero.discard;
      hero.discard = [];
      shuffle(match, hero.deck);
    }
  }
  recordSightings(match);
  return match;
}

/** Whether a revealed area of the Squad covers the tile; walls and Cover do not matter inside it. */
function isRevealed(match: MatchState, squad: SquadId, tile: GridPosition): boolean {
  return match.revealedAreas.some(
    (area) => area.squad === squad && chebyshevDistance(area.center, tile) <= Math.floor(area.size / 2),
  );
}

/**
 * Whether the Squad sees a tile right now: vision is shared, so one non-Exhausted Hero of the Squad
 * with the tile in sight range and Line of Sight is enough, or a Scout Drone area of the Squad covers it.
 */
export function canSquadSee(match: MatchState, squad: SquadId, tile: GridPosition): boolean {
  return (
    isRevealed(match, squad, tile) ||
    match.heroes.some(
      (hero) =>
        hero.squad === squad &&
        !hero.exhausted &&
        chebyshevDistance(hero.position, tile) <= sightRange(hero) &&
        hasLineOfSight(match.grid, hero.position, tile),
    )
  );
}

/**
 * Whether the Squad sees a Hero right now. A Marked enemy is always seen; a Hidden enemy is not seen even
 * on a tile in sight; otherwise the Hero is seen when its tile is.
 */
export function canSquadSeeHero(match: MatchState, squad: SquadId, target: HeroState): boolean {
  if (target.squad === squad) return true;
  if (target.marked > 0) return true;
  return target.hidden === 0 && canSquadSee(match, squad, target.position);
}

/**
 * Updates every Squad's Ghost memory with the enemies it sees right now. Called after every Tick, so an
 * enemy that leaves sight mid-Resolution is remembered where it was last seen.
 */
export function recordSightings(match: MatchState): void {
  const destroyed = destroyedCoverTiles(match.grid);
  for (const squad of [SquadId.Left, SquadId.Right]) {
    const known = match.knownDestroyedCover[squad];
    for (const tile of destroyed) {
      if (!known.some((other) => other.col === tile.col && other.row === tile.row) && canSquadSee(match, squad, tile)) {
        known.push(tile);
      }
    }
    for (const enemy of match.heroes.filter((hero) => hero.squad !== squad)) {
      if (!canSquadSeeHero(match, squad, enemy)) continue;
      match.ghosts[squad][enemy.id] = {
        position: { ...enemy.position },
        deckCount: enemy.deck.length,
        discardCount: enemy.discard.length,
        exileCount: enemy.exile.length,
        lastSeenRound: match.round,
      };
    }
  }
}

/** The Squad View of one Squad: its own Heroes only, with counts instead of Deck contents. */
export function buildSquadView(match: MatchState, squad: SquadId): SquadView {
  const heroes: HeroView[] = match.heroes
    .filter((hero) => hero.squad === squad)
    .map((hero) => ({
      id: hero.id,
      heroClass: hero.heroClass,
      position: { ...hero.position },
      deckCount: hero.deck.length,
      exileCount: hero.exile.length,
      hand: [...hero.hand],
      exhausted: hero.exhausted,
      slowed: hero.slow > 0,
      hidden: hero.hidden > 0,
      marked: hero.marked > 0,
    }));
  const enemies: EnemyView[] = match.heroes
    .filter((hero) => hero.squad !== squad)
    .map((hero): EnemyView => {
      const identity = { id: hero.id, heroClass: hero.heroClass };
      if (canSquadSeeHero(match, squad, hero)) {
        return {
          ...identity,
          visibility: Visibility.Visible,
          position: { ...hero.position },
          shield: hero.shield,
          deckCount: hero.deck.length,
          discardCount: hero.discard.length,
          exileCount: hero.exile.length,
          exhausted: hero.exhausted,
          slowed: hero.slow > 0,
          marked: hero.marked > 0,
        };
      }
      const ghost = match.ghosts[squad][hero.id];
      if (ghost) return { ...identity, visibility: Visibility.Ghost, ...structuredClone(ghost) };
      return { ...identity, visibility: Visibility.Unknown };
    });
  const { controller, progress } = match.primeZone;
  const primeProgress = {
    [SquadId.Left]: controller === SquadId.Left ? progress : 0,
    [SquadId.Right]: controller === SquadId.Right ? progress : 0,
  };
  const result = match.result ? { result: structuredClone(match.result) } : {};
  // Cover that was destroyed out of sight still looks intact to this Squad.
  const destroyedCover = match.knownDestroyedCover[squad].map((tile) => ({ ...tile }));
  // Placed Cover is known to the Squad that placed it and to a Squad that sees the tile.
  const placedCover = match.placedCover
    .filter((cover) => cover.squad === squad || canSquadSee(match, squad, cover.position))
    .map((cover) => ({ ...cover.position }));
  const revealedAreas = match.revealedAreas
    .filter((area) => area.squad === squad)
    .map(({ center, size }) => ({ center: { ...center }, size }));
  return {
    squad, round: match.round, roundLimit: ROUND_LIMIT, primeProgress, ...result, destroyedCover, placedCover, revealedAreas, heroes, enemies,
  };
}
