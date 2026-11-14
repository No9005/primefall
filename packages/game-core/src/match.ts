// Match setup and the card economy of a Round (ADR 0007, ADR 0017). Pure and deterministic:
// every function returns a new Match State and all randomness comes from the seeded PRNG in it.

import { type CardIndex, HAND_SIZE, HERO_DECKS, HeroClass } from "./cards";
import {
  type EnemyView,
  type MatchResult,
  type RevealedArea,
  DEFENDER_ROUND_LIMIT,
  MAX_PLACED_COVER_PER_SQUAD,
  MatchMode,
  OUTPOST_UNLOCK_ROUND,
  OUTPOST_VALUE,
  PRIME_ZONE_UNLOCK_ROUND,
  PRIME_ZONE_VALUE,
  type MatchModeSetting,
  ROUND_LIMIT,
  SquadId,
  type HeroView,
  type SquadView,
  Visibility,
  type ZoneControl,
  ZoneKind,
  type ZoneView,
} from "./host";
import { chebyshevDistance } from "./plan";
import { CoverKind, defenderStartTiles, spawnStartTiles, coverAt, destroyCover, destroyedCoverTiles, findTiles, type Grid, type GridPosition, hasLineOfSight, isWreck, REACTOR_DECK, TileKind, tileAt, withTile, withWreck } from "./reactor-deck";

/** A scoring zone of the classic mode, read from the Reactor Deck. */
export interface ZoneDefinition {
  kind: ZoneKind;
  tiles: readonly GridPosition[];
  value: number;
  unlockRound: number;
}

/** The tile groups of one kind: 4-connected tiles form one zone, in reading order. */
function tileGroups(grid: Grid, kind: TileKind): GridPosition[][] {
  const groups: GridPosition[][] = [];
  const seen = new Set<string>();
  for (const start of findTiles(grid, kind)) {
    if (seen.has(`${start.col},${start.row}`)) continue;
    const group: GridPosition[] = [];
    const open = [start];
    seen.add(`${start.col},${start.row}`);
    while (open.length > 0) {
      const tile = open.pop()!;
      group.push(tile);
      for (const next of [{ col: tile.col + 1, row: tile.row }, { col: tile.col - 1, row: tile.row }, { col: tile.col, row: tile.row + 1 }, { col: tile.col, row: tile.row - 1 }]) {
        if (tileAt(grid, next) !== kind || seen.has(`${next.col},${next.row}`)) continue;
        seen.add(`${next.col},${next.row}`);
        open.push(next);
      }
    }
    groups.push(group.sort((a, b) => a.row - b.row || a.col - b.col));
  }
  return groups;
}

/** The zones of the classic mode: the Prime Zone first, then the Outposts. Values and unlock Rounds are the constants in host.ts. */
export const ZONES: readonly ZoneDefinition[] = [
  ...tileGroups(REACTOR_DECK, TileKind.PrimeZone).map((tiles) => ({ kind: ZoneKind.PrimeZone, tiles, value: PRIME_ZONE_VALUE, unlockRound: PRIME_ZONE_UNLOCK_ROUND })),
  ...tileGroups(REACTOR_DECK, TileKind.Outpost).map((tiles) => ({ kind: ZoneKind.Outpost, tiles, value: OUTPOST_VALUE, unlockRound: OUTPOST_UNLOCK_ROUND })),
];

const samePosition = (a: GridPosition, b: GridPosition) => a.col === b.col && a.row === b.row;

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
  /** Adrenal Surge: extra damage of every Attack this Hero plays; lasts until Exhaustion (ADR 0003). */
  attackBonus: number;
  /** Overwatch Uplink: this Hero's Attacks ignore the Half Cover damage reduction until the end of the Round. */
  ignoresHalfCover: boolean;
  /** Charge: extra damage of the Hero's next Attack at Range 1; absent when none is pending. Expires at the end of the Round. */
  chargeBonus?: number;
  /** Reposition: the Hero's next Move action covers this many tiles; absent when none is pending. */
  extendedMove?: number;
  /** Set after a Resolution that leaves the Deck and the Discard empty; an Exhausted Hero is out of the match (ADR 0006). */
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

