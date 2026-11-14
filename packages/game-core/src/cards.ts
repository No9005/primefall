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
  /** An enemy Hero that is a Ghost for the Squad: the shot goes to its last known position (ADR 0005). */
  GhostEnemy = "ghostEnemy",
}

export enum EffectKind {
  Damage = "damage",
  ApplySlow = "applySlow",
  ApplyMarked = "applyMarked",
  Knockback = "knockback",
  DestroyHalfCover = "destroyHalfCover",
  DestroyAnyCover = "destroyAnyCover",
  IgnoreHalfCover = "ignoreHalfCover",
  /** The card's damage is Piercing Damage: it does not use up Shield and goes straight into Deck Damage. */
  PiercingDamage = "piercingDamage",
  GainShield = "gainShield",
  /** The Hero's next Move action in the Queue covers `amount` tiles instead of 2 (ADR 0020). */
  ExtendMove = "extendMove",
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
}

/** Index of a card in its Hero's fixed Deck list (`HERO_DECKS`). */
export type CardIndex = number;

/** Maximum Hand size a Draw fills up to. */
export const HAND_SIZE = 4;

/**
 * Cards whose Primary effect is only "deal damage to one visible enemy". These are the Attacks the
 * resolution can play so far; other effects follow with their own tickets.
 */
export function isSimpleAttack(card: CardDefinition): boolean {
  const [first, ...rest] = card.effects;
  return (
    card.type === CardType.Attack &&
    card.target === CardTarget.VisibleEnemy &&
    first?.kind === EffectKind.Damage &&
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

/** Ghost Shot: an Attack on a Ghost's last known position that deals damage to whoever stands there. */
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
  EffectKind.BecomeHidden,
  EffectKind.ExtendMove,
  EffectKind.GainPermanentAttack,
  EffectKind.RevealArea,
  EffectKind.PlaceCover,
  EffectKind.RemoveHalfCoverReduction,
  EffectKind.Pull,
  EffectKind.Charge,
] as const;

/**
 * Utility cards whose effects all have an interpreter and that are aimed at this Hero, an allied Hero (or its
 * tile), a visible enemy, a tile or an area. Tile and area cards are confirmed on this Hero.
 */
export function isPlayableUtility(card: CardDefinition): boolean {
  return (
    card.type === CardType.Utility &&
    (card.target === CardTarget.SelfHero ||
      card.target === CardTarget.AllyHero ||
      card.target === CardTarget.AllyHeroTile ||
      card.target === CardTarget.EmptyTile ||
      card.target === CardTarget.Area ||
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
 * Breach Charge: an Attack on a tile that damages the enemy Hero standing there and
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

/** Whether a card's Primary effect can be planned and resolved so far. */
export function isPlayableCard(card: CardDefinition): boolean {
  return isSimpleAttack(card) || isGhostAttack(card) || isAreaAttack(card) || isTileAttack(card) || isPlayableUtility(card);
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
  name: "Breach Charge", type: CardType.Attack, energyCost: 1, range: BRUISER_RANGE,
  target: CardTarget.Tile,
  effects: [damage(2), { kind: EffectKind.DestroyHalfCover }],
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
  name: "Shockwave", type: CardType.Attack, energyCost: 1, range: 1,
  target: CardTarget.EnemiesInRange, effects: [damage(2), knockback],
};
const bulwark: CardDefinition = {
  name: "Bulwark", type: CardType.Utility, energyCost: 1, target: CardTarget.SelfHero, effects: [shield(3)],
};
const reinforce: CardDefinition = {
  name: "Reinforce", type: CardType.Utility, energyCost: 1, target: CardTarget.AllyHero, effects: [shield(2)],
};
const adrenalSurge: CardDefinition = {
  name: "Adrenal Surge", type: CardType.Utility, energyCost: 1,
  target: CardTarget.SelfHero, effects: [{ kind: EffectKind.GainPermanentAttack, amount: 1 }],
};

const tagRound: CardDefinition = {
  name: "Tag Round", type: CardType.Attack, energyCost: 1, range: CONTROLLER_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(1), marked],
};
const scoutDrone: CardDefinition = {
  name: "Scout Drone", type: CardType.Utility, energyCost: 1, target: CardTarget.Area, // no Range: any tile of the map
  effects: [{ kind: EffectKind.RevealArea, size: 3, duration: 2 }],
};
const aegisProtocol: CardDefinition = {
  name: "Aegis Protocol", type: CardType.Utility, energyCost: 1,
  target: CardTarget.AllyHero, effects: [shield(3)],
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
  name: "Gravity Snare", type: CardType.Utility, energyCost: 1, target: CardTarget.VisibleEnemy, effects: [slow],
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
  name: "Shield Breaker", type: CardType.Attack, energyCost: 1, range: 4, minRange: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2), { kind: EffectKind.PiercingDamage }],
};
const longShot: CardDefinition = {
  name: "Long Shot", type: CardType.Attack, energyCost: 1, range: 7, minRange: 3,
  target: CardTarget.VisibleEnemy, effects: [damage(2)],
};
const ghostShot: CardDefinition = {
  name: "Ghost Shot", type: CardType.Attack, energyCost: 1, range: ASSASSIN_RANGE, minRange: 2,
  // Ghost Shot fires at the last known position of a Ghost.
  target: CardTarget.GhostEnemy, effects: [{ kind: EffectKind.TargetGhost }, damage(2)],
};
const executionRound: CardDefinition = {
  name: "Execution Round", type: CardType.Attack, energyCost: 1, range: ASSASSIN_RANGE, minRange: 2,
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
