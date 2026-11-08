// Squad Plans and planning-time validation (ADR 0013, ADR 0020). Shared with clients: a plan is plain
// data, and `validatePlan` lets the UI explain why a plan cannot be committed. The host validates again.

import { type CardDefinition, type CardIndex, cardInMode, CardTarget, EffectKind, EffectRecipient, HERO_DECKS, type HeroClass, isPlayableCard } from "./cards";
import { type HeroView, type SquadId, type SquadView, Visibility } from "./host";
import { CoverKind, coverAt, type Grid, type GridPosition, isStepAllowed, REACTOR_DECK, stepTowards, TileKind, tileAt } from "./reactor-deck";

/** A Hero's Queue holds at most 4 actions (the maximum Hand size, ADR 0020). */
export const MAX_QUEUE_LENGTH = 4;

/** Tiles a Move 2 covers at most. */
export const MOVE_DISTANCE = 2;

/** Energy one Pitch produces (ADR 0007). */
export const PITCH_ENERGY = 1;

/** Shield a Block creates (ADR 0002). */
export const BLOCK_SHIELD = 2;

export enum ActionKind {
  /** Any card used as Move 2: up to two steps towards the destination. */
  Move = "move",
  /** Any card used as Block 2: Shield 2 in its Tick. */
  Block = "block",
  /** A card's primary effect; it costs the card's Energy. Simple damage Attacks and Shield Utility cards resolve so far. */
  Primary = "primary",
  /** The Hero does nothing for one Tick; it needs no card and no Energy but takes a slot of the Queue. */
  Wait = "wait",
}

export interface MoveAction {
  kind: ActionKind.Move;
  /** The Hand card spent on this action. */
  card: CardIndex;
  destination: GridPosition;
}

export interface BlockAction {
  kind: ActionKind.Block;
  card: CardIndex;
}

export interface PrimaryAction {
  kind: ActionKind.Primary;
  card: CardIndex;
  /**
   * Id of the Hero the card is aimed at: an enemy Hero for an Attack (Range and Line of Sight are checked
   * when it resolves), this Hero or an allied Hero for a Utility card.
   */
  target: string;
  /**
   * For a card aimed at a tile or area (Breach Charge, Scout Drone, Deploy Cover): the tile (the centre of
   * an area); `target` is then the casting Hero.
   * For Forward Deploy: the tile the allied `target` moves towards.
   */
  tile?: GridPosition;
  /** For an Overdrive that affects two allied Heroes (Aegis Protocol): the second one, distinct from `target`. */
  secondTarget?: string;
  /** Play the card's Overdrive instead of its standard effect; the card is then Exiled (ADR 0003). */
  overdrive?: boolean;
}

export interface WaitAction {
  kind: ActionKind.Wait;
}

/** Actions are a union that grows with the card uses. */
export type QueuedAction = MoveAction | BlockAction | PrimaryAction | WaitAction;

export interface HeroPlan {
  heroId: string;
  queue: readonly QueuedAction[];
  /** Hand cards pitched for Energy; Pitch is a planning step, not a queued action (ADR 0020). */
  pitched?: readonly CardIndex[];
}

/** Energy a Hero's pitched cards produce for the Round. */
export function energyPool(pitched: readonly CardIndex[] = []): number {
  return pitched.length * PITCH_ENERGY;
}

/** Energy the Queue spends: only primary effects cost Energy; Move 2 and Block 2 are free. */
export function queueEnergyCost(heroClass: HeroClass, queue: readonly QueuedAction[]): number {
  return queue.reduce(
    (sum, action) => sum + (action.kind === ActionKind.Primary ? HERO_DECKS[heroClass][action.card]!.energyCost : 0),
    0,
  );
}

export interface SquadPlan {
  squad: SquadId;
  /** Heroes without an entry plan nothing. */
  heroes: readonly HeroPlan[];
}

export enum PlanIssueKind {
  WrongSquad = "wrongSquad",
  UnknownHero = "unknownHero",
  CardNotInHand = "cardNotInHand",
  CardUsedTwice = "cardUsedTwice",
  QueueTooLong = "queueTooLong",
  BadDestination = "badDestination",
  NotEnoughEnergy = "notEnoughEnergy",
  /** The card's primary effect cannot be played yet. */
  UnplayableCard = "unplayableCard",
  BadTarget = "badTarget",
  HeroExhausted = "heroExhausted",
  /** Overdrive was requested for a card that has none. */
  NoOverdrive = "noOverdrive",
  /** A Block in the classic mode, which has none: Shield comes from Shield cards. */
  BlockNotAllowed = "blockNotAllowed",
}

