import { HeroClass } from "game-core";
import { cardArtFile } from "./card-art";

// The standard uses of a card, which every card has (docs/design/cards/): Pitch, Move and Wait, each with the name and the
// picture of the Hero that plays them.

export interface BasicLook {
  name: string;
  /** The address of the picture. */
  art: string;
}

export interface HeroBasics {
  pitch: BasicLook;
  move: BasicLook;
  wait: BasicLook;
}

export const HERO_BASICS: Record<HeroClass, HeroBasics> = {
  [HeroClass.Bruiser]: {
    pitch: { name: "Overtime", art: cardArtFile("overtime") },
    move: { name: "Walk It Off", art: cardArtFile("walk-it-off") },
    wait: { name: "Smoke Break", art: cardArtFile("smoke-break") },
  },
  [HeroClass.Controller]: {
    pitch: { name: "Cannibalize", art: cardArtFile("cannibalize") },
    move: { name: "Walk It Off", art: cardArtFile("walk-it-off-tilly") },
    wait: { name: "Idle Hands", art: cardArtFile("idle-hands") },
  },
  [HeroClass.Assassin]: {
    pitch: { name: "Trade-In", art: cardArtFile("trade-in") },
    move: { name: "Walk It Off", art: cardArtFile("walk-it-off-kit") },
    wait: { name: "Stakeout", art: cardArtFile("stakeout") },
  },
};
