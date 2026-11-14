// AI planning (ADR 0017, ADR 0018). A pure, deterministic function from a Squad View to a Squad Plan.
// It only ever sees the Squad View, so it cannot read enemy Hands or unseen Heroes: no cheating.

import { type CardIndex, HeroClass, HERO_DECKS, isSimpleAttack } from "./cards";
import { buildSquadView, type HeroState, matchFromSquadView, type MatchState, seededHash, ZONES } from "./match";
import { resolveRound, cardsNotExiled } from "./resolution";
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
  type Grid,
  type GridPosition,
  hasLineOfSight,
  isStepAllowed,
  tileAt,
  TileKind,
} from "./reactor-deck";

/** Actions the AI queues per Hero and Round; fewer than the Queue limit keeps Decks from draining fast. */
const AI_QUEUE_LENGTH = 3;

/**
 * What the AI navigates on, read from the Squad View only: the map and the objective (the tiles that score). No tile,
 * zone or map is named in the code; a different map or winning condition only changes these inputs.
 */
interface Navigation {
  grid: Grid;
  /** Walking distance in steps from every tile to the nearest free objective tile (see `distancesToObjective`). */
  distances: ReadonlyMap<number, number>;
  key: (tile: GridPosition) => number;
  isObjective: (tile: GridPosition) => boolean;
  /** Tries equally good destinations in the other order: a different tie-break gives a different candidate plan. */
  reverseTies: boolean;
}

/**
 * The tiles the AI heads for. Classic: the tiles of the zones with the highest value (the most points per Resolution).
 * A zone that is not unlocked yet counts for the value it will have: the AI walks toward it and arrives when it scores.
 * Who controls a zone is not read here: a held zone stays the goal so the Squad keeps it. Attack and Defend: the Zone
 * to take or hold.
 */
function objectiveTiles(view: SquadView): GridPosition[] {
  if (view.attackAndDefend) return [...view.attackAndDefend.zone];
  const zones = view.zones ?? [];
  const best = Math.max(0, ...zones.map((zone) => zone.value));
  return zones.filter((zone) => zone.value === best).flatMap((zone) => [...zone.tiles]);
}

/**
 * Walking distance in steps from every tile to the nearest objective tile that is not in `blocked`, going around
 * Walls and the blocked tiles (a Move can neither cross nor end on one). A Squad that only counted the Zone as a place to walk to
 * froze at its edge behind Squad mates standing in it (issue 147).
 */
function distancesToObjective(
  grid: Grid,
  key: (tile: GridPosition) => number,
  objective: readonly GridPosition[],
  blocked: ReadonlySet<number>,
): ReadonlyMap<number, number> {
  const free = objective.filter((tile) => !blocked.has(key(tile)));
  const distances = new Map<number, number>(free.map((tile) => [key(tile), 0]));
  const queue = [...free];
  for (const tile of queue) {
    for (let row = tile.row - 1; row <= tile.row + 1; row++) {
      for (let col = tile.col - 1; col <= tile.col + 1; col++) {
        const next = { col, row };
        if (distances.has(key(next)) || blocked.has(key(next)) || !isStepAllowed(tile, next, grid)) continue;
        distances.set(key(next), distances.get(key(tile))! + 1);
        queue.push(next);
      }
    }
  }
  return distances;
}

/** The navigation of a Squad View, and the tiles no Move should end on: enemies and Squad mates that stand on the objective. */
function buildNavigation(
  view: SquadView,
  objective: readonly GridPosition[] = objectiveTiles(view),
  reverseTies = false,
): { nav: Navigation; blocked: Set<number> } {
  const { grid } = view;
  const key = ({ col, row }: GridPosition) => row * grid.width + col;
  const objectiveKeys = new Set(objective.map(key));
  const isObjective = (tile: GridPosition) => objectiveKeys.has(key(tile));
  const blocked = new Set<number>();
  for (const hero of view.heroes) {
    if (!hero.exhausted && isObjective(hero.position)) blocked.add(key(hero.position));
  }
  for (const enemy of view.enemies) {
    if (enemy.visibility === Visibility.Visible && !enemy.exhausted) blocked.add(key(enemy.position));
  }
  return { nav: { grid, distances: distancesToObjective(grid, key, objective, blocked), key, isObjective, reverseTies }, blocked };
}

