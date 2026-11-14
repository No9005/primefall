import {
  ActionKind,
  type CardDefinition,
  CardTarget,
  cardInMode,
  chebyshevDistance,
  CoverKind,
  coverAt,
  EffectKind,
  type EnemyView,
  EventKind,
  type Grid,
  type GridPosition,
  HERO_DECKS,
  type HeroView,
  isStepAllowed,
  MAX_PLACED_COVER_PER_SQUAD,
  type MatchEvent,
  type QueuedAction,
  type SquadPlan,
  stepTowards,
  Visibility,
  type VisibleEnemyView,
} from "game-core";
import { drawShot, type ShotDrawing, SegmentStyle } from "./shot-lines";

// Who targets whom: a line from a Hero to the target of each queued action (planning) and of each resolved action
// (replay). Everything is pure and kept in tiles, so the board draws it through the same projection as the terrain.
// Only data of the Squad View is read: the plans passed in are the own Squad's, an Unknown enemy never gets a line.

export enum LineKind {
  /** A shot at an enemy Hero or a Ghost, drawn like the line of fire of an Attack. */
  Attack = "attack",
  /** A card effect on an allied Hero: teal, with an arrow head. */
  Ally = "ally",
  /** A card effect on a tile (Breach Charge, Scout Drone, Deploy Cover, Barricade): ends in a ring. */
  Tile = "tile",
}

export enum LineTone {
  /** The action can reach its target: teal. */
  Clear = "clear",
  /** The shot is blocked by a Wall or out of Range, or an enemy acts: red. */
  Red = "red",
}

export interface TargetLine {
  /** The Hero that acts. */
  heroId: string;
  /** Belongs to the Squad's own Heroes (as opposed to an enemy shown in the replay). */
  own: boolean;
  kind: LineKind;
  tone: LineTone;
  /** The Tick of the action (1-based). */
  tick: number;
  /** For an Attack: the id of the targeted enemy. */
  targetId?: string;
  from: GridPosition;
  to: GridPosition;
  /** For an Attack: the drawing of the shot with its block, cross and Cover tile. */
  shot?: ShotDrawing;
  /** A line of a queued action (planning), as opposed to one of the replay. */
  planned?: boolean;
  /** Planned Attack that cannot reach its target from the planned position: out of Range or no Line of Sight. */
  unreachable?: boolean;
  /** Set with `unreachable`: why the shot may miss from the planned position. A hint only; Commit is never blocked by it. */
  missHint?: string;
  /** An allied Hero's plan: drawn very faint in yellow, without badge or ring. */
  faint?: boolean;
}

const NO_RANGE_LIMIT = Number.MAX_SAFE_INTEGER;

const ENEMY_TARGETS = [CardTarget.VisibleEnemy, CardTarget.GhostEnemy];
const ALLY_TARGETS = [CardTarget.AllyHero, CardTarget.AllyHeroTile];
const TILE_TARGETS = [CardTarget.Tile, CardTarget.EmptyTile, CardTarget.Area];

/** The enemy Hero a line may end on: Visible, or a Ghost at its last known tile; never an Unknown one. */
function knownEnemy(enemies: readonly EnemyView[], id: string): { id: string; position: GridPosition } | undefined {
  const enemy = enemies.find((candidate) => candidate.id === id);
  return enemy && enemy.visibility !== Visibility.Unknown ? { id, position: enemy.position } : undefined;
}

/**
 * The note for a shot that cannot hit from the planned position (a Declared Target is only checked in the Tick it
 * fires, so this is a hint, not an error). It judges the target's last known position.
 */
export function mayMissHint(from: GridPosition, target: GridPosition, range: number, minRange = 0): string {
  const distance = chebyshevDistance(from, target);
  if (distance > range) return "may miss: out of Range from the planned position";
  if (distance < minRange) return "may miss: too close from the planned position";
  return "may miss: no clear shot from the planned position";
}

/** Where a Hero stands when action `index` resolves: at its last queued Move destination before it (up to the Move's reach). */
function positionBefore(hero: HeroView, queue: readonly QueuedAction[], index: number): GridPosition {
  const moves = queue.slice(0, index).flatMap((action) => (action.kind === ActionKind.Move ? [action.destination] : []));
  return moves.at(-1) ?? hero.position;
}

/** What the lines of a plan are drawn against: the grid and the Squad View's Heroes and enemies. */
interface LineContext {
  grid: Grid;
  heroes: readonly HeroView[];
  enemies: readonly EnemyView[];
}

type LineBase = Pick<TargetLine, "heroId" | "own" | "tick">;
type PrimaryAction = Extract<QueuedAction, { kind: ActionKind.Primary }>;

