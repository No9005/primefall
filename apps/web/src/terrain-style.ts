// The look of the terrain: the one place that holds terrain colours (palette of artboard J, "Primefall UI proposals").
// Change the look here; nothing else in the code names a terrain colour.

/** Outline of every standing piece and Hero: constant on screen, whatever the zoom or rotation. Width in px. */
export const OUTLINE = { color: 0x0b1016, width: 1.75 } as const;

/** Outline width on screen per kind of standing piece, in px: Cover is drawn thinner so it does not outshine the Heroes. */
export const PIECE_OUTLINE_WIDTH = { wall: OUTLINE.width, fullCover: 1, halfCover: 1, overwatchNest: OUTLINE.width } as const;

/** Measured mean relative luminance of the Hero sprites at 844 x 390 (planning screenshot, non-floor pixels). Used only by the terrain contrast test. */
export const HERO_REFERENCE_LUMINANCE = 0.23;

export const TERRAIN_STYLE = {
  /** Plain floor, used when no sight is applied. `edge` is the fine grid line. */
  floor: { fill: 0x333c4a, fillAlt: 0x374150, edge: 0x4b596c },
  /** Floor tiles the Squad sees and the fog over the rest. `edge` is the fine grid line. */
  floorLit: { fill: 0x2c4257, edge: 0x3d5a73 },
  floorDark: { fill: 0x0b1016, edge: 0x141c25 },
  /** Width of the fine grid lines on screen, in px. */
  gridLineWidth: 0.6,
  /** Landmarks in the fog: known, but dark. */
  primeZoneDark: { fill: 0x0f1f22, edge: 0x1d6b66 },
  spawnMarkerDark: 0x1d6b66,
  /** Outpost tiles (an interim look until the HUD and map ticket): amber, so they differ from the teal Prime Zone. */
  outpost: { fill: 0x45391f, edge: 0xffb347 },
  outpostDark: { fill: 0x1f1b10, edge: 0x7a5a24 },
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
  /** The look of Cover (docs/design/role-visuals): the map's own as blue panels on a plinth, built as yellow-black bars. */
  coverLook: { plinthTop: 0x2a323c, plinthSide: 0x14181e, blue: 0x4da3ff, yellow: 0xffd24a, black: 0x14181e, grey: 0xd9dee4, outline: 0x0b1016 },
  wall: { top: 0x5d7284, left: 0x3a4b5b, right: 0x2a3845, edge: OUTLINE.color },
  fullCover: { top: 0x75808a, left: 0x56616b, right: 0x3f484f, edge: OUTLINE.color, topEdge: 0x93a3b0 },
  halfCover: { top: 0x68727b, left: 0x4d565e, right: 0x394046, edge: 0x2e353c },
  overwatchNest: { top: 0x5d7194, left: 0x465676, right: 0x344059, edge: OUTLINE.color },
} as const;

/**
 * The drifting clouds over the unseen tiles (issue #275). Speeds are in world pixels per second, periods in world
 * pixels (they scale with the camera like the board). The total cloud alpha runs from `thinAlpha` to `denseAlpha`.
 */
export const FOG_CLOUDS = {
  tint: 0x9fb4c8,
  thinAlpha: 0.15,
  denseAlpha: 0.35,
  a: { speed: 8, direction: { x: 1, y: 0.3 }, period: 512 },
  b: { speed: 14, direction: { x: -1, y: -0.3 }, period: 870 },
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
  crossfire: 0xff8a3d,
  steel: 0x3d5a73,
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
  /** Outline colour of the top face only; without it the top uses `edge`. */
  topEdge?: number;
}

/**
 * Standing pieces: `thickness` is the share of a tile that a joined slab is wide, `pillar` the share of a piece
 * with no neighbour to join, `height` is in world pixels. A Wall slab is a third of a tile thick;
 * the Overwatch Nest never joins.
 */
export const PIECE_SHAPE = {
  wall: { thickness: 1 / 3, pillar: 0.5, height: 64 },
  fullCover: { thickness: 0.4, pillar: 0.62, height: 44 },
  halfCover: { thickness: 0.4, pillar: 0.62, height: 16 },
  overwatchNest: { thickness: 0.8, pillar: 0.8, height: 72 },
} as const;
