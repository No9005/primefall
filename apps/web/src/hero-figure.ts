import { Container, Graphics, Text } from "pixi.js";
import { HERO_STYLE } from "./hero-style";
import { type HeroMarks, IconKind } from "./shield-marks";
import { worldLineWidth } from "./terrain";

export type HeroPose = "idle" | "hit" | "exhausted";

/**
 * What lies under a Hero's feet, in drawing order: the contact shadow, the Squad ring (label "teamRing") and the red ring
 * flash of a hit (label "ring", hidden at rest). Shared by the shape rig and the pixel figure. In design px, so they go in
 * a container scaled by `HERO_STYLE.figureScale`; `scale` is the camera scale, so the strokes keep their width on screen.
 */
export function groundMarks(enemy: boolean, scale: number): [shadow: Graphics, teamRing: Graphics, ringFlash: Graphics] {
  const { ring, shadow } = HERO_STYLE;
  const inner = scale * HERO_STYLE.figureScale;
  const ringFlash = new Graphics()
    .ellipse(0, 0, ring.radiusX, ring.radiusY)
    .fill({ color: ring.enemy, alpha: 0.33 })
    .stroke({ width: worldLineWidth(ring.width, inner), color: ring.enemy });
  ringFlash.label = "ring";
  ringFlash.alpha = 0;
  const ringColor = enemy ? ring.enemy : ring.own;
  const teamRing = new Graphics()
    .ellipse(0, 0, ring.radiusX, ring.radiusY)
    .stroke({ width: worldLineWidth(ring.width + ring.glowExtra, inner), color: ringColor, alpha: ring.glowAlpha })
    .ellipse(0, 0, ring.radiusX, ring.radiusY)
    .stroke({ width: worldLineWidth(ring.width, inner), color: ringColor });
  teamRing.label = "teamRing";
  return [new Graphics().ellipse(0, 0, shadow.radiusX, shadow.radiusY).fill(shadow), teamRing, ringFlash];
}

/** The outline of a ruby, a faceted gem pointing down, centred on (x, y). */
function rubyPoints(x: number, y: number, size: number): number[] {
  return [-0.55, -0.9, 0.55, -0.9, 1, -0.2, 0, 0.9, -1, -0.2].map((value, index) => (index % 2 === 0 ? x + value * size : y + value * size));
}

/** Strokes a closed polygon as dashes, for the hollow rubies of a planned Shield. */
function strokeDashed(graphics: Graphics, points: readonly number[], dash: number, line: { width: number; color: number }): void {
  for (let i = 0; i < points.length; i += 2) {
    const [x1, y1] = [points[i]!, points[i + 1]!];
    const [x2, y2] = [points[(i + 2) % points.length]!, points[(i + 3) % points.length]!];
    const dashes = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / dash / 2));
    for (let step = 0; step < dashes; step++) {
      const from = step / dashes;
      const to = (step + 0.5) / dashes;
      graphics.moveTo(x1 + (x2 - x1) * from, y1 + (y2 - y1) * from).lineTo(x1 + (x2 - x1) * to, y1 + (y2 - y1) * to);
    }
  }
  graphics.stroke(line);
}

function tickLabel(text: string, x: number, y: number): Text {
  const { fill, size } = HERO_STYLE.marks.tickText;
  const label = new Text({ text, style: { fill, fontSize: size, fontWeight: "700", stroke: { color: HERO_STYLE.outline.color, width: 3 } } });
  label.anchor.set(0, 0.5);
  label.position.set(x, y);
  return label;
}

/** The small grey badge of a planned Wait: the slot number and a pause sign. */
function waitBadge(tick: number, x: number, y: number): Container {
  const { fill, text, size } = HERO_STYLE.marks.waitBadge;
  const label = new Text({ text: `${tick} II`, style: { fill: text, fontSize: size, fontWeight: "700" } });
  label.anchor.set(0.5);
  const badge = new Container();
  badge.position.set(x, y);
  badge.addChild(new Graphics().roundRect(-label.width / 2 - 5, -9, label.width + 10, 18, 9).fill(fill), label);
  return badge;
}

function iconGraphics(kind: IconKind, x: number, y: number, scale: number): Graphics {
  const { fill, size } = HERO_STYLE.marks.icon;
  const line = { width: worldLineWidth(HERO_STYLE.outline.width, scale), color: HERO_STYLE.outline.color, join: "round" as const };
  const graphics = new Graphics();
  if (kind === IconKind.Wait) {
    // An hourglass: two triangles meeting in the middle.
    graphics.poly([x - size / 2, y - size, x + size / 2, y - size, x, y, x + size / 2, y + size, x - size / 2, y + size, x, y]).fill(fill).stroke(line);
  } else {
    // A small card, upright.
    graphics.roundRect(x - size * 0.6, y - size, size * 1.2, size * 2, 2).fill(fill).stroke(line);
  }
  return graphics;
}

