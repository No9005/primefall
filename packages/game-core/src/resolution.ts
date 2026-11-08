// Resolution of a Round (ADR 0013, ADR 0020). Pure and deterministic: the same Match State and plans
// always give the same result. Only Move actions exist so far.

import {
  type CardDefinition,
  type CardEffect,
  type CardIndex,
  cardInMode,
  CardTarget,
  damageAtDistance,
  CardType,
  EffectKind,
  EffectRecipient,
  HERO_DECKS,
  isAreaAttack,
  isGhostAttack,
  isPlayableCard,
  isPlayableUtility,
  isTileAttack,
  isTileBlast,
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
  VICTORY_POINTS_TO_WIN,
  ZONE_DECAY_CARDS,
  ZoneTie,
} from "./host";
import { canSquadSee, canSquadSeeHero, type HeroState, type MatchState, recordSightings, refillDeck, sightRange, ZONES } from "./match";
import {
  ActionKind,
  BLOCK_SHIELD,
  chebyshevDistance,
  MAX_QUEUE_LENGTH,
  MOVE_DISTANCE,
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
}

const SQUADS = [SquadId.Left, SquadId.Right];
const PRIME_ZONE_TILES = findTiles(REACTOR_DECK, TileKind.PrimeZone);

/** Tiles a Slowed Hero's Move covers at most (Move 1). */
const SLOWED_MOVE_DISTANCE = 1;

/** Slow applied in a Resolution lasts until the end of the next one: that is `duration` Resolutions after this. */
function applySlow(tick: number, source: HeroState, target: HeroState, effect: CardEffect, events: MatchEvent[]): void {
  target.slow = (effect.duration ?? 1) + 1;
  events.push({ kind: EventKind.SlowApplied, tick, heroId: source.id, targetId: target.id });
}

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
 * Crossfire raises the incoming damage before Shield absorbs. Piercing Damage skips the Shield.
 * Shield absorbs first; the rest is Deck Damage: the top cards, one per point, leave the cycle (Exile) so the
 * damage lasts. When the Deck runs out on the way, the Discard is shuffled into it and the damage goes on.
 * Then the events read: AttackHit (cards burned so far), DeckShuffled, AttackHit (the rest).
 */