export interface PlanIssue {
  kind: PlanIssueKind;
  heroId?: string;
  /** Human-readable reason, shown to the player. */
  message: string;
  /** The Queue slot (0-based) of the action that causes the issue, when it belongs to one. */
  slot?: number;
}

export function chebyshevDistance(a: GridPosition, b: GridPosition): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/** Tiles a Move 2 from `from` may be planned to: 1 or 2 tiles away, inside the Grid, not a Wall. */
export function moveDestinations(from: GridPosition, grid: Grid = REACTOR_DECK, distance = MOVE_DISTANCE): GridPosition[] {
  const found: GridPosition[] = [];
  for (let row = from.row - distance; row <= from.row + distance; row++) {
    for (let col = from.col - distance; col <= from.col + distance; col++) {
      const kind = tileAt(grid, { col, row });
      if (kind !== undefined && kind !== TileKind.Wall && chebyshevDistance(from, { col, row }) > 0) {
        found.push({ col, row });
      }
    }
  }
  return found;
}

/** Where a Move 2 towards `destination` really ends: it stops before a Wall or Wall corner (ADR 0020). */
export function moveEnd(from: GridPosition, destination: GridPosition): GridPosition {
  return movePath(from, destination).at(-1) ?? from;
}

/** The tiles a Move 2 towards `destination` stands on after step 1 and step 2, without other Heroes in the way. */
export function movePath(from: GridPosition, destination: GridPosition): GridPosition[] {
  const path: GridPosition[] = [];
  let position = from;
  for (let step = 0; step < MOVE_DISTANCE; step++) {
    const next = stepTowards(position, destination);
    if (!isStepAllowed(position, next) || (next.col === position.col && next.row === position.row)) break;
    position = next;
    path.push(position);
  }
  return path;
}

/** The Move 2 destinations the Hero reaches completely: `moveDestinations` minus tiles behind a Wall or Wall corner. */
export const reachableMoveDestinations = (from: GridPosition): GridPosition[] =>
  moveDestinations(from).filter((destination) => {
    const end = moveEnd(from, destination);
    return end.col === destination.col && end.row === destination.row;
  });

/** The Queue slot whose cost first takes the running total above the pitched Energy. */
function firstUnaffordableSlot(heroClass: HeroClass, queue: readonly QueuedAction[], pool: number): number | undefined {
  let spent = 0;
  for (const [slot, action] of queue.entries()) {
    spent += queueEnergyCost(heroClass, [action]);
    if (spent > pool) return slot;
  }
  return undefined;
}

/** Block is a rule of the match mode: only Attack and Defend has it (ADR 0022); the classic mode takes Shield from Shield cards. */
export function blockAllowed(view: Pick<SquadView, "attackAndDefend">): boolean {
  return view.attackAndDefend !== undefined;
}

