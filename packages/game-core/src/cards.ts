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
  SelfHero = "selfHero",
  Tile = "tile",
  EmptyTile = "emptyTile",
  Area = "area",
  /** A Visible enemy Hero, or a Ghost: the effect works if the Hero still stands on the Ghost's last known tile (Cargo Hook). */
  VisibleOrGhostEnemy = "visibleOrGhostEnemy",
}

export enum EffectKind {
  Damage = "damage",
  ApplySlow = "applySlow",
  ApplyMarked = "applyMarked",
  /** Destroys every Cover tile (Half or Full) of the area the Attack hits (Urban Renewal). */
  DestroyAnyCover = "destroyAnyCover",
  /** Damage to every Hero in a square of tiles round the aimed tile, allies included (Urban Renewal). */
  AreaDamage = "areaDamage",
  /** A square of tiles that Slows the Heroes in it and hurts them when they Move (Heavy Metal). */
  ScrapField = "scrapField",
  /** The Attack ignores all Cover: Half Cover does not reduce it, Full Cover does not block it or the Line of Sight (Shield Breaker). */
  IgnoreCover = "ignoreCover",
  /** The card's damage is Piercing Damage: it does not use up Shield and goes straight into Deck Damage. */
  PiercingDamage = "piercingDamage",
  GainShield = "gainShield",
  RevealArea = "revealArea",
  /** Placed Cover: stays until destroyed; `cover` picks the kind (Half unless stated). */
  PlaceCover = "placeCover",
  BecomeHidden = "becomeHidden",
  /** The Attack reaches beyond `amount` tiles (the normal Range) only for a Hidden caster or a Marked target; a Hidden caster deals +1 damage there (Long Shot). */
  FarShot = "farShot",
  /** Knockback: the Attack's target is pushed up to `amount` tiles directly away from the caster; it stops at a Wall, Full Cover or a Hero. */
  Knockback = "knockback",
  /** Pull: the named enemy moves up to `amount` tiles directly toward the caster; it stops at a Wall, Full Cover or a Hero. */
  Pull = "pull",
  /** Charge (Express Delivery): the caster first gains Shield `shield`, then moves up to `amount` tiles toward the named enemy and ends next to it. */
  Charge = "charge",
  /** The Attack deals `amount` more damage at Range 1 (Handle With Care, Buy One, Get Two). */
  CloseRangeBonus = "closeRangeBonus",
  /** The Attack is made twice on the same target, one after the other (Buy One, Get Two). */
  AttackTwice = "attackTwice",
}

export interface CardEffect {
  kind: EffectKind;
  /** Damage, Shield, tiles or bonus value, depending on the kind. */
  amount?: number;
  /** Number of Resolutions the effect lasts, where it is not "this round". */
  duration?: number;
  /** For Charge: the Shield the caster gains before it moves. */
  shield?: number;
  /** Side length of a square area. */
  size?: number;
  /** For Placed Cover: Full instead of the default Half. */
  cover?: CoverKind.Half | CoverKind.Full;
  /** Scrap (Tilly): the fields of this effect that change while the casting Hero has Scrap, for example a longer duration. */
  scrap?: Pick<CardEffect, "amount" | "duration" | "size" | "cover">;
}

/** The Range a card reaches without help: Long Shot reaches beyond its normal Range only for a Hidden Hero or a Marked target. */
export function normalRange(card: Pick<CardDefinition, "range" | "effects">): number {
  return card.effects.find(({ kind }) => kind === EffectKind.FarShot)?.amount ?? card.range ?? 0;
}

/** The effect as it works for a Hero: with Scrap its `scrap` fields replace the plain ones. */
export function effectFor(effect: CardEffect, hasScrap: boolean): CardEffect {
  return hasScrap && effect.scrap ? { ...effect, ...effect.scrap } : effect;
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
        effect.kind === EffectKind.IgnoreCover ||
        effect.kind === EffectKind.PiercingDamage ||
        effect.kind === EffectKind.CloseRangeBonus ||
        effect.kind === EffectKind.AttackTwice ||
        effect.kind === EffectKind.FarShot ||
        effect.kind === EffectKind.Knockback ||
        effect.kind === EffectKind.ApplyMarked,
    )
  );
}

/** Utility effect kinds the resolution has an interpreter for; later Utility effects are added here. */
export const PLAYABLE_UTILITY_EFFECTS = [
  EffectKind.GainShield,
  EffectKind.ScrapField,
  EffectKind.BecomeHidden,
  EffectKind.RevealArea,
  EffectKind.PlaceCover,
  EffectKind.Pull,
  EffectKind.Charge,
] as const;

