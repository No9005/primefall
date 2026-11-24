// The Match State an AI can imagine from one Squad View, so it can play a Round through the real Resolution (ADR 0005).

import { type CardIndex, EffectKind, HERO_DECKS, HeroClass } from "./cards";
import { HAND_SIZE } from "./rules";
import { SquadId, type SquadView, Visibility } from "./host";
import { type HeroState, type MatchState, recordSightings, seededHash, ZONES } from "./match";
import { CoverKind, coverAt, destroyCover, type Grid, type GridPosition, TileKind, withTile, withWreck } from "./notstrom-map";

const hashOfText = (text: string) => [...text].reduce((sum, char) => Math.imul(sum, 31) + char.charCodeAt(0), 7);

/** What `matchFromSquadView` knows of one Hero: the card counts, and the Hand only when it is the Squad's own. */
interface GuessedHero {
  id: string;
  squad: SquadId;
  heroClass: HeroClass;
  position: GridPosition;
  counts: { deck: number; discard: number; exile: number };
  knownHand: readonly CardIndex[] | undefined;
  exhausted: boolean;
}

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
  const heroState = (guessed: GuessedHero) => guessHero(seed, salt, guessed);
  const ghosts: MatchState["ghosts"] = { [SquadId.Left]: {}, [SquadId.Right]: {} };
  const heroes = [...ownHeroes(view, heroState), ...enemyHeroes(view, enemySquad, imagined, heroState, ghosts)];

  const fieldCard = HERO_DECKS[HeroClass.Controller].find((card) => card.effects.some(({ kind }) => kind === EffectKind.ScrapField))!;
  const fieldEffect = fieldCard.effects.find(({ kind }) => kind === EffectKind.ScrapField)!;
  const match: MatchState = {
    seed,
    rngState: seededHash(seed, salt),
    round: view.round,
    heroes,
    ghosts,
    grid: knownGrid(view),
    knownDestroyedCover: { [SquadId.Left]: view.destroyedCover.map((t) => ({ ...t })), [SquadId.Right]: view.destroyedCover.map((t) => ({ ...t })) },
    knownWrecks: { [SquadId.Left]: view.wreckCover.map((t) => ({ ...t })), [SquadId.Right]: view.wreckCover.map((t) => ({ ...t })) },
    placedCover: view.placedCover.map((position) => ({ squad: view.squad, position: { ...position } })),
    revealedAreas: view.revealedAreas.map((area) => ({ ...structuredClone(area), squad: view.squad })),
    scrapFields: view.scrapFields.map((field) => ({
      center: { ...field.center }, size: field.size, remaining: field.remaining, squad: field.own ? view.squad : enemySquad,
      // The caster of an enemy field is not known; the Controller of that Squad is the Hero that makes them.
      casterId: heroes.find((hero) => hero.squad === (field.own ? view.squad : enemySquad) && hero.heroClass === HeroClass.Controller)?.id ?? "",
      card: fieldCard.name, damage: fieldEffect.amount ?? 0,
    })),
    scores: { ...view.scores },
    zoneControl: ZONES.map((_, i) => ({ controller: view.zones[i]?.controller, contested: view.zones[i]?.contested ?? false })),
    takeoverCooldown: ZONES.map(() => 0),
    rules: {},
  };
  recordSightings(match);
  return match;
}

/** The Grid as the Squad knows it: destroyed Cover is gone, Wrecks and Placed Cover are in. */
function knownGrid(view: SquadView): Grid {
  let grid: Grid = view.grid;
  for (const tile of view.destroyedCover) grid = destroyCover(grid, tile);
  for (const tile of view.wreckCover) grid = withWreck(grid, tile);
  for (const tile of view.placedCover) if (coverAt(grid, tile) === CoverKind.None) grid = withTile(grid, tile, TileKind.HalfCover);
  return grid;
}

/** A Hero with a Hand and Deck guessed from the counts: the cards that are not the known Hand fill Hand, Deck, Discard and Exile in an order set by the seed. */
function guessHero(seed: number, salt: number, { id, squad, heroClass, position, counts, knownHand, exhausted }: GuessedHero): HeroState {
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
    shield: 0, slow: 0, hidden: 0, marked: 0, scrap: false, exhausted,
  };
}

/** The Squad's own Heroes: exact, except the order of Deck and Discard. */
function ownHeroes(view: SquadView, heroState: (guessed: GuessedHero) => HeroState): HeroState[] {
  return view.heroes.map((own) => ({
    ...heroState({ id: own.id, squad: view.squad, heroClass: own.heroClass, position: own.position, counts: { deck: own.deckCount, discard: own.discardCount, exile: own.exileCount }, knownHand: own.hand, exhausted: own.exhausted }),
    slow: own.slowed ? 1 : 0,
    hidden: own.hidden ? 1 : 0,
    marked: own.marked ? 1 : 0,
    scrap: own.scrap,
  }));
}

/** The enemy Heroes as the Squad sees or remembers them; a Ghost is also written into `ghosts`, which this fills in. */
function enemyHeroes(
  view: SquadView,
  enemySquad: SquadId,
  imagined: ReadonlyMap<string, GridPosition>,
  heroState: (guessed: GuessedHero) => HeroState,
  ghosts: MatchState["ghosts"],
): HeroState[] {
  const heroes: HeroState[] = [];
  for (const enemy of view.enemies) {
    const guess = imagined.get(enemy.id);
    if (enemy.visibility === Visibility.Unknown) {
      // Never seen: left out, or, in an imagined world, standing on the imagined tile with a fresh Deck.
      const fresh = { deck: HERO_DECKS[enemy.heroClass].length - HAND_SIZE, discard: 0, exile: 0 };
      const base = { id: enemy.id, squad: enemySquad, heroClass: enemy.heroClass, knownHand: undefined };
      heroes.push(
        guess
          ? heroState({ ...base, position: guess, counts: fresh, exhausted: false })
          : heroState({ ...base, position: { col: 0, row: 0 }, counts: { deck: 0, discard: 0, exile: 0 }, exhausted: true }),
      );
      continue;
    }
    const counts = { deck: enemy.deckCount, discard: enemy.discardCount, exile: enemy.exileCount };
    const where = enemy.visibility === Visibility.Ghost && guess ? guess : enemy.position;
    const state = heroState({ id: enemy.id, squad: enemySquad, heroClass: enemy.heroClass, position: where, counts, knownHand: undefined, exhausted: enemy.visibility === Visibility.Visible && enemy.exhausted });
    if (enemy.visibility === Visibility.Visible) {
      Object.assign(state, { shield: enemy.shield, slow: enemy.slowed ? 1 : 0, marked: enemy.marked ? 1 : 0, scrap: enemy.scrap });
    } else {
      ghosts[view.squad][enemy.id] = { deckCount: enemy.deckCount, discardCount: enemy.discardCount, exileCount: enemy.exileCount, position: { ...enemy.position }, lastSeenRound: enemy.lastSeenRound };
    }
    heroes.push(state);
  }
  return heroes;
}