/** Returns every rule the plan breaks against the Squad View; an empty list means it can be committed. */
export function validatePlan(view: SquadView, plan: SquadPlan): PlanIssue[] {
  const issues: PlanIssue[] = [];
  if (plan.squad !== view.squad) {
    issues.push({ kind: PlanIssueKind.WrongSquad, message: "The plan belongs to another Squad." });
  }
  for (const { heroId, queue, pitched = [] } of plan.heroes) {
    const hero = view.heroes.find((candidate) => candidate.id === heroId);
    if (!hero) {
      issues.push({ kind: PlanIssueKind.UnknownHero, heroId, message: `Unknown Hero ${heroId}.` });
      continue;
    }
    if (hero.exhausted && (queue.length > 0 || pitched.length > 0)) {
      issues.push({ kind: PlanIssueKind.HeroExhausted, heroId, message: "An Exhausted Hero cannot act." });
      continue;
    }
    if (queue.length > MAX_QUEUE_LENGTH) {
      issues.push({ kind: PlanIssueKind.QueueTooLong, heroId, message: `A Queue holds at most ${MAX_QUEUE_LENGTH} actions.` });
    }
    const used = new Set<CardIndex>();
    // A card fulfils one role per Round: Pitch and Queue actions share the same set.
    const useCard = (card: CardIndex) => {
      if (!hero.hand.includes(card)) {
        issues.push({ kind: PlanIssueKind.CardNotInHand, heroId, message: "A planned card is not in the Hand." });
      } else if (used.has(card)) {
        issues.push({ kind: PlanIssueKind.CardUsedTwice, heroId, message: "A card can be used only once per Round." });
      }
      used.add(card);
    };
    pitched.forEach(useCard);
    const cost = queueEnergyCost(hero.heroClass, queue);
    if (cost > energyPool(pitched)) {
      issues.push({
        kind: PlanIssueKind.NotEnoughEnergy,
        heroId,
        slot: firstUnaffordableSlot(hero.heroClass, queue, energyPool(pitched)),
        message: `The Queue needs ${cost} Energy but only ${energyPool(pitched)} is pitched.`,
      });
    }
    let position = hero.position;
    // Reposition stretches the next Move of the Queue to the distance on its card.
    let moveDistance = MOVE_DISTANCE;
    for (const [slot, action] of queue.entries()) {
      const report = (issue: PlanIssue) => issues.push({ ...issue, slot });
      if (action.kind === ActionKind.Wait) continue;
      useCard(action.card);
      if (action.kind === ActionKind.Block && !blockAllowed(view)) {
        report({ kind: PlanIssueKind.BlockNotAllowed, heroId, message: "This mode has no Block: Shield comes from Shield cards." });
      }
      if (action.kind === ActionKind.Primary) {
        const extend = cardInMode(HERO_DECKS[hero.heroClass][action.card]!, action.overdrive).effects.find(
          ({ kind }) => kind === EffectKind.ExtendMove,
        );
        if (extend) moveDistance = extend.amount ?? MOVE_DISTANCE;
      }
      if (action.kind === ActionKind.Primary) {
        const base = HERO_DECKS[hero.heroClass][action.card];
        const card = base && cardInMode(base, action.overdrive);
        if (base && action.overdrive && !base.overdrive) {
          report({ kind: PlanIssueKind.NoOverdrive, heroId, message: `${base.name} has no Overdrive.` });
        } else if (!card || !isPlayableCard(base!, action.overdrive)) {
          report({ kind: PlanIssueKind.UnplayableCard, heroId, message: "This card's effect cannot be played yet." });
        } else if (card.target === CardTarget.GhostEnemy) {
          if (!view.enemies.some((enemy) => enemy.id === action.target && enemy.visibility === Visibility.Ghost)) {
            report({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a Ghost as its target.` });
          }
        } else if (card.target === CardTarget.Tile || card.target === CardTarget.EmptyTile || card.target === CardTarget.Area) {
          // Range, Line of Sight and whether the tile is empty are checked when the card resolves.
          const kind = action.tile && tileAt(REACTOR_DECK, action.tile);
          if (action.target !== heroId || kind === undefined || kind === TileKind.Wall) {
            report({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a tile that is not a Wall as its target.` });
          }
        } else if (card.target !== CardTarget.VisibleEnemy && card.target !== CardTarget.EnemyInSight) {
          // Self cards and area Attacks are confirmed on this Hero; ally cards need another Hero.
          const isSelfCard = card.target === CardTarget.SelfHero || card.target === CardTarget.EnemiesInRange;
          const validTarget = isSelfCard
            ? action.target === heroId
            : view.heroes.some((ally) => ally.id === action.target && ally.id !== heroId && !ally.exhausted);
          if (!validTarget) {
            report({
              kind: PlanIssueKind.BadTarget,
              heroId,
              message: isSelfCard ? `${card.name} can only target this Hero.` : `${card.name} needs an allied Hero as its target.`,
            });
          }
          if (card.effects.some(({ recipient }) => recipient === EffectRecipient.SecondTarget)) {
            const second = view.heroes.find((ally) => ally.id === action.secondTarget);
            if (!second || second.id === heroId || second.id === action.target || second.exhausted) {
              report({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a second, different allied Hero.` });
            }
          }
          // Forward Deploy also names the tile the ally heads for; where the ally stands by then is checked when it resolves.
          const destination = action.tile && tileAt(REACTOR_DECK, action.tile);
          if (
            card.effects.some(({ kind }) => kind === EffectKind.GrantExtraMove) &&
            (destination === undefined || destination === TileKind.Wall)
          ) {
            report({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a destination tile that is not a Wall.` });
          }
        } else if (!view.enemies.some(
            (enemy) => enemy.id === action.target && enemy.visibility === Visibility.Visible && !enemy.exhausted,
          )) {
          report({ kind: PlanIssueKind.BadTarget, heroId, message: `${card.name} needs a Visible enemy Hero as its target.` });
        }
      }
      if (action.kind !== ActionKind.Move) continue;
      const reachable = moveDestinations(position, REACTOR_DECK, moveDistance).some(
        (tile) => tile.col === action.destination.col && tile.row === action.destination.row,
      );
      if (!reachable) {
        report({ kind: PlanIssueKind.BadDestination, heroId, message: "Move 2 needs a free destination 1 or 2 tiles away." });
      }
      position = action.destination;
      moveDistance = MOVE_DISTANCE;
    }
  }
  return issues;
}

export interface RangeTile {
  position: GridPosition;
  /** A Wall or Full Cover: shown, but nothing can be aimed at it. */
  blocked: boolean;
}

/**
 * The tiles a card reaches from `origin` (not including it): every tile of the Grid within the card's Range, Chebyshev
 * distance (ADR 0020), so the area is a square. Empty for a card without a Range. The shape lives here so a card with
 * another shape can be added without the clients changing.
 */
export function cardRangeArea(grid: Grid, origin: GridPosition, card: Pick<CardDefinition, "range" | "minRange">): RangeTile[] {
  const { range, minRange = 0 } = card;
  if (range === undefined) return [];
  const tiles: RangeTile[] = [];
  for (let row = Math.max(0, origin.row - range); row <= Math.min(grid.height - 1, origin.row + range); row++) {
    for (let col = Math.max(0, origin.col - range); col <= Math.min(grid.width - 1, origin.col + range); col++) {
      if (col === origin.col && row === origin.row) continue;
      const position = { col, row };
      if (chebyshevDistance(origin, position) < minRange) continue;
      tiles.push({ position, blocked: tileAt(grid, position) === TileKind.Wall || coverAt(grid, position) === CoverKind.Full });
    }
  }
  return tiles;
}

/**
 * Whether `position` is inside the Range of the card around `origin`. The Minimum Range is not checked: a target that
 * is too close can still be named, the planner only hints that the shot may miss (`TooClose`).
 * A card without a Range reaches every position.
 */
export function isInCardRange(origin: GridPosition, card: Pick<CardDefinition, "range">, position: GridPosition): boolean {
  return card.range === undefined || chebyshevDistance(origin, position) <= card.range;
}

export interface WalkRequest {
  heroId: string;
  destination: GridPosition;
  /** Tiles the Move covers at most. */
  distance: number;
}

export interface WalkOutcome {
  heroId: string;
  /** The tiles the Hero stood on after each step, starting with its own tile; the last one is where it stops. */
  path: GridPosition[];
  /** The Hero stops before its destination: a Wall or a Wall corner is in the way, or a step failed because of another Hero. */
  blocked: boolean;
  /** For a Move stopped by Heroes: the Hero that was on the tile of the failed step (standing there or stepping onto it too). */
  occupiedBy?: string;
}

const sameTile = (a: GridPosition, b: GridPosition) => a.col === b.col && a.row === b.row;

/**
 * Decides where Moves end (ADR 0013). `standing` has every Hero. Each walking Hero plans its walk towards the
 * destination (a Wall or Wall corner ends it). Walking Heroes may cross each other's tiles in the middle of the
 * Tick, but a Hero cannot walk through a Hero that stays, and no two Heroes may be on one tile when the movement
 * ends. A walk is cut one step shorter, for all Heroes at once, when it passes a tile where a Hero stays or ends
 * on a tile another Hero ends on; a Hero left without a step stays, which may cut other walks. This is repeated
 * until nothing changes. The result does not depend on the order of the requests or on the Squad of a Hero.
 */
export function resolveWalks(standing: ReadonlyMap<string, GridPosition>, requests: readonly WalkRequest[]): Map<string, WalkOutcome> {
  const planned = new Map<string, { path: GridPosition[]; wallBlocked: boolean }>();
  for (const { heroId, destination, distance } of requests) {
    const path = [{ ...standing.get(heroId)! }];
    let wallBlocked = false;
    for (let step = 0; step < distance && !sameTile(path.at(-1)!, destination); step++) {
      const next = stepTowards(path.at(-1)!, destination);
      if (!isStepAllowed(path.at(-1)!, next)) {
        wallBlocked = true;
        break;
      }
      path.push(next);
    }
    planned.set(heroId, { path, wallBlocked });
  }

  const length = new Map([...planned].map(([heroId, { path }]) => [heroId, path.length - 1]));
  const stoppedBy = new Map<string, string>();
  const tileOf = (heroId: string) => planned.get(heroId)?.path[length.get(heroId)!] ?? standing.get(heroId)!;
  for (let changed = true; changed; ) {
    changed = false;
    const cuts = new Map<string, { newLength: number; by: string }>();
    // Heroes that stay for the whole Tick: not moving, or left without a step.
    const stayers = [...standing.keys()].filter((heroId) => (length.get(heroId) ?? 0) === 0).sort();
    for (const [heroId, { path }] of planned) {
      const steps = length.get(heroId)!;
      if (steps === 0) continue;
      for (let index = 1; index <= steps; index++) {
        const stayer = stayers.find((other) => other !== heroId && sameTile(standing.get(other)!, path[index]!));
        if (stayer !== undefined) {
          cuts.set(heroId, { newLength: index - 1, by: stayer });
          break;
        }
      }
      if (cuts.has(heroId)) continue;
      const end = tileOf(heroId);
      const sharing = [...standing.keys()].filter((other) => other !== heroId && sameTile(tileOf(other), end)).sort();
      if (sharing.length > 0) cuts.set(heroId, { newLength: steps - 1, by: sharing[0]! });
    }
    for (const [heroId, { newLength, by }] of cuts) {
      length.set(heroId, newLength);
      stoppedBy.set(heroId, by);
      changed = true;
    }
  }
  return new Map(
    requests.map(({ heroId }) => {
      const { path, wallBlocked } = planned.get(heroId)!;
      const outcome: WalkOutcome = { heroId, path: path.slice(0, length.get(heroId)! + 1), blocked: wallBlocked || stoppedBy.has(heroId) };
      if (stoppedBy.has(heroId)) outcome.occupiedBy = stoppedBy.get(heroId)!;
      return [heroId, outcome];
    }),
  );
}

/** A planned Move that stops short because of another Hero of the same Squad (ADR 0013). */
export interface MoveCollision {
  heroId: string;
  /** 1-based Tick of the Move action. */
  tick: number;
  /** The destination of the Move, where the warning is drawn. */
  destination: GridPosition;
  /** A Squad Hero on the tile the Move would reach: standing there, or ending its own Move there. */
  blockedBy: string;
}

/** A Slowed Hero's first Move 2 becomes a Move 1 (mirrors the Resolution). */
const SLOWED_MOVE_DISTANCE = 1;

/**
 * The planned Moves that stop short of their destination because another Hero of the Squad is on the tile they
 * would end on, judged by `resolveWalks` like the Resolution does. Enemies are not considered, and a Move stopped
 * by a Wall is not a collision. Heroes that stop short start their next Move from where they stopped.
 */
export function findMoveCollisions(heroes: readonly HeroView[], plans: readonly SquadPlan[]): MoveCollision[] {
  const positions = new Map(heroes.filter((hero) => !hero.exhausted).map((hero) => [hero.id, { ...hero.position }]));
  const slowed = new Set(heroes.filter((hero) => hero.slowed).map((hero) => hero.id));
  const extended = new Map<string, number>();
  const queues = plans.flatMap((plan) => plan.heroes).filter(({ heroId }) => positions.has(heroId));
  const collisions: MoveCollision[] = [];
  const ticks = Math.max(0, ...queues.map(({ queue }) => queue.length));

  for (let tick = 1; tick <= ticks; tick++) {
    const movers = queues.flatMap(({ heroId, queue }) => {
      const hero = heroes.find((candidate) => candidate.id === heroId)!;
      const action = queue[tick - 1];
      if (!action || hero.exhausted) return [];
      if (action.kind === ActionKind.Primary) {
        const card = HERO_DECKS[hero.heroClass][action.card];
        const extend = card && cardInMode(card, action.overdrive).effects.find(({ kind }) => kind === EffectKind.ExtendMove);
        if (extend) extended.set(heroId, extend.amount ?? MOVE_DISTANCE);
      }
      if (action.kind !== ActionKind.Move) return [];
      let distance = extended.get(heroId) ?? MOVE_DISTANCE;
      extended.delete(heroId);
      if (slowed.delete(heroId)) distance = SLOWED_MOVE_DISTANCE;
      return [{ heroId, destination: action.destination, distance }];
    });
    // A Slowed Hero's walk is shorter, so the Resolution's Slow rule is already in `distance`.
    const outcomes = resolveWalks(positions, movers);
    for (const { heroId, destination } of movers) {
      const { path, occupiedBy } = outcomes.get(heroId)!;
      if (occupiedBy !== undefined) collisions.push({ heroId, tick, destination, blockedBy: occupiedBy });
      positions.set(heroId, path.at(-1)!);
    }
  }
  return collisions;
}