/** Cover a Hero put on a tile with a card; it stays until destroyed. `match.placedCover` keeps the order of placing, oldest first. */
export interface PlacedCover {
  squad: SquadId;
  position: GridPosition;
}

// A Squad has at most this many Placed Cover tiles; placing another removes its oldest (the constant is in host.ts, which a client may import).
export { MAX_PLACED_COVER_PER_SQUAD };

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
  /** Per Squad: the Cover left by Exhausted Heroes (`grid.wrecks`) that it has seen and not seen destroyed since. */
  knownWrecks: Record<SquadId, GridPosition[]>;
  placedCover: PlacedCover[];
  revealedAreas: ActiveReveal[];
  /** Attack and Defend only: the Squad that controls the Prime Zone and for how many consecutive Resolutions (ADR 0010, ADR 0022). Unused in the classic mode. */
  primeZone: { controller?: SquadId; progress: number };
  /** Classic: Victory Points of each Squad. */
  scores: Record<SquadId, number>;
  /** Classic: control of each zone of `ZONES` after the last Resolution. */
  zoneControl: ZoneControl[];
  /** Classic: Resolutions left in which each zone gives no takeover bonus. */
  takeoverCooldown: number[];
  /** Classic by default; in Attack and Defend one Squad is the Defender and the other the Attacker (ADR 0022). */
  mode: MatchModeSetting;
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

