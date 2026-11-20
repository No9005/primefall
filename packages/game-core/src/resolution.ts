// Resolution of a Round (ADR 0013, ADR 0020). Pure and deterministic: the same Match State and plans
// always give the same result. Only Move actions exist so far.

import {
  type CardDefinition,
  type CardEffect,
  type CardIndex,
  CardTarget,
  CardType,
  EffectKind,
  HERO_DECKS,
  effectFor,
  isAreaAttack,
  isPlayableUtility,
  type PLAYABLE_UTILITY_EFFECTS,
} from "./cards";
import {
  AttackFailReason,
  DEFENDER_ROUND_LIMIT,
  DEFENDER_ZONE_TIE,
  EventKind,
  MatchEndReason,
  MatchMode,
  type MatchEvent,
  PRIME_ZONE_WIN_RESOLUTIONS,
  TAKEOVER_BONUS_FACTOR,
  TAKEOVER_COOLDOWN,
  ROUND_LIMIT,
  SquadId,
  CREDITS_TO_WIN,
  ZONE_DECAY_CARDS,
  ZoneTie,
} from "./host";
import { type ActiveField, areaTiles, canSquadSee, canSquadSeeHero, type HeroState, MAX_PLACED_COVER_PER_SQUAD, type MatchState, recordSightings, refillDeck, ZONES } from "./match";
import {
  ActionKind,
  chebyshevDistance,
  MAX_QUEUE_LENGTH,
  MOVE_DISTANCE,
  slowedDistance,
  type QueuedAction,
  resolveWalks,
  type SquadPlan,
} from "./plan";
import {
  CoverKind,
  coverAgainst,
  coverAt,
  destroyCover,
  findTiles,
  type GridPosition,
  isStepAllowed,
  isWall,
  HALF_COVER_REDUCTION,
  hasLineOfSight,
  REACTOR_DECK,
  stepTowards,
  TileKind,
  tileAt,
  withTile,
  withWreck,
} from "./reactor-deck";

export interface ResolutionResult {
  /** The Match State after the Resolution; the Round counter and Hands are unchanged. */
  match: MatchState;
  /** Everything that happened, for all Squads. Clients only ever see `getSquadEvents`. */
  events: readonly MatchEvent[];
  /** Parallel to `events`: the Squads that perceive each event. */
  perceivedBy: readonly (readonly SquadId[])[];
  /**
   * The fields of an event a Squad that perceives it must not get, by index in `events`: a Pull the Squad sees only in
   * part does not tell where the Hero stood, where it passed or who pulled it (`getSquadEvents` drops them).
   */
  withheld: Readonly<Record<number, Readonly<Partial<Record<SquadId, readonly WithheldField[]>>>>>;
}

type WithheldField = "from" | "to" | "casterId";

const SQUADS = [SquadId.Left, SquadId.Right];
const PRIME_ZONE_TILES = findTiles(REACTOR_DECK, TileKind.PrimeZone);


/** Slow applied in a Resolution lasts until the end of the next one: that is `duration` Resolutions after this. */
function applySlow(tick: number, source: HeroState, target: HeroState, effect: CardEffect, events: MatchEvent[]): void {
  target.slow = (effect.duration ?? 1) + 1;
  events.push({ kind: EventKind.SlowApplied, tick, heroId: source.id, targetId: target.id });
}

/** Extra damage of every hit on a Marked Hero. */
const MARKED_DAMAGE_BONUS = 1;

/** Per Resolution, per target: the Tick of the last hit by each attacker. Crossfire needs no state between Rounds. */
const hitTicks = new WeakMap<MatchState, Map<string, Map<string, number>>>();

/**
 * Crossfire: +1 when a different attacker hit this target in the same Tick or the Tick directly before.
 * Records this hit. Hits on allies create no Crossfire; neither does the same attacker twice.
 */
function crossfireBonus(match: MatchState, tick: number, source: HeroState, target: HeroState): number {
  if (source.squad === target.squad) return 0;
  const byTarget = hitTicks.get(match) ?? new Map<string, Map<string, number>>();
  hitTicks.set(match, byTarget);
  const byAttacker = byTarget.get(target.id) ?? new Map<string, number>();
  byTarget.set(target.id, byAttacker);
  const joined = [...byAttacker].some(([attackerId, lastTick]) => attackerId !== source.id && tick - lastTick <= 1);
  byAttacker.set(source.id, tick);
  return joined ? 1 : 0;
}

/**
 * Crossfire and Marked raise the incoming damage before Shield absorbs. Piercing Damage skips the Shield.
 * Shield absorbs first; the rest is Deck Damage: the top cards, one per point, leave the cycle (Exile) so the
 * damage lasts. When the Deck runs out on the way, the Discard is shuffled into it and the damage goes on.
 * Then the events read: AttackHit (cards burned so far), DeckShuffled, AttackHit (the rest).
 */
function dealDamage(
  match: MatchState,
  tick: number,
  source: HeroState,
  target: HeroState,
  baseDamage: number,
  events: MatchEvent[],
  { piercing = false, crossfire: joinsCrossfire = true }: { piercing?: boolean; crossfire?: boolean } = {},
): void {
  let crossfire = joinsCrossfire ? crossfireBonus(match, tick, source, target) : 0;
  // Marked: every hit on the Hero deals 1 more damage (Price Tag).
  let marked = target.marked > 0 ? MARKED_DAMAGE_BONUS : 0;
  const incoming = baseDamage + crossfire + marked;
  // Piercing Damage (Crossfire bonus included) leaves the Shield untouched.
  const absorbed = piercing ? 0 : Math.min(target.shield, incoming);
  target.shield -= absorbed;
  let remaining = incoming - absorbed;
  let burned = 0;
  let alreadyAbsorbed = absorbed;
  const reportHit = () => {
    events.push({ kind: EventKind.AttackHit, tick, heroId: source.id, targetId: target.id, absorbed: alreadyAbsorbed, damage: burned, crossfire, ...(marked > 0 ? { marked } : {}) });
    crossfire = 0;
    marked = 0;
    alreadyAbsorbed = 0;
    burned = 0;
  };
  while (remaining > 0) {
    const removed = target.deck.splice(Math.max(0, target.deck.length - remaining));
    target.exile.push(...removed);
    burned += removed.length;
    remaining -= removed.length;
    if (remaining === 0 || target.discard.length === 0) break;
    reportHit();
    events.push({ kind: EventKind.DeckShuffled, tick, heroId: target.id, amount: refillDeck(match, target) });
  }
  reportHit();
  // Damage ends Hidden at once (Vanish).
  if (incoming > 0) endHidden(tick, target, events);
}

