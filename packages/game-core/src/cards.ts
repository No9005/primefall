// Card data for the three fixed Hero Decks (docs/specs/mvp-card-set.md, ADR 0009, ADR 0015).
// Effects are declarative descriptors; interpreting them belongs to the resolution rules.

import { CoverKind } from "./reactor-deck";

export enum HeroClass {
  Bruiser = "bruiser",
  Controller = "controller",
  Assassin = "assassin",
}

export enum CardType {
  Attack = "attack",
  Utility = "utility",
}

export enum CardTarget {
  VisibleEnemy = "visibleEnemy",
  EnemiesInRange = "enemiesInRange",
  SelfHero = "selfHero",
  AllyHero = "allyHero",
  AllyHeroTile = "allyHeroTile",
  Tile = "tile",
  EmptyTile = "emptyTile",
  Area = "area",
  EnemyInSight = "enemyInSight",
  /** An enemy Hero that is a Ghost for the Squad: the shot goes to its last known position (ADR 0005). */
  GhostEnemy = "ghostEnemy",
}

export enum EffectKind {
  Damage = "damage",
  DamageHeroesAtAndAroundTarget = "damageHeroesAtAndAroundTarget",
  DamageAtLongRange = "damageAtLongRange",
  ApplySlow = "applySlow",
  ApplyMarked = "applyMarked",
  Knockback = "knockback",
  DestroyHalfCover = "destroyHalfCover",
  DestroyAnyCover = "destroyAnyCover",
  IgnoreHalfCover = "ignoreHalfCover",
  /** The card's damage is Piercing Damage: it does not use up Shield and goes straight into Deck Damage. */
  PiercingDamage = "piercingDamage",
  GainShield = "gainShield",
  GrantExtraMove = "grantExtraMove",
  /** The Hero's next Move action in the Queue covers `amount` tiles instead of 2 (ADR 0020). */
  ExtendMove = "extendMove",
  PreventHidden = "preventHidden",
  GainPermanentAttack = "gainPermanentAttack",
  RevealArea = "revealArea",
  /** Placed Cover: stays until destroyed; `cover` picks the kind (Half unless stated). */
  PlaceCover = "placeCover",
  BecomeHidden = "becomeHidden",
  TargetGhost = "targetGhost",
  RemoveHalfCoverReduction = "removeHalfCoverReduction",
  /** Pull: the named enemy moves up to `amount` tiles directly toward the caster (stops like Knockback). */
  Pull = "pull",
  /** Charge: the caster moves up to `amount` tiles toward the named enemy and ends next to it, gains Shield and a Range 1 damage bonus. */
  Charge = "charge",
  /** The Attack deals `amount` more damage at Range 1 (the Bruiser's Slam Shot). */
  CloseRangeBonus = "closeRangeBonus",
}

/** Charge: Shield until the end of the Round, and extra damage of the next Attack at Range 1 in that Round. */
export const CHARGE_SHIELD = 1;
export const CHARGE_DAMAGE_BONUS = 1;

/** Who receives an effect that can apply either to the casting Hero or to the card's target. */
export enum EffectRecipient {
  Self = "self",
  Target = "target",
  /** The second allied Hero of an Overdrive that affects two (Aegis Protocol). */
  SecondTarget = "secondTarget",
}

export interface CardEffect {
  kind: EffectKind;
  /** Damage, Shield, tiles or bonus value, depending on the kind. */
  amount?: number;
  /** Number of Resolutions the effect lasts, where it is not "this round". */
  duration?: number;
  /** Side length of a square area. */
  size?: number;
  /** For Placed Cover: Full instead of the default Half. */
  cover?: CoverKind.Half | CoverKind.Full;
  /** For damage that is higher at long range: the damage at Range 6 or 7 (`amount` applies closer). */
  longRangeAmount?: number;
  /** The effect only applies when the target is within this many tiles. */
  withinRange?: number;
  /** Who receives the effect; defaults to the card's target. */
  recipient?: EffectRecipient;
}

