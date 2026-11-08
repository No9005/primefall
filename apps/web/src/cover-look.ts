import { FillGradient, type Graphics } from "pixi.js";
import { type CoverLook, worldLineWidth } from "./terrain";
import { TERRAIN_STYLE } from "./terrain-style";

// Draws the look of a Cover tile (docs/design/role-visuals): the map's own Cover as blue shield panels on a plinth, Cover
// a Hero built as yellow-black construction bars. The shapes come from `coverLook` in terrain.ts.

const { blue: COVER_BLUE_VALUE, outline: OUTLINE, black: BAND, grey: RAIL } = TERRAIN_STYLE.coverLook;
export const COVER_BLUE = COVER_BLUE_VALUE;

/** `scale` is the camera scale: lines keep their width on screen. */
export function drawCoverLook(g: Graphics, look: CoverLook, scale: number): void {
  for (const { points, fill, edge, edgeWidth } of look.plinth) {
    g.poly(points).fill(fill).stroke({ width: worldLineWidth(edgeWidth, scale), color: edge, join: "round" });
  }
  for (const panel of look.panels) {
    const gradient = new FillGradient({
      type: "linear",
      start: { x: 0, y: 1 },
      end: { x: 0, y: 0 },
      colorStops: [
        { offset: 0, color: "rgba(77, 163, 255, 0.55)" },
        { offset: 1, color: "rgba(77, 163, 255, 0.08)" },
      ],
    });
    const [ax, ay, bx, by, bTopX, bTopY, aTopX, aTopY] = panel.points as [number, number, number, number, number, number, number, number];
    g.poly(panel.points).fill(gradient);
    g.moveTo(ax, ay).lineTo(aTopX, aTopY).moveTo(bx, by).lineTo(bTopX, bTopY).moveTo(aTopX, aTopY).lineTo(bTopX, bTopY);
    g.stroke({ width: worldLineWidth(1, scale), color: COVER_BLUE, alpha: 0.7 });
    g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: worldLineWidth(1.5, scale), color: COVER_BLUE });
  }
  for (const bar of look.bars) {
    g.poly(bar.points).fill(bar.fill);
    for (const stripe of bar.stripes) g.poly(stripe).fill(BAND);
    g.poly(bar.points).stroke({ width: worldLineWidth(1, scale), color: OUTLINE, join: "round" });
  }
  for (const [x1, y1, x2, y2] of look.rails) {
    g.moveTo(x1!, y1!).lineTo(x2!, y2!).stroke({ width: worldLineWidth(1.5, scale), color: RAIL, cap: "round" });
  }
}