/** Names the extra damage of the hit that starts at `first` (the close-range effect), so the playback can label it. */
function flagCloseBonus(events: MatchEvent[], first: number, close: number): void {
  const hit = events.slice(first).find((event) => event.kind === EventKind.AttackHit);
  if (hit !== undefined && close > 0) hit.closeBonus = close;
}

/** Marks the hits from `first` on as reduced by Half Cover, so the playback can show the projectile hitting the wall. */
function flagHalfCover(events: MatchEvent[], first: number): void {
  for (const event of events.slice(first)) if (event.kind === EventKind.AttackHit) event.halfCover = true;
}

/** A Hero stops being Hidden when it attacks or is revealed (Marked). */
function endHidden(tick: number, hero: HeroState, events: MatchEvent[]): void {
  if (hero.hidden === 0) return;
  hero.hidden = 0;
  events.push({ kind: EventKind.HiddenEnded, tick, heroId: hero.id });
}

/** Marked lasts until the end of the next Resolution, like Slow; it also reveals a Hidden Hero. */
function applyMarked(tick: number, source: HeroState, target: HeroState, effect: CardEffect, events: MatchEvent[]): void {
  target.marked = (effect.duration ?? 1) + 1;
  events.push({ kind: EventKind.MarkedApplied, tick, heroId: source.id, targetId: target.id });
  endHidden(tick, target, events);
}

/** The events a card causes carry its name (not Steps, shuffles or the end of Hidden). */
const CARD_EVENT_KINDS: ReadonlySet<EventKind> = new Set([
  EventKind.AttackHit, EventKind.AttackFailed, EventKind.SlowApplied, EventKind.MarkedApplied, EventKind.HiddenGained,
  EventKind.CoverPlaced, EventKind.CoverDestroyed, EventKind.AreaRevealed,
  EventKind.FieldPlaced, EventKind.AreaBlasted, EventKind.ShieldGained, EventKind.Pull, EventKind.Charged,
]);

/**
 * Marks the events from index `first` on as caused by `card`. Attack events also get the Range between the
 * attacker and the target Hero (or the targeted tile), which tells a Long Shot from a normal shot.
 */
function tagCardEvents(
  match: MatchState,
  events: MatchEvent[],
  first: number,
  caster: HeroState,
  card: CardDefinition,
  tile?: GridPosition,
): void {
  for (const event of events.slice(first)) {
    if (!CARD_EVENT_KINDS.has(event.kind)) continue;
    event.card = card.name;
    if (event.kind !== EventKind.AttackHit && event.kind !== EventKind.AttackFailed) continue;
    // A miss on a target the Squad cannot see must not reveal how far away it stands.
    if (event.reason === AttackFailReason.NotVisible) continue;
    const target = match.heroes.find((hero) => hero.id === event.targetId);
    const aimedAt = target?.position ?? tile;
    if (aimedAt) event.distance = chebyshevDistance(caster.position, aimedAt);
    if (tile) event.tile = { ...tile };
  }
}

/**
 * What a Squad that perceives a Pull must not learn from it (judged at the end of the Tick, like `perceivers`): a tile it
 * does not see (not for its own pulled Hero) and the Hero that pulled when it does not see that Hero. So a Squad that
 * sees only where an enemy ended up learns that, and not where it stood or from which side it came, and a Squad whose
 * Hero is pulled by an enemy it cannot see learns that it was pulled, not by whom.
 */
function withheldFields(match: MatchState, events: readonly MatchEvent[], perceivedBy: readonly (readonly SquadId[])[], first: number): Record<number, Partial<Record<SquadId, readonly WithheldField[]>>> {
  const result: Record<number, Partial<Record<SquadId, readonly WithheldField[]>>> = {};
  events.forEach((event, index) => {
    if (index < first || event.kind !== EventKind.Pull) return;
    const pulled = match.heroes.find((hero) => hero.id === event.heroId);
    const caster = match.heroes.find((hero) => hero.id === event.casterId);
    for (const squad of perceivedBy[index]!) {
      const fields: WithheldField[] = [];
      // A Squad always sees where its own Hero is pulled; it may still not see who pulls it.
      if (pulled?.squad !== squad) {
        if (event.from && !canSquadSee(match, squad, event.from)) fields.push("from");
        if (event.to && !canSquadSee(match, squad, event.to)) fields.push("to");
      }
      if (caster && caster.squad !== squad && !canSquadSeeHero(match, squad, caster)) fields.push("casterId");
      if (fields.length > 0) (result[index] ??= {})[squad] = fields;
    }
  });
  return result;
}

/** Which Squads perceive the events from `first` on, judged by the current positions (see `getSquadEvents`). */
function perceivers(match: MatchState, events: readonly MatchEvent[], first: number): SquadId[][] {
  return events.slice(first).map((event) => {
    if (event.kind === EventKind.ZoneTakenOver) return [...SQUADS];
    // Only the attacker's Squad learns that a shot at an unseen target missed.
    if (event.reason === AttackFailReason.NotVisible) {
      return SQUADS.filter((squad) => match.heroes.some((hero) => hero.id === event.heroId && hero.squad === squad));
    }
    const involved = [event.heroId, event.targetId].flatMap((id) => match.heroes.filter((hero) => hero.id === id));
    const tiles = [event.from, event.to, ...involved.map((hero) => hero.position)].filter((tile) => tile !== undefined);
    // Seeing a tile does not reveal what a Hidden enemy does on it.
    return SQUADS.filter(
      (squad) =>
        involved.some((hero) => hero.squad === squad) ||
        (involved.every((hero) => canSquadSeeHero(match, squad, hero) || hero.hidden === 0) &&
          tiles.some((tile) => canSquadSee(match, squad, tile))),
    );
  });
}

