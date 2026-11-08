// The Tutorial as data: a list of steps, each with a card, a gesture and a one-line caption.
// Numbers come from the card data and rule constants, so a rule change cannot make the tutorial lie.

import {
  type CardDefinition,
  HALF_COVER_REDUCTION,
  HERO_DECKS,
  type GridPosition,
  hasLineOfSight,
  HeroClass,
  MOVE_DISTANCE,
  PITCH_ENERGY,
  PRIME_ZONE_WIN_RESOLUTIONS,
  REACTOR_DECK,
} from "game-core";
import { describeEffects, modeChoiceFaces, type ModeFace } from "./planning-selection";
import { drawShot } from "./shot-lines";

export enum TutorialTopic {
  Goal = "goal",
  Move = "move",
  Pitch = "pitch",
  Attack = "attack",
  Overdrive = "overdrive",
  Sight = "sight",
}

/** Where the dragged card is dropped in the step; `none` means the step shows no drag. */
export enum TutorialDrop {
  None = "none",
  Tile = "tile",
  EnergyOrb = "energyOrb",
  EnemyHero = "enemyHero",
}

export interface TutorialStep {
  topic: TutorialTopic;
  title: string;
  /** One line, in the terms of GLOSSARY.md. */
  caption: string;
  /** The glossary terms the caption uses; a test checks that each is a defined term and appears in the caption. */
  terms: readonly string[];
  card?: CardDefinition;
  drop: TutorialDrop;
}

/** Seconds a step is shown before the next one starts. */
export const TUTORIAL_STEP_SECONDS = 4;

function cardNamed(heroClass: HeroClass, name: string): CardDefinition {
  const card = HERO_DECKS[heroClass].find((candidate) => candidate.name === name);
  if (!card) throw new Error(`Tutorial card ${name} is not in the ${heroClass} Deck`);
  return card;
}

const attackCard = cardNamed(HeroClass.Bruiser, "Slam Shot");
const overdriveCard = cardNamed(HeroClass.Assassin, "Long Shot");
const anyCard = cardNamed(HeroClass.Bruiser, "Bulwark");

/** The two faces of the Overdrive step's card, as the game's own mode choice builds them (all pressable in the demo). */
export const OVERDRIVE_FACES: readonly ModeFace[] = (modeChoiceFaces(HeroClass.Assassin, HERO_DECKS[HeroClass.Assassin].indexOf(overdriveCard), [], []) ?? []).map(
  (face) => ({ ...face, reason: undefined }),
);

const attackDamage = attackCard.effects[0]?.amount ?? 0;
const attackRange = attackCard.range ?? 0;

// The Line of Sight step: one Hero on the real Reactor Deck, an enemy it sees and one behind a Wall. The Board draws it.

/** How far a Hero sees; the rules' SIGHT_RANGE lives in the server entry point, which the web app may not import. */
const TUTORIAL_SIGHT_TILES = 7;

export const SIGHT_SCENE = (() => {
  const hero = { col: 10, row: 8 };
  const seenEnemy = { id: "seen", position: { col: 13, row: 6 } };
  const hiddenEnemy = { id: "hidden", position: { col: 10, row: 4 } };
  const visibleTiles: GridPosition[] = [];
  REACTOR_DECK.tiles.forEach((line, row) =>
    line.forEach((_, col) => {
      const tile = { col, row };
      const near = Math.max(Math.abs(col - hero.col), Math.abs(row - hero.row)) <= TUTORIAL_SIGHT_TILES;
      if (near && hasLineOfSight(REACTOR_DECK, hero, tile)) visibleTiles.push(tile);
    }),
  );
  return { hero, seenEnemy, hiddenEnemy, visibleTiles, shot: drawShot(REACTOR_DECK, hero, seenEnemy, attackRange) };
})();

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    topic: TutorialTopic.Goal,
    title: "Goal",
    caption: `Hold the Prime Zone for ${PRIME_ZONE_WIN_RESOLUTIONS} Resolutions in a row to win.`,
    terms: ["Prime Zone", "Resolution"],
    drop: TutorialDrop.None,
  },
  {
    topic: TutorialTopic.Move,
    title: `Move ${MOVE_DISTANCE}`,
    caption: `Drag a card onto a highlighted tile: the Hero moves up to ${MOVE_DISTANCE} tiles.`,
    terms: ["Hero"],
    card: anyCard,
    drop: TutorialDrop.Tile,
  },
  {
    topic: TutorialTopic.Pitch,
    title: "Pitch",
    caption: `Drag a card onto the Energy orb to Pitch it: you gain ${PITCH_ENERGY} Energy.`,
    terms: ["Pitch", "Energy"],
    card: anyCard,
    drop: TutorialDrop.EnergyOrb,
  },
  {
    topic: TutorialTopic.Attack,
    title: "Attack",
    caption: `Drag ${attackCard.name} onto an enemy Hero: it costs ${attackCard.energyCost} Energy and deals ${attackDamage} Deck Damage to its Deck.`,
    terms: ["Hero", "Energy", "Deck Damage", "Deck"],
    card: attackCard,
    drop: TutorialDrop.EnemyHero,
  },
  {
    topic: TutorialTopic.Overdrive,
    title: "Overdrive",
    caption: `${overdriveCard.name} has two faces: Normal (${describeEffects(overdriveCard.effects)}) and Overdrive (${describeEffects(overdriveCard.overdrive)}). Choose Overdrive and the card goes to Exile.`,
    terms: ["Overdrive", "Exile"],
    card: overdriveCard,
    drop: TutorialDrop.EnemyHero,
  },
  {
    topic: TutorialTopic.Sight,
    title: "Line of Sight",
    caption: `An attack needs Line of Sight and Range ${attackRange}: a Hero out of sight is not Visible, and Half Cover cuts damage by ${HALF_COVER_REDUCTION}.`,
    terms: ["Line of Sight", "Range", "Visible", "Cover", "Hero"],
    drop: TutorialDrop.None,
  },
];
