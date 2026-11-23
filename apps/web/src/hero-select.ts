import { HeroClass } from "game-core";

// What the Hero Select screen shows besides the figures: the three Heroes in their order and their names.

/** The Heroes in the order they stand on the screen, left to right. */
export const SELECTABLE_HEROES = [HeroClass.Bruiser, HeroClass.Controller, HeroClass.Assassin] as const;

export const HERO_NAMES: Record<HeroClass, string> = {
  [HeroClass.Bruiser]: "Bruiser",
  [HeroClass.Controller]: "Controller",
  [HeroClass.Assassin]: "Assassin",
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

/** Where the feet of a Hero stand inside its area: the selected Bruiser steps left so its tracer stays inside the area. */
export function feetX(heroClass: HeroClass, selected: boolean): number {
  return heroClass === HeroClass.Bruiser && selected ? 62 : 120;
}
