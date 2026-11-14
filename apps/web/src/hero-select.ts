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

/** Who a Hero is, besides its class: the Hero Name, the line of the Hero Select, the bio of the BIO sheet (docs/design/world). */
export interface HeroProfile {
  name: string;
  quote: string;
  bio: string;
}

export const HERO_PROFILES: Record<HeroClass, HeroProfile> = {
  [HeroClass.Bruiser]: {
    name: "Max Overload",
    quote: "I came here to move cargo and kick ass. The cargo is optional.",
    bio: "Loadmaster in the Corps, twenty-two years. He has moved every crate, comrade and complaint the military ever shipped, and he still takes the manual more seriously than the mission. If it is in the way, it is cargo.",
  },
  [HeroClass.Controller]: {
    name: "Tilly Turnover",
    quote: "Everything is a spare part if you squint hard enough.",
    bio: "Mech mechanic and tinkerer. The third arm is her own build, patched together from scrap, and so is most of what she carries. She had no employer to leave: she was hired with the other two on the day the job was posted.",
  },
  [HeroClass.Assassin]: {
    name: "Kit Crosshair",
    quote: "Nobody asked for my real name. Nobody will.",
    bio: "Former syndicate assassin. Crosshair is the name the syndicate gave; Kit kept it and dropped the employer. Nobody knows the real name, and the contract does not ask.",
  },
};

/** The folder of a Hero's sheets: its `portrait.png` (36 x 36 px, the close-up of the pixel concept) is shown at 6 x on the BIO sheet. */
export const HERO_CLOSE_UP: Record<HeroClass, string> = {
  [HeroClass.Bruiser]: "bruiser",
  [HeroClass.Controller]: "controller",
  [HeroClass.Assassin]: "assassin",
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

/** Where the feet of a Hero stand inside its area: the selected Bruiser steps left so its tracer stays inside the area. */
export function feetX(heroClass: HeroClass, selected: boolean): number {
  return heroClass === HeroClass.Bruiser && selected ? 62 : 120;
}
