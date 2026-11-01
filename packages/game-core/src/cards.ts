// Card data for the three fixed Hero Decks (docs/specs/mvp-card-set.md, ADR 0009, ADR 0015).
// Effects are declarative descriptors; interpreting them belongs to the resolution rules.

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
  GainShield = "gainShield",
  GrantExtraMove = "grantExtraMove",
  PreventHidden = "preventHidden",
  GainPermanentAttack = "gainPermanentAttack",
  RevealArea = "revealArea",
  PlaceHalfCover = "placeHalfCover",
  BecomeHidden = "becomeHidden",
  TargetGhost = "targetGhost",
  RemoveHalfCoverReduction = "removeHalfCoverReduction",
}

/** Who receives an effect that can apply either to the casting Hero or to the card's target. */
export enum EffectRecipient {
  Self = "self",
  Target = "target",
}

export interface CardEffect {
  kind: EffectKind;
  /** Damage, Shield, tiles or bonus value, depending on the kind. */
  amount?: number;
  /** Number of Resolutions the effect lasts, where it is not "this round". */
  duration?: number;
  /** Side length of a square area. */
  size?: number;
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
  target: CardTarget;
  effects: readonly CardEffect[];
  /** Present only on cards with an Overdrive mode; replaces the standard effects (ADR 0003). */
  overdrive?: readonly CardEffect[];
  /** Target of the Overdrive when it differs from `target`. */
  overdriveTarget?: CardTarget;
}

/** Maximum Hand size a Draw fills up to. */
export const HAND_SIZE = 4;

const slow: CardEffect = { kind: EffectKind.ApplySlow, duration: 1 };
const marked: CardEffect = { kind: EffectKind.ApplyMarked, duration: 1 };
const knockback: CardEffect = { kind: EffectKind.Knockback, amount: 2 };
const damage = (amount: number): CardEffect => ({ kind: EffectKind.Damage, amount });
const shield = (amount: number): CardEffect => ({ kind: EffectKind.GainShield, amount });

// Hero ranges (ADR 0009); attack cards without an explicit range use their Hero's range.
const BRUISER_RANGE = 3;
const CONTROLLER_RANGE = 2;
const ASSASSIN_RANGE = 5;

const slamShot: CardDefinition = {
  name: "Slam Shot", type: CardType.Attack, energyCost: 1, range: BRUISER_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(2)],
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
const shockwave: CardDefinition = {
  name: "Shockwave", type: CardType.Attack, energyCost: 2, range: 1,
  target: CardTarget.EnemiesInRange, effects: [damage(2), knockback], overdrive: [damage(3), knockback],
};
const bulwark: CardDefinition = {
  name: "Bulwark", type: CardType.Utility, energyCost: 1, target: CardTarget.SelfHero, effects: [shield(3)],
};
const forwardDeploy: CardDefinition = {
  name: "Forward Deploy", type: CardType.Utility, energyCost: 1,
  target: CardTarget.AllyHero, effects: [{ kind: EffectKind.GrantExtraMove, amount: 2 }],
};
const suppress: CardDefinition = {
  name: "Suppress", type: CardType.Utility, energyCost: 1,
  target: CardTarget.VisibleEnemy, effects: [slow, { kind: EffectKind.PreventHidden }],
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

const pulseBolt: CardDefinition = {
  name: "Pulse Bolt", type: CardType.Attack, energyCost: 1, range: CONTROLLER_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(2)],
};
const tagRound: CardDefinition = {
  name: "Tag Round", type: CardType.Attack, energyCost: 1, range: CONTROLLER_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(1), marked], overdrive: [damage(1), marked, slow],
};
const shockPulse: CardDefinition = {
  name: "Shock Pulse", type: CardType.Attack, energyCost: 1, range: CONTROLLER_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(1), slow],
};
const scoutDrone: CardDefinition = {
  name: "Scout Drone", type: CardType.Utility, energyCost: 1, range: 4, target: CardTarget.Area,
  effects: [{ kind: EffectKind.RevealArea, size: 3, duration: 2 }],
  overdrive: [{ kind: EffectKind.RevealArea, size: 5, duration: 2 }],
};
// Overdrive: two allied Heroes each gain Shield 3.
const aegisProtocol: CardDefinition = {
  name: "Aegis Protocol", type: CardType.Utility, energyCost: 1,
  target: CardTarget.AllyHero, effects: [shield(3)], overdrive: [shield(3), shield(3)],
};
const fortify: CardDefinition = {
  name: "Fortify", type: CardType.Utility, energyCost: 1, range: 3,
  target: CardTarget.AllyHeroTile, effects: [{ kind: EffectKind.PlaceHalfCover, duration: 2 }],
};
const deployCover: CardDefinition = {
  name: "Deploy Cover", type: CardType.Utility, energyCost: 1,
  target: CardTarget.EmptyTile, effects: [{ kind: EffectKind.PlaceHalfCover, duration: 2 }],
};
const gravitySnare: CardDefinition = {
  name: "Gravity Snare", type: CardType.Utility, energyCost: 2, target: CardTarget.VisibleEnemy, effects: [slow],
};
const overwatchUplink: CardDefinition = {
  name: "Overwatch Uplink", type: CardType.Utility, energyCost: 1,
  target: CardTarget.AllyHero, effects: [{ kind: EffectKind.RemoveHalfCoverReduction }],
};

