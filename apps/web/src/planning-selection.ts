import {
  ActionKind,
  CardType,
  type CardDefinition,
  type CardEffect,
  type CardIndex,
  CardTarget,
  chebyshevDistance,
  CoverKind,
  coverAgainst,
  damageAtDistance,
  EffectKind,
  energyPool,
  LONG_RANGE_FROM,
  type Grid,
  type GridPosition,
  HALF_COVER_REDUCTION,
  HERO_DECKS,
  type HeroClass,
  isPlayableCard,
  MAX_QUEUE_LENGTH,
  type QueuedAction,
  queueEnergyCost,
  REACTOR_DECK,
} from "game-core";

export interface PlanningDraft {
  selectedId: string;
  queue: readonly QueuedAction[];
  pitched: readonly CardIndex[];
  armed: CardIndex | undefined;
}

/**
 * The Queue and the pitched cards belong to the selected Hero, so selecting another Hero discards them.
 * Selection is locked while the playback runs.
 */
export function selectHero(draft: PlanningDraft, heroId: string, playing: boolean): PlanningDraft {
  if (playing || heroId === draft.selectedId) return draft;
  return { selectedId: heroId, queue: [], pitched: [], armed: undefined };
}

/** What the Cover on a target's tile does against an attacker at `attacker`; `undefined` without protection. */
export function coverProtectionLabel(attacker: GridPosition, target: GridPosition, grid: Grid = REACTOR_DECK): string | undefined {
  switch (coverAgainst(grid, attacker, target)) {
    case CoverKind.Full:
      return "Full Cover · cannot be attacked";
    case CoverKind.Half:
      return `Half Cover · damage -${HALF_COVER_REDUCTION}`;
    default:
      return undefined;
  }
}

/** For a card whose damage depends on the Range (Long Shot's Overdrive): the damage against a target at `target`. */
export function rangeDamageLabel(card: CardDefinition, attacker: GridPosition, target: GridPosition): string | undefined {
  const effect = card.effects.find(({ kind }) => kind === EffectKind.DamageAtLongRange);
  if (!effect) return undefined;
  const distance = chebyshevDistance(attacker, target);
  const damage = damageAtDistance(effect, distance);
  return `Range ${distance} · ${damage} damage${distance >= LONG_RANGE_FROM ? " (long range bonus)" : ""}`;
}

function describeEffect(effect: CardEffect): string {
  const { amount, duration, size, longRangeAmount, withinRange } = effect;
  switch (effect.kind) {
    case EffectKind.Damage:
      return `${amount} damage`;
    case EffectKind.DamageHeroesAtAndAroundTarget:
      return `${amount} damage to Heroes at and around the target`;
    case EffectKind.DamageAtLongRange:
      return `${amount} damage, ${longRangeAmount} from Range ${LONG_RANGE_FROM}`;
    case EffectKind.ApplySlow:
      return `Slow for ${duration ?? 1} Resolution${duration === 1 || duration === undefined ? "" : "s"}`;
    case EffectKind.ApplyMarked:
      return `Marked, +${amount} damage taken${duration ? ` for ${duration} Resolutions` : ""}`;
    case EffectKind.Knockback:
      return `Knockback ${amount}${withinRange ? ` within ${withinRange} tiles` : ""}`;
    case EffectKind.DestroyHalfCover:
      return "destroys Half Cover";
    case EffectKind.DestroyAnyCover:
      return "destroys any Cover";
    case EffectKind.IgnoreHalfCover:
      return "ignores Half Cover";
    case EffectKind.GainShield:
      return `Shield ${amount}`;
    case EffectKind.GrantExtraMove:
      return `ally Moves ${amount} more tiles`;
    case EffectKind.ExtendMove:
      return `next Move covers ${amount} tiles`;
    case EffectKind.PreventHidden:
      return "prevents Hidden";
    case EffectKind.GainPermanentAttack:
      return `+${amount} Attack damage for the rest of the match`;
    case EffectKind.RevealArea:
      return `reveals a ${size}x${size} area`;
    case EffectKind.PlaceHalfCover:
      return "places Half Cover";
    case EffectKind.BecomeHidden:
      return "become Hidden";
    case EffectKind.TargetGhost:
      return "shoots a Ghost's last known position";
    case EffectKind.RemoveHalfCoverReduction:
      return "Half Cover does not reduce the damage";
  }
}