/**
 * Utility cards whose effects all have an interpreter and that are aimed at this Hero, a visible enemy, a tile or an area. Tile and area cards are confirmed on this Hero.
 */
export function isPlayableUtility(card: CardDefinition): boolean {
  return (
    card.type === CardType.Utility &&
    (card.target === CardTarget.SelfHero ||
      card.target === CardTarget.EmptyTile ||
      card.target === CardTarget.Area ||
      card.target === CardTarget.VisibleEnemy ||
      card.target === CardTarget.VisibleOrGhostEnemy) &&
    card.effects.every((effect) => (PLAYABLE_UTILITY_EFFECTS as readonly EffectKind[]).includes(effect.kind))
  );
}

/**
 * Urban Renewal: an Attack on a tile that hurts every Hero in the area round it and destroys the Cover there. The
 * action carries the tile; its target is the casting Hero.
 */
export function isAreaAttack(card: CardDefinition): boolean {
  const [first, second, ...rest] = card.effects;
  return (
    card.type === CardType.Attack &&
    card.target === CardTarget.Tile &&
    first?.kind === EffectKind.AreaDamage &&
    second?.kind === EffectKind.DestroyAnyCover &&
    rest.length === 0
  );
}

/** Whether a card's Primary effect can be planned and resolved so far. */
export function isPlayableCard(card: CardDefinition): boolean {
  return isSimpleAttack(card) || isAreaAttack(card) || isPlayableUtility(card);
}

const slow: CardEffect = { kind: EffectKind.ApplySlow, duration: 1 };
const marked: CardEffect = { kind: EffectKind.ApplyMarked, duration: 1 };
const damage = (amount: number): CardEffect => ({ kind: EffectKind.Damage, amount });
const shield = (amount: number): CardEffect => ({ kind: EffectKind.GainShield, amount });

// Hero ranges (ADR 0009); attack cards without an explicit range use their Hero's range.
const BRUISER_RANGE = 3;

// Max Overload: up close and personal (docs/design/decks.md). Every card costs 1 Energy.
// Range 1 to 2: 2 damage, 3 at Range 1.
const handleWithCare: CardDefinition = {
  name: "Handle With Care", type: CardType.Attack, energyCost: 1, range: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2), { kind: EffectKind.CloseRangeBonus, amount: 1 }],
};
// Two Attacks on the same target, each with the close-range bonus.
const buyOneGetTwo: CardDefinition = {
  name: "Buy One, Get Two", type: CardType.Attack, energyCost: 1, range: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2), { kind: EffectKind.CloseRangeBonus, amount: 1 }, { kind: EffectKind.AttackTwice }],
};
const timeForCoffee: CardDefinition = {
  name: "Time for Coffee", type: CardType.Attack, energyCost: 1, range: BRUISER_RANGE,
  target: CardTarget.VisibleEnemy, effects: [damage(1), slow],
};
// Shield 2 first, then up to 5 tiles toward a named enemy Hero; it cannot be used as a plain Move.
const expressDelivery: CardDefinition = {
  name: "Express Delivery", type: CardType.Utility, energyCost: 1,
  target: CardTarget.VisibleEnemy, effects: [{ kind: EffectKind.Charge, amount: 5, shield: 2 }],
};
const hardHat: CardDefinition = {
  name: "Hard Hat", type: CardType.Utility, energyCost: 1, target: CardTarget.SelfHero, effects: [shield(2)],
};
// Range 7: the named enemy is pulled until it stands next to the caster (it stops at a Wall, Full Cover or a Hero).
const cargoHook: CardDefinition = {
  name: "Cargo Hook", type: CardType.Utility, energyCost: 1, range: 7,
  target: CardTarget.VisibleOrGhostEnemy, effects: [{ kind: EffectKind.Pull, amount: 6 }],
};