export interface CardDefinition {
  name: string;
  type: CardType;
  energyCost: number;
  /** Range in tiles (Chebyshev); absent for cards that do not reach a target. */
  range?: number;
  /** Minimum Range in tiles: a target closer than this cannot be hit (a Miss with `TooClose`). Default 0. */
  minRange?: number;
  target: CardTarget;
  effects: readonly CardEffect[];
  /** Present only on cards with an Overdrive mode; replaces the standard effects (ADR 0003). */
  overdrive?: readonly CardEffect[];
  /** Target of the Overdrive when it differs from `target`. */
  overdriveTarget?: CardTarget;
}

/** Index of a card in its Hero's fixed Deck list (`HERO_DECKS`). */
export type CardIndex = number;

/** Maximum Hand size a Draw fills up to. */
export const HAND_SIZE = 4;

/**
 * The card as it is played in a mode: with `overdrive`, the Overdrive effects (and target) replace the
 * standard ones (ADR 0003). A card without an Overdrive keeps its standard effects, so callers check
 * `card.overdrive` first where the mode must exist.
 */
export function cardInMode(card: CardDefinition, overdrive: boolean | undefined): CardDefinition {
  if (!overdrive || !card.overdrive) return card;
  return { ...card, effects: card.overdrive, target: card.overdriveTarget ?? card.target };
}

/** Damage of a Damage-type effect at `distance` tiles: long-range damage applies from Range 6. */
export const LONG_RANGE_FROM = 6;
export function damageAtDistance(effect: CardEffect, distance: number): number {
  const longRange = effect.kind === EffectKind.DamageAtLongRange && distance >= LONG_RANGE_FROM;
  return (longRange ? effect.longRangeAmount : effect.amount) ?? 0;
}

/**
 * Cards whose Primary effect is only "deal damage to one visible enemy". These are the Attacks the
 * resolution can play so far; other effects follow with their own tickets.
 */
export function isSimpleAttack(card: CardDefinition): boolean {
  const [first, ...rest] = card.effects;
  return (
    card.type === CardType.Attack &&
    card.target === CardTarget.VisibleEnemy &&
    (first?.kind === EffectKind.Damage || first?.kind === EffectKind.DamageAtLongRange) &&
    rest.every(
      (effect) =>
        effect.kind === EffectKind.ApplySlow ||
        effect.kind === EffectKind.IgnoreHalfCover ||
        effect.kind === EffectKind.PiercingDamage ||
        effect.kind === EffectKind.CloseRangeBonus ||
        effect.kind === EffectKind.DestroyAnyCover ||
        effect.kind === EffectKind.ApplyMarked,
    )
  );
}

/** The Overdrive of Ghost Shot: an Attack on a Ghost's last known position that deals damage to whoever stands there. */
export function isGhostAttack(card: CardDefinition): boolean {
  const [first, second, ...rest] = card.effects;
  return (
    card.type === CardType.Attack &&
    card.target === CardTarget.GhostEnemy &&
    first?.kind === EffectKind.TargetGhost &&
    second?.kind === EffectKind.Damage &&
    rest.length === 0
  );
}

/** Utility effect kinds the resolution has an interpreter for; later Utility effects are added here. */
export const PLAYABLE_UTILITY_EFFECTS = [
  EffectKind.GainShield,
  EffectKind.ApplySlow,
  EffectKind.PreventHidden,
  EffectKind.BecomeHidden,
  EffectKind.ExtendMove,
  EffectKind.ApplyMarked,
  EffectKind.Damage,
  EffectKind.GrantExtraMove,
  EffectKind.GainPermanentAttack,
  EffectKind.RevealArea,
  EffectKind.PlaceCover,
  EffectKind.RemoveHalfCoverReduction,
  EffectKind.Pull,
  EffectKind.Charge,
] as const;

/**
 * Utility cards whose effects all have an interpreter and that are aimed at this Hero, an allied Hero (or its
 * tile), a visible enemy, an enemy in sight, a tile or an area. Tile and area cards are confirmed on this Hero.
 */