function linesOfAction({ grid, heroes, enemies }: LineContext, hero: HeroView, from: GridPosition, action: QueuedAction, tick: number): TargetLine[] {
  if (action.kind !== ActionKind.Primary) return [];
  const card: CardDefinition = cardInMode(HERO_DECKS[hero.heroClass][action.card]!, action.overdrive);
  const base = { heroId: hero.id, own: true, tick };
  if (ENEMY_TARGETS.includes(card.target)) {
    return attackLines(grid, enemies, { base, from, action, range: card.range ?? NO_RANGE_LIMIT, minRange: card.minRange ?? 0 });
  }
  if (ALLY_TARGETS.includes(card.target)) return allyLines(heroes, hero, base, from, action);
  if (TILE_TARGETS.includes(card.target) && action.tile) return [tileLine(base, from, action.tile)];
  return [];
}

function attackLines(grid: Grid, enemies: readonly EnemyView[], shotAt: { base: LineBase; from: GridPosition; action: PrimaryAction; range: number; minRange: number }): TargetLine[] {
  const { base, from, action, range, minRange } = shotAt;
  const target = knownEnemy(enemies, action.target);
  if (!target) return [];
  const shot = drawShot(grid, from, target, range);
  const tooClose = chebyshevDistance(from, target.position) < minRange;
  const clear = !tooClose && shot.segments.every((segment) => segment.style === SegmentStyle.Clear) && shot.ringed;
  const missHint = clear ? undefined : mayMissHint(from, target.position, range, minRange);
  return [{ ...base, kind: LineKind.Attack, tone: clear ? LineTone.Clear : LineTone.Red, targetId: target.id, from, to: target.position, shot, unreachable: !clear, missHint }];
}

function allyLines(heroes: readonly HeroView[], hero: HeroView, base: LineBase, from: GridPosition, action: PrimaryAction): TargetLine[] {
  const ally = heroes.find((candidate) => candidate.id === action.target);
  if (!ally || ally.id === hero.id) return [];
  return [{ ...base, kind: LineKind.Ally, tone: LineTone.Clear, from, to: ally.position }];
}

function tileLine(base: Pick<TargetLine, "heroId" | "own" | "tick">, from: GridPosition, to: GridPosition): TargetLine {
  return { ...base, kind: LineKind.Tile, tone: LineTone.Clear, from, to };
}

/**
 * The lines of the queued actions of the own Squad's plans, numbered with their Tick. Plans of other Heroes than the
 * Squad's own are ignored, as are Move and Block actions (a Move's path is drawn elsewhere).
 */
export function plannedTargetLines(
  grid: Grid,
  heroes: readonly HeroView[],
  enemies: readonly EnemyView[],
  plans: readonly SquadPlan[],
): TargetLine[] {
  const context = { grid, heroes, enemies };
  return plans.flatMap((plan) =>
    plan.heroes.flatMap(({ heroId, queue }) => {
      const hero = heroes.find((candidate) => candidate.id === heroId);
      if (!hero || hero.exhausted) return [];
      return queue.flatMap((action, index) =>
        linesOfAction(context, hero, positionBefore(hero, queue, index), action, index + 1).map((line) => ({ ...line, planned: true })),
      );
    }),
  );
}

/**
 * The lines of the actions that resolved in one playback frame. `positionOf` tells where a Hero stands at that moment.
 * Own Heroes always show their lines (the Squad knows its own actions and targets only if it may see them); an enemy's
 * line shows only when that enemy is Visible, and is red. An action on a target the Squad has no position for is skipped.
 */
export function replayTargetLines(
  events: readonly MatchEvent[],
  heroes: readonly HeroView[],
  enemies: readonly EnemyView[],
  positionOf: (heroId: string) => GridPosition | undefined,
): TargetLine[] {
  const ownIds = new Set(heroes.map((hero) => hero.id));
  return events.flatMap((event) => replayLines(event, { ownIds, enemies, positionOf }));
}

interface ReplayContext {
  ownIds: ReadonlySet<string>;
  enemies: readonly EnemyView[];
  positionOf: (heroId: string) => GridPosition | undefined;
}

function replayLines(event: MatchEvent, context: ReplayContext): TargetLine[] {
  const { ownIds, enemies, positionOf } = context;
  const own = ownIds.has(event.heroId);
  const actor = positionOf(event.heroId);
  if (!actor) return [];
  if (!own && enemies.find((enemy) => enemy.id === event.heroId)?.visibility !== Visibility.Visible) return [];
  const base = { heroId: event.heroId, own, tick: event.tick };
  switch (event.kind) {
    case EventKind.CoverDestroyed:
    case EventKind.CoverPlaced:
    case EventKind.AreaRevealed:
      return event.to ? [{ ...base, kind: LineKind.Tile, tone: replayTone(own, true), from: actor, to: event.to }] : [];
    case EventKind.AttackHit:
    case EventKind.AttackFailed:
    case EventKind.SlowApplied:
    case EventKind.MarkedApplied:
      return replayAttackLines(event, base, actor, context);
    default:
      return [];
  }
}