interface Mover {
  heroId: string;
  destination: GridPosition;
  /** Tiles the Move covers at most: the Move distance. */
  distance: number;
}

interface Attack {
  hero: HeroState;
  card: CardDefinition;
  targetId: string;
  /** For an area Attack (Urban Renewal): the tile at the centre. */
  tile?: GridPosition;
}

const samePosition = (a: GridPosition, b: GridPosition) => a.col === b.col && a.row === b.row;

/**
 * Resolves one Tick of Move actions. Heroes walk through each other, but a Move must end on a free tile; where
 * it stops is decided by `resolveWalks` (ADR 0013). Positions change only after the whole Tick is decided.
 */
function resolveMoves(match: MatchState, tick: number, movers: Mover[], events: MatchEvent[]): void {
  // A Slowed Hero's Move covers half the distance, rounded down, and that uses the Slow up. A Hero that starts the
  // Move in a Scrap Field is Slowed for it too, without using up a Slow of its own.
  const slowedIds = new Set<string>();
  for (const { heroId } of movers) {
    const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
    const inField = scrapFieldsAt(match, hero.position).length > 0;
    if (hero.slow === 0 && !inField) continue;
    if (hero.slow > 0) hero.slow = 0;
    slowedIds.add(heroId);
    events.push({ kind: EventKind.SlowUsed, tick, heroId });
  }
  const outcomes = resolveWalks(
    new Map(match.heroes.filter((hero) => !hero.exhausted).map((hero) => [hero.id, hero.position])),
    movers.map((mover) => ({ ...mover, distance: slowedIds.has(mover.heroId) ? slowedDistance(mover.distance) : mover.distance })),
    match.grid,
  );
  const furthest = Math.max(0, ...[...outcomes.values()].map(({ path, blocked }) => path.length - 1 + (blocked ? 1 : 0)));
  for (let step = 1; step <= furthest; step++) {
    for (const { heroId } of movers) {
      const { path, blocked } = outcomes.get(heroId)!;
      if (step < path.length) {
        events.push({ kind: EventKind.Step, tick, heroId, from: { ...path[step - 1]! }, to: { ...path[step]! } });
      } else if (step === path.length && blocked) {
        events.push({ kind: EventKind.MoveBlocked, tick, heroId, from: { ...path[step - 1]! } });
      }
    }
  }
  // A Move that starts in, passes or ends in a Scrap Field hurts the Hero once.
  for (const { heroId } of movers) {
    const { path } = outcomes.get(heroId)!;
    if (path.length < 2) continue;
    const field = path.flatMap((tile) => scrapFieldsAt(match, tile))[0];
    const caster = field && match.heroes.find((hero) => hero.id === field.casterId);
    if (!field || !caster) continue;
    const first = events.length;
    dealDamage(match, tick, caster, match.heroes.find((hero) => hero.id === heroId)!, field.damage, events, { crossfire: false });
    for (const event of events.slice(first)) if (event.kind === EventKind.AttackHit) event.card = field.card;
  }
  for (const { heroId } of movers) {
    match.heroes.find((hero) => hero.id === heroId)!.position = { ...outcomes.get(heroId)!.path.at(-1)! };
  }
}

/** The Scrap Fields that cover a tile. */
function scrapFieldsAt(match: MatchState, tile: GridPosition): ActiveField[] {
  return match.scrapFields.filter((field) => areaTiles(match.grid, field.center, field.size).some((covered) => samePosition(covered, tile)));
}

/**
 * Resolves one Tick of Attacks against the positions at the end of the Tick's movement. Every Attack is
 * checked before any damage is applied, so simultaneous Attacks all resolve, even between Heroes that
 * lose their last card in this Tick. A failed Attack (Range, Line of Sight, Exhausted target) does nothing.
 */
