import { HeroClass } from "game-core";
import { OUTLINE } from "./terrain-style";

// The look of a Hero figure (artboard J): the one place that holds Hero colours and proportions.

export const HERO_STYLE = {
  outline: OUTLINE,
  /** Body colour per role. */
  body: { [HeroClass.Bruiser]: 0xd9732f, [HeroClass.Controller]: 0x5b8def, [HeroClass.Assassin]: 0x9b6bd6 },
  /** Head and the lighter band on the chest. */
  head: 0xe8d3b9,
  /** Body colour of an Exhausted Hero and of one that has just been hit. */
  exhausted: 0x4a5560,
  hit: 0xffffff,
  /** The ring under the figure, by Squad. */
  ring: { own: 0x2ec4b6, enemy: 0xe5484d, width: 3 },
  /** Soft contact shadow under the feet. */
  shadow: { color: 0x000000, alpha: 0.4 },
  /** Shield rubies, the shield bubble and the planned-action icons above the Hero. */
  marks: {
    ruby: { fill: 0x2f7bff, facet: 0x9cc4ff, size: 7, gap: 3, rowY: -96, dash: 3 },
    bubble: { fill: 0x4aa3ff, fillAlpha: 0.22, edgeAlpha: 0.75, radiusX: 34, radiusY: 46, centerY: -42, appearMs: 250 },
    icon: { fill: 0xe8eef5, size: 9, rowY: -118, gap: 6 },
    /** The grey badge of a planned Wait ("n II"). */
    waitBadge: { fill: 0x8a99a8, text: 0x12161c, size: 12 },
    tickText: { fill: 0xe8eef5, size: 12 },
    /** Alpha of the marks of an allied Hero that is not the selected one. */
  },
  /** World pixels; the feet are at (0, 0). */
  shape: { bodyWidth: 30, bodyHeight: 50, bodyLift: 4, headRadius: 12, headGap: 2 },
} as const;