const precisionShot: CardDefinition = {
  name: "Precision Shot", type: CardType.Attack, energyCost: 1, range: ASSASSIN_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(2)],
};
const piercingRound: CardDefinition = {
  name: "Piercing Round", type: CardType.Attack, energyCost: 1, range: ASSASSIN_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(2), { kind: EffectKind.IgnoreHalfCover }],
};
const longShot: CardDefinition = {
  name: "Long Shot", type: CardType.Attack, energyCost: 1, range: 7,
  target: CardTarget.VisibleEnemy, effects: [damage(2)],
  // Overdrive: 4 damage at Range 6 or 7, otherwise the usual 2.
  overdrive: [{ kind: EffectKind.DamageAtLongRange, amount: 2, longRangeAmount: 4 }],
};
const ghostShot: CardDefinition = {
  name: "Ghost Shot", type: CardType.Attack, energyCost: 1, range: ASSASSIN_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(2)],
  overdrive: [{ kind: EffectKind.TargetGhost }, damage(2)],
};
const executionRound: CardDefinition = {
  name: "Execution Round", type: CardType.Attack, energyCost: 2, range: ASSASSIN_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(3)],
};
const vanish: CardDefinition = {
  name: "Vanish", type: CardType.Utility, energyCost: 1,
  target: CardTarget.SelfHero, effects: [{ kind: EffectKind.BecomeHidden, duration: 2 }],
};
const markTarget: CardDefinition = {
  name: "Mark Target", type: CardType.Utility, energyCost: 1,
  target: CardTarget.EnemyInSight, effects: [marked],
  // Overdrive: also 1 damage, but only within the Assassin's weapon range.
  overdrive: [marked, { ...damage(1), withinRange: ASSASSIN_RANGE }],
};
const reposition: CardDefinition = {
  name: "Reposition", type: CardType.Utility, energyCost: 1,
  target: CardTarget.SelfHero, effects: [{ kind: EffectKind.GrantExtraMove, amount: 3 }],
};

/**
 * The fixed 12-card Decks, in the order of the MVP card set. A card is identified within its Hero by
 * its index in this list, so identical cards stay distinct (for example in Hand or Exile).
 */
export const HERO_DECKS: Record<HeroClass, readonly CardDefinition[]> = {
  [HeroClass.Bruiser]: [
    slamShot, slamShot, concussionRound, concussionRound, breachCharge, shockwave,
    bulwark, bulwark, forwardDeploy, suppress, reinforce, adrenalSurge,
  ],
  [HeroClass.Controller]: [
    pulseBolt, pulseBolt, tagRound, shockPulse, scoutDrone, scoutDrone,
    aegisProtocol, fortify, deployCover, deployCover, gravitySnare, overwatchUplink,
  ],
  [HeroClass.Assassin]: [
    precisionShot, precisionShot, piercingRound, piercingRound, longShot, longShot,
    ghostShot, executionRound, vanish, vanish, markTarget, reposition,
  ],
};