// Tilly Turnover creates and destroys Cover, and makes Scrap of it (docs/design/decks.md).
// Scrap: active once a card of hers destroyed Cover this Round; `scrap` on an effect is what it becomes then.
const temporarySolution: CardDefinition = {
  name: "Temporary Solution", type: CardType.Utility, energyCost: 1, range: 5,
  target: CardTarget.EmptyTile, effects: [{ kind: EffectKind.PlaceCover, scrap: { cover: CoverKind.Full } }],
};
// No Range: any tile of the map. Shown for 3 Resolutions.
const siteSurvey: CardDefinition = {
  name: "Site Survey", type: CardType.Utility, energyCost: 1, target: CardTarget.Area,
  effects: [{ kind: EffectKind.RevealArea, size: 3, duration: 3, scrap: { size: 5 } }],
};
// 2 damage to every Hero in the 3 x 3 area, allies too; all Cover in it is destroyed.
const urbanRenewal: CardDefinition = {
  name: "Urban Renewal", type: CardType.Attack, energyCost: 1, range: 4,
  target: CardTarget.Tile, effects: [{ kind: EffectKind.AreaDamage, amount: 2, size: 3 }, { kind: EffectKind.DestroyAnyCover }],
};
// Until the end of the next Resolution; a Move of a Hero that starts in it is Slowed, each Move through it costs 1 damage.
const heavyMetal: CardDefinition = {
  name: "Heavy Metal", type: CardType.Utility, energyCost: 1, range: 4,
  target: CardTarget.Area, effects: [{ kind: EffectKind.ScrapField, size: 3, duration: 2, amount: 1, scrap: { duration: 3 } }],
};
const priceTag: CardDefinition = {
  name: "Price Tag", type: CardType.Attack, energyCost: 1, range: 3,
  target: CardTarget.VisibleEnemy, effects: [{ kind: EffectKind.Damage, amount: 1, scrap: { amount: 2 } }, marked],
};

// Kit Crosshair is the sniper, a glass cannon (docs/design/decks.md). Every card costs 1 Energy.
// Range 3 to 7, 3 damage; a Hidden Kit or a Marked target is reached up to Range 9, and a Hidden Kit deals +1 beyond Range 7.
const longShot: CardDefinition = {
  name: "Long Shot", type: CardType.Attack, energyCost: 1, range: 9, minRange: 3,
  target: CardTarget.VisibleEnemy, effects: [damage(3), { kind: EffectKind.FarShot, amount: 7 }],
};
// Hidden for 2 Resolutions wherever Kit stands; damage or an Attack ends it.
const vanish: CardDefinition = {
  name: "Vanish", type: CardType.Utility, energyCost: 1,
  target: CardTarget.SelfHero, effects: [{ kind: EffectKind.BecomeHidden, duration: 2 }],
};
// 1 damage and the target is pushed 3 tiles away: out of Kit's minimum Range, where Long Shot hits.
const personalSpace: CardDefinition = {
  name: "Personal Space", type: CardType.Attack, energyCost: 1, range: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(1), { kind: EffectKind.Knockback, amount: 3 }],
};
// 2 damage that goes through Shield and all Cover.
const shieldBreaker: CardDefinition = {
  name: "Shield Breaker", type: CardType.Attack, energyCost: 1, range: 4, minRange: 2,
  target: CardTarget.VisibleEnemy, effects: [damage(2), { kind: EffectKind.PiercingDamage }, { kind: EffectKind.IgnoreCover }],
};

/**
 * The fixed Hero Decks (ADR 0025): Bruiser 12, Controller 10, Assassin 9 cards. A
 * card is identified within its Hero by its index in this list, so identical cards stay distinct (for example in Hand or Exile).
 */
export const HERO_DECKS: Record<HeroClass, readonly CardDefinition[]> = {
  [HeroClass.Bruiser]: [
    handleWithCare, handleWithCare, timeForCoffee, buyOneGetTwo, handleWithCare, hardHat,
    hardHat, expressDelivery, expressDelivery, cargoHook, cargoHook, timeForCoffee,
  ],
  [HeroClass.Controller]: [
    priceTag, priceTag, siteSurvey, siteSurvey, urbanRenewal,
    urbanRenewal, temporarySolution, temporarySolution, heavyMetal, heavyMetal,
  ],
  [HeroClass.Assassin]: [
    longShot, longShot, longShot, vanish, vanish,
    personalSpace, personalSpace, shieldBreaker, shieldBreaker,
  ],
};

/** The index of the `copy`-th (0-based) card called `name` in a Hero's Deck, so callers need not count positions. */
export function cardIndex(heroClass: HeroClass, name: string, copy = 0): CardIndex {
  const indices = HERO_DECKS[heroClass].flatMap((card, index) => (card.name === name ? [index] : []));
  const index = indices[copy];
  if (index === undefined) throw new Error(`${heroClass} has no card ${name} (copy ${copy})`);
  return index;
}