function resolveAttacks(match: MatchState, tick: number, attacks: Attack[], events: MatchEvent[]): void {
  // The first check an Attack on `target` fails, in the order of ADR 0013; visibility is only asked of a Declared Target.
  // A Hidden Hero that attacks stops being Hidden, but its Hidden state counts for this very Attack (sight, Range, bonus).
  const hiddenAttackers = new Set(attacks.filter(({ hero }) => hero.hidden > 0).map(({ hero }) => hero.id));
  const missReason = (hero: HeroState, card: CardDefinition, target: HeroState) => {
    if (target.squad === hero.squad) return AttackFailReason.NotVisible;
    if (!canSquadSeeHero(match, hero.squad, target)) return AttackFailReason.NotVisible;
    if (target.exhausted) return AttackFailReason.TargetExhausted;
    const distance = chebyshevDistance(hero.position, target.position);
    if (distance > (card.range ?? 0)) return AttackFailReason.OutOfRange;
    const far = card.effects.find(({ kind }) => kind === EffectKind.FarShot);
    if (far && distance > (far.amount ?? 0) && !hiddenAttackers.has(hero.id) && target.marked === 0) return AttackFailReason.OutOfRange;
    if (distance < (card.minRange ?? 0)) return AttackFailReason.TooClose;
    const ignoresCover = card.effects.some(({ kind }) => kind === EffectKind.IgnoreCover);
    if (!hasLineOfSight(match.grid, hero.position, target.position, ignoresCover)) return AttackFailReason.NoLineOfSight;
    if (!ignoresCover && coverAgainst(match.grid, hero.position, target.position) === CoverKind.Full) return AttackFailReason.FullCover;
    return undefined;
  };
  const areaAttacks = attacks.filter(({ card }) => isAreaAttack(card));
  const aimed = attacks.filter(({ card }) => !isAreaAttack(card)).flatMap((attack) =>
    attack.card.effects.some(({ kind }) => kind === EffectKind.AttackTwice) ? [attack, attack] : [attack],
  );
  const reasons = aimed.map(({ hero, card, targetId }) => {
    const target = match.heroes.find((candidate) => candidate.id === targetId);
    return target ? missReason(hero, card, target) : AttackFailReason.NotVisible;
  });
  // Attacking gives away a Hidden Hero, whether or not the Attack lands.
  for (const { hero } of attacks) endHidden(tick, hero, events);
  const landed = aimed.filter(({ hero, card, targetId }, index) => {
    const reason = reasons[index];
    if (reason) {
      const first = events.length;
      events.push({ kind: EventKind.AttackFailed, tick, heroId: hero.id, targetId, reason });
      tagCardEvents(match, events, first, hero, card);
    }
    return reason === undefined;
  });
  for (const { hero, card, targetId } of landed) {
    const first = events.length;
    const target = match.heroes.find((candidate) => candidate.id === targetId)!;
    const distance = chebyshevDistance(hero.position, target.position);
    const ignoresCover = card.effects.some(({ kind }) => kind === EffectKind.IgnoreCover);
    const halfCover =
      coverAgainst(match.grid, hero.position, target.position) === CoverKind.Half && !ignoresCover;
    const damageEffect = effectFor(card.effects.find(({ kind }) => kind === EffectKind.Damage)!, hero.scrap);
    const closeRange = card.effects.find(({ kind }) => kind === EffectKind.CloseRangeBonus);
    const closeBonus = distance === 1 ? (closeRange?.amount ?? 0) : 0;
    // A Hidden Hero that shoots beyond the normal Range deals +1 damage.
    const far = card.effects.find(({ kind }) => kind === EffectKind.FarShot);
    const farBonus = far && distance > (far.amount ?? 0) && hiddenAttackers.has(hero.id) ? 1 : 0;
    const damage = (damageEffect.amount ?? 0) + closeBonus + farBonus;
    const incoming = Math.max(0, damage - (halfCover ? HALF_COVER_REDUCTION : 0));
    const piercing = card.effects.some(({ kind }) => kind === EffectKind.PiercingDamage);
    dealDamage(match, tick, hero, target, incoming, events, { piercing });
    if (halfCover && damage > 0) flagHalfCover(events, first);
    flagCloseBonus(events, first, closeBonus);
    for (const effect of card.effects.filter(({ kind }) => kind === EffectKind.ApplySlow)) {
      applySlow(tick, hero, target, effect, events);
    }
    for (const effect of card.effects.filter(({ kind }) => kind === EffectKind.ApplyMarked)) {
      applyMarked(tick, hero, target, effect, events);
    }
    for (const effect of card.effects.filter(({ kind }) => kind === EffectKind.Knockback)) {
      pushAway(match, tick, hero, target, effect.amount ?? 0, events);
    }
    tagCardEvents(match, events, first, hero, card);
  }
  // Area Attacks come after the other damage of the Tick, so Cover they destroy still protected against it.
  for (const attack of areaAttacks) {
    const first = events.length;
    resolveAreaAttack(match, tick, attack, events);
    tagCardEvents(match, events, first, attack.hero, attack.card, attack.tile);
  }
}

/**
 * Urban Renewal on a tile: needs Range, no Line of Sight (it is thrown). Every Hero in the area takes the damage, allies
 * and the caster included, whatever Cover it stands behind; then all Cover in the area is destroyed. A card that
 * destroyed Cover gives its Hero Scrap for the rest of the Round.
 */
function resolveAreaAttack(match: MatchState, tick: number, { hero, card, tile }: Attack, events: MatchEvent[]): void {
  if (!tile || chebyshevDistance(hero.position, tile) > (card.range ?? 0)) {
    events.push({ kind: EventKind.AttackFailed, tick, heroId: hero.id, reason: AttackFailReason.OutOfRange });
    return;
  }
  const blast = card.effects.find(({ kind }) => kind === EffectKind.AreaDamage)!;
  const tiles = areaTiles(match.grid, tile, blast.size ?? 1);
  events.push({ kind: EventKind.AreaBlasted, tick, heroId: hero.id, to: { ...tile }, amount: blast.size ?? 1 });
  for (const target of match.heroes) {
    if (target.exhausted || !tiles.some((covered) => samePosition(covered, target.position))) continue;
    dealDamage(match, tick, hero, target, blast.amount ?? 0, events);
  }
  let destroyed = 0;
  for (const covered of tiles) {
    if (coverAt(match.grid, covered) === CoverKind.None) continue;
    destroyCoverAt(match, tick, hero, covered, events);
    destroyed++;
  }
  if (destroyed > 0 && !hero.scrap) {
    hero.scrap = true;
    events.push({ kind: EventKind.ScrapGained, tick, heroId: hero.id, to: { ...tile } });
  }
}

/** Destroys the Cover (Half or Full, Placed or original) on a tile; does nothing on a tile without Cover. */
function destroyCoverAt(match: MatchState, tick: number, hero: HeroState, tile: GridPosition, events: MatchEvent[]): void {
  if (coverAt(match.grid, tile) === CoverKind.None) return;
  match.grid = destroyCover(match.grid, tile);
  match.placedCover = match.placedCover.filter((placed) => !samePosition(placed.position, tile));
  events.push({ kind: EventKind.CoverDestroyed, tick, heroId: hero.id, to: { ...tile } });
}

/** Moves `target` up to `distance` tiles in `direction`, one event per tile, and stops early at a Wall (or Wall corner), a Full Cover tile, another Hero or the edge of the Grid. */
function slideHero(
  match: MatchState,
  tick: number,
  target: HeroState,
  direction: { col: number; row: number },
  distance: number,
  events: MatchEvent[],
  casterId: string,
): void {
  for (let step = 0; step < distance; step++) {
    const to = { col: target.position.col + direction.col, row: target.position.row + direction.row };
    const blocked =
      !isStepAllowed(target.position, to, match.grid) ||
      coverAt(match.grid, to) === CoverKind.Full ||
      match.heroes.some((other) => !other.exhausted && samePosition(other.position, to));
    if (blocked) return;
    events.push({ kind: EventKind.Pull, tick, heroId: target.id, from: { ...target.position }, to, casterId });
    target.position = to;
  }
}

