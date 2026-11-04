// The look of the terrain: the one place that holds terrain colours (palette of artboard J, "Primefall UI proposals").
// Change the look here; nothing else in the code names a terrain colour.

/** Outline of every standing piece and Hero: constant on screen, whatever the zoom or rotation. Width in px. */
export const OUTLINE = { color: 0x0b1016, width: 1.75 } as const;

export const TERRAIN_STYLE = {
  /** Plain floor, used when no sight is applied. `edge` is the fine grid line. */
  floor: { fill: 0x2c3440, fillAlt: 0x303944, edge: 0x465262 },
  /** Floor tiles the Squad sees and the fog over the rest. `edge` is the fine grid line. */
  floorLit: { fill: 0x2c4257, edge: 0x3d5a73 },
  floorDark: { fill: 0x0b1016, edge: 0x141c25 },
  /** Width of the fine grid lines on screen, in px. */
  gridLineWidth: 0.6,
  /** Landmarks in the fog: known, but dark. */
  primeZoneDark: { fill: 0x0f1f22, edge: 0x1d6b66 },
  spawnMarkerDark: 0x1d6b66,
  /** How much of a standing piece shows in the fog (0 to 1). */
  fogPieceAlpha: 0.45,
  /** Soft light around an own Hero: `rings` stacked ellipses that add up to about `alpha` at the centre. */
  heroLight: { color: 0xffffff, alpha: 0.1, rings: 6 },
  primeZone: { fill: 0x184648, edge: 0x2ec4b6 },
  /** Faint tint over the Prime Zone tiles: the own Squad holds it, contested, otherwise. */
  zoneTint: { own: 0x2ec4b6, contested: 0xffb347, neutral: 0x3d5a73 },
  primeZoneEdge: { fill: 0x1e3440, edge: 0x2ec4b6 },
  spawnMarker: 0x2ec4b6,
  /** Floor outlines that mark Cover tiles while planning. */
  coverOutline: { full: 0xff8a3d, half: 0x4aa3ff, placed: 0x7be0ff, destroyed: 0x8a8f98 },
  wall: { top: 0x5d7284, left: 0x3a4b5b, right: 0x2a3845, edge: OUTLINE.color },
  fullCover: { top: 0x5f7f9a, left: 0x486279, right: 0x364b5d, edge: 0xe5b429 },
  halfCover: { top: 0x6f94b3, left: 0x547591, right: 0x3f5a71, edge: 0xe5b429 },
  overwatchNest: { top: 0x5d7194, left: 0x465676, right: 0x344059, edge: OUTLINE.color },
} as const;

/** The line of fire drawn while aiming (artboard J). */
export const SHOT_STYLE = {
  clear: 0x2ec4b6,
  stopped: 0xe5484d,
  beyond: 0x8a8f98,
  cover: 0xffc933,
  width: 4,
  dash: 14,
  dot: 4,
  gap: 10,
} as const;

/** The Queue drawn on the board (UI rework 11): the player's plan in teal, the allies' plans very faint in yellow. */
export const PLAN_STYLE = {
  own: 0x2ec4b6,
  ally: 0xe5b429,
  allyAlpha: 0.22,
  danger: 0xe5484d,
  badgeText: 0x12161c,
  width: 3,
  dash: 8,
  dashGap: 4,
  dot: 2,
  dotGap: 4,
  ringFillAlpha: 0.15,
  ghostAlpha: 0.35,
} as const;

export interface PieceStyle {
  top: number;
  left: number;
  right: number;
  edge: number;
}

/**
 * Standing pieces: `thickness` is the share of a tile that a joined slab is wide, `pillar` the share of a piece
 * with no neighbour to join, `height` is in world pixels. A Wall slab is a third of a tile thick;
 * the Overwatch Nest never joins.
 */
export const PIECE_SHAPE = {
  wall: { thickness: 1 / 3, pillar: 0.5, height: 64 },
  fullCover: { thickness: 0.4, pillar: 0.62, height: 44 },
  halfCover: { thickness: 0.4, pillar: 0.62, height: 20 },
  overwatchNest: { thickness: 0.8, pillar: 0.8, height: 72 },
} as const;