export function isPlayableUtility(card: CardDefinition): boolean {
  return (
    card.type === CardType.Utility &&
    (card.target === CardTarget.SelfHero ||
      card.target === CardTarget.AllyHero ||
      card.target === CardTarget.AllyHeroTile ||
      card.target === CardTarget.EmptyTile ||
      card.target === CardTarget.Area ||
      card.target === CardTarget.EnemyInSight ||
      card.target === CardTarget.VisibleEnemy) &&
    card.effects.every((effect) => (PLAYABLE_UTILITY_EFFECTS as readonly EffectKind[]).includes(effect.kind))
  );
}

/**
 * Attacks that hit every enemy Hero in Range (no chosen target): damage, then Knockback. The player
 * confirms them on the casting Hero, so the action's target is that Hero.
 */
export function isAreaAttack(card: CardDefinition): boolean {
  const [first, ...rest] = card.effects;
  return (
    card.type === CardType.Attack &&
    card.target === CardTarget.EnemiesInRange &&
    first?.kind === EffectKind.Damage &&
    rest.every((effect) => effect.kind === EffectKind.Knockback)
  );
}

/**
 * Breach Charge without Overdrive: an Attack on a tile that damages the enemy Hero standing there and
 * destroys Half Cover on it. The action carries the tile; its target is the casting Hero.
 */
export function isTileAttack(card: CardDefinition): boolean {
  const [first, second, ...rest] = card.effects;
  return (
    card.type === CardType.Attack &&
    card.target === CardTarget.Tile &&
    first?.kind === EffectKind.Damage &&
    second?.kind === EffectKind.DestroyHalfCover &&
    rest.length === 0
  );
}

/** The Overdrive of Breach Charge: destroys any Cover on a tile and damages every Hero on and around it. */
export function isTileBlast(card: CardDefinition): boolean {
  const [first, second, ...rest] = card.effects;
  return (
    card.type === CardType.Attack &&
    card.target === CardTarget.Tile &&
    first?.kind === EffectKind.DestroyAnyCover &&
    second?.kind === EffectKind.DamageHeroesAtAndAroundTarget &&
    rest.length === 0
  );
}

/**
 * Whether a card's Primary effect can be planned and resolved so far. Utility Overdrives with two allied
 * targets of the same kind (Aegis Protocol) or an area follow with their own tickets; an Overdrive aimed at
 * an ally is playable when every effect names its recipient (Adrenal Surge).
 */
export function isPlayableCard(card: CardDefinition, overdrive?: boolean): boolean {
  if (overdrive) {
    if (card.overdrive === undefined) return false;
    const mode = cardInMode(card, true);
    const allyWithRecipients =
      mode.target === CardTarget.AllyHero && mode.effects.every((effect) => effect.recipient !== undefined);
    return (
      isSimpleAttack(mode) ||
      isGhostAttack(mode) ||
      isAreaAttack(mode) ||
      isTileBlast(mode) ||
      ((mode.target === CardTarget.EnemyInSight || mode.target === CardTarget.Area || allyWithRecipients) &&
        isPlayableUtility(mode))
    );
  }
  return isSimpleAttack(card) || isAreaAttack(card) || isTileAttack(card) || isPlayableUtility(card);
}

const slow: CardEffect = { kind: EffectKind.ApplySlow, duration: 1 };
const marked: CardEffect = { kind: EffectKind.ApplyMarked, duration: 1 };
const knockback: CardEffect = { kind: EffectKind.Knockback, amount: 2 };
const damage = (amount: number): CardEffect => ({ kind: EffectKind.Damage, amount });
const shield = (amount: number): CardEffect => ({ kind: EffectKind.GainShield, amount });

// Hero ranges (ADR 0009); attack cards without an explicit range use their Hero's range.
const BRUISER_RANGE = 3;
const CONTROLLER_RANGE = 2;
const ASSASSIN_RANGE = 5;

