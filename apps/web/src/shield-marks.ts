import { ActionKind, BLOCK_SHIELD, CardTarget, cardInMode, HERO_DECKS, type HeroClass, type QueuedAction, Visibility } from "game-core";

// What is drawn above a Hero besides its figure: Shield as rubies, the shield bubble, and the planned actions that have no
// line on the board (Wait, a card played on the Hero itself). Pure: the board only draws the marks this returns.

export enum IconKind {
  Wait = "wait",
  SelfCard = "selfCard",
}

export interface PlannedIcon {
  kind: IconKind;
  /** The Tick of the queued action (1-based). */
  tick: number;
}

export interface HeroMarks {
  /** Number of rubies in the row above the head. */
  rubies: number;
  /** Filled rubies are the Shield the Hero holds; hollow, dashed ones are the Shield a queued Block will create. */
  filled: boolean;
  /** For planned rubies: the Ticks of the queued Blocks. */
  ticks: readonly number[];
  /** The translucent shield in front of the Hero: on while the Hero holds Shield. */
  bubble: boolean;
  /** Planned Waits and self-played cards, in Tick order. */
  icons: readonly PlannedIcon[];
}

export const NO_MARKS: HeroMarks = { rubies: 0, filled: false, ticks: [], bubble: false, icons: [] };

export interface MarksInput {
  /** A Hero of the Squad's own, as opposed to an enemy. */
  own: boolean;
  /** For an enemy: how the Squad sees it. Only Visible enemies get marks. */
  visibility?: Visibility;
  /** The Shield the Hero holds right now (the simulation's value, less what the replay has absorbed). */
  shield: number;
  /** The queued actions of an own Hero; ignored for enemies and during the Resolution. */
  queue?: readonly QueuedAction[];
  /** The Resolution is playing: then only the held Shield is shown. */
  resolving: boolean;
  heroClass: HeroClass;
}

function playsOnItself(heroClass: HeroClass, action: QueuedAction): boolean {
  return action.kind === ActionKind.Primary && cardInMode(HERO_DECKS[heroClass][action.card]!, action.overdrive).target === CardTarget.SelfHero;
}

/**
 * The marks of one Hero. Nothing for a Ghost or an Unknown enemy, and never an enemy's plan: a planned Block is the
 * Squad's own knowledge. While the Resolution plays, the rubies are the Shield held at this moment.
 */
export function heroMarks({ own, visibility, shield, queue = [], resolving, heroClass }: MarksInput): HeroMarks {
  if (!own && visibility !== Visibility.Visible) return NO_MARKS;
  if (shield > 0) return { rubies: shield, filled: true, ticks: [], bubble: true, icons: [] };
  if (!own || resolving) return NO_MARKS;
  const ticks = queue.flatMap((action, index) => (action.kind === ActionKind.Block ? [index + 1] : []));
  const icons = queue.flatMap((action, index): PlannedIcon[] => {
    if (action.kind === ActionKind.Wait) return [{ kind: IconKind.Wait, tick: index + 1 }];
    return playsOnItself(heroClass, action) ? [{ kind: IconKind.SelfCard, tick: index + 1 }] : [];
  });
  return { rubies: ticks.length * BLOCK_SHIELD, filled: false, ticks, bubble: false, icons };
}