/**
 * The Move 2 destinations in the order they are tried. The map is mirrored between the Squads, so the Right Squad
 * tries them in the mirrored order (rows from the top, columns from the right): with the same order for both, the tie
 * between equally good destinations always went to the one with the lowest column, which is a longer advance for the
 * Right Squad and made it win nearly every match (issue 87).
 */
const destinationsInOrder = (from: GridPosition, squad: SquadId, { grid, reverseTies }: Navigation): GridPosition[] =>
  (squad === SquadId.Left) !== reverseTies
    ? moveDestinations(from, grid)
    : moveDestinations(from, grid).sort((a, b) => a.row - b.row || b.col - a.col);

/**
 * Tiles that Heroes planned earlier stand on after each step of a queue slot (key: `claimKey`). Only the tile
 * where a Move ends is checked: two Heroes ending on one tile both stop one step early (ADR 0013).
 */
type ClaimedTiles = Map<number, Set<number>>;
/** The enemy ids Squad mates planned an Attack on, by queue slot. */
type PlannedAttacks = Map<number, Set<string>>;

const claimKey = (slot: number, step: number) => slot * MOVE_DISTANCE + step - 1;

/** The tile a Hero stands on after step 1 and step 2 of a Move from `from` to `destination`. */
const tilesAfterSteps = (from: GridPosition, destination: GridPosition, grid: Grid): GridPosition[] => {
  const path = movePath(from, destination, grid);
  return Array.from({ length: MOVE_DISTANCE }, (_, step) => path[step] ?? path.at(-1) ?? from);
};

/** Attack and Defend (ADR 0022): the Squad View says which role the viewing Squad plays. */
enum Role {
  Classic,
  Attacker,
  Defender,
}

/** Steps an Attacker covers in one Round (a full queue of Moves): from this far from the objective all Heroes can enter together. */
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
function attackerIsReady(view: SquadView, nav: Navigation): boolean {
  if ((view.attackAndDefend?.roundsLeft ?? Infinity) <= ATTACKER_PATIENCE_ROUNDS) return true;
  return view.heroes.every((hero) => hero.exhausted || (nav.distances.get(nav.key(hero.position)) ?? Infinity) <= ENTRY_DISTANCE);
}

/**
 * The Move 2 destination that ends closest to the objective by walking distance; undefined if none gets closer.
 * Moving Heroes do not hinder each other, but a Move cannot step onto a blocked tile (a Hero stays there) or a
 * tile another Hero already claimed for the same step of the queue slot.
 */