function dealDamage(match: MatchState, tick: number, source: HeroState, target: HeroState, baseDamage: number, events: MatchEvent[], piercing = false): void {
  let crossfire = crossfireBonus(match, tick, source, target);
  const incoming = baseDamage + crossfire;
  // Piercing Damage (Crossfire bonus included) leaves the Shield untouched.
  const absorbed = piercing ? 0 : Math.min(target.shield, incoming);
  target.shield -= absorbed;
  let remaining = incoming - absorbed;
  let burned = 0;
  let alreadyAbsorbed = absorbed;
  const reportHit = () => {
    events.push({ kind: EventKind.AttackHit, tick, heroId: source.id, targetId: target.id, absorbed: alreadyAbsorbed, damage: burned, crossfire });
    crossfire = 0;
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

/** The events a card causes carry its name and the Overdrive flag (not Block, Steps, shuffles or the end of Hidden). */
const CARD_EVENT_KINDS: ReadonlySet<EventKind> = new Set([
  EventKind.AttackHit, EventKind.AttackFailed, EventKind.SlowApplied, EventKind.MarkedApplied, EventKind.HiddenGained,
  EventKind.Knockback, EventKind.CoverPlaced, EventKind.CoverDestroyed, EventKind.AreaRevealed,
  EventKind.CoverReductionIgnored, EventKind.AttackBonusGained, EventKind.ShieldGained,
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
  overdrive: boolean | undefined,
  tile?: GridPosition,
): void {
  for (const event of events.slice(first)) {
    if (!CARD_EVENT_KINDS.has(event.kind)) continue;
    event.card = card.name;
    if (overdrive) event.overdrive = true;
    if (event.kind !== EventKind.AttackHit && event.kind !== EventKind.AttackFailed) continue;
    // A miss on a target the Squad cannot see must not reveal how far away it stands.
    if (event.reason === AttackFailReason.NotVisible) continue;
    const target = match.heroes.find((hero) => hero.id === event.targetId);
    const aimedAt = target?.position ?? tile;
    if (aimedAt) event.distance = chebyshevDistance(caster.position, aimedAt);
    if (tile) event.tile = { ...tile };
  }
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
  /** Tiles the Move covers at most: 2, or more after Reposition. */
  distance: number;
}

interface Attack {
  hero: HeroState;
  card: CardDefinition;
  targetId: string;
  /** For a Ghost Shot: the last known position of the targeted Ghost, as remembered when the Resolution began. */
  ghostTile?: GridPosition;
  /** Set when a Ghost Shot found nobody on its tile. */
  missed?: boolean;
  /** For a tile Attack (Breach Charge): the targeted tile. */
  tile?: GridPosition;
  /** The card was played in Overdrive. */
  overdrive?: boolean;
}

const samePosition = (a: GridPosition, b: GridPosition) => a.col === b.col && a.row === b.row;

/**
 * Resolves one Tick of Move actions. Heroes walk through each other, but a Move must end on a free tile; where
 * it stops is decided by `resolveWalks` (ADR 0013). Positions change only after the whole Tick is decided.
 */
function resolveMoves(match: MatchState, tick: number, movers: Mover[], events: MatchEvent[]): void {
  // A Slowed Hero's Move 2 becomes a Move 1, and that uses the Slow up.
  const slowedIds = new Set<string>();
  for (const { heroId } of movers) {
    const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
    if (hero.slow === 0) continue;
    hero.slow = 0;
    slowedIds.add(heroId);
    events.push({ kind: EventKind.SlowUsed, tick, heroId });
  }
  const outcomes = resolveWalks(
    new Map(match.heroes.filter((hero) => !hero.exhausted).map((hero) => [hero.id, hero.position])),
    movers.map((mover) => ({ ...mover, distance: slowedIds.has(mover.heroId) ? SLOWED_MOVE_DISTANCE : mover.distance })),
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
  for (const { heroId } of movers) {
    match.heroes.find((hero) => hero.id === heroId)!.position = { ...outcomes.get(heroId)!.path.at(-1)! };
  }
}

/**
 * Resolves one Tick of Attacks against the positions at the end of the Tick's movement. Every Attack is
 * checked before any damage is applied, so simultaneous Attacks all resolve, even between Heroes that
 * lose their last card in this Tick. A failed Attack (Range, Line of Sight, Exhausted target) does nothing.
 */
function resolveAttacks(match: MatchState, tick: number, attacks: Attack[], events: MatchEvent[]): void {
  // The first check an Attack on `target` fails, in the order of ADR 0013; visibility is only asked of a Declared Target.
  const missReason = (hero: HeroState, card: CardDefinition, target: HeroState, needsSight: boolean) => {
    if (target.squad === hero.squad) return AttackFailReason.NotVisible;
    if (needsSight && !canSquadSeeHero(match, hero.squad, target)) return AttackFailReason.NotVisible;
    if (target.exhausted) return AttackFailReason.TargetExhausted;
    if (chebyshevDistance(hero.position, target.position) > (card.range ?? 0)) return AttackFailReason.OutOfRange;
    if (!hasLineOfSight(match.grid, hero.position, target.position)) return AttackFailReason.NoLineOfSight;
    if (coverAgainst(match.grid, hero.position, target.position) === CoverKind.Full) return AttackFailReason.FullCover;
    return undefined;
  };
  const canReach = (hero: HeroState, card: CardDefinition, target: HeroState) =>
    missReason(hero, card, target, false) === undefined;
  // An area Attack hits every enemy Hero it reaches and does nothing when there is none.
  // A Ghost Shot goes to a tile: it hits the enemy standing there when it resolves, or nobody.
  const isTileCard = (card: CardDefinition) => isTileAttack(card) || isTileBlast(card);
  const tileAttacks = attacks.filter(({ card }) => isTileCard(card));
  const aimed = attacks.filter(({ card }) => !isTileCard(card)).flatMap((attack) => {
    if (isAreaAttack(attack.card)) {
      return match.heroes.filter((target) => canReach(attack.hero, attack.card, target)).map((target) => ({ ...attack, targetId: target.id }));
    }
    if (!isGhostAttack(attack.card)) return [attack];
    const occupant = match.heroes.find(
      (other) =>
        other.squad !== attack.hero.squad &&
        !other.exhausted &&
        attack.ghostTile !== undefined &&
        samePosition(other.position, attack.ghostTile),
    );
    return [{ ...attack, targetId: occupant?.id ?? attack.targetId, missed: occupant === undefined }];
  });
  // Attacking gives away a Hidden Hero, whether or not the Attack lands.
  for (const { hero } of attacks) endHidden(tick, hero, events);
  const landed = aimed.filter(({ hero, card, targetId, missed, overdrive }) => {
    const target = match.heroes.find((candidate) => candidate.id === targetId);
    let reason = target ? missReason(hero, card, target, !isGhostAttack(card) && !isAreaAttack(card)) : AttackFailReason.NotVisible;
    if (missed) reason = AttackFailReason.EmptyTile;
    if (reason) {
      const first = events.length;
      events.push({ kind: EventKind.AttackFailed, tick, heroId: hero.id, targetId, reason });
      tagCardEvents(match, events, first, hero, card, overdrive);
    }
    return reason === undefined;
  });
  for (const { hero, card, targetId, overdrive } of landed) {
    const first = events.length;
    const target = match.heroes.find((candidate) => candidate.id === targetId)!;
    const distance = chebyshevDistance(hero.position, target.position);
    const ignoresHalfCover = card.effects.some(({ kind }) => kind === EffectKind.IgnoreHalfCover);
    const halfCover =
      coverAgainst(match.grid, hero.position, target.position) === CoverKind.Half && !ignoresHalfCover && !hero.ignoresHalfCover;
    const damageEffect = card.effects.find(({ kind }) => kind === EffectKind.Damage || kind === EffectKind.DamageAtLongRange)!;
    const damage = damageAtDistance(damageEffect, distance) + hero.attackBonus;
    const incoming = Math.max(0, damage - (halfCover ? HALF_COVER_REDUCTION : 0));
    const piercing = card.effects.some(({ kind }) => kind === EffectKind.PiercingDamage);
    dealDamage(match, tick, hero, target, incoming, events, piercing);
    if (halfCover && damage > 0) flagHalfCover(events, first);
    for (const effect of card.effects.filter(({ kind }) => kind === EffectKind.ApplySlow)) {
      applySlow(tick, hero, target, effect, events);
    }
    for (const effect of card.effects.filter(({ kind }) => kind === EffectKind.ApplyMarked)) {
      applyMarked(tick, hero, target, effect, events);
    }
    tagCardEvents(match, events, first, hero, card, overdrive);
  }
  // Tile Attacks come after the other damage of the Tick, so Cover they destroy still protected against it.
  for (const attack of tileAttacks) {
    const first = events.length;
    resolveTileAttack(match, tick, attack, events);
    tagCardEvents(match, events, first, attack.hero, attack.card, attack.overdrive, attack.tile);
  }
  // Knockback comes after all damage of the Tick, in Hero order, so an earlier push can block a later one.
  for (const { hero, card, targetId, overdrive } of landed) {
    const push = card.effects.find(({ kind }) => kind === EffectKind.Knockback);
    if (!push) continue;
    const first = events.length;
    knockBack(match, tick, hero, match.heroes.find((candidate) => candidate.id === targetId)!, push.amount ?? 0, events);
    tagCardEvents(match, events, first, hero, card, overdrive);
  }
}

/**
 * Breach Charge on a tile: needs Range and Line of Sight to the tile, otherwise it fails. It damages the
 * enemy Hero standing there, with Cover applying as it does for any Attack (Full Cover blocks the damage,
 * Half Cover reduces it), and then destroys Half Cover on the tile. Full Cover stays.
 */
function resolveTileAttack(match: MatchState, tick: number, { hero, card, tile }: Attack, events: MatchEvent[]): void {
  if (!tile || chebyshevDistance(hero.position, tile) > (card.range ?? 0)) {
    events.push({ kind: EventKind.AttackFailed, tick, heroId: hero.id, reason: AttackFailReason.OutOfRange });
    return;
  }
  if (!hasLineOfSight(match.grid, hero.position, tile)) {
    events.push({ kind: EventKind.AttackFailed, tick, heroId: hero.id, reason: AttackFailReason.NoLineOfSight });
    return;
  }
  if (isTileBlast(card)) {
    // The blast hurts every Hero on the tile and the adjacent tiles, allies and the caster included; Cover does not protect.
    const blast = card.effects.find(({ kind }) => kind === EffectKind.DamageHeroesAtAndAroundTarget)!;
    const caught = match.heroes.filter((other) => !other.exhausted && chebyshevDistance(other.position, tile) <= 1);
    for (const victim of caught) dealDamage(match, tick, hero, victim, (blast.amount ?? 0) + hero.attackBonus, events);
  } else {
    const occupant = match.heroes.find((other) => other.squad !== hero.squad && !other.exhausted && samePosition(other.position, tile));
    const cover = coverAgainst(match.grid, hero.position, tile);
    if (occupant && cover === CoverKind.Full) {
      events.push({ kind: EventKind.AttackFailed, tick, heroId: hero.id, targetId: occupant.id, reason: AttackFailReason.FullCover });
    } else if (occupant) {
      const amount = (card.effects.find(({ kind }) => kind === EffectKind.Damage)?.amount ?? 0) + hero.attackBonus;
      const reduced = cover === CoverKind.Half && !hero.ignoresHalfCover;
      const first = events.length;
      dealDamage(match, tick, hero, occupant, Math.max(0, amount - (reduced ? HALF_COVER_REDUCTION : 0)), events);
      if (reduced && amount > 0) flagHalfCover(events, first);
    }
  }
  const destroysAny = isTileBlast(card);
  if (destroysAny ? coverAt(match.grid, tile) !== CoverKind.None : coverAt(match.grid, tile) === CoverKind.Half) {
    match.grid = destroyCover(match.grid, tile);
    events.push({ kind: EventKind.CoverDestroyed, tick, heroId: hero.id, to: { ...tile } });
  }
}

/**
 * Pushes `target` up to `distance` tiles directly away from `attacker`, one event per tile. It stops early,
 * without error, before a Wall (or Wall corner), a Full Cover tile, another Hero or the edge of the Grid.
 */
function knockBack(
  match: MatchState,
  tick: number,
  attacker: HeroState,
  target: HeroState,
  distance: number,
  events: MatchEvent[],
): void {
  const direction = {
    col: Math.sign(target.position.col - attacker.position.col),
    row: Math.sign(target.position.row - attacker.position.row),
  };
  for (let step = 0; step < distance; step++) {
    const to = { col: target.position.col + direction.col, row: target.position.row + direction.row };
    const blocked =
      !isStepAllowed(target.position, to) ||
      coverAt(match.grid, to) === CoverKind.Full ||
      match.heroes.some((other) => !other.exhausted && samePosition(other.position, to));
    if (blocked) return;
    events.push({ kind: EventKind.Knockback, tick, heroId: target.id, from: { ...target.position }, to });
    target.position = to;
  }
}

interface UtilityUse {
  match: MatchState;
  tick: number;
  card: CardDefinition;
  effect: CardEffect;
  /** The Hero that plays the card. */
  caster: HeroState;
  /** The Hero the card is aimed at: the caster itself, an allied Hero or a visible enemy. */
  target: HeroState;
  /** The second allied Hero of an Overdrive that affects two (Aegis Protocol). */
  secondTarget?: HeroState;
  /** For Forward Deploy: the tile the allied Hero heads for. For Scout Drone and Deploy Cover: the tile aimed at. */
  tile?: GridPosition;
  events: MatchEvent[];
}

/** Puts temporary Half Cover on a tile without Cover; the tile gets its kind back when `duration` Resolutions are over. */
function placeHalfCover(use: UtilityUse, position: GridPosition, requireEmpty: boolean): void {
  const { match, tick, effect, caster, events } = use;
  const occupied = match.heroes.some((other) => !other.exhausted && samePosition(other.position, position));
  if (isWall(position) || tileAt(match.grid, position) === undefined || coverAt(match.grid, position) !== CoverKind.None || (requireEmpty && occupied)) {
    events.push({ kind: EventKind.ActionFailed, tick, heroId: caster.id });
    return;
  }
  match.placedCover.push({
    squad: caster.squad,
    position: { ...position },
    originalKind: tileAt(match.grid, position)!,
    remaining: effect.duration ?? 1,
  });
  match.grid = withTile(match.grid, position, TileKind.HalfCover);
  events.push({ kind: EventKind.CoverPlaced, tick, heroId: caster.id, to: { ...position } });
}

/** One interpreter per Utility effect kind (ADR 0018); new Utility effects add an entry here. */
const UTILITY_EFFECTS: Record<(typeof PLAYABLE_UTILITY_EFFECTS)[number], (use: UtilityUse) => void> = {
  [EffectKind.GainShield]: ({ tick, effect, caster, target, secondTarget, events }) => {
    const receiver =
      effect.recipient === EffectRecipient.SecondTarget ? secondTarget! : effect.recipient === EffectRecipient.Self ? caster : target;
    const amount = effect.amount ?? 0;
    receiver.shield += amount;
    events.push({ kind: EventKind.ShieldGained, tick, heroId: receiver.id, amount, casterId: caster.id });
  },
  // Scout Drone: the Squad sees the area for `duration` Resolutions, this one included; range was checked with the target.
  [EffectKind.RevealArea]: ({ match, tick, effect, caster, tile, events }) => {
    const size = effect.size ?? 1;
    if (!tile || tileAt(match.grid, tile) === undefined) {
      events.push({ kind: EventKind.ActionFailed, tick, heroId: caster.id });
      return;
    }
    match.revealedAreas.push({ squad: caster.squad, center: { ...tile }, size, remaining: effect.duration ?? 1 });
    events.push({ kind: EventKind.AreaRevealed, tick, heroId: caster.id, to: { ...tile }, amount: size });
  },
  // Deploy Cover needs an empty tile; Fortify covers the tile the allied Hero stands on.
  [EffectKind.PlaceHalfCover]: (use) => {
    const fortify = use.card.target === CardTarget.AllyHeroTile;
    const position = fortify ? use.target.position : use.tile;
    if (position) placeHalfCover(use, position, !fortify);
    else use.events.push({ kind: EventKind.ActionFailed, tick: use.tick, heroId: use.caster.id });
  },
  // From this Tick on, so Attacks resolved in earlier Ticks of the Round keep the reduction.
  [EffectKind.RemoveHalfCoverReduction]: ({ tick, caster, target, events }) => {
    target.ignoresHalfCover = true;
    events.push({ kind: EventKind.CoverReductionIgnored, tick, heroId: caster.id, targetId: target.id });
  },
  [EffectKind.ApplySlow]: ({ tick, effect, caster, target, events }) => applySlow(tick, caster, target, effect, events),
  [EffectKind.PreventHidden]: ({ target }) => {
    target.hiddenPrevented = true;
  },
  // Hidden needs Cover where the Hero stands; Suppress in the same Round prevents it.
  [EffectKind.BecomeHidden]: ({ match, tick, effect, caster, events }) => {
    if (caster.hiddenPrevented || coverAt(match.grid, caster.position) === CoverKind.None) {
      events.push({ kind: EventKind.ActionFailed, tick, heroId: caster.id });
      return;
    }
    caster.hidden = effect.duration ?? 1;
    events.push({ kind: EventKind.HiddenGained, tick, heroId: caster.id });
  },
  // The ally takes an additional Move of `amount` tiles towards the tile; Slow cuts it like any Move.
  [EffectKind.GrantExtraMove]: ({ match, tick, effect, caster, target, tile, events }) => {
    if (!tile || tileAt(match.grid, tile) === undefined || isWall(tile)) {
      events.push({ kind: EventKind.ActionFailed, tick, heroId: caster.id });
      return;
    }
    resolveMoves(match, tick, [{ heroId: target.id, destination: tile, distance: effect.amount ?? MOVE_DISTANCE }], events);
  },
  // Without a recipient the effect goes to the card's target; Adrenal Surge's Overdrive names both Heroes.
  [EffectKind.GainPermanentAttack]: ({ tick, effect, caster, target, events }) => {
    const receiver = effect.recipient === EffectRecipient.Self ? caster : target;
    const amount = effect.amount ?? 0;
    receiver.attackBonus += amount;
    events.push({ kind: EventKind.AttackBonusGained, tick, heroId: receiver.id, amount });
  },
  [EffectKind.ExtendMove]: ({ effect, caster }) => {
    caster.extendedMove = effect.amount;
  },
  [EffectKind.ApplyMarked]: ({ tick, effect, caster, target, events }) => applyMarked(tick, caster, target, effect, events),
  // Damage on a Utility card (Mark Target's Overdrive) ignores Cover; it only reaches `withinRange`.
  [EffectKind.Damage]: ({ match, tick, effect, caster, target, events }) => {
    const reaches = effect.withinRange === undefined || chebyshevDistance(caster.position, target.position) <= effect.withinRange;
    if (reaches) dealDamage(match, tick, caster, target, effect.amount ?? 0, events);
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
  secondTargetId: string | undefined,
  tile: GridPosition | undefined,
  events: MatchEvent[],
): void {
  const target = match.heroes.find((candidate) => candidate.id === targetId);
  const secondTarget = match.heroes.find((candidate) => candidate.id === secondTargetId);
  // Mark Target needs the enemy within this Hero's own sight range (9 while Hidden), which also finds Hidden enemies.
  const inOwnSight = (enemy: HeroState) =>
    chebyshevDistance(caster.position, enemy.position) <= sightRange(caster) &&
    hasLineOfSight(match.grid, caster.position, enemy.position);
  const isAlly = (hero: HeroState | undefined) => hero !== undefined && !hero.exhausted && hero.squad === caster.squad && hero !== caster;
  // Scout Drone and Fortify reach as far as the card's Range (no Line of Sight needed).
  const inCardRange = (position: GridPosition | undefined) =>
    position !== undefined && chebyshevDistance(caster.position, position) <= (card.range ?? Infinity);
  const needsSecond = card.effects.some(({ recipient }) => recipient === EffectRecipient.SecondTarget);
  let validTarget: boolean;
  switch (card.target) {
    case CardTarget.VisibleEnemy:
      validTarget = target !== undefined && !target.exhausted && target.squad !== caster.squad && canSquadSeeHero(match, caster.squad, target);
      break;
    case CardTarget.EnemyInSight:
      validTarget = target !== undefined && !target.exhausted && target.squad !== caster.squad && inOwnSight(target);
      break;
    case CardTarget.SelfHero:
      validTarget = target === caster;
      break;
    case CardTarget.Area:
      validTarget = target === caster && inCardRange(tile);
      break;
    case CardTarget.EmptyTile:
      validTarget = target === caster;
      break;
    case CardTarget.AllyHeroTile:
      validTarget = isAlly(target) && inCardRange(target!.position);
      break;
    default:
      validTarget = isAlly(target) && (!needsSecond || (isAlly(secondTarget) && secondTarget !== target));
  }
  if (!validTarget || !isPlayableUtility(card)) {
    events.push({ kind: EventKind.ActionFailed, tick, heroId: caster.id });
    return;
  }
  for (const effect of card.effects) {
    UTILITY_EFFECTS[effect.kind as (typeof PLAYABLE_UTILITY_EFFECTS)[number]]({
      match, tick, card, effect, caster, target: target!, secondTarget, tile, events,
    });
  }
}

/**
 * Ends one Resolution for placed Cover and revealed areas. Expired Cover gives the tile its kind back,
 * unless the Cover was destroyed in the meantime (the tile then stays open floor).
 */
function expireTemporaryEffects(match: MatchState): void {
  for (const cover of match.placedCover) {
    cover.remaining -= 1;
    if (cover.remaining > 0) continue;
    if (coverAt(match.grid, cover.position) === CoverKind.Half) {
      match.grid = withTile(match.grid, cover.position, cover.originalKind);
    }
  }
  match.placedCover = match.placedCover.filter((cover) => cover.remaining > 0);
  for (const area of match.revealedAreas) area.remaining -= 1;
  match.revealedAreas = match.revealedAreas.filter((area) => area.remaining > 0);
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
  if (SQUADS.some((squad) => match.scores[squad] >= VICTORY_POINTS_TO_WIN)) return end(MatchEndReason.VictoryPoints, winnerOnPoints());
  if (match.round >= ROUND_LIMIT) end(MatchEndReason.RoundLimit, winnerOnPoints());
}

/** The number of non-Exhausted Heroes of a Squad standing on the given tiles. */
function heroesIn(match: MatchState, squad: SquadId, tiles: readonly GridPosition[]): number {
  return match.heroes.filter(
    (hero) => hero.squad === squad && !hero.exhausted && tiles.some((tile) => tile.col === hero.position.col && tile.row === hero.position.row),
  ).length;
}

/**
 * Classic mode: the control of every zone at the end of a Resolution and the Victory Points it earns. More
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
const cardsNotExiled = (match: MatchState, squad: SquadId): number =>
  match.heroes.filter((hero) => hero.squad === squad).reduce((sum, hero) => sum + hero.deck.length + hero.discard.length + hero.hand.length, 0);

interface HeroQueue {
  heroId: string;
  /** One entry per planned action; `undefined` marks an action that is illegal and fails (ADR 0013). */
  queue: readonly (QueuedAction | undefined)[];
  /** The Hand cards that leave the Hand: each at most once, and only cards the Hero holds. */
  spent: CardIndex[];
  /** The part of `spent` that was played in Overdrive: these go to the Exile instead of the Discard. */
  overdriven: CardIndex[];
}

/** The card an action plays, in the mode the action chose. */
const playedCard = (hero: HeroState, action: { card: CardIndex; overdrive?: boolean }): CardDefinition =>
  cardInMode(HERO_DECKS[hero.heroClass][action.card]!, action.overdrive);

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
      const overdriven: CardIndex[] = [];
      const legal = queue.map((action, index) => {
        if (index >= MAX_QUEUE_LENGTH) return undefined;
        if (action.kind === ActionKind.Wait) return action;
        // An Overdrive that does not exist or cannot be played yet is illegal and fails without spending the card.
        if (
          action.kind === ActionKind.Primary &&
          action.overdrive &&
          !isPlayableCard(HERO_DECKS[hero.heroClass][action.card]!, true)
        ) {
          return undefined;
        }
        if (!claim(action.card)) return undefined;
        if (action.kind === ActionKind.Primary && action.overdrive) overdriven.push(action.card);
        return action;
      });
      return [{ heroId, queue: legal, spent, overdriven }];
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
  // Judged at the end of each Tick, when Heroes stand where the Tick left them; also feeds Ghost memory.
  const endTick = () => {
    perceivedBy.push(...perceivers(match, events, perceivedBy.length));
    recordSightings(match);
  };

  // A Ghost Shot aims at what the Squad remembered when the Resolution began, not at later sightings.
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
    // Shield exists from its Tick on, so damage resolved later in the same Tick is absorbed by it.
    for (const { hero, action } of actions) {
      if (action.kind === ActionKind.Block) {
        hero.shield += BLOCK_SHIELD;
        events.push({ kind: EventKind.ShieldGained, tick, heroId: hero.id, amount: BLOCK_SHIELD });
      }
    }
    for (const { hero, action } of actions) {
      if (action.kind !== ActionKind.Primary) continue;
      const card = playedCard(hero, action);
      if (card.type !== CardType.Utility) continue;
      const first = events.length;
      resolveUtility(match, tick, hero, card, action.target, action.secondTarget, action.tile, events);
      tagCardEvents(match, events, first, hero, card, action.overdrive);
    }
    const movers = actions.flatMap(({ hero, action }) => {
      if (action.kind !== ActionKind.Move) return [];
      // Reposition stretches the next Move of the Queue only.
      const distance = hero.extendedMove ?? MOVE_DISTANCE;
      delete hero.extendedMove;
      return [{ heroId: hero.id, destination: action.destination, distance }];
    });
    resolveMoves(match, tick, movers, events);
    const attacks: Attack[] = actions.flatMap(({ hero, action }) =>
      action.kind === ActionKind.Primary && playedCard(hero, action).type === CardType.Attack
        ? [{
            hero,
            card: playedCard(hero, action),
            targetId: action.target,
            ghostTile: ghostTiles[hero.squad][action.target]?.position,
            tile: action.tile,
            overdrive: action.overdrive,
          }]
        : [],
    );
    resolveAttacks(match, tick, attacks, events);
    endTick();
  }

  // Pitched and queued cards leave the Hand for the Discard; Energy and Shield expire with the Round.
  // Cards played in Overdrive are Exiled and never return (ADR 0003).
  for (const { heroId, spent, overdriven } of queues) {
    const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
    if (hero.exhausted) continue;
    for (const card of spent) {
      hero.hand.splice(hero.hand.indexOf(card), 1);
      (overdriven.includes(card) ? hero.exile : hero.discard).push(card);
    }
  }
  for (const hero of match.heroes) {
    hero.shield = 0;
    hero.slow = Math.max(0, hero.slow - 1);
    hero.hidden = Math.max(0, hero.hidden - 1);
    hero.marked = Math.max(0, hero.marked - 1);
    hero.hiddenPrevented = false;
    hero.ignoresHalfCover = false;
    delete hero.extendedMove;
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
  return { match, events, perceivedBy };
}

/**
 * The events a Squad may perceive; the only source of events for a client, so hidden information never
 * has to be removed in the UI. A Squad perceives an event when one of its own Heroes is involved (it acts
 * or is the target), or when it sees, at the end of the event's Tick, a tile the event touched: the tiles
 * a Hero stepped from or to, and where the acting and the targeted Hero stand. Being attacked by an
 * enemy out of sight therefore reveals which Hero attacked, but not where it stands.
 */
export function getSquadEvents(squad: SquadId, resolution: ResolutionResult): MatchEvent[] {
  return structuredClone(resolution.events.filter((_, i) => resolution.perceivedBy[i]!.includes(squad)));
}
