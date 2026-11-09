import { CardType, type CardDefinition, HERO_DECKS, HeroClass } from "game-core";
import { cardFace } from "./planning-selection";

// What the Hero Select screen shows besides the figures: the three Heroes in their order, the info text of each, and the card list.

/** The Heroes in the order they stand on the screen, left to right. */
export const SELECTABLE_HEROES = [HeroClass.Bruiser, HeroClass.Controller, HeroClass.Assassin] as const;

export const HERO_NAMES: Record<HeroClass, string> = {
  [HeroClass.Bruiser]: "Bruiser",
  [HeroClass.Controller]: "Controller",
  [HeroClass.Assassin]: "Assassin",
};

/** The main task of each Hero, the owner's texts (two lines at 560 px wide, Barlow 500 14 px). */
export const HERO_TASKS: Record<HeroClass, string> = {
  [HeroClass.Bruiser]: "Tank and enabler. +1 damage at Range 1.",
  [HeroClass.Controller]: "Support. Builds lasting Cover, shields allies and sends the Scout Drone anywhere on the map. One weak attack.",
  [HeroClass.Assassin]: "Glass cannon. Deals damage from range and hides with Vanish. Cannot hit what stands next to it.",
};

/** The three ways into the Hero Select; the chip at the top right names it. */
export type SelectMode = "classic" | "attack" | "defend";

export const MODE_LABELS: Record<SelectMode, string> = { classic: "CLASSIC", attack: "ATTACK", defend: "DEFEND" };

/** One row of the card list: a card of the Deck, with the number of copies in the Deck. */
export interface CardRow {
  name: string;
  copies: number;
  type: string;
  cost: number;
  /** The effect text of the card data, with the Overdrive after it where the card has one. */
  effect: string;
}

/** The Deck of a Hero as rows, in Deck order, identical cards on one row ("x2"). The text comes from the card data. */
export function cardRows(heroClass: HeroClass): CardRow[] {
  const rows = new Map<CardDefinition, CardRow>();
  for (const card of HERO_DECKS[heroClass]) {
    const row = rows.get(card);
    if (row) row.copies += 1;
    else rows.set(card, { name: card.name, copies: 1, type: card.type === CardType.Attack ? "Attack" : "Utility", cost: card.energyCost, effect: cardFace(card).effectText });
  }
  return [...rows.values()];
}

/** "CONTROLLER: 12 CARDS": the heading of the card list. */
export function cardListTitle(heroClass: HeroClass): string {
  return `${HERO_NAMES[heroClass].toUpperCase()}: ${HERO_DECKS[heroClass].length} CARDS`;
}

/** The text of the name of a card in the list: the name, with "x2" for a card that is in the Deck twice. */
export function cardRowName(row: CardRow): string {
  return row.copies > 1 ? `${row.name} x${row.copies}` : row.name;
}
