// The look of the terrain: the one place that holds terrain colours (palette of artboard J, "Primefall UI proposals").
// Change the look here; nothing else in the code names a terrain colour.

export const TERRAIN_STYLE = {
  floor: { fill: 0x2c3440, fillAlt: 0x303944, edge: 0x465262 },
  /** Floor tiles in view of a Hero and out of it; the visibility ticket switches between them. */
  floorLit: { fill: 0x3a4a5e, edge: 0x56708c },
  floorDark: { fill: 0x1e252e, edge: 0x2f3946 },
  primeZone: { fill: 0x184648, edge: 0x2ec4b6 },
  primeZoneEdge: { fill: 0x1e3440, edge: 0x2ec4b6 },
  spawnMarker: 0x2ec4b6,
  wall: { top: 0x52627a, left: 0x3e4b5e, right: 0x2c3646, edge: 0x6b7e99 },
  fullCover: { top: 0x5f7f9a, left: 0x486279, right: 0x364b5d, edge: 0xffc933 },
  halfCover: { top: 0x6f94b3, left: 0x547591, right: 0x3f5a71, edge: 0xffc933 },
  overwatchNest: { top: 0x5d7194, left: 0x465676, right: 0x344059, edge: 0xffc933 },
} as const;

export interface PieceStyle {
  top: number;
  left: number;
  right: number;
  edge: number;
}

/** Footprint share of the tile and height in world pixels of each standing piece. */
export const PIECE_SHAPE = {
  wall: { inset: 1, height: 64 },
  fullCover: { inset: 0.62, height: 44 },
  halfCover: { inset: 0.62, height: 20 },
  overwatchNest: { inset: 0.8, height: 72 },
} as const;
