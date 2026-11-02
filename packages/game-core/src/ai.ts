// AI planning (ADR 0017, ADR 0018). A pure, deterministic function from a Squad View to a Squad Plan.
// It only ever sees the Squad View, so it cannot read enemy Hands or unseen Heroes: no cheating.

import { type CardIndex, HERO_DECKS, isSimpleAttack } from "./cards";
import { type HeroView, SquadId, type SquadView, Visibility, type VisibleEnemyView } from "./host";
import {
  ActionKind,
  chebyshevDistance,
  type HeroPlan,
  MAX_QUEUE_LENGTH,
  MOVE_DISTANCE,
  moveDestinations,
  type QueuedAction,
  type SquadPlan,
  validatePlan,
} from "./plan";
import { findTiles, type GridPosition, isStepAllowed, REACTOR_DECK, stepTowards, TileKind } from "./reactor-deck";

/** Actions the AI queues per Hero and Round; fewer than the Queue limit keeps Decks from draining fast. */
const AI_QUEUE_LENGTH = 3;

const PRIME_ZONE_TILES = findTiles(REACTOR_DECK, TileKind.PrimeZone);

const tileKey = ({ col, row }: GridPosition) => row * REACTOR_DECK.width + col;

/** Walking distance in steps from every tile to the nearest Prime Zone tile, going around Walls. */
const DISTANCE_TO_PRIME_ZONE: ReadonlyMap<number, number> = (() => {
  const distances = new Map<number, number>(PRIME_ZONE_TILES.map((tile) => [tileKey(tile), 0]));
  const queue = [...PRIME_ZONE_TILES];
  for (const tile of queue) {
    for (let row = tile.row - 1; row <= tile.row + 1; row++) {
      for (let col = tile.col - 1; col <= tile.col + 1; col++) {
        const next = { col, row };
        if (distances.has(tileKey(next)) || !isStepAllowed(tile, next)) continue;
        distances.set(tileKey(next), distances.get(tileKey(tile))! + 1);
        queue.push(next);
      }
    }
  }
  return distances;
})();

const distanceToPrimeZone = (tile: GridPosition) => DISTANCE_TO_PRIME_ZONE.get(tileKey(tile)) ?? Infinity;

/** Where a Move 2 towards `destination` really ends: it stops before a Wall or Wall corner. */
function walk(from: GridPosition, destination: GridPosition): GridPosition {
  let position = from;
  for (let step = 0; step < MOVE_DISTANCE; step++) {
    const next = stepTowards(position, destination);
    if (!isStepAllowed(position, next) || (next.col === position.col && next.row === position.row)) break;
    position = next;
  }
  return position;
}

const mirrorTile = ({ col, row }: GridPosition): GridPosition => ({ col: REACTOR_DECK.width - 1 - col, row });

/**
 * The Move 2 destinations in the order they are tried. The Reactor Deck is mirrored around the Prime Zone, so the
 * Right Squad tries them in the mirrored order: with the same order for both, the tie between equally good
 * destinations always went to the one with the lowest column, which is a longer advance for the Right Squad and
 * made it win nearly every match (issue 87).
 */
const destinationsInOrder = (from: GridPosition, squad: SquadId): GridPosition[] =>
  squad === SquadId.Left ? moveDestinations(from) : moveDestinations(mirrorTile(from)).map(mirrorTile);

/** The Move 2 destination that ends closest to the Prime Zone by walking distance; undefined if none gets closer. */
function stepTowardPrimeZone(from: GridPosition, squad: SquadId): GridPosition | undefined {
  let best: GridPosition | undefined;
  let bestDistance = distanceToPrimeZone(from);
  for (const destination of destinationsInOrder(from, squad)) {
    const distance = distanceToPrimeZone(walk(from, destination));
    if (distance < bestDistance) {
      best = destination;
      bestDistance = distance;
    }
  }
  return best;
}

function planHero(view: SquadView, hero: HeroView): HeroPlan {
  const deck = HERO_DECKS[hero.heroClass];
  const isAttackCard = (card: CardIndex) => isSimpleAttack(deck[card]!);
  // Attacks are kept for attacking; other cards pay for Moves, Blocks and Pitch first.
  const attackCards = hero.hand.filter(isAttackCard);
  const otherCards = hero.hand.filter((card) => !isAttackCard(card));
  const spare = () => [...otherCards, ...attackCards];

  const targets = view.enemies.filter(
    (enemy): enemy is VisibleEnemyView => enemy.visibility === Visibility.Visible && !enemy.exhausted,
  );
  const inRangeTargets = (position: GridPosition, card: CardIndex) =>
    targets.filter((enemy) => chebyshevDistance(position, enemy.position) <= (deck[card]!.range ?? 0));

  const queue: QueuedAction[] = [];
  let position = hero.position;
  let energyNeeded = 0;

  while (queue.length < Math.min(AI_QUEUE_LENGTH, MAX_QUEUE_LENGTH)) {
    // Every queued card and every pitched card must come from the Hand; Attacks need their Energy pitched.
    const cardsLeft = hero.hand.length - queue.length - energyNeeded;
    const attackCard = attackCards.find((card) => {
      const cost = deck[card]!.energyCost;
      return inRangeTargets(position, card).length > 0 && cardsLeft - 1 - cost >= 0;
    });
    if (attackCard !== undefined) {
      const cost = deck[attackCard]!.energyCost;
      const target = inRangeTargets(position, attackCard).sort((a, b) => a.deckCount - b.deckCount)[0]!;
      attackCards.splice(attackCards.indexOf(attackCard), 1);
      queue.push({ kind: ActionKind.Primary, card: attackCard, target: target.id });
      energyNeeded += cost;
      continue;
    }
    const card = spare()[0];
    if (card === undefined || cardsLeft - 1 < 0) break;
    const destination = stepTowardPrimeZone(position, view.squad);
    if (destination) {
      queue.push({ kind: ActionKind.Move, card, destination });
      position = walk(position, destination);
    } else if (targets.length > 0) {
      queue.push({ kind: ActionKind.Block, card });
    } else {
      break;
    }
    const pool = otherCards.includes(card) ? otherCards : attackCards;
    pool.splice(pool.indexOf(card), 1);
  }

  const pitched = spare().slice(0, energyNeeded);
  return { heroId: hero.id, queue, pitched };
}

/**
 * Plans the given Heroes of the viewing Squad: move toward the Prime Zone, attack Visible enemies in
 * Range, Block while holding the Zone or facing enemies. Any Hero whose plan fails `validatePlan` plans
 * nothing, so the result is always committable.
 */
export function planSquad(view: SquadView, heroIds: readonly string[] = view.heroes.map((hero) => hero.id)): SquadPlan {
  const heroes = view.heroes
    .filter((hero) => heroIds.includes(hero.id) && !hero.exhausted)
    .map((hero) => planHero(view, hero));
  const plan: SquadPlan = { squad: view.squad, heroes };
  const broken = new Set(validatePlan(view, plan).flatMap((issue) => (issue.heroId ? [issue.heroId] : [])));
  return broken.size === 0 ? plan : { squad: view.squad, heroes: heroes.filter((hero) => !broken.has(hero.heroId)) };
}