/** Knockback: `target` is pushed up to `distance` tiles directly away from `caster`, and stops like a pulled Hero does. */
function pushAway(match: MatchState, tick: number, caster: HeroState, target: HeroState, distance: number, events: MatchEvent[]): void {
  if (target.exhausted) return;
  const direction = { col: Math.sign(target.position.col - caster.position.col), row: Math.sign(target.position.row - caster.position.row) };
  slideHero(match, tick, target, direction, distance, events, caster.id);
}

/** Charge: the caster walks up to `distance` tiles toward `target` and stops next to it, or earlier at an obstacle (Step events, like a Move). */
function chargeAt(match: MatchState, tick: number, caster: HeroState, target: HeroState, distance: number, events: MatchEvent[]): void {
  for (let step = 0; step < distance && chebyshevDistance(caster.position, target.position) > 1; step++) {
    const to = stepTowards(caster.position, target.position);
    const blocked =
      !isStepAllowed(caster.position, to, match.grid) ||
      coverAt(match.grid, to) === CoverKind.Full ||
      match.heroes.some((other) => other !== caster && !other.exhausted && samePosition(other.position, to));
    if (blocked) break;
    events.push({ kind: EventKind.Step, tick, heroId: caster.id, from: { ...caster.position }, to });
    caster.position = to;
  }
  events.push({ kind: EventKind.Charged, tick, heroId: caster.id, targetId: target.id });
}

interface UtilityUse {
  match: MatchState;
  tick: number;
  card: CardDefinition;
  effect: CardEffect;
  /** The Hero that plays the card. */
  caster: HeroState;
  /** The Hero the card is aimed at: the caster itself or a visible enemy. */
  target: HeroState;
  /** For Site Survey, Temporary Solution and Heavy Metal: the tile aimed at. */
  tile?: GridPosition;
  events: MatchEvent[];
}

/**
 * Puts Cover on a tile without Cover. It stays until destroyed; when the Squad already has the maximum of
 * Placed Cover tiles, its oldest one is removed first (shown as a destroyed Cover).
 */
function placeCover(use: UtilityUse, position: GridPosition, requireEmpty: boolean): void {
  const { match, tick, effect, caster, events } = use;
  const occupied = match.heroes.some((other) => !other.exhausted && samePosition(other.position, position));
  if (isWall(position) || tileAt(match.grid, position) === undefined || coverAt(match.grid, position) !== CoverKind.None || (requireEmpty && occupied)) {
    events.push({ kind: EventKind.ActionFailed, tick, heroId: caster.id });
    return;
  }
  const own = match.placedCover.filter((placed) => placed.squad === caster.squad);
  if (own.length >= MAX_PLACED_COVER_PER_SQUAD) {
    const oldest = own[0]!;
    match.placedCover = match.placedCover.filter((placed) => placed !== oldest);
    match.grid = destroyCover(match.grid, oldest.position);
    events.push({ kind: EventKind.CoverDestroyed, tick, heroId: caster.id, to: { ...oldest.position } });
  }
  match.placedCover.push({ squad: caster.squad, position: { ...position } });
  match.grid = withTile(match.grid, position, effect.cover === CoverKind.Full ? TileKind.FullCover : TileKind.HalfCover);
  events.push({ kind: EventKind.CoverPlaced, tick, heroId: caster.id, to: { ...position }, ...(effect.cover === CoverKind.Full ? { full: true } : {}) });
}

/** One interpreter per Utility effect kind (ADR 0018); new Utility effects add an entry here. */
const UTILITY_EFFECTS: Record<(typeof PLAYABLE_UTILITY_EFFECTS)[number], (use: UtilityUse) => void> = {
  [EffectKind.GainShield]: ({ tick, effect, caster, target, events }) => {
    const amount = effect.amount ?? 0;
    target.shield += amount;
    events.push({ kind: EventKind.ShieldGained, tick, heroId: target.id, amount, casterId: caster.id });
  },
  // Site Survey: the Squad sees the area for `duration` Resolutions, this one included; range was checked with the target.
  [EffectKind.RevealArea]: ({ match, tick, effect, caster, tile, events }) => {
    const size = effect.size ?? 1;
    if (!tile || tileAt(match.grid, tile) === undefined) {
      events.push({ kind: EventKind.ActionFailed, tick, heroId: caster.id });
      return;
    }
    match.revealedAreas.push({ squad: caster.squad, center: { ...tile }, size, remaining: effect.duration ?? 1 });
    events.push({ kind: EventKind.AreaRevealed, tick, heroId: caster.id, to: { ...tile }, amount: size });
  },
  // Temporary Solution needs an empty tile.
  [EffectKind.PlaceCover]: (use) => {
    if (use.tile) placeCover(use, use.tile, true);
    else use.events.push({ kind: EventKind.ActionFailed, tick: use.tick, heroId: use.caster.id });
  },
  // Heavy Metal: the Scrap Field lasts `duration` Resolutions, this one included; range was checked with the target.
  [EffectKind.ScrapField]: ({ match, tick, card, effect, caster, tile, events }) => {
    const size = effect.size ?? 1;
    if (!tile || tileAt(match.grid, tile) === undefined) {
      events.push({ kind: EventKind.ActionFailed, tick, heroId: caster.id });
      return;
    }
    match.scrapFields.push({ squad: caster.squad, casterId: caster.id, card: card.name, center: { ...tile }, size, remaining: effect.duration ?? 1, damage: effect.amount ?? 0 });
    events.push({ kind: EventKind.FieldPlaced, tick, heroId: caster.id, to: { ...tile }, amount: size });
  },
  // Pull: the enemy slides toward the caster. Charge: the caster gains its Shield first, then closes in.
  [EffectKind.Pull]: ({ match, tick, effect, caster, target, events }) => {
    const direction = {
      col: Math.sign(caster.position.col - target.position.col),
      row: Math.sign(caster.position.row - target.position.row),
    };
    slideHero(match, tick, target, direction, effect.amount ?? 0, events, caster.id);
  },
  [EffectKind.Charge]: ({ match, tick, effect, caster, target, events }) => {
    const shield = effect.shield ?? 0;
    if (shield > 0) {
      caster.shield += shield;
      events.push({ kind: EventKind.ShieldGained, tick, heroId: caster.id, amount: shield, casterId: caster.id });
    }
    chargeAt(match, tick, caster, target, effect.amount ?? 0, events);
  },
  // Vanish: Hidden wherever the Hero stands.
  [EffectKind.BecomeHidden]: ({ tick, effect, caster, events }) => {
    caster.hidden = effect.duration ?? 1;
    events.push({ kind: EventKind.HiddenGained, tick, heroId: caster.id });
  },
};

