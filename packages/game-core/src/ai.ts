// AI planning (ADR 0017, ADR 0018). A pure, deterministic function from a Squad View to a Squad Plan.
// It only ever sees the Squad View, so it cannot read enemy Hands or unseen Heroes: no cheating.

import { type CardIndex, HeroClass, HERO_DECKS, isSimpleAttack } from "./cards";
import { type GhostEnemyView, type HeroView, SquadId, type SquadView, Visibility, type VisibleEnemyView } from "./host";
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
import {
  CoverKind,
  coverAt,
  findTiles,
  type GridPosition,
  hasLineOfSight,
  isStepAllowed,
  REACTOR_DECK,
  TileKind,
} from "./reactor-deck";

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
 * Tiles that Heroes planned earlier stand on after each step of a queue slot (key: `claimKey`). Only the tile
 * where a Move ends is checked: two Heroes ending on one tile both stop one step early (ADR 0013).
 */
type ClaimedTiles = Map<number, Set<number>>;
/** The enemy ids Squad mates planned an Attack on, by queue slot. */
type PlannedAttacks = Map<number, Set<string>>;

const claimKey = (slot: number, step: number) => slot * MOVE_DISTANCE + step - 1;

/** The tile a Hero stands on after step 1 and step 2 of a Move from `from` to `destination`. */
const tilesAfterSteps = (from: GridPosition, destination: GridPosition): GridPosition[] => {
  const path = movePath(from, destination);
  return Array.from({ length: MOVE_DISTANCE }, (_, step) => path[step] ?? path.at(-1) ?? from);
};

/** Attack and Defend (ADR 0022): the Squad View says which role the viewing Squad plays. */
enum Role {
  Classic,
  Attacker,
  Defender,
}

/** Steps an Attacker covers in one Round (a full queue of Moves): from this far from the Zone all Heroes can enter together. */
const ENTRY_DISTANCE = AI_QUEUE_LENGTH * MOVE_DISTANCE;
/** While the Attacker waits for its Squad mates it stays at least this far from the Zone. */
const STAGING_DISTANCE = ENTRY_DISTANCE - 1;
/** With this many Rounds left the Attacker stops waiting for stragglers. */
const ATTACKER_PATIENCE_ROUNDS = 8;
/** The Defender queues at most this many actions per Hero: its Deck has to last until the Round limit. */
const DEFENDER_QUEUE_LENGTH = 2;
/** The Defender Blocks only when an enemy it can see is this close. */
const DEFENDER_ALERT_DISTANCE = 8;

interface Approach {
  /** Prefer a Cover tile among equally close destinations. */
  preferCover?: boolean;
  /** Skip destinations closer to the Zone than this (walking distance). */
  stayAtLeast?: number;
}

const roleOf = (view: SquadView): Role =>
  view.attackAndDefend === undefined ? Role.Classic : view.attackAndDefend.defender === view.squad ? Role.Defender : Role.Attacker;