const replayTone = (own: boolean, clear: boolean) => (own && clear ? LineTone.Clear : LineTone.Red);

function replayAttackLines(event: MatchEvent, base: LineBase, actor: GridPosition, { ownIds, enemies, positionOf }: ReplayContext): TargetLine[] {
  const target = event.targetId ? positionOf(event.targetId) : undefined;
  if (!event.targetId || !target || (!ownIds.has(event.targetId) && !knownEnemy(enemies, event.targetId))) return [];
  const failed = event.kind === EventKind.AttackFailed;
  const shot: ShotDrawing = {
    targetId: event.targetId,
    segments: [{ from: actor, to: target, style: failed ? SegmentStyle.Stopped : SegmentStyle.Clear }],
    ...(failed ? { cross: target } : {}),
    coverKind: CoverKind.None,
    ringed: !failed,
  };
  return [{ ...base, kind: LineKind.Attack, tone: replayTone(base.own, !failed), from: actor, to: target, shot }];
}

export enum RingSegment {
  /** No own Attack on the target in this Tick. */
  Empty = "empty",
  /** An own Attack on the target in this Tick. */
  Attack = "attack",
  /** An Attack that may form a Crossfire with one of another own Hero in the same or the next Tick. */
  Crossfire = "crossfire",
}

/** The Tick ring of a Visible enemy that own planned Attacks declare as target: one segment per Tick. */
export interface CrossfireRing {
  targetId: string;
  position: GridPosition;
  /** Segment state of Ticks 1 to 4, in order. */
  segments: RingSegment[];
}

export const RING_TICKS = 4;

/**
 * The Tick rings of the plan preview: which Ticks of each Visible enemy are attacked by own Heroes and which of those may
 * be a Crossfire (different Heroes, same or consecutive Ticks; judged on the declared targets only, so the Attacks can
 * still miss). Ghosts and Unknown enemies get no ring. The plan is only read.
 */
export function crossfireRings(lines: readonly TargetLine[], enemies: readonly EnemyView[]): CrossfireRing[] {
  const attacks = lines.filter((line) => line.planned && line.kind === LineKind.Attack && line.targetId && line.tick <= RING_TICKS);
  const targetIds = [...new Set(attacks.map((line) => line.targetId!))];
  return targetIds.flatMap((targetId) => {
    const enemy = enemies.find((candidate) => candidate.id === targetId);
    if (enemy?.visibility !== Visibility.Visible) return [];
    const onTarget = attacks.filter((line) => line.targetId === targetId);
    const segments = Array.from({ length: RING_TICKS }, (_, index) => {
      const tick = index + 1;
      const here = onTarget.filter((line) => line.tick === tick);
      if (here.length === 0) return RingSegment.Empty;
      const crossfire = onTarget.some((other) => Math.abs(other.tick - tick) <= 1 && here.some((line) => line.heroId !== other.heroId));
      return crossfire ? RingSegment.Crossfire : RingSegment.Attack;
    });
    return [{ targetId, position: enemy.position, segments }];
  });
}

export enum EffectPathKind {
  /** The tiles an enemy would be pulled over, toward the Bruiser. */
  Pull = "pull",
  /** The tiles a Charge would carry the Bruiser over, toward the enemy. */
  Charge = "charge",
}

/** One tile of a path and the direction its chevron points. */
export interface EffectPathTile {
  tile: GridPosition;
  direction: GridPosition;
}

/** The path a queued Pull or Charge would take (docs/design/role-visuals/380/pull.png and charge.png), with its tag. */
export interface EffectPath {
  kind: EffectPathKind;
  heroId: string;
  tiles: readonly EffectPathTile[];
  tag: string;
  /** The tile the tag sits over: the target of a Pull, the Bruiser for a Charge. */
  tagTile: GridPosition;
}

const samePosition = (a: GridPosition, b: GridPosition) => a.col === b.col && a.row === b.row;

/**
 * The paths of the queued Pulls and Charges of the own Squad's plans, drawn with the rules' own stopping: a path ends before a
 * Wall, Full Cover, another Hero or the Bruiser, and a Charge next to its target. Only Visible enemies are named: a Pull and a
 * Charge need a Visible target. A path is a preview of the plan; the Resolution may stop earlier.
 */