/**
 * The marks above a Hero: a row of rubies (filled for held Shield, hollow and dashed for a queued Block, with its Tick)
 * and the icons of planned Waits and self-played cards. Drawn in the Hero's own Graphics, without filters.
 */
export function marksFigure(marks: HeroMarks, cameraScale: number): Container {
  const { ruby, icon } = HERO_STYLE.marks;
  const scale = cameraScale * HERO_STYLE.figureScale;
  const line = { width: worldLineWidth(HERO_STYLE.outline.width, scale), color: HERO_STYLE.outline.color, join: "round" as const };
  const container = new Container();
  container.scale.set(HERO_STYLE.figureScale);
  const step = ruby.size * 2 + ruby.gap;
  const left = (-(marks.rubies - 1) * step) / 2;
  const rubies = new Graphics();
  for (let i = 0; i < marks.rubies; i++) {
    const x = left + i * step;
    const points = rubyPoints(x, ruby.rowY, ruby.size);
    if (marks.filled) {
      rubies.poly(points).fill(ruby.fill).stroke(line);
      const top = ruby.rowY - ruby.size * 0.9;
      rubies.poly([x - ruby.size * 0.55, top, x + ruby.size * 0.55, top, x, ruby.rowY - ruby.size * 0.1]).fill(ruby.facet);
    } else {
      // A queued Block: a hollow dashed diamond.
      const diamond = [0, -1, 1, 0, 0, 1, -1, 0].map((value, index) => (index % 2 === 0 ? x + value * ruby.size : ruby.rowY + value * ruby.size));
      strokeDashed(rubies, diamond, ruby.dash, { width: worldLineWidth(2, scale), color: ruby.fill });
    }
  }
  container.addChild(rubies);
  if (marks.ticks.length > 0) container.addChild(tickLabel(marks.ticks.join(","), -left + ruby.size + 4, ruby.rowY));
  const iconStep = icon.size * 2 + icon.gap + 16;
  const iconLeft = (-(marks.icons.length - 1) * iconStep) / 2;
  marks.icons.forEach(({ kind, tick }, i) => {
    const x = iconLeft + i * iconStep;
    if (kind === IconKind.Wait) {
      container.addChild(waitBadge(tick, x, icon.rowY));
      return;
    }
    container.addChild(iconGraphics(kind, x - 6, icon.rowY, scale), tickLabel(String(tick), x + icon.size * 0.6 - 2, icon.rowY));
  });
  return container;
}

/**
 * The row of `total` filled rubies as separate shapes, each centred on its own origin so it can pop, swell or burst on
 * its own. The container is scaled like `marksFigure`; the rubies keep their places when one of them goes.
 */
export function rubyPieces(total: number, cameraScale: number): { row: Container; rubies: Graphics[] } {
  const { ruby } = HERO_STYLE.marks;
  const scale = cameraScale * HERO_STYLE.figureScale;
  const line = { width: worldLineWidth(HERO_STYLE.outline.width, scale), color: HERO_STYLE.outline.color, join: "round" as const };
  const row = new Container();
  row.scale.set(HERO_STYLE.figureScale);
  const step = ruby.size * 2 + ruby.gap;
  const rubies = Array.from({ length: total }, (_, i) => {
    const piece = new Graphics();
    piece.poly(rubyPoints(0, 0, ruby.size)).fill(ruby.fill).stroke(line);
    const top = -ruby.size * 0.9;
    piece.poly([-ruby.size * 0.55, top, ruby.size * 0.55, top, 0, -ruby.size * 0.1]).fill(ruby.facet);
    piece.position.set((-(total - 1) * step) / 2 + i * step, ruby.rowY);
    row.addChild(piece);
    return piece;
  });
  return { row, rubies };
}

/** The translucent blue shield in front of the Hero, an upright ellipse with a brighter edge. */
export function shieldBubble(cameraScale: number): Graphics {
  const { fill, fillAlpha, edgeAlpha, radiusX, radiusY, centerY } = HERO_STYLE.marks.bubble;
  const bubble = new Graphics()
    .ellipse(0, centerY, radiusX, radiusY)
    .fill({ color: fill, alpha: fillAlpha })
    .stroke({ width: worldLineWidth(2, cameraScale * HERO_STYLE.figureScale), color: fill, alpha: edgeAlpha });
  bubble.scale.set(HERO_STYLE.figureScale);
  return bubble;
}