function stepTowardObjective(
  from: GridPosition,
  squad: SquadId,
  slot: number,
  claimed: ClaimedTiles,
  blocked: ReadonlySet<number>,
  nav: Navigation,
  approach: Approach = {},
): GridPosition | undefined {
  const { key } = nav;
  const distanceTo = (tile: GridPosition) => nav.distances.get(key(tile)) ?? Infinity;
  const inCover = (tile: GridPosition) => coverAt(nav.grid, tile) !== CoverKind.None;
  let best: GridPosition | undefined;
  let bestEnd: GridPosition | undefined;
  let bestDistance = nav.isObjective(from) ? 0 : distanceTo(from);
  for (const destination of destinationsInOrder(from, squad, nav)) {
    const end = moveEnd(from, destination, nav.grid);
    const steps = tilesAfterSteps(from, destination, nav.grid);
    if (blocked.has(key(end)) || steps.some((tile) => blocked.has(key(tile)))) continue;
    // Crossing in the middle of a walk is allowed; only the tile where the Move ends must not be claimed.
    if (claimed.get(claimKey(slot, MOVE_DISTANCE))?.has(key(steps.at(-1)!))) continue;
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
  /** Per step closer to the objective (the zone that scores most). */
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
  /**
   * The lookahead's value of a simulated Round (`evaluateRound`), own minus enemy: per Credit (or Prime Zone
   * progress), per point of zone value controlled, per card not in the Exile, per Hero in Cover; minus per enemy that
   * can hit a Hero; plus for winning the match.
   */
  evalPoints: 10,
  evalZones: 4,
  evalCards: 1.5,
  evalCover: 1,
  evalDanger: 2,
  evalWin: 1000,
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

/** What a Hero does for its Squad. A role only shifts weights; it never fixes a path, the goal stays the objective. */
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

const canShoot = (grid: Grid, from: GridPosition, to: GridPosition, range: number) =>
  chebyshevDistance(from, to) <= range && hasLineOfSight(grid, from, to);

/** How much the tile's Cover is worth against the enemies that can hit it (0 to 1). */
const coverShare = (grid: Grid, tile: GridPosition, threats: readonly { position: GridPosition }[]) => {
  if (threats.length === 0 || threats.every((enemy) => chebyshevDistance(tile, enemy.position) <= 1)) return 0;
  const cover = coverAt(grid, tile);
  return cover === CoverKind.Full ? 1 : cover === CoverKind.Half ? 0.5 : 0;
};

/**
 * Scores a tile a Hero could end a Move on. `mates` are the
 * tiles Squad mates planned to end this slot on, `weapon` the Range of the Hero's attacks, `ghosts` the remembered enemies.
 */
function scoreTile(
  nav: Navigation,
  tile: GridPosition,
  distance: number,
  targets: readonly VisibleEnemyView[],
  mates: readonly GridPosition[],
  weapon: number,
  ghosts: readonly GhostThreat[],
  W: AiWeights = AI_WEIGHTS,
): number {
  const { grid } = nav;
  const hitters = targets.filter((enemy) => canShoot(grid, enemy.position, tile, WEAPON_RANGE[enemy.heroClass] ?? 0));
  const cover = coverShare(grid, tile, hitters);
  // Holding the objective is the goal: its tiles are never scored down for danger or crowding (the Heroes there fight anyway).
  const goal = nav.isObjective(tile);
  const danger = goal ? 0 : hitters.length * (1 - cover);
  const ghostRisk = goal
    ? 0
    : ghosts
        .filter((ghost) => canShoot(grid, ghost.position, tile, WEAPON_RANGE[ghost.heroClass] ?? 0))
        .reduce((sum, ghost) => sum + ghost.freshness * (1 - coverShare(grid, tile, [ghost])), 0);
  const shootable = targets.filter((enemy) => canShoot(grid, tile, enemy.position, weapon));
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
 * as for `stepTowardObjective`: no blocked tile, no tile another Hero already claimed for this step.
 */
function chooseDestination(
  from: GridPosition,
  squad: SquadId,
  slot: number,
  claimed: ClaimedTiles,
  blocked: ReadonlySet<number>,
  nav: Navigation,
  targets: readonly VisibleEnemyView[],
  mates: readonly GridPosition[],
  weapon: number,
  ghosts: readonly GhostThreat[],
  weights: AiWeights,
): GridPosition | undefined {
  const { key } = nav;
  const distanceTo = (tile: GridPosition) => (nav.isObjective(tile) ? 0 : nav.distances.get(key(tile)) ?? Infinity);
  let best: GridPosition | undefined;
  let bestScore = scoreTile(nav, from, distanceTo(from), targets, mates, weapon, ghosts, weights);
  for (const destination of destinationsInOrder(from, squad, nav)) {
    const end = moveEnd(from, destination, nav.grid);
    const steps = tilesAfterSteps(from, destination, nav.grid);
    if (blocked.has(key(end)) || steps.some((tile) => blocked.has(key(tile)))) continue;
    if (claimed.get(claimKey(slot, MOVE_DISTANCE))?.has(key(steps.at(-1)!))) continue;
    const distance = distanceTo(end);
    if (!Number.isFinite(distance)) continue;
    const score = scoreTile(nav, end, distance, targets, mates, weapon, ghosts, weights);
    if (score > bestScore) {
      best = destination;
      bestScore = score;
    }
  }
  return best;
}

/** The tiles Heroes planned earlier end the given queue slot on. */
const matesEndingSlot = (claimed: ClaimedTiles, slot: number, width: number): GridPosition[] =>
  [...(claimed.get(claimKey(slot, MOVE_DISTANCE)) ?? [])].map((tile) => ({ col: tile % width, row: Math.floor(tile / width) }));

function claimSteps(claimed: ClaimedTiles, slot: number, tiles: readonly GridPosition[], nav: Navigation): void {
  tiles.forEach((tile, step) => {
    const claim = claimKey(slot, step + 1);
    claimed.set(claim, (claimed.get(claim) ?? new Set<number>()).add(nav.key(tile)));
  });
}

function planHero(
  view: SquadView,
  hero: HeroView,
  claimed: ClaimedTiles,
  blocked: ReadonlySet<number>,
  nav: Navigation,
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
    for (const row of nav.grid.tiles.keys()) {
      for (let col = 0; col < nav.grid.width; col++) {
        if (targets.some((enemy) => chebyshevDistance(enemy.position, { col, row }) <= MOVE_DISTANCE)) unavailable.add(nav.key({ col, row }));
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
        claimSteps(claimed, slot, [position, position], nav);
        queue.push({ kind: ActionKind.Block, card });
        continue;
      }
      plannedAttacks.set(slot, (plannedAttacks.get(slot) ?? new Set<string>()).add(target.id));
      attackCards.splice(attackCards.indexOf(attackCard), 1);
      claimSteps(claimed, queue.length, [position, position], nav);
      queue.push({ kind: ActionKind.Primary, card: attackCard, target: target.id });
      energyNeeded += cost;
      continue;
    }
    const card = spare()[0];
    if (card === undefined || cardsLeft - 1 < 0) break;
    const slot = queue.length;
    const destination =
      role === Role.Classic
        ? chooseDestination(position, view.squad, slot, claimed, unavailable, nav, targets, matesEndingSlot(claimed, slot, nav.grid.width), weapon, ghosts, weights)
        : stepTowardObjective(position, view.squad, slot, claimed, unavailable, nav, approach);
    if (destination) {
      queue.push({ kind: ActionKind.Move, card, destination });
      claimSteps(claimed, slot, tilesAfterSteps(position, destination, nav.grid), nav);
      position = moveEnd(position, destination, nav.grid);
    } else if (
      // The classic mode has no Block action: Shield comes from Shield cards only, so the Hero just waits.
      role !== Role.Classic &&
      (role === Role.Defender
        ? enemyClose() && !queue.some((action) => action.kind === ActionKind.Block)
        : targets.length > 0)
    ) {
      queue.push({ kind: ActionKind.Block, card });
      claimSteps(claimed, slot, [position, position], nav);
    } else {
      break;
    }
    const pool = otherCards.includes(card) ? otherCards : attackCards;
    pool.splice(pool.indexOf(card), 1);
  }

  const pitched = spare().slice(0, energyNeeded);
  return { heroId: hero.id, queue, pitched };
}

/** One way to make a greedy plan: the candidates and the enemy replies differ in these. */
interface PlanVariant {
  style: AiStyle;
  reverseTies: boolean;
  /** The zone (index into `view.zones`) each planned Hero heads for; absent: all Heroes head for the best zones. */
  zones?: readonly number[];
}

/**
 * The greedy plan of the given Heroes of the viewing Squad: move toward the objective the view names, attack Visible
 * enemies in Range, Block while holding it or facing enemies. Any Hero whose plan fails `validatePlan` plans nothing,
 * so the result is always committable.
 */
export function planSquadGreedy(
  view: SquadView,
  heroIds: readonly string[] = view.heroes.map((hero) => hero.id),
  style: AiStyle = AiStyle.Balanced,
  variant: Partial<Omit<PlanVariant, "style">> = {},
): SquadPlan {
  const claimed: ClaimedTiles = new Map();
  const reverseTies = variant.reverseTies ?? false;
  const base = buildNavigation(view, undefined, reverseTies);
  const role = roleOf(view);
  const attackerReady = role === Role.Attacker && attackerIsReady(view, base.nav);
  const roles = assignRoles(view, heroIds);
  const plannedAttacks: PlannedAttacks = new Map();
  const heroes = view.heroes
    .filter((hero) => heroIds.includes(hero.id) && !hero.exhausted)
    .map((hero, i) => {
      const zone = variant.zones === undefined ? undefined : view.zones?.[variant.zones[i]!];
      const { nav, blocked } = zone ? buildNavigation(view, zone.tiles, reverseTies) : base;
      const weights = weightsFor(style, roles.get(hero.id) ?? SquadRole.None);
      return planHero(view, hero, claimed, blocked, nav, role, attackerReady, weights, plannedAttacks);
    });
  const plan: SquadPlan = { squad: view.squad, heroes };
  const broken = new Set(validatePlan(view, plan).flatMap((issue) => (issue.heroId ? [issue.heroId] : [])));
  return broken.size === 0 ? plan : { squad: view.squad, heroes: heroes.filter((hero) => !broken.has(hero.heroId)) };
}

/** Simulations of the Resolution the AI may run to plan one Round: candidates times enemy replies. A count, not a time, so every device plans the same. */
export const SIMULATIONS_PER_ROUND = 40;
/** The enemy replies: the same AI from the enemy's side with each Style, and once with the other tie-break. */
const REPLY_VARIANTS: readonly PlanVariant[] = [
  ...AI_STYLES.map((style) => ({ style, reverseTies: false })),
  { style: AiStyle.Balanced, reverseTies: true },
];
const MIN_CANDIDATES = 8;
const MAX_CANDIDATES = 24;
/** Candidates within this much of the best value count as equally good; the match seed picks among them. */
const EQUAL_VALUE_MARGIN = 1;
/**
 * Worlds the AI imagines for the enemies it cannot see (Fog of War): world 0 is the view as it is (a Ghost where it was
 * seen, an Unknown enemy left out), the others put each hidden enemy on a tile it could have reached. A candidate meets
 * every reply in one world each (replies and worlds are paired, not crossed), so the number of simulations stays
 * `SIMULATIONS_PER_ROUND` however many enemies are hidden.
 */
export const WORLDS = 3;
/** Tiles a Hero can cover in a Round (game-goals: about 6 to 8); the reach of a hidden enemy grows by this per Round. */
const REACH_PER_ROUND = 6;

const tileKeyOf = ({ col, row }: GridPosition) => `${col},${row}`;
const textHash = (text: string) => [...text].reduce((sum, char) => (Math.imul(sum, 31) + char.charCodeAt(0)) | 0, 7);

/**
 * The imagined worlds for one planning call: the position of each hidden enemy (Ghost or Unknown) by Hero id, one map per
 * world, world 0 empty. Only the Squad View and the seed are read, so the hidden state of the match cannot leak. A hidden
 * enemy stands on a tile the Squad does not see, is no Wall and no Hero of the Squad, and is within reach of where it
 * was last seen (a Ghost) or of a Drop Point (never seen: the further the match, the more of the map it could have reached).
 */
export function sampleWorlds(view: SquadView, seed: number, worldCount = WORLDS): ReadonlyMap<string, GridPosition>[] {
  const hidden = view.enemies.filter((enemy) => enemy.visibility !== Visibility.Visible);
  const worlds: Map<string, GridPosition>[] = [new Map()];
  if (hidden.length === 0) return worlds;
  const seen = new Set(view.visibleTiles.map(tileKeyOf));
  const ownTiles = new Set(view.heroes.map((hero) => tileKeyOf(hero.position)));
  const open: GridPosition[] = [];
  view.grid.tiles.forEach((line, row) =>
    line.forEach((_, col) => {
      const tile = { col, row };
      if (tileAt(view.grid, tile) !== TileKind.Wall && !seen.has(tileKeyOf(tile)) && !ownTiles.has(tileKeyOf(tile))) open.push(tile);
    }),
  );
  const dropPoints = findTiles(view.grid, TileKind.DropPoint).filter((tile) => !seen.has(tileKeyOf(tile)) && !ownTiles.has(tileKeyOf(tile)));
  const salt = view.round * 2 + (view.squad === SquadId.Left ? 0 : 1);
  for (let world = 1; world < worldCount; world++) {
    const placed = new Map<string, GridPosition>();
    const taken = new Set<string>();
    for (const enemy of hidden) {
      const ghost = enemy.visibility === Visibility.Ghost ? enemy : undefined;
      const origins = ghost ? [ghost.position] : dropPoints;
      const radius = ghost ? Math.max(1, view.round - ghost.lastSeenRound) * REACH_PER_ROUND : (view.round - 1) * REACH_PER_ROUND;
      const reachable = open.filter((tile) => !taken.has(tileKeyOf(tile)) && origins.some((origin) => chebyshevDistance(origin, tile) <= radius));
      if (reachable.length === 0) continue;
      const pick = reachable[seededHash(seed, salt * 104729 + world * 8387 + textHash(enemy.id)) % reachable.length]!;
      placed.set(enemy.id, pick);
      taken.add(tileKeyOf(pick));
    }
    worlds.push(placed);
  }
  return worlds;
}

/** Weight of the worst reply in a candidate's value; the rest goes to the mean. */
const WORST_CASE_SHARE = 0.5;

/** What the plan does, ignoring which cards pay for it: two candidates must differ in this. */
const planSignature = (plan: SquadPlan): string =>
  JSON.stringify(
    plan.heroes.map(({ heroId, queue }) => [
      heroId,
      queue.map((action) => [action.kind, "destination" in action ? action.destination : null, "target" in action ? action.target : null]),
    ]),
  );

/**
 * Candidate variants in a seeded order: the plain Style of the Squad first, then every other combination of Style,
 * tie-break and (when the view lists several zones) which zone each Hero heads for. All Heroes in one zone is a 3-0,
 * two and one a 2-1, each in its own a 1-1-1.
 */
function candidateVariants(view: SquadView, planned: number, preferred: AiStyle, seed: number): PlanVariant[] {
  const zoneCount = view.zones?.length ?? 0;
  const allocations: (readonly number[] | undefined)[] = [undefined];
  if (zoneCount > 1) {
    let tuples: number[][] = [[]];
    for (let hero = 0; hero < planned; hero++) tuples = tuples.flatMap((tuple) => Array.from({ length: zoneCount }, (_, zone) => [...tuple, zone]));
    allocations.push(...tuples);
  }
  const first: PlanVariant = { style: preferred, reverseTies: false };
  const others = AI_STYLES.flatMap((style) => [false, true].flatMap((reverseTies) => allocations.map((zones) => ({ style, reverseTies, zones }))))
    .filter((variant) => variant.zones !== undefined || variant.reverseTies || variant.style !== preferred);
  const salt = view.round * 2 + (view.squad === SquadId.Left ? 0 : 1);
  return [first, ...others.map((variant, i) => ({ variant, order: seededHash(seed, salt * 4093 + i) })).sort((a, b) => a.order - b.order).map(({ variant }) => variant)];
}

/** Whether a Hero of `heroes` ends in Cover, for the evaluation. */
const inCover = (match: MatchState, hero: HeroState) => coverAt(match.grid, hero.position) !== CoverKind.None;

/**
 * How good the Match State after a simulated Round is for a Squad, own minus enemy: Credits (or the progress on
 * the Prime Zone), zone control, cards not in the Exile (Deck-as-Life), Heroes in Cover, and danger (enemies that can
 * still hit a Hero, less what Cover takes). It names no tile or zone; the weights are in `AI_WEIGHTS`.
 */
export function evaluateRound(match: MatchState, squad: SquadId, W: AiWeights = AI_WEIGHTS): number {
  const enemySquad = squad === SquadId.Left ? SquadId.Right : SquadId.Left;
  const sign = (who: SquadId | undefined) => (who === squad ? 1 : who === enemySquad ? -1 : 0);
  const points = match.scores[squad] - match.scores[enemySquad] + sign(match.primeZone.controller) * match.primeZone.progress;
  const zones = ZONES.reduce((sum, zone, i) => sum + sign(match.zoneControl[i]?.controller) * zone.value, 0);
  const cards = cardsNotExiled(match, squad) - cardsNotExiled(match, enemySquad);
  const own = match.heroes.filter((hero) => hero.squad === squad && !hero.exhausted);
  const enemies = match.heroes.filter((hero) => hero.squad === enemySquad && !hero.exhausted);
  const covered = own.filter((hero) => inCover(match, hero)).length - enemies.filter((hero) => inCover(match, hero)).length;
  const danger = own.reduce((sum, hero) => {
    const hitters = enemies.filter((enemy) => canShoot(match.grid, enemy.position, hero.position, WEAPON_RANGE[enemy.heroClass] ?? 0));
    return sum + hitters.length * (1 - coverShare(match.grid, hero.position, hitters));
  }, 0);
  const outcome = match.result ? sign(match.result.winner) : 0;
  return W.evalWin * outcome + W.evalPoints * points + W.evalZones * zones + W.evalCards * cards + W.evalCover * covered - W.evalDanger * danger;
}

/**
 * Plans the given Heroes of the viewing Squad by looking one Round ahead: several greedy candidate plans are played
 * through the real Resolution against several likely enemy plans, and the plan with the best worst-case-weighted value
 * wins. `seed` (the match seed) picks among plans that are about equally good. Allies of the player use it unchanged.
 */
export function planSquad(
  view: SquadView,
  heroIds: readonly string[] = view.heroes.map((hero) => hero.id),
  style: AiStyle = AiStyle.Balanced,
  seed = 0,
): SquadPlan {
  const planned = view.heroes.filter((hero) => heroIds.includes(hero.id) && !hero.exhausted).length;
  const greedy = planSquadGreedy(view, heroIds, style);
  if (planned === 0 || view.result) return greedy;

  const worlds = sampleWorlds(view, seed).map((imagined) => matchFromSquadView(view, seed, imagined));
  const enemySquad = view.squad === SquadId.Left ? SquadId.Right : SquadId.Left;
  // Each enemy reply is the AI from the enemy's side in one of the worlds, in turn; a candidate meets each reply there.
  const replies = [
    ...new Map(
      REPLY_VARIANTS.map((variant, i) => {
        const world = worlds[i % worlds.length]!;
        const plan = planSquadGreedy(buildSquadView(world, enemySquad), undefined, variant.style, variant);
        return [planSignature(plan), { plan, world }] as const;
      }),
    ).values(),
  ];
  // Own Heroes the caller does not plan (the player's) are assumed to play the plain greedy plan.
  const unplanned = planSquadGreedy(view, view.heroes.filter((hero) => !heroIds.includes(hero.id)).map((hero) => hero.id), style);

  const candidateLimit = Math.min(MAX_CANDIDATES, Math.max(MIN_CANDIDATES, Math.floor(SIMULATIONS_PER_ROUND / replies.length)));
  const candidates = new Map<string, SquadPlan>();
  const variants = candidateVariants(view, planned, style, seed);
  for (const variant of variants.slice(0, candidateLimit * 2)) {
    if (candidates.size >= candidateLimit) break;
    const plan = variant === variants[0] ? greedy : planSquadGreedy(view, heroIds, variant.style, variant);
    candidates.set(planSignature(plan), plan);
  }

  const budgetCandidates = Math.max(1, Math.floor(SIMULATIONS_PER_ROUND / replies.length));
  const valued = [...candidates.values()].slice(0, budgetCandidates).map((plan) => {
    const full: SquadPlan = { squad: view.squad, heroes: [...plan.heroes, ...unplanned.heroes] };
    const values = replies.map(({ plan: reply, world }) => evaluateRound(resolveRound(world, [full, reply]).match, view.squad));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { plan, value: WORST_CASE_SHARE * Math.min(...values) + (1 - WORST_CASE_SHARE) * mean };
  });
  const best = Math.max(...valued.map(({ value }) => value));
  const close = valued.filter(({ value }) => value >= best - EQUAL_VALUE_MARGIN);
  const salt = view.round * 2 + (view.squad === SquadId.Left ? 0 : 1);
  return close[seededHash(seed, salt * 8191 + 1) % close.length]!.plan;
}