/**
 * Plays a Utility card in its Tick. The target must be the caster (self cards) or another, not yet
 * Exhausted Hero of the same Squad (ally cards); otherwise the action fails without effect.
 */
function resolveUtility(
  match: MatchState,
  tick: number,
  caster: HeroState,
  card: CardDefinition,
  targetId: string,
  tile: GridPosition | undefined,
  ghostTile: GridPosition | undefined,
  events: MatchEvent[],
): void {
  const target = match.heroes.find((candidate) => candidate.id === targetId);
  // Site Survey, Temporary Solution and Heavy Metal reach as far as the card's Range (no Line of Sight needed).
  const inCardRange = (position: GridPosition | undefined) =>
    position !== undefined && chebyshevDistance(caster.position, position) <= (card.range ?? Infinity);
  let validTarget: boolean;
  switch (card.target) {
    case CardTarget.VisibleEnemy:
      validTarget =
        target !== undefined && !target.exhausted && target.squad !== caster.squad && canSquadSeeHero(match, caster.squad, target) &&
        (card.range === undefined || inCardRange(target.position));
      break;
    // A Ghost counts while the enemy still stands on the tile where the Squad last saw it (the memory of the Resolution's start).
    case CardTarget.VisibleOrGhostEnemy:
      validTarget =
        target !== undefined && !target.exhausted && target.squad !== caster.squad &&
        (canSquadSeeHero(match, caster.squad, target) || (ghostTile !== undefined && samePosition(target.position, ghostTile))) &&
        inCardRange(target.position);
      break;
    case CardTarget.SelfHero:
      validTarget = target === caster;
      break;
    // A card aimed at a tile or an area is confirmed on the caster itself.
    default:
      validTarget = target === caster && inCardRange(tile);
  }
  if (!validTarget || !isPlayableUtility(card)) {
    events.push({ kind: EventKind.ActionFailed, tick, heroId: caster.id });
    return;
  }
  for (const effect of card.effects) {
    UTILITY_EFFECTS[effect.kind as (typeof PLAYABLE_UTILITY_EFFECTS)[number]]({
      match, tick, card, effect: effectFor(effect, caster.scrap), caster, target: target!, tile, events,
    });
  }
}

/** Ends one Resolution for revealed areas and Scrap Fields (Placed Cover does not expire). */
function expireTemporaryEffects(match: MatchState): void {
  for (const area of match.revealedAreas) area.remaining -= 1;
  match.revealedAreas = match.revealedAreas.filter((area) => area.remaining > 0);
  for (const field of match.scrapFields) field.remaining -= 1;
  match.scrapFields = match.scrapFields.filter((field) => field.remaining > 0);
}

const otherSquad = (squad: SquadId) => (squad === SquadId.Left ? SquadId.Right : SquadId.Left);

/**
 * Attack and Defend (ADR 0022): the Attacker takes control with a Hero in the Zone and at least as many Heroes as
 * the Defender (a tie goes to the Attacker). Otherwise the Defender holds the Zone with more Heroes there; with
 * nobody in it the previous controller keeps it. Only the Attacker's control counts towards a win.
 */
function attackAndDefendController(
  previous: SquadId | undefined,
  attacker: SquadId,
  attackers: number,
  defenders: number,
  tie: ZoneTie,
): SquadId | undefined {
  if (attackers > 0 && (attackers > defenders || (attackers === defenders && tie === ZoneTie.Attacker))) return attacker;
  return defenders > attackers || (attackers > 0 && attackers === defenders) ? otherSquad(attacker) : previous;
}

/** Zone Decay (Attack and Defend, off by default): each Hero that ends the Resolution in the Zone loses cards from its Deck to the Exile. */
function applyZoneDecay(match: MatchState): void {
  const { mode } = match;
  const cards = mode.kind === MatchMode.AttackAndDefend ? (mode.zoneDecay ?? ZONE_DECAY_CARDS) : 0;
  if (cards === 0) return;
  for (const hero of match.heroes) {
    if (hero.exhausted || tileAt(REACTOR_DECK, hero.position) !== TileKind.PrimeZone) continue;
    for (let i = 0; i < cards && hero.deck.length > 0; i++) hero.exile.push(hero.deck.pop()!);
  }
}

/**
 * Updates Prime Zone control and checks the victory conditions at the end of a Resolution
 * (ADR 0010, ADR 0011, ADR 0019). Squad loss is checked first: an Exhausted Squad cannot win by keeping
 * control on a tie. Sets `match.result` when the match is over.
 */