// Range 1 to 2 (ADR 0025): 2 damage, 3 at Range 1.
const slamShot: CardDefinition = {
  name: "Slam Shot", type: CardType.Attack, energyCost: 1, range: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2), { kind: EffectKind.CloseRangeBonus, amount: 1 }],
};
const concussionRound: CardDefinition = {
  name: "Concussion Round", type: CardType.Attack, energyCost: 1, range: BRUISER_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(2), slow],
};
const breachCharge: CardDefinition = {
  name: "Breach Charge", type: CardType.Attack, energyCost: 2, range: BRUISER_RANGE,
  target: CardTarget.Tile,
  effects: [damage(2), { kind: EffectKind.DestroyHalfCover }],
  // Destroys any Cover and hurts every Hero on the target tile and around it, allies and the caster included.
  overdrive: [{ kind: EffectKind.DestroyAnyCover }, { kind: EffectKind.DamageHeroesAtAndAroundTarget, amount: 2 }],
};
// The Bruiser's tools to close in, to move enemies and to wreck Cover (ADR 0025).
export const charge: CardDefinition = {
  name: "Charge", type: CardType.Utility, energyCost: 1,
  target: CardTarget.VisibleEnemy, effects: [{ kind: EffectKind.Charge, amount: 3 }],
};
export const pull: CardDefinition = {
  name: "Pull", type: CardType.Utility, energyCost: 1, range: 4,
  target: CardTarget.VisibleEnemy, effects: [{ kind: EffectKind.Pull, amount: 2 }],
};
export const wreckingBlow: CardDefinition = {
  name: "Wrecking Blow", type: CardType.Attack, energyCost: 1, range: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2), { kind: EffectKind.DestroyAnyCover }],
};
const shockwave: CardDefinition = {
  name: "Shockwave", type: CardType.Attack, energyCost: 2, range: 1,
  target: CardTarget.EnemiesInRange, effects: [damage(2), knockback], overdrive: [damage(3), knockback],
};
const bulwark: CardDefinition = {
  name: "Bulwark", type: CardType.Utility, energyCost: 1, target: CardTarget.SelfHero, effects: [shield(3)],
};
const reinforce: CardDefinition = {
  name: "Reinforce", type: CardType.Utility, energyCost: 1, target: CardTarget.AllyHero, effects: [shield(2)],
};
const adrenalSurge: CardDefinition = {
  name: "Adrenal Surge", type: CardType.Utility, energyCost: 2,
  target: CardTarget.SelfHero, effects: [{ kind: EffectKind.GainPermanentAttack, amount: 1 }],
  // Overdrive: this Hero and an allied Hero each gain the permanent +1 Attack.
  overdriveTarget: CardTarget.AllyHero,
  overdrive: [
    { kind: EffectKind.GainPermanentAttack, amount: 1, recipient: EffectRecipient.Self },
    { kind: EffectKind.GainPermanentAttack, amount: 1, recipient: EffectRecipient.Target },
  ],
};

const tagRound: CardDefinition = {
  name: "Tag Round", type: CardType.Attack, energyCost: 1, range: CONTROLLER_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(1), marked], overdrive: [damage(1), marked, slow],
};
const scoutDrone: CardDefinition = {
  name: "Scout Drone", type: CardType.Utility, energyCost: 1, target: CardTarget.Area, // no Range: any tile of the map
  effects: [{ kind: EffectKind.RevealArea, size: 3, duration: 2 }],
  overdrive: [{ kind: EffectKind.RevealArea, size: 5, duration: 2 }],
};
// Overdrive: two allied Heroes each gain Shield 3.
const aegisProtocol: CardDefinition = {
  name: "Aegis Protocol", type: CardType.Utility, energyCost: 1,
  target: CardTarget.AllyHero, effects: [shield(3)],
  overdrive: [
    { ...shield(3), recipient: EffectRecipient.Target },
    { ...shield(3), recipient: EffectRecipient.SecondTarget },
  ],
};
const fortify: CardDefinition = {
  name: "Fortify", type: CardType.Utility, energyCost: 1, range: 3,
  target: CardTarget.AllyHeroTile, effects: [{ kind: EffectKind.PlaceCover }],
};
const deployCover: CardDefinition = {
  name: "Deploy Cover", type: CardType.Utility, energyCost: 1,
  target: CardTarget.EmptyTile, effects: [{ kind: EffectKind.PlaceCover }],
};
const barricade: CardDefinition = {
  name: "Barricade", type: CardType.Utility, energyCost: 1, range: 3,
  target: CardTarget.EmptyTile, effects: [{ kind: EffectKind.PlaceCover, cover: CoverKind.Full }],
};
const gravitySnare: CardDefinition = {
  name: "Gravity Snare", type: CardType.Utility, energyCost: 2, target: CardTarget.VisibleEnemy, effects: [slow],
};
const overwatchUplink: CardDefinition = {
  name: "Overwatch Uplink", type: CardType.Utility, energyCost: 1,
  target: CardTarget.AllyHero, effects: [{ kind: EffectKind.RemoveHalfCoverReduction }],
};