/** The Attacker enters the Zone with all living Heroes in the same Round, so it wins the tie (ADR 0022). */
function attackerIsReady(view: SquadView, distances: ReadonlyMap<number, number>): boolean {
  if ((view.attackAndDefend?.roundsLeft ?? Infinity) <= ATTACKER_PATIENCE_ROUNDS) return true;
  return view.heroes.every((hero) => hero.exhausted || (distances.get(tileKey(hero.position)) ?? Infinity) <= ENTRY_DISTANCE);
}

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
  approach: Approach = {},
): GridPosition | undefined {
  const distanceTo = (tile: GridPosition) => distances.get(tileKey(tile)) ?? Infinity;
  const inCover = (tile: GridPosition) => coverAt(REACTOR_DECK, tile) !== CoverKind.None;
  let best: GridPosition | undefined;
  let bestEnd: GridPosition | undefined;
  let bestDistance = isPrimeZoneTile(from) ? 0 : distanceTo(from);
  for (const destination of destinationsInOrder(from, squad)) {
    const end = moveEnd(from, destination);
    const steps = tilesAfterSteps(from, destination);
    if (blocked.has(tileKey(end)) || steps.some((tile) => blocked.has(tileKey(tile)))) continue;
    // Crossing in the middle of a walk is allowed; only the tile where the Move ends must not be claimed.
    if (claimed.get(claimKey(slot, MOVE_DISTANCE))?.has(tileKey(steps.at(-1)!))) continue;
    const distance = distanceTo(end);
    if (distance < (approach.stayAtLeast ?? 0)) continue;
    const coverTie = approach.preferCover && best !== undefined && distance === bestDistance && inCover(end) && !inCover(bestEnd!);
    if (distance < bestDistance || coverTie) {
      best = destination;
      bestEnd = end;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The weights of the Classic mode scoring: the single default AI Style. Each consideration is a count or a share (0 to 1)
 * times its weight. Progress dominates on purpose: one step closer to the Zone beats everything else except a real
 * flank or a Full Cover, so Squads cannot stand off for ever.
 */
export const AI_WEIGHTS = {
  /** Per step closer to the Prime Zone. */
  progress: 10,
  /** Ending in Cover while a Visible enemy is near: Full Cover 1, Half Cover 0.5. */
  cover: 8,
  /** Per Visible enemy that could hit the tile this Round, before Cover. */
  danger: 6,
  /** A tile beside a Visible enemy (not straight in front) that few enemies can hit. */
  flank: 7,
  /** Per Squad mate ending within one tile, and per Squad mate ending in the same row. */
  spreadClose: 5,
  spreadLine: 2,
  /** Keeping a Visible enemy in Range from the end tile (the Hero can shoot it). */
  keepShot: 3,
  /** Per remembered (Ghost) enemy that could hit the tile from where it was last seen, before Cover and age. */
  ghostDanger: 4,
  /** Aiming at an enemy a Squad mate attacks in the same Tick or the Tick before or after (Crossfire needs consecutive Ticks). */
  focus: 5,
};

export type AiWeights = typeof AI_WEIGHTS;

/** AI Styles (GLOSSARY): a named set of multipliers on `AI_WEIGHTS`. Progress is never scaled, so every style heads for the Zone. */
export enum AiStyle {
  Balanced = "balanced",
  Aggressive = "aggressive",
  Defensive = "defensive",
  Flanker = "flanker",
}

type WeightScale = Partial<Record<keyof AiWeights, number>>;

const STYLE_SCALES: Record<AiStyle, WeightScale> = {
  [AiStyle.Balanced]: {},
  [AiStyle.Aggressive]: { danger: 0.2, ghostDanger: 0.2, cover: 0.3, keepShot: 2.5 },
  [AiStyle.Defensive]: { danger: 1.5, ghostDanger: 1.5, cover: 1.6, flank: 0.5 },
  [AiStyle.Flanker]: { flank: 1.4, spreadLine: 4, spreadClose: 3, keepShot: 0.5 },
};

const AI_STYLES = Object.values(AiStyle);

/** The AI Style of a Squad: a pure function of the match seed and the Squad, so the same seed always gives the same Styles. */
export function aiStyleFor(seed: number, squad: SquadId): AiStyle {
  let h = Math.imul((seed >>> 0) ^ (squad === SquadId.Left ? 0x9e3779b9 : 0x85ebca6b), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return AI_STYLES[(h >>> 0) % AI_STYLES.length]!;
}

/** What a Hero does for its Squad. A role only shifts weights; it never fixes a path, the goal stays the Prime Zone. */
export enum SquadRole {
  /** Goes at the Zone head-on: danger counts less. */
  Breaker = "breaker",
  /** Takes the flank. */
  Flanker = "flanker",
  /** Takes Cover beside the Zone. */
  Anchor = "anchor",
  /** No role (a lone Hero). */
  None = "none",
}

const ROLE_SCALES: Record<SquadRole, WeightScale> = {
  [SquadRole.Breaker]: { danger: 0.3, ghostDanger: 0.3, cover: 0.3, flank: 0.5, spreadClose: 0.5 },
  [SquadRole.Flanker]: { spreadLine: 2, cover: 0.5 },
  [SquadRole.Anchor]: { cover: 2, danger: 1.5, flank: 0.3 },
  [SquadRole.None]: {},
};

const CLASS_ROLE: Record<HeroClass, SquadRole> = {
  [HeroClass.Bruiser]: SquadRole.Breaker,
  [HeroClass.Assassin]: SquadRole.Flanker,
  [HeroClass.Controller]: SquadRole.Anchor,
};

/** The Squad coordinator: a role for each Hero to plan from its class and the situation (a Hero alone has no one to coordinate with). */
export function assignRoles(view: SquadView, heroIds: readonly string[]): Map<string, SquadRole> {
  const living = view.heroes.filter((hero) => !hero.exhausted);
  return new Map(
    living
      .filter((hero) => heroIds.includes(hero.id))
      .map((hero) => [hero.id, living.length < 2 ? SquadRole.None : (CLASS_ROLE[hero.heroClass] ?? SquadRole.None)]),
  );
}

/** The weights a Hero scores with: the base weights scaled by the Squad's Style, then by the Hero's role. */
export function weightsFor(style: AiStyle, role: SquadRole): AiWeights {
  const scaled = { ...AI_WEIGHTS };
  for (const scale of [STYLE_SCALES[style], ROLE_SCALES[role]]) {
    for (const key of Object.keys(scale) as (keyof AiWeights)[]) scaled[key] *= scale[key]!;
  }
  return scaled;
}

/** A Ghost counts as a threat for this many Rounds after it was last seen; it counts less the older it is. */
export const GHOST_MEMORY_ROUNDS = 4;

/** A remembered enemy and how much of its threat is left (1 when just seen, 0 after `GHOST_MEMORY_ROUNDS`). */
export interface GhostThreat {
  position: GridPosition;
  heroClass: HeroClass;
  freshness: number;
}

/** The Ghosts of the Squad View as threats. The view carries the Round a Ghost was last seen, which gives its age. */
const ghostThreats = (view: SquadView): GhostThreat[] =>
  view.enemies
    .filter((enemy): enemy is GhostEnemyView => enemy.visibility === Visibility.Ghost)
    .map((ghost) => ({
      position: ghost.position,
      heroClass: ghost.heroClass,
      freshness: Math.max(0, 1 - (view.round - ghost.lastSeenRound) / GHOST_MEMORY_ROUNDS),
    }))
    .filter((ghost) => ghost.freshness > 0);

/** Longest weapon Range of an enemy Hero class. */
const WEAPON_RANGE = Object.fromEntries(
  Object.entries(HERO_DECKS).map(([heroClass, deck]) => [
    heroClass,
    Math.max(...deck.filter(isSimpleAttack).map((card) => card.range ?? 0)),
  ]),
);

const canShoot = (from: GridPosition, to: GridPosition, range: number) =>
  chebyshevDistance(from, to) <= range && hasLineOfSight(REACTOR_DECK, from, to);

/** How much the tile's Cover is worth against the enemies that can hit it (0 to 1). */
const coverShare = (tile: GridPosition, threats: readonly { position: GridPosition }[]) => {
  if (threats.length === 0 || threats.every((enemy) => chebyshevDistance(tile, enemy.position) <= 1)) return 0;
  const cover = coverAt(REACTOR_DECK, tile);
  return cover === CoverKind.Full ? 1 : cover === CoverKind.Half ? 0.5 : 0;
};

/**
 * Scores a tile a Hero could end a Move on (exported so tests can compare tiles of equal distance). `mates` are the
 * tiles Squad mates planned to end this slot on, `weapon` the Range of the Hero's attacks, `ghosts` the remembered enemies.
 */
export function scoreTile(
  tile: GridPosition,
  distance: number,
  targets: readonly VisibleEnemyView[],
  mates: readonly GridPosition[],
  weapon: number,
  ghosts: readonly GhostThreat[],
  W: AiWeights = AI_WEIGHTS,
): number {
  const hitters = targets.filter((enemy) => canShoot(enemy.position, tile, WEAPON_RANGE[enemy.heroClass] ?? 0));
  const cover = coverShare(tile, hitters);
  // Holding the Zone is the goal: its tiles are never scored down for danger or crowding (the Heroes there fight anyway).
  const goal = isPrimeZoneTile(tile);
  const danger = goal ? 0 : hitters.length * (1 - cover);
  const ghostRisk = goal
    ? 0
    : ghosts
        .filter((ghost) => canShoot(ghost.position, tile, WEAPON_RANGE[ghost.heroClass] ?? 0))
        .reduce((sum, ghost) => sum + ghost.freshness * (1 - coverShare(tile, [ghost])), 0);
  const shootable = targets.filter((enemy) => canShoot(tile, enemy.position, weapon));
  const flanks = shootable.some((enemy) => Math.abs(enemy.position.row - tile.row) >= 2) && hitters.length <= 1;
  const close = goal ? 0 : mates.filter((mate) => chebyshevDistance(mate, tile) <= 1).length;
  const inLine = goal ? 0 : mates.filter((mate) => mate.row === tile.row).length;
  return (
    -W.progress * distance +
    W.cover * cover -
    W.danger * danger -
    W.ghostDanger * ghostRisk +
    (flanks ? W.flank : 0) +
    (shootable.length > 0 ? W.keepShot : 0) -
    W.spreadClose * close -
    W.spreadLine * inLine
  );
}

/**
 * The Move 2 destination with the best score, or undefined when staying put scores best. Legal destinations are the same
 * as for `stepTowardPrimeZone`: no blocked tile, no tile another Hero already claimed for this step.
 */
function chooseDestination(
  from: GridPosition,
  squad: SquadId,
  slot: number,
  claimed: ClaimedTiles,
  blocked: ReadonlySet<number>,
  distances: ReadonlyMap<number, number>,
  targets: readonly VisibleEnemyView[],
  mates: readonly GridPosition[],
  weapon: number,
  ghosts: readonly GhostThreat[],
  weights: AiWeights,
): GridPosition | undefined {
  const distanceTo = (tile: GridPosition) => (isPrimeZoneTile(tile) ? 0 : distances.get(tileKey(tile)) ?? Infinity);
  let best: GridPosition | undefined;
  let bestScore = scoreTile(from, distanceTo(from), targets, mates, weapon, ghosts, weights);
  for (const destination of destinationsInOrder(from, squad)) {
    const end = moveEnd(from, destination);
    const steps = tilesAfterSteps(from, destination);
    if (blocked.has(tileKey(end)) || steps.some((tile) => blocked.has(tileKey(tile)))) continue;
    if (claimed.get(claimKey(slot, MOVE_DISTANCE))?.has(tileKey(steps.at(-1)!))) continue;
    const distance = distanceTo(end);
    if (!Number.isFinite(distance)) continue;
    const score = scoreTile(end, distance, targets, mates, weapon, ghosts, weights);
    if (score > bestScore) {
      best = destination;
      bestScore = score;
    }
  }
  return best;
}

/** The tiles Heroes planned earlier end the given queue slot on. */
const matesEndingSlot = (claimed: ClaimedTiles, slot: number): GridPosition[] =>
  [...(claimed.get(claimKey(slot, MOVE_DISTANCE)) ?? [])].map((key) => ({ col: key % REACTOR_DECK.width, row: Math.floor(key / REACTOR_DECK.width) }));

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
  role: Role,
  attackerReady: boolean,
  weights: AiWeights,
  plannedAttacks: PlannedAttacks,
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

  const weapon = Math.max(0, ...deck.filter(isSimpleAttack).map((card) => card.range ?? 0));
  const ghosts = ghostThreats(view);
  const queue: QueuedAction[] = [];
  let position = hero.position;
  let energyNeeded = 0;

  const queueLength = role === Role.Defender ? DEFENDER_QUEUE_LENGTH : AI_QUEUE_LENGTH;
  const approach: Approach =
    role === Role.Attacker ? { preferCover: true, stayAtLeast: attackerReady ? 0 : STAGING_DISTANCE } : {};
  const enemyClose = () => targets.some((enemy) => chebyshevDistance(hero.position, enemy.position) <= DEFENDER_ALERT_DISTANCE);

  while (queue.length < Math.min(queueLength, MAX_QUEUE_LENGTH)) {
    // Every queued card and every pitched card must come from the Hand; Attacks need their Energy pitched.
    const cardsLeft = hero.hand.length - queue.length - energyNeeded;
    const attackCard = attackCards.find((card) => {
      const cost = deck[card]!.energyCost;
      return inRangeTargets(position, card).length > 0 && cardsLeft - 1 - cost >= 0;
    });
    if (attackCard !== undefined) {
      const cost = deck[attackCard]!.energyCost;
      const slot = queue.length;
      const matesAim = (id: string, at: number) => plannedAttacks.get(at)?.has(id) ?? false;
      const focusScore = (enemy: VisibleEnemyView) =>
        [slot - 1, slot, slot + 1].some((at) => matesAim(enemy.id, at)) ? weights.focus : 0;
      const target = inRangeTargets(position, attackCard).sort(
        (a, b) => focusScore(b) - focusScore(a) || a.deckCount - b.deckCount,
      )[0]!;
      // A mate hits this target in this very Tick and none in the Tick before or after: shield first, so the hits are consecutive.
      if (
        role !== Role.Classic && matesAim(target.id, slot) && !matesAim(target.id, slot - 1) && !matesAim(target.id, slot + 1) &&
        otherCards.length > 0 && cardsLeft - 2 - cost >= 0 && slot + 1 < Math.min(queueLength, MAX_QUEUE_LENGTH)
      ) {
        const card = otherCards.shift()!;
        claimSteps(claimed, slot, [position, position]);
        queue.push({ kind: ActionKind.Block, card });
        continue;
      }
      plannedAttacks.set(slot, (plannedAttacks.get(slot) ?? new Set<string>()).add(target.id));
      attackCards.splice(attackCards.indexOf(attackCard), 1);
      claimSteps(claimed, queue.length, [position, position]);
      queue.push({ kind: ActionKind.Primary, card: attackCard, target: target.id });
      energyNeeded += cost;
      continue;
    }
    const card = spare()[0];
    if (card === undefined || cardsLeft - 1 < 0) break;
    const slot = queue.length;
    const destination =
      role === Role.Classic
        ? chooseDestination(position, view.squad, slot, claimed, unavailable, distances, targets, matesEndingSlot(claimed, slot), weapon, ghosts, weights)
        : stepTowardPrimeZone(position, view.squad, slot, claimed, unavailable, distances, approach);
    if (destination) {
      queue.push({ kind: ActionKind.Move, card, destination });
      claimSteps(claimed, slot, tilesAfterSteps(position, destination));
      position = moveEnd(position, destination);
    } else if (
      // The classic mode has no Block action: Shield comes from Shield cards only, so the Hero just waits.
      role !== Role.Classic &&
      (role === Role.Defender
        ? enemyClose() && !queue.some((action) => action.kind === ActionKind.Block)
        : targets.length > 0)
    ) {
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
export function planSquad(
  view: SquadView,
  heroIds: readonly string[] = view.heroes.map((hero) => hero.id),
  style: AiStyle = AiStyle.Balanced,
): SquadPlan {
  const claimed: ClaimedTiles = new Map();
  const blocked = blockedTiles(view);
  const distances = distancesToPrimeZone(blocked);
  const role = roleOf(view);
  const attackerReady = role === Role.Attacker && attackerIsReady(view, distances);
  const roles = assignRoles(view, heroIds);
  const plannedAttacks: PlannedAttacks = new Map();
  const heroes = view.heroes
    .filter((hero) => heroIds.includes(hero.id) && !hero.exhausted)
    .map((hero) =>
      planHero(view, hero, claimed, blocked, distances, role, attackerReady, weightsFor(style, roles.get(hero.id) ?? SquadRole.None), plannedAttacks),
    );
  const plan: SquadPlan = { squad: view.squad, heroes };
  const broken = new Set(validatePlan(view, plan).flatMap((issue) => (issue.heroId ? [issue.heroId] : [])));
  return broken.size === 0 ? plan : { squad: view.squad, heroes: heroes.filter((hero) => !broken.has(hero.heroId)) };
}
