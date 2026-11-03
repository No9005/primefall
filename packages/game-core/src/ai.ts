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
  moveEnd,
  movePath,
  type QueuedAction,
  type SquadPlan,
  validatePlan,
} from "./plan";
import { findTiles, type GridPosition, isStepAllowed, REACTOR_DECK, TileKind } from "./reactor-deck";

/** Actions the AI queues per Hero and Round; fewer than the Queue limit keeps Decks from draining fast. */
const AI_QUEUE_LENGTH = 3;

const PRIME_ZONE_TILES = findTiles(REACTOR_DECK, TileKind.PrimeZone);

const tileKey = ({ col, row }: GridPosition) => row * REACTOR_DECK.width + col;

const isPrimeZoneTile = (tile: GridPosition) => PRIME_ZONE_TILES.some((zone) => zone.col === tile.col && zone.row === tile.row);

/**
 * Walking distance in steps from every tile to the nearest Prime Zone tile that is not in `blocked`, going around
 * Walls and the blocked tiles (a Move can neither cross nor end on one). A Squad that only counted the Zone as a place to walk to
 * froze at its edge behind Squad mates standing in it (issue 147).
 */
function distancesToPrimeZone(blocked: ReadonlySet<number>): ReadonlyMap<number, number> {
  const free = PRIME_ZONE_TILES.filter((tile) => !blocked.has(tileKey(tile)));
  const distances = new Map<number, number>(free.map((tile) => [tileKey(tile), 0]));
  const queue = [...free];
  for (const tile of queue) {
    for (let row = tile.row - 1; row <= tile.row + 1; row++) {
      for (let col = tile.col - 1; col <= tile.col + 1; col++) {
        const next = { col, row };
        if (distances.has(tileKey(next)) || blocked.has(tileKey(next)) || !isStepAllowed(tile, next)) continue;
        distances.set(tileKey(next), distances.get(tileKey(tile))! + 1);
        queue.push(next);
      }
    }
  }
  return distances;
}

/** Tiles no Move should end on: enemies and Squad mates that already stand in the Zone. */
function blockedTiles(view: SquadView): Set<number> {
  const blocked = new Set<number>();
  for (const hero of view.heroes) {
    if (!hero.exhausted && isPrimeZoneTile(hero.position)) blocked.add(tileKey(hero.position));
  }
  for (const enemy of view.enemies) {
    if (enemy.visibility === Visibility.Visible && !enemy.exhausted) blocked.add(tileKey(enemy.position));
  }
  return blocked;
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

/**
 * Tiles that Heroes planned earlier stand on after each step of a queue slot (key: `claimKey`). Two Heroes
 * stepping onto one tile, or onto a tile where a Hero stays, both fail that step (ADR 0013).
 */
type ClaimedTiles = Map<number, Set<number>>;

const claimKey = (slot: number, step: number) => slot * MOVE_DISTANCE + step - 1;

/** The tile a Hero stands on after step 1 and step 2 of a Move from `from` to `destination`. */
const tilesAfterSteps = (from: GridPosition, destination: GridPosition): GridPosition[] => {
  const path = movePath(from, destination);
  return Array.from({ length: MOVE_DISTANCE }, (_, step) => path[step] ?? path.at(-1) ?? from);
};

/**
 * The Move 2 destination that ends closest to the Prime Zone by walking distance; undefined if none gets closer.
 * Moving Heroes do not hinder each other, but a Move cannot step onto a blocked tile (a Hero stays there) or a
 * tile another Hero already claimed for the same step of the queue slot.
 */
function stepTowardPrimeZone(
  from: GridPosition,
  squad: SquadId,
  slot: number,
  claimed: ClaimedTiles,
  blocked: ReadonlySet<number>,
  distances: ReadonlyMap<number, number>,
): GridPosition | undefined {
  const distanceTo = (tile: GridPosition) => distances.get(tileKey(tile)) ?? Infinity;
  let best: GridPosition | undefined;
  let bestDistance = isPrimeZoneTile(from) ? 0 : distanceTo(from);
  for (const destination of destinationsInOrder(from, squad)) {
    const end = moveEnd(from, destination);
    const steps = tilesAfterSteps(from, destination);
    if (blocked.has(tileKey(end)) || steps.some((tile) => blocked.has(tileKey(tile)))) continue;
    if (steps.some((tile, step) => claimed.get(claimKey(slot, step + 1))?.has(tileKey(tile)))) continue;
    const distance = distanceTo(end);
    if (distance < bestDistance) {
      best = destination;
      bestDistance = distance;
    }
  }
  return best;
}

function claimSteps(claimed: ClaimedTiles, slot: number, tiles: readonly GridPosition[]): void {
  tiles.forEach((tile, step) => {
    const key = claimKey(slot, step + 1);
    claimed.set(key, (claimed.get(key) ?? new Set<number>()).add(tileKey(tile)));
  });
}

function planHero(
  view: SquadView,
  hero: HeroView,
  claimed: ClaimedTiles,
  blocked: ReadonlySet<number>,
  distances: ReadonlyMap<number, number>,
): HeroPlan {
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

  // Two Heroes that would end a Move on the same tile both stop short. Mirrored Squads plan mirrored Moves, so
  // without a tie-break they would block each other for ever: the Squads take turns, one per Round, at keeping
  // away from the tiles an enemy can reach too.
  const yieldsThisRound = (view.round + (view.squad === SquadId.Left ? 0 : 1)) % 2 === 0;
  const unavailable = new Set(blocked);
  if (yieldsThisRound) {
    for (const row of REACTOR_DECK.tiles.keys()) {
      for (let col = 0; col < REACTOR_DECK.width; col++) {
        if (targets.some((enemy) => chebyshevDistance(enemy.position, { col, row }) <= MOVE_DISTANCE)) unavailable.add(tileKey({ col, row }));
      }
    }
  }

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
      claimSteps(claimed, queue.length, [position, position]);
      queue.push({ kind: ActionKind.Primary, card: attackCard, target: target.id });
      energyNeeded += cost;
      continue;
    }
    const card = spare()[0];
    if (card === undefined || cardsLeft - 1 < 0) break;
    const slot = queue.length;
    const destination = stepTowardPrimeZone(position, view.squad, slot, claimed, unavailable, distances);
    if (destination) {
      queue.push({ kind: ActionKind.Move, card, destination });
      claimSteps(claimed, slot, tilesAfterSteps(position, destination));
      position = moveEnd(position, destination);
    } else if (targets.length > 0) {
      queue.push({ kind: ActionKind.Block, card });
      claimSteps(claimed, slot, [position, position]);
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
  const claimed: ClaimedTiles = new Map();
  const blocked = blockedTiles(view);
  const distances = distancesToPrimeZone(blocked);
  const heroes = view.heroes
    .filter((hero) => heroIds.includes(hero.id) && !hero.exhausted)
    .map((hero) => planHero(view, hero, claimed, blocked, distances));
  const plan: SquadPlan = { squad: view.squad, heroes };
  const broken = new Set(validatePlan(view, plan).flatMap((issue) => (issue.heroId ? [issue.heroId] : [])));
  return broken.size === 0 ? plan : { squad: view.squad, heroes: heroes.filter((hero) => !broken.has(hero.heroId)) };
}