/** One line of card text for a mode of a card: its effects in order, `undefined` for a card without that mode. */
export function describeEffects(effects: readonly CardEffect[] | undefined): string | undefined {
  if (!effects || effects.length === 0) return undefined;
  const text = effects.map(describeEffect).join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What a card face shows besides its name and cost; the effect text always comes from the card data. */
export function cardFace(card: CardDefinition): { type: string; effectText: string } {
  const effectText = describeEffects(card.effects) ?? "";
  const overdriveText = describeEffects(card.overdrive);
  return {
    type: card.type === CardType.Attack ? "ATTACK" : "UTILITY",
    effectText: overdriveText ? `${effectText}. Overdrive: ${overdriveText}` : effectText,
  };
}

/** The short code a filled Queue slot shows. */
export function queueSlotCode(heroClass: HeroClass, action: QueuedAction): string {
  if (action.kind === ActionKind.Move) return "MOVE";
  if (action.kind === ActionKind.Block) return "BLK";
  if (action.kind === ActionKind.Wait) return "Wait";
  return HERO_DECKS[heroClass][action.card]!.type === CardType.Attack ? "ATK" : "UTL";
}

/** The Queue without the action in slot `index`; its Energy is available again because Spent follows the Queue. */
export function removeQueueAction(queue: readonly QueuedAction[], index: number): readonly QueuedAction[] {
  return queue.filter((_, i) => i !== index);
}

/** The Queue entries the tap flow and the drag flow both build, so one use of a card is one entry however it was chosen. */
export function moveAction(card: CardIndex, destination: GridPosition): QueuedAction {
  return { kind: ActionKind.Move, card, destination };
}

/** A Wait needs no card; it takes the first free slot of the Queue, and nothing is added to a full Queue. */
export function addWaitAction(queue: readonly QueuedAction[]): readonly QueuedAction[] {
  return queue.length >= MAX_QUEUE_LENGTH ? queue : [...queue, { kind: ActionKind.Wait }];
}

/** Whether the action spends the Hand card `card`; a Wait spends none. */
export function actionUsesCard(action: QueuedAction, card: CardIndex): boolean {
  return action.kind !== ActionKind.Wait && action.card === card;
}

export function blockAction(card: CardIndex): QueuedAction {
  return { kind: ActionKind.Block, card };
}

export function primaryAction(card: CardIndex, target: string, { tile, overdrive }: { tile?: GridPosition; overdrive?: boolean } = {}): QueuedAction {
  return { kind: ActionKind.Primary, card, target, ...(tile ? { tile } : {}), ...(overdrive ? { overdrive } : {}) };
}

/** One of the two faces offered when a card with an Overdrive mode is played on a target. */
export interface ModeFace {
  overdrive: boolean;
  effectText: string;
  energyCost: number;
  /** Set when this face cannot be chosen: why not. */
  reason?: string;
  /** Overdrive only: the card leaves the game after use (ADR 0003). */
  exiled: boolean;
}

/**
 * The Normal and the Overdrive face of a card played on a target, or `undefined` for a card without an
 * Overdrive mode (it plays immediately). `acceptsTarget` tells whether the chosen target is valid for a mode.
 */
export function modeChoiceFaces(
  heroClass: HeroClass,
  card: CardIndex,
  queue: readonly QueuedAction[],
  pitched: readonly CardIndex[],
  acceptsTarget: (overdrive: boolean) => boolean = () => true,
): [ModeFace, ModeFace] | undefined {
  const definition = HERO_DECKS[heroClass][card]!;
  if (!describeEffects(definition.overdrive)) return undefined;
  const face = (overdrive: boolean): ModeFace => ({
    overdrive,
    effectText: describeEffects(overdrive ? definition.overdrive : definition.effects) ?? "",
    energyCost: definition.energyCost,
    reason: cardUseReasons(heroClass, card, queue, pitched, overdrive)[CardUse.Primary] ?? (acceptsTarget(overdrive) ? undefined : "needs another target"),
    exiled: overdrive,
  });
  return [face(false), face(true)];
}

export enum CardUse {
  Primary = "primary",
  Pitch = "pitch",
  Move = "move",
  Block = "block",
}

export const CARD_USE_LABELS: Record<CardUse, string> = {
  [CardUse.Primary]: "Primary effect",
  [CardUse.Pitch]: "Pitch 1",
  [CardUse.Move]: "Move 2",
  [CardUse.Block]: "Block 2",
};

export interface AimState {
  card: CardDefinition;
  /** The card needs a highlighted tile (Breach Charge). */
  aimsAtTile: boolean;
  aimsAtAlly: boolean;
  /** Forward Deploy: the ally is picked, the tile it moves towards is next. */
  aimsAtDeployTile: boolean;
  needsSecondAlly: boolean;
  /** An ally has already been picked (Aegis Protocol Overdrive). */
  allyPicked: boolean;
}

/** One short line telling the player what to tap next while a card is aimed. */
export function targetHint({ card, aimsAtTile, aimsAtAlly, aimsAtDeployTile, needsSecondAlly, allyPicked }: AimState): string {
  if (card.target === CardTarget.Area) return "Tap a highlighted tile to reveal the area";
  if (card.target === CardTarget.EmptyTile) return "Tap a highlighted empty tile for Half Cover";
  if (aimsAtTile) return "Tap a highlighted tile to hit the Hero there";
  if (needsSecondAlly) return allyPicked ? "Tap the second allied Hero" : "Tap the first allied Hero";
  if (card.target === CardTarget.SelfHero) return "Tap this Hero to confirm";
  if (card.target === CardTarget.EnemiesInRange) return "Tap this Hero to hit all enemies in Range";
  if (card.target === CardTarget.GhostEnemy) return "Tap a Ghost to shoot its last position";
  if (aimsAtDeployTile) return "Tap the tile the ally moves to";
  if (aimsAtAlly) return "Tap an allied Hero";
  return "Tap an enemy Hero to attack";
}

export interface EnergyReadout {
  pitched: number;
  spent: number;
  available: number;
}

export function energyReadout(heroClass: HeroClass, queue: readonly QueuedAction[], pitched: readonly CardIndex[]): EnergyReadout {
  const total = energyPool(pitched);
  const spent = queueEnergyCost(heroClass, queue);
  return { pitched: total, spent, available: total - spent };
}

/** For each use of a card: `undefined` when it can be chosen, otherwise the reason it is disabled. */
export function cardUseReasons(
  heroClass: HeroClass,
  card: CardIndex,
  queue: readonly QueuedAction[],
  pitched: readonly CardIndex[],
  overdrive = false,
): Record<CardUse, string | undefined> {
  const queueFull = queue.length >= MAX_QUEUE_LENGTH ? "Queue is full" : undefined;
  const cost = HERO_DECKS[heroClass][card]!.energyCost;
  const { available } = energyReadout(heroClass, queue, pitched);
  return {
    [CardUse.Primary]:
      queueFull ??
      (!isPlayableCard(HERO_DECKS[heroClass][card]!, overdrive)
        ? overdrive
          ? "Overdrive is not playable yet"
          : "effect is not playable yet"
        : cost > available
          ? `needs ${cost} Energy`
          : undefined),
    [CardUse.Pitch]: undefined,
    [CardUse.Move]: queueFull,
    [CardUse.Block]: queueFull,
  };
}
