import { OUTLINE } from "./terrain-style";

// The numbers of a Hero's drawn surroundings (docs/design/animation/README.md): the Squad ring under the feet, the contact
// shadow, the marks above the head. The Heroes themselves are the sprite sheets of docs/design/pixel-heroes.

/** Height of a Hero from its feet to the top of the head or the rifle, in world pixels. */
export const HERO_WORLD_HEIGHT = 113;

export const HERO_STYLE = {
  outline: OUTLINE,
  /** The marks are drawn in design pixels (a tile is 46 px wide there, 128 px in the game), so figure and marks are magnified by this factor: a Hero is then about 100 px tall. */
  figureScale: 128 / 46,
  /** The ring under the figure, by Squad. */
  ring: { own: 0x2ec4b6, enemy: 0xf0555a, width: 3.5, glowExtra: 3, glowAlpha: 0.25, radiusX: 16, radiusY: 8 },
  /** Soft contact shadow under the feet. */
  shadow: { color: 0x000000, alpha: 0.4, radiusX: 18, radiusY: 8 },
  /** Shield rubies, the shield bubble and the planned-action icons above the Hero. */
  marks: {
    ruby: { fill: 0x2f7bff, facet: 0x9cc4ff, size: 7, gap: 3, rowY: -64, dash: 3 },
    bubble: { fill: 0x4aa3ff, fillAlpha: 0.22, edgeAlpha: 0.75, radiusX: 26, radiusY: 32, centerY: -22, appearMs: 250 },
    icon: { fill: 0xe8eef5, size: 9, rowY: -84, gap: 6 },
    /** The grey badge of a planned Wait ("n II"). */
    waitBadge: { fill: 0x8a99a8, text: 0x12161c, size: 12 },
    tickText: { fill: 0xe8eef5, size: 12 },
  },
} as const;