const precisionShot: CardDefinition = {
  name: "Precision Shot", type: CardType.Attack, energyCost: 1, range: ASSASSIN_RANGE, minRange: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2)],
};
const coverBreaker: CardDefinition = {
  name: "Cover Breaker", type: CardType.Attack, energyCost: 1, range: ASSASSIN_RANGE, minRange: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2), { kind: EffectKind.IgnoreHalfCover }],
};
const shieldBreaker: CardDefinition = {
  name: "Shield Breaker", type: CardType.Attack, energyCost: 2, range: 4, minRange: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2), { kind: EffectKind.PiercingDamage }],
};
const longShot: CardDefinition = {
  name: "Long Shot", type: CardType.Attack, energyCost: 1, range: 7, minRange: 3,
  target: CardTarget.VisibleEnemy, effects: [damage(2)],
  // Overdrive: 4 damage at Range 6 or 7, otherwise the usual 2.
  overdrive: [{ kind: EffectKind.DamageAtLongRange, amount: 2, longRangeAmount: 4 }],
};
const ghostShot: CardDefinition = {
  name: "Ghost Shot", type: CardType.Attack, energyCost: 1, range: ASSASSIN_RANGE, minRange: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2)],
  overdriveTarget: CardTarget.GhostEnemy,
  overdrive: [{ kind: EffectKind.TargetGhost }, damage(2)],
};
const executionRound: CardDefinition = {
  name: "Execution Round", type: CardType.Attack, energyCost: 2, range: ASSASSIN_RANGE, minRange: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(3), { kind: EffectKind.IgnoreHalfCover }],
};
const vanish: CardDefinition = {
  name: "Vanish", type: CardType.Utility, energyCost: 1,
  target: CardTarget.SelfHero, effects: [{ kind: EffectKind.BecomeHidden, duration: 2 }],
};
const reposition: CardDefinition = {
  name: "Reposition", type: CardType.Utility, energyCost: 1,
  target: CardTarget.SelfHero, effects: [{ kind: EffectKind.ExtendMove, amount: 3 }],
};

/**
 * The fixed Hero Decks (ADR 0025): Bruiser 12, Controller 10, Assassin 9 cards, in the order of the MVP card set. A
 * card is identified within its Hero by its index in this list, so identical cards stay distinct (for example in Hand or Exile).
 */
export const HERO_DECKS: Record<HeroClass, readonly CardDefinition[]> = {
  [HeroClass.Bruiser]: [
    slamShot, slamShot, concussionRound, breachCharge, shockwave, bulwark,
    bulwark, charge, charge, pull, adrenalSurge, wreckingBlow,
  ],
  [HeroClass.Controller]: [
    tagRound, scoutDrone, scoutDrone, aegisProtocol, reinforce,
    fortify, deployCover, barricade, gravitySnare, overwatchUplink,
  ],
  [HeroClass.Assassin]: [
    precisionShot, longShot, longShot, coverBreaker, shieldBreaker,
    ghostShot, executionRound, vanish, reposition,
  ],
};

/** The index of the `copy`-th (0-based) card called `name` in a Hero's Deck, so callers need not count positions. */
export function cardIndex(heroClass: HeroClass, name: string, copy = 0): CardIndex {
  const indices = HERO_DECKS[heroClass].flatMap((card, index) => (card.name === name ? [index] : []));
  const index = indices[copy];
  if (index === undefined) throw new Error(`${heroClass} has no card ${name} (copy ${copy})`);
  return index;
}