function evaluateMatchEnd(match: MatchState, events: MatchEvent[], tick: number): void {
  const { mode } = match;
  const attacker = mode.kind === MatchMode.AttackAndDefend ? otherSquad(mode.defender) : undefined;
  if (attacker) {
    const controller = attackAndDefendController(
      match.primeZone.controller,
      attacker,
      heroesIn(match, attacker, PRIME_ZONE_TILES),
      heroesIn(match, otherSquad(attacker), PRIME_ZONE_TILES),
      mode.kind === MatchMode.AttackAndDefend ? (mode.zoneTie ?? DEFENDER_ZONE_TIE) : DEFENDER_ZONE_TIE,
    );
    match.primeZone =
      controller === undefined
        ? { progress: 0 }
        : { controller, progress: controller === match.primeZone.controller ? match.primeZone.progress + 1 : 1 };
  } else {
    scoreZones(match, events, tick);
  }

  const deckTotals = {
    [SquadId.Left]: 0,
    [SquadId.Right]: 0,
  };
  for (const hero of match.heroes) deckTotals[hero.squad] += hero.deck.length;
  const classicTotals = attacker
    ? {}
    : {
        scores: { ...match.scores },
        cardTotals: { [SquadId.Left]: cardsNotExiled(match, SquadId.Left), [SquadId.Right]: cardsNotExiled(match, SquadId.Right) },
      };
  const end = (reason: MatchEndReason, winner?: SquadId) => {
    match.result = { ...(winner ? { winner } : {}), reason, round: match.round, deckTotals, ...classicTotals };
  };
  /** The higher score wins; equal scores go to the larger number of cards not in the Exile; still equal is a draw. */
  const winnerOnPoints = (): SquadId | undefined => {
    for (const totals of [match.scores, ...(classicTotals.cardTotals ? [classicTotals.cardTotals] : [])]) {
      if (totals[SquadId.Left] !== totals[SquadId.Right]) return totals[SquadId.Left] > totals[SquadId.Right] ? SquadId.Left : SquadId.Right;
    }
    return undefined;
  };

  const lost = SQUADS.filter((squad) => match.heroes.filter((hero) => hero.squad === squad).every((hero) => hero.exhausted));
  if (lost.length === 2) return end(MatchEndReason.AllHeroesExhausted);
  if (lost.length === 1) return end(MatchEndReason.AllHeroesExhausted, otherSquad(lost[0]!));
  if (attacker) {
    if (match.primeZone.progress >= PRIME_ZONE_WIN_RESOLUTIONS && match.primeZone.controller === attacker) {
      return end(MatchEndReason.PrimeZoneHeld, match.primeZone.controller);
    }
    const roundLimit = mode.kind === MatchMode.AttackAndDefend ? (mode.roundLimit ?? DEFENDER_ROUND_LIMIT) : DEFENDER_ROUND_LIMIT;
    if (match.round >= roundLimit) end(MatchEndReason.DefenceHeld, otherSquad(attacker));
    return;
  }
  if (SQUADS.some((squad) => match.scores[squad] >= CREDITS_TO_WIN)) return end(MatchEndReason.Credits, winnerOnPoints());
  if (match.round >= ROUND_LIMIT) end(MatchEndReason.RoundLimit, winnerOnPoints());
}

/** The number of non-Exhausted Heroes of a Squad standing on the given tiles. */
function heroesIn(match: MatchState, squad: SquadId, tiles: readonly GridPosition[]): number {
  return match.heroes.filter(
    (hero) => hero.squad === squad && !hero.exhausted && tiles.some((tile) => tile.col === hero.position.col && tile.row === hero.position.row),
  ).length;
}

/**
 * Classic mode: the control of every zone at the end of a Resolution and the Credits it earns. More
 * non-Exhausted Heroes control a zone; equal numbers with at least one each is Contested; an inactive zone
 * has no control and scores nothing.
 */
function scoreZones(match: MatchState, events: MatchEvent[], tick: number): void {
  const classic = match.mode.kind === MatchMode.Classic ? match.mode : undefined;
  const factor = classic?.takeoverBonusFactor ?? TAKEOVER_BONUS_FACTOR;
  const cooldown = classic?.takeoverCooldown ?? TAKEOVER_COOLDOWN;
  ZONES.forEach((zone, i) => {
    const before = match.zoneControl[i]!.controller;
    const cooling = match.takeoverCooldown[i]! > 0;
    match.takeoverCooldown[i] = Math.max(0, match.takeoverCooldown[i]! - 1);
    if (match.round < zone.unlockRound) {
      match.zoneControl[i] = { contested: false };
      return;
    }
    const left = heroesIn(match, SquadId.Left, zone.tiles);
    const right = heroesIn(match, SquadId.Right, zone.tiles);
    const controller = left > right ? SquadId.Left : right > left ? SquadId.Right : undefined;
    match.zoneControl[i] = controller ? { controller, contested: false } : { contested: left > 0 };
    if (!controller) return;
    match.scores[controller] += zone.value;
    // A takeover is a flip from the enemy's control; Contested or empty before is not one.
    if (before === undefined || before === controller) return;
    const bonus = cooling ? 0 : zone.value * factor;
    if (!cooling) match.takeoverCooldown[i] = cooldown;
    match.scores[controller] += bonus;
    events.push({ kind: EventKind.ZoneTakenOver, tick, heroId: "", squad: controller, zone: i, amount: bonus });
  });
}

/** Cards of the Squad's Heroes that are not in the Exile: Deck, Discard and Hand. */
export const cardsNotExiled =(match: MatchState, squad: SquadId): number =>
  match.heroes.filter((hero) => hero.squad === squad).reduce((sum, hero) => sum + hero.deck.length + hero.discard.length + hero.hand.length, 0);

interface HeroQueue {
  heroId: string;
  /** One entry per planned action; `undefined` marks an action that is illegal and fails (ADR 0013). */
  queue: readonly (QueuedAction | undefined)[];
  /** The Hand cards that leave the Hand: each at most once, and only cards the Hero holds. */
  spent: CardIndex[];
}

/** The card an action plays. */
const playedCard = (hero: HeroState, action: { card: CardIndex }): CardDefinition => HERO_DECKS[hero.heroClass][action.card]!;

/**
 * Drops what the host should have validated, so the simulation is safe on its own: a card that is not in
 * the Hand or was already used this Round, and every action beyond the Queue limit, fails without
 * affecting the other actions. Pitched cards are claimed first, like in `validatePlan`.
 */
