import type { HeroClass } from "game-core";
import { Container, Graphics, Text } from "pixi.js";
import { HERO_STYLE } from "./hero-style";
import { type HeroMarks, IconKind } from "./shield-marks";
import { worldLineWidth } from "./terrain";

export type HeroPose = "idle" | "hit" | "exhausted";

/** Body colour and height factor of a pose: a hit Hero flashes white, an Exhausted one is grey and slumped. */
export function poseLook(heroClass: HeroClass, pose: HeroPose): { body: number; squash: number } {
  if (pose === "hit") return { body: HERO_STYLE.hit, squash: 1 };
  if (pose === "exhausted") return { body: HERO_STYLE.exhausted, squash: 0.65 };
  return { body: HERO_STYLE.body[heroClass], squash: 1 };
}

/**
 * A Hero as a vector figure with its feet at (0, 0): contact shadow, Squad ring, a capsule body and a round head,
 * all with the dark outline. `scale` is the camera scale, so the outline keeps its width on screen.
 * The chest is left plain: the identity marker (a later ticket) goes there.
 */
export function heroFigure(heroClass: HeroClass, enemy: boolean, pose: HeroPose, scale: number): Container {
  const { shape, outline, ring, shadow, head } = HERO_STYLE;
  const { body, squash } = poseLook(heroClass, pose);
  const line = { width: worldLineWidth(outline.width, scale), color: outline.color, join: "round" as const };
  const bodyHeight = shape.bodyHeight * squash;
  const figure = new Container();
  figure.addChild(
    new Graphics().ellipse(0, -4, 28, 12).fill(shadow),
    new Graphics().ellipse(0, -4, 26, 11).stroke({ width: worldLineWidth(ring.width, scale), color: enemy ? ring.enemy : ring.own }),
    new Graphics()
      .roundRect(-shape.bodyWidth / 2, -shape.bodyLift - bodyHeight, shape.bodyWidth, bodyHeight, shape.bodyWidth / 2)
      .fill(body)
      .stroke(line),
    new Graphics().circle(0, -shape.bodyLift - bodyHeight - shape.headGap - shape.headRadius + 4, shape.headRadius).fill(head).stroke(line),
  );
  return figure;
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
export function marksFigure(marks: HeroMarks, scale: number, faint: boolean): Container {
  const { ruby, icon, faint: faintAlpha } = HERO_STYLE.marks;
  const line = { width: worldLineWidth(HERO_STYLE.outline.width, scale), color: HERO_STYLE.outline.color, join: "round" as const };
  const container = new Container();
  container.alpha = faint ? faintAlpha : 1;
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
      strokeDashed(rubies, points, ruby.dash, { width: worldLineWidth(2, scale), color: ruby.fill });
    }
  }
  container.addChild(rubies);
  if (marks.ticks.length > 0) container.addChild(tickLabel(marks.ticks.join(","), -left + ruby.size + 4, ruby.rowY));
  const iconStep = icon.size * 2 + icon.gap + 16;
  const iconLeft = (-(marks.icons.length - 1) * iconStep) / 2;
  marks.icons.forEach(({ kind, tick }, i) => {
    const x = iconLeft + i * iconStep;
    container.addChild(iconGraphics(kind, x - 6, icon.rowY, scale), tickLabel(String(tick), x + icon.size * 0.6 - 2, icon.rowY));
  });
  return container;
}

/** The translucent blue shield in front of the Hero, an upright ellipse with a brighter edge. */
export function shieldBubble(scale: number): Graphics {
  const { fill, fillAlpha, edgeAlpha, radiusX, radiusY, centerY } = HERO_STYLE.marks.bubble;
  return new Graphics()
    .ellipse(0, centerY, radiusX, radiusY)
    .fill({ color: fill, alpha: fillAlpha })
    .stroke({ width: worldLineWidth(2, scale), color: fill, alpha: edgeAlpha });
}