export function plannedEffectPaths(grid: Grid, heroes: readonly HeroView[], enemies: readonly EnemyView[], plans: readonly SquadPlan[]): EffectPath[] {
  const standing = (except: string, ...also: GridPosition[]) => [
    ...heroes.filter((hero) => hero.id !== except && !hero.exhausted).map((hero) => hero.position),
    ...enemies.filter((enemy): enemy is VisibleEnemyView => enemy.visibility === Visibility.Visible && enemy.id !== except && !enemy.exhausted).map((enemy) => enemy.position),
    ...also,
  ];
  const blocked = (from: GridPosition, to: GridPosition, occupied: readonly GridPosition[]) =>
    !isStepAllowed(from, to, grid) || coverAt(grid, to) === CoverKind.Full || occupied.some((other) => samePosition(other, to));
  return plans.flatMap((plan) =>
    plan.heroes.flatMap(({ heroId, queue }) => {
      const hero = heroes.find((candidate) => candidate.id === heroId);
      if (!hero || hero.exhausted) return [];
      return queue.flatMap((action, index): EffectPath[] => {
        if (action.kind !== ActionKind.Primary) return [];
        const card = cardInMode(HERO_DECKS[hero.heroClass][action.card]!, action.overdrive);
        const target = enemies.find((enemy) => enemy.id === action.target);
        if (target?.visibility !== Visibility.Visible) return [];
        const caster = positionBefore(hero, queue, index);
        const pull = card.effects.find((effect) => effect.kind === EffectKind.Pull);
        if (pull) {
          const direction = { col: Math.sign(caster.col - target.position.col), row: Math.sign(caster.row - target.position.row) };
          const occupied = standing(target.id, caster);
          const tiles: EffectPathTile[] = [];
          for (let at = target.position; tiles.length < (pull.amount ?? 0); ) {
            const next = { col: at.col + direction.col, row: at.row + direction.row };
            if (blocked(at, next, occupied)) break;
            tiles.push({ tile: next, direction });
            at = next;
          }
          return [{ kind: EffectPathKind.Pull, heroId, tiles, tag: `PULL · RANGE ${card.range ?? 0}`, tagTile: target.position }];
        }
        const charge = card.effects.find((effect) => effect.kind === EffectKind.Charge);
        if (charge) {
          const occupied = standing(hero.id);
          const tiles: EffectPathTile[] = [];
          for (let at = caster; tiles.length < (charge.amount ?? 0) && chebyshevDistance(at, target.position) > 1; ) {
            const next = stepTowards(at, target.position);
            if (blocked(at, next, occupied)) break;
            tiles.push({ tile: next, direction: { col: next.col - at.col, row: next.row - at.row } });
            at = next;
          }
          return [{ kind: EffectPathKind.Charge, heroId, tiles, tag: `CHARGE · MOVE ${charge.amount ?? 0} TOWARD`, tagTile: caster }];
        }
        return [];
      });
    }),
  );
}

/** What the plan does to the Placed Cover of the Squad: the oldest tiles that go and the tiles the new Cover will stand on. */
export interface CoverPlan {
  oldest: readonly GridPosition[];
  fresh: readonly GridPosition[];
}

export const NO_COVER_PLAN: CoverPlan = { oldest: [], fresh: [] };

/**
 * The Placed Cover the Squad's plans put down and the oldest tiles that go for it (docs/design/role-visuals/380/placed-cover.png,
 * "Aiming a fourth"). `own` is the Squad's Placed Cover, oldest first; `aiming` is a card that places Cover being aimed, which counts
 * as one more placement. A Squad has at most `MAX_PLACED_COVER_PER_SQUAD`: every placement beyond that takes the oldest.
 */
export function plannedCoverPlan(own: readonly GridPosition[], heroes: readonly HeroView[], plans: readonly SquadPlan[], aiming: boolean): CoverPlan & { overflow: boolean } {
  const fresh = plans.flatMap((plan) =>
    plan.heroes.flatMap(({ heroId, queue }) => {
      const hero = heroes.find((candidate) => candidate.id === heroId);
      if (!hero || hero.exhausted) return [];
      return queue.flatMap((action) => {
        if (action.kind !== ActionKind.Primary || !action.tile) return [];
        const card = cardInMode(HERO_DECKS[hero.heroClass][action.card]!, action.overdrive);
        return card.effects.some((effect) => effect.kind === EffectKind.PlaceCover) ? [action.tile] : [];
      });
    }),
  );
  const overflow = Math.max(0, own.length + fresh.length + (aiming ? 1 : 0) - MAX_PLACED_COVER_PER_SQUAD);
  return { oldest: own.slice(0, overflow), fresh, overflow: overflow > 0 };
}
