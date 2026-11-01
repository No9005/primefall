// Match setup and the card economy of a Round (ADR 0007, ADR 0017). Pure and deterministic:
// every function returns a new Match State and all randomness comes from the seeded PRNG in it.

import { HAND_SIZE, HERO_DECKS, HeroClass } from "./cards";
import { ROUND_LIMIT, SquadId, type HeroView, type SquadView } from "./host";
import { findTiles, GridPosition, REACTOR_DECK, TileKind } from "./reactor-deck";

/** Index of a card in its Hero's fixed Deck list (`HERO_DECKS`). */
export type CardIndex = number;

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
}

/** Plain serializable data: it survives `JSON.stringify` / `JSON.parse` unchanged. */
export interface MatchState {
  seed: number;
  /** State of the seeded PRNG; advances with every shuffle. */
  rngState: number;
  round: number;
  heroes: HeroState[];
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
  const match: MatchState = { seed, rngState: seed >>> 0, round: 0, heroes: [] };
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
      });
    });
  }
  return match;
}

/**
 * Starts the next Round: every Hero draws up to a Hand of 4 and keeps unused cards. When the Deck runs
 * out, the Discard (never the Exile) is shuffled into a new Deck cycle; drawing resumes next Round.
 */
export function startRound(previous: MatchState): MatchState {
  const match = structuredClone(previous);
  match.round += 1;
  for (const hero of match.heroes) {
    while (hero.hand.length < HAND_SIZE && hero.deck.length > 0) {
      hero.hand.push(hero.deck.pop()!);
    }
    if (hero.deck.length === 0 && hero.discard.length > 0) {
      hero.deck = hero.discard;
      hero.discard = [];
      shuffle(match, hero.deck);
    }
  }
  return match;
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
    }));
  return { squad, round: match.round, roundLimit: ROUND_LIMIT, heroes };
}