function legalQueues(match: MatchState, plans: readonly SquadPlan[]): HeroQueue[] {
  return plans.flatMap((plan) =>
    plan.heroes.flatMap(({ heroId, queue, pitched = [] }) => {
      const hero = match.heroes.find((candidate) => candidate.id === heroId);
      if (!hero) return [];
      const spent: CardIndex[] = [];
      const claim = (card: CardIndex) => {
        if (!hero.hand.includes(card) || spent.includes(card)) return false;
        spent.push(card);
        return true;
      };
      pitched.forEach(claim);
      const legal = queue.map((action, index) => {
        if (index >= MAX_QUEUE_LENGTH) return undefined;
        if (action.kind === ActionKind.Wait) return action;
        if (!claim(action.card)) return undefined;
        return action;
      });
      return [{ heroId, queue: legal, spent }];
    }),
  );
}

/**
 * Plays out the plans: Tick n resolves the n-th action of every Hero's Queue. Cards used in a Queue
 * leave the Hand for the Discard, whether the action succeeds or fails. An action that is illegal
 * (card not in the Hand, used twice, beyond the Queue limit) fails and costs nothing.
 */
export function resolveRound(previous: MatchState, plans: readonly SquadPlan[]): ResolutionResult {
  const match = structuredClone(previous);
  const queues = legalQueues(match, plans);
  const events: MatchEvent[] = [];
  const perceivedBy: SquadId[][] = [];
  const withheld: Record<number, Partial<Record<SquadId, readonly WithheldField[]>>> = {};
  // Judged at the end of each Tick, when Heroes stand where the Tick left them; also feeds Ghost memory.
  const endTick = () => {
    const first = perceivedBy.length;
    perceivedBy.push(...perceivers(match, events, first));
    Object.assign(withheld, withheldFields(match, events, perceivedBy, first));
    recordSightings(match);
  };

  // Cargo Hook can name a Ghost: it aims at what the Squad remembered when the Resolution began, not at later sightings.
  const ghostTiles = structuredClone(match.ghosts);
  const ticks = Math.max(0, ...queues.map(({ queue }) => queue.length));
  for (let tick = 1; tick <= ticks; tick++) {
    const actions = match.heroes.filter((hero) => !hero.exhausted).flatMap((hero) => {
      const queue = queues.find(({ heroId }) => heroId === hero.id)?.queue;
      if (queue && tick <= queue.length && !queue[tick - 1]) {
        events.push({ kind: EventKind.ActionFailed, tick, heroId: hero.id });
      }
      const action = queue?.[tick - 1];
      return action ? [{ hero, action }] : [];
    });
    for (const { hero, action } of actions) {
      if (action.kind === ActionKind.Wait) events.push({ kind: EventKind.Wait, tick, heroId: hero.id });
    }
    for (const { hero, action } of actions) {
      if (action.kind !== ActionKind.Primary) continue;
      const card = playedCard(hero, action);
      if (card.type !== CardType.Utility) continue;
      const first = events.length;
      resolveUtility(match, tick, hero, card, action.target, action.tile, ghostTiles[hero.squad][action.target]?.position, events);
      tagCardEvents(match, events, first, hero, card);
    }
    const movers = actions.flatMap(({ hero, action }) => {
      if (action.kind !== ActionKind.Move) return [];
      return [{ heroId: hero.id, destination: action.destination, distance: MOVE_DISTANCE }];
    });
    resolveMoves(match, tick, movers, events);
    const attacks: Attack[] = actions.flatMap(({ hero, action }) =>
      action.kind === ActionKind.Primary && playedCard(hero, action).type === CardType.Attack
        ? [{
            hero,
            card: playedCard(hero, action),
            targetId: action.target,
            tile: action.tile,
          }]
        : [],
    );
    resolveAttacks(match, tick, attacks, events);
    endTick();
  }

  // Pitched and queued cards leave the Hand for the Discard; Energy and Shield expire with the Round.
  for (const { heroId, spent } of queues) {
    const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
    if (hero.exhausted) continue;
    for (const card of spent) {
      hero.hand.splice(hero.hand.indexOf(card), 1);
      hero.discard.push(card);
    }
  }
  for (const hero of match.heroes) {
    hero.shield = 0;
    hero.slow = Math.max(0, hero.slow - 1);
    hero.hidden = Math.max(0, hero.hidden - 1);
    hero.marked = Math.max(0, hero.marked - 1);
    hero.scrap = false;
  }
  expireTemporaryEffects(match);
  // An empty Deck is refilled from the Discard right now. Exhaustion takes effect only after that, when no
  // card is left to take or draw, so a Hero whose cards ran out mid-Resolution finished its Queue (ADR 0006).
  for (const hero of match.heroes.filter((candidate) => !candidate.exhausted)) {
    const shuffled = refillDeck(match, hero);
    if (shuffled > 0) events.push({ kind: EventKind.DeckShuffled, tick: Math.max(ticks, 1), heroId: hero.id, amount: shuffled });
  }
  applyZoneDecay(match);
  for (const hero of match.heroes.filter((candidate) => !candidate.exhausted && candidate.deck.length === 0)) {
    hero.exhausted = true;
    match.grid = withWreck(match.grid, hero.position);
    events.push({ kind: EventKind.Exhausted, tick: Math.max(ticks, 1), heroId: hero.id });
  }
  evaluateMatchEnd(match, events, Math.max(ticks, 1));
  endTick();
  return { match, events, perceivedBy, withheld };
}

/**
 * The events a Squad may perceive; the only source of events for a client, so hidden information never
 * has to be removed in the UI. A Squad perceives an event when one of its own Heroes is involved (it acts
 * or is the target), or when it sees, at the end of the event's Tick, a tile the event touched: the tiles
 * a Hero stepped from or to, and where the acting and the targeted Hero stand. Being attacked by an
 * enemy out of sight therefore reveals which Hero attacked, but not where it stands.
 */
export function getSquadEvents(squad: SquadId, resolution: ResolutionResult): MatchEvent[] {
  return structuredClone(
    resolution.events.flatMap((event, i) => {
      if (!resolution.perceivedBy[i]!.includes(squad)) return [];
      const withheld = resolution.withheld[i]?.[squad] ?? [];
      if (withheld.length === 0) return [event];
      const shown = { ...event };
      for (const field of withheld) delete shown[field];
      return [shown];
    }),
  );
}