/** Creates two Squads of three Heroes on their start tiles, each with a freshly shuffled Deck. */
export function createMatch(seed: number, mode: MatchModeSetting = { kind: MatchMode.Classic }): MatchState {
  const match: MatchState = {
    seed,
    rngState: seed >>> 0,
    round: 0,
    heroes: [],
    ghosts: { [SquadId.Left]: {}, [SquadId.Right]: {} },
    grid: REACTOR_DECK,
    knownDestroyedCover: { [SquadId.Left]: [], [SquadId.Right]: [] },
    knownWrecks: { [SquadId.Left]: [], [SquadId.Right]: [] },
    placedCover: [],
    revealedAreas: [],
    primeZone: { progress: 0 },
    scores: { [SquadId.Left]: 0, [SquadId.Right]: 0 },
    zoneControl: ZONES.map(() => ({ contested: false })),
    takeoverCooldown: ZONES.map(() => 0),
    mode,
  };
  for (const squad of [SquadId.Left, SquadId.Right]) {
    const left = squad === SquadId.Left;
    const spawns = mode.kind === MatchMode.AttackAndDefend && mode.defender === squad ? defenderStartTiles(left) : spawnStartTiles(left);
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
 * When the Hero's Deck is empty and the Discard is not, shuffles the Discard (never the Exile) into the Deck.
 * Returns the number of cards shuffled, 0 when nothing happened.
 */
export function refillDeck(match: MatchState, hero: HeroState): number {
  if (hero.deck.length > 0 || hero.discard.length === 0) return 0;
  hero.deck = hero.discard;
  hero.discard = [];
  shuffle(match, hero.deck);
  return hero.deck.length;
}

/**
 * Starts the next Round: every Hero draws up to a Hand of 4 and keeps unused cards. When the Deck runs
 * out while drawing, the Discard is shuffled into it at once and drawing goes on.
 */
export function startRound(previous: MatchState): MatchState {
  const match = structuredClone(previous);
  match.round += 1;
  for (const hero of match.heroes.filter((candidate) => !candidate.exhausted)) {
    while (hero.hand.length < HAND_SIZE) {
      refillDeck(match, hero);
      if (hero.deck.length === 0) break;
      hero.hand.push(hero.deck.pop()!);
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
 * on a tile in sight, except inside a Scout Drone area of the Squad (it stays Hidden, it is only shown);
 * otherwise the Hero is seen when its tile is.
 */
export function canSquadSeeHero(match: MatchState, squad: SquadId, target: HeroState): boolean {
  if (target.squad === squad) return true;
  if (target.marked > 0) return true;
  if (target.hidden > 0) return isRevealed(match, squad, target.position);
  return canSquadSee(match, squad, target.position);
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
    // A Squad's own wrecks are known at once, others when seen; a seen wreck that is gone is forgotten.
    const own = (tile: GridPosition) =>
      match.heroes.some((hero) => hero.squad === squad && hero.exhausted && samePosition(hero.position, tile));
    const wrecks = (match.grid.wrecks ?? []).filter((tile) => own(tile) || canSquadSee(match, squad, tile));
    match.knownWrecks[squad] = [
      ...match.knownWrecks[squad].filter((tile) => !canSquadSee(match, squad, tile) || isWreck(match.grid, tile)),
      ...wrecks,
    ].filter((tile, i, all) => all.findIndex((other) => samePosition(other, tile)) === i);
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

// `roundsLeft` counts the Round being planned: 12 in Round 1, 1 in the last Round, 0 once the match is over.

/** The Squad View of one Squad: its own Heroes only, with counts instead of Deck contents. */
export function buildSquadView(match: MatchState, squad: SquadId): SquadView {
  const heroes: HeroView[] = match.heroes
    .filter((hero) => hero.squad === squad)
    .map((hero) => ({
      id: hero.id,
      heroClass: hero.heroClass,
      position: { ...hero.position },
      deckCount: hero.deck.length,
      discardCount: hero.discard.length,
      exileCount: hero.exile.length,
      hand: [...hero.hand],
      exhausted: hero.exhausted,
      slowed: hero.slow > 0,
      hidden: hero.hidden > 0,
      marked: hero.marked > 0,
      attackBonus: hero.attackBonus,
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
          hidden: hero.hidden > 0,
          slowed: hero.slow > 0,
          marked: hero.marked > 0,
          attackBonus: hero.attackBonus,
        };
      }
      const ghost = match.ghosts[squad][hero.id];
      if (ghost) return { ...identity, visibility: Visibility.Ghost, ...structuredClone(ghost) };
      return { ...identity, visibility: Visibility.Unknown };
    });
  const { controller, progress } = match.primeZone;
  const classic = match.mode.kind === MatchMode.Classic;
  const primeProgress = {
    [SquadId.Left]: controller === SquadId.Left ? progress : 0,
    [SquadId.Right]: controller === SquadId.Right ? progress : 0,
  };
  const result = match.result ? { result: structuredClone(match.result) } : {};
  // Cover that was destroyed out of sight still looks intact to this Squad.
  const destroyedCover = match.knownDestroyedCover[squad].map((tile) => ({ ...tile }));
  // Placed Cover is known to the Squad that placed it and to a Squad that sees the tile.
  const wreckCover = match.knownWrecks[squad].map((tile) => ({ ...tile }));
  const placedCover = match.placedCover
    .filter((cover) => cover.squad === squad || canSquadSee(match, squad, cover.position))
    .map((cover) => ({ ...cover.position }));
  // `match.placedCover` is in the order of placing, so this is oldest first.
  const ownPlacedCover = match.placedCover.filter((cover) => cover.squad === squad).map((cover) => ({ ...cover.position }));
  const revealedAreas = match.revealedAreas
    .filter((area) => area.squad === squad)
    .map(({ center, size, remaining }) => ({ center: { ...center }, size, remaining }));
  // The enemy learns which area was scanned and for how long more: no contents, no Hero, not who looks.
  const scannedAreas = match.revealedAreas
    .filter((area) => area.squad !== squad)
    .map(({ center, size, remaining }) => ({ center: { ...center }, size, remaining }));
  const visibleTiles: GridPosition[] = [];
  for (let row = 0; row < match.grid.height; row++) {
    for (let col = 0; col < match.grid.width; col++) {
      if (canSquadSee(match, squad, { col, row })) visibleTiles.push({ col, row });
    }
  }
  const { mode } = match;
  const modeView =
    mode.kind === MatchMode.AttackAndDefend
      ? (() => {
          const roundLimit = mode.roundLimit ?? DEFENDER_ROUND_LIMIT;
          const zone = findTiles(REACTOR_DECK, TileKind.PrimeZone);
          return { roundLimit, attackAndDefend: { defender: mode.defender, roundsLeft: match.result ? 0 : Math.max(0, roundLimit - match.round + 1), zone } };
        })()
      : { roundLimit: ROUND_LIMIT };
  const zones: ZoneView[] = ZONES.map((zone, i) => ({
    kind: zone.kind,
    tiles: zone.tiles.map((tile) => ({ ...tile })),
    value: zone.value,
    unlockRound: zone.unlockRound,
    active: match.round >= zone.unlockRound,
    ...match.zoneControl[i]!,
  }));
  const points = classic ? { scores: { ...match.scores }, zones } : {};
  return {
    squad, round: match.round, grid: REACTOR_DECK, ...modeView, primeProgress, ...points, ...result, destroyedCover, placedCover, ownPlacedCover, wreckCover, revealedAreas, scannedAreas, visibleTiles, heroes, enemies,
  };
}

/** A number in [0, 2^32) that only depends on the seed and the salt: the AI's source of variety (never `Math.random()`). */
export function seededHash(seed: number, salt: number): number {
  let h = Math.imul((seed >>> 0) ^ Math.imul(salt >>> 0, 0x9e3779b9), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return h >>> 0;
}

const hashOfText = (text: string) => [...text].reduce((sum, char) => Math.imul(sum, 31) + char.charCodeAt(0), 7);

/**
 * A Match State built from what one Squad knows, so the AI can play a Round through the real Resolution without reading
 * hidden state. Own Heroes are exact except the order of Deck and Discard. An enemy Hand is a guess: as many cards as the
 * counts leave, picked by the seed. A Visible enemy or a Ghost stands where it was seen; an Unknown enemy is left out
 * (Exhausted, no cards). `imagined` (optional) puts a Ghost or an Unknown enemy on a tile the caller imagined: the AI plays
 * several such worlds to plan under Fog of War. The same view, seed and `imagined` always give the same state.
 */
export function matchFromSquadView(view: SquadView, seed: number, imagined: ReadonlyMap<string, GridPosition> = new Map()): MatchState {
  const salt = view.round * 2 + (view.squad === SquadId.Left ? 0 : 1);
  const enemySquad = view.squad === SquadId.Left ? SquadId.Right : SquadId.Left;
  let grid: Grid = view.grid;
  for (const tile of view.destroyedCover) grid = destroyCover(grid, tile);
  for (const tile of view.wreckCover) grid = withWreck(grid, tile);
  for (const tile of view.placedCover) if (coverAt(grid, tile) === CoverKind.None) grid = withTile(grid, tile, TileKind.HalfCover);

  const heroState = (
    id: string,
    squad: SquadId,
    heroClass: HeroClass,
    position: GridPosition,
    counts: { deck: number; discard: number; exile: number },
    knownHand: readonly CardIndex[] | undefined,
    exhausted: boolean,
  ): HeroState => {
    const all = HERO_DECKS[heroClass].map((_, index) => index);
    const others = all
      .filter((card) => !knownHand?.includes(card))
      .sort((a, b) => seededHash(seed, salt * 7919 + hashOfText(id) + a) - seededHash(seed, salt * 7919 + hashOfText(id) + b));
    const hand = knownHand ? [...knownHand] : others.splice(0, Math.max(0, all.length - counts.deck - counts.discard - counts.exile));
    // The cards that are not in the Hand fill Deck, Discard and Exile by the counts.
    const deck = others.splice(0, counts.deck);
    const discard = others.splice(0, counts.discard);
    const exile = others.splice(0, counts.exile);
    return {
      id, squad, heroClass, position: { ...position },
      deck: exhausted ? [] : deck, hand: exhausted ? [] : hand, discard: exhausted ? [] : discard, exile: exhausted ? [] : exile,
      shield: 0, slow: 0, hidden: 0, marked: 0, attackBonus: 0, ignoresHalfCover: false, exhausted,
    };
  };

  const heroes: HeroState[] = view.heroes.map((own) => ({
    ...heroState(own.id, view.squad, own.heroClass, own.position, { deck: own.deckCount, discard: own.discardCount, exile: own.exileCount }, own.hand, own.exhausted),
    slow: own.slowed ? 1 : 0,
    hidden: own.hidden ? 1 : 0,
    marked: own.marked ? 1 : 0,
    attackBonus: own.attackBonus,
  }));
  const ghosts: MatchState["ghosts"] = { [SquadId.Left]: {}, [SquadId.Right]: {} };
  for (const enemy of view.enemies) {
    const guess = imagined.get(enemy.id);
    if (enemy.visibility === Visibility.Unknown) {
      // Never seen: left out, or, in an imagined world, standing on the imagined tile with a fresh Deck.
      const fresh = { deck: HERO_DECKS[enemy.heroClass].length - HAND_SIZE, discard: 0, exile: 0 };
      heroes.push(guess ? heroState(enemy.id, enemySquad, enemy.heroClass, guess, fresh, undefined, false) : heroState(enemy.id, enemySquad, enemy.heroClass, { col: 0, row: 0 }, { deck: 0, discard: 0, exile: 0 }, undefined, true));
      continue;
    }
    const counts = { deck: enemy.deckCount, discard: enemy.discardCount, exile: enemy.exileCount };
    const where = enemy.visibility === Visibility.Ghost && guess ? guess : enemy.position;
    const state = heroState(enemy.id, enemySquad, enemy.heroClass, where, counts, undefined, enemy.visibility === Visibility.Visible && enemy.exhausted);
    if (enemy.visibility === Visibility.Visible) {
      Object.assign(state, { shield: enemy.shield, slow: enemy.slowed ? 1 : 0, marked: enemy.marked ? 1 : 0, attackBonus: enemy.attackBonus });
    } else {
      ghosts[view.squad][enemy.id] = { deckCount: enemy.deckCount, discardCount: enemy.discardCount, exileCount: enemy.exileCount, position: { ...enemy.position }, lastSeenRound: enemy.lastSeenRound };
    }
    heroes.push(state);
  }

  const { primeProgress } = view;
  const primeController = primeProgress[SquadId.Left] > 0 ? SquadId.Left : primeProgress[SquadId.Right] > 0 ? SquadId.Right : undefined;
  const match: MatchState = {
    seed,
    rngState: seededHash(seed, salt),
    round: view.round,
    heroes,
    ghosts,
    grid,
    knownDestroyedCover: { [SquadId.Left]: view.destroyedCover.map((t) => ({ ...t })), [SquadId.Right]: view.destroyedCover.map((t) => ({ ...t })) },
    knownWrecks: { [SquadId.Left]: view.wreckCover.map((t) => ({ ...t })), [SquadId.Right]: view.wreckCover.map((t) => ({ ...t })) },
    placedCover: view.placedCover.map((position) => ({ squad: view.squad, position: { ...position } })),
    revealedAreas: view.revealedAreas.map((area) => ({ ...structuredClone(area), squad: view.squad })),
    primeZone: primeController === undefined ? { progress: 0 } : { controller: primeController, progress: primeProgress[primeController] },
    scores: view.scores ? { ...view.scores } : { [SquadId.Left]: 0, [SquadId.Right]: 0 },
    zoneControl: ZONES.map((_, i) => ({ controller: view.zones?.[i]?.controller, contested: view.zones?.[i]?.contested ?? false })),
    takeoverCooldown: ZONES.map(() => 0),
    mode: view.attackAndDefend
      ? { kind: MatchMode.AttackAndDefend, defender: view.attackAndDefend.defender, roundLimit: view.roundLimit }
      : { kind: MatchMode.Classic },
  };
  recordSightings(match);
  return match;
}
