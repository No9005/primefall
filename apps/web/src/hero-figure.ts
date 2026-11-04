import { HeroClass } from "game-core";
import { Container, Graphics, Text } from "pixi.js";
import { HERO_STYLE, type HeroLook, heroLook } from "./hero-style";
import { type HeroMarks, IconKind } from "./shield-marks";
import { worldLineWidth } from "./terrain";

export type HeroPose = "idle" | "hit" | "exhausted";

/** Opacity of the Controller's beacon at a time: 1 to 0.25 and back, a smooth loop of 1.4 s. */
export function beaconAlpha(ms: number): number {
  const { periodMs, minAlpha } = HERO_STYLE.rig.beacon;
  const phase = (ms % periodMs) / periodMs;
  return minAlpha + (1 - minAlpha) * (0.5 + 0.5 * Math.cos(phase * 2 * Math.PI));
}

/** The label of the beacon, so the board can blink it. */
export const BEACON_LABEL = "beacon";

interface Stroke {
  width: number;
  color: number;
  join: "round";
}
interface Strokes {
  body: Stroke;
  limb: Stroke;
}

/** A rounded box with the dark outline. */
function box(x: number, y: number, width: number, height: number, radius: number, fill: number, line: Stroke): Graphics {
  return new Graphics().roundRect(x, y, width, height, radius).fill(fill).stroke(line);
}

/** A polygon given in fractions of its box, with the dark outline. */
function polygon(shape: { x: number; y: number; width: number; height: number; points: readonly number[] }, fill: number, line: Stroke): Graphics {
  const points = shape.points.map((value, i) => (i % 2 === 0 ? shape.x + value * shape.width : shape.y + value * shape.height));
  return new Graphics().poly(points).fill(fill).stroke(line);
}

/** A container that turns about (x, y); its label is the name the clip player finds it by. */
function pivoted(label: string, x: number, y: number, degrees: number, ...children: Graphics[]): Container {
  const part = new Container();
  part.label = label;
  part.position.set(x, y);
  part.rotation = (degrees * Math.PI) / 180;
  part.addChild(...children);
  return part;
}

/** One arm, hanging from its shoulder; the front arm carries the hand and the weapon (children, so they point along the arm). */
function arm(heroClass: HeroClass, look: HeroLook, strokes: Strokes, front: boolean): Container {
  const { arm: a, weapon, scope, console: wrist, hipY } = HERO_STYLE.rig;
  const shape = HERO_STYLE.shape[heroClass];
  const side = front ? a.front : a.back;
  // The arm box starts 2 px left of and 1 px above the shoulder.
  const children: Graphics[] = [box(-2, -1, shape.armWidth, a.height, a.radius, look.arms, strokes.limb)];
  if (front) {
    const { gun } = shape;
    const gunX = -2 + weapon.x;
    const gunY = -1 + weapon.y;
    children.push(
      box(gunX, gunY, gun.width, gun.height, weapon.radius, gun.color, strokes.limb),
      box(-3, 7, a.hand, a.hand, a.hand / 2, HERO_STYLE.skin, strokes.limb),
    );
    if (heroClass === HeroClass.Assassin) children.push(new Graphics().rect(gunX + scope.x, gunY + scope.y, scope.width, scope.height).fill(scope.color));
  } else if (heroClass === HeroClass.Controller) {
    children.push(box(-2 + wrist.x, -1 + wrist.y, wrist.width, wrist.height, 1, wrist.color, strokes.limb));
  }
  return pivoted(front ? "armF" : "armB", side.shoulderX, a.shoulderY - hipY, side.angle, ...children);
}

/** The head with its visor slit, and the Assassin's hood on it; it turns about the bottom centre. */
function head(heroClass: HeroClass, look: HeroLook, strokes: Strokes): Container {
  const { head: h, hood, hipY } = HERO_STYLE.rig;
  const visorX = h.size / 2 - HERO_STYLE.shape[heroClass].visorRight - h.visorWidth;
  const parts = [new Graphics().circle(0, -h.size / 2, h.size / 2).fill(look.head).stroke(strokes.body)];
  if (heroClass === HeroClass.Assassin) parts.push(polygon({ ...hood, y: hood.y - h.pivotY }, look.accent, strokes.body));
  parts.push(new Graphics().rect(visorX, h.visorY - h.size, h.visorWidth, h.visorHeight).fill(look.visor));
  return pivoted("head", 0, h.pivotY - hipY, 0, ...parts);
}

/** The torso group: everything that leans and bobs with the hip, with the class parts. */
function torso(heroClass: HeroClass, look: HeroLook, strokes: Strokes): Container {
  const { body, hipY } = HERO_STYLE.rig;
  const shape = HERO_STYLE.shape[heroClass];
  const local = (y: number) => y - hipY;
  const group = new Container();
  group.label = "torso";
  group.position.set(0, hipY);
  if (heroClass === HeroClass.Assassin) {
    const { cape } = HERO_STYLE.rig;
    // The cape hangs from the top right of its box, where it turns.
    const hang = cape.x + cape.width * cape.pivot;
    group.addChild(pivoted("cape", hang, local(cape.y), 0, polygon({ ...cape, x: cape.x - hang, y: 0 }, look.arms, strokes.body)));
  }
  if (heroClass === HeroClass.Controller) {
    const { pack, antenna, beacon } = HERO_STYLE.rig;
    const light = new Graphics().circle(beacon.x, local(beacon.y), beacon.radius).fill(beacon.color);
    light.label = BEACON_LABEL;
    group.addChild(
      box(pack.x, local(pack.y), pack.width, pack.height, pack.radius, look.legs, strokes.body),
      new Graphics().rect(antenna.x, local(antenna.y), antenna.width, antenna.height).fill(antenna.color),
      light,
    );
  }
  group.addChild(
    arm(heroClass, look, strokes, false),
    box(-shape.bodyWidth / 2, local(body.y), shape.bodyWidth, body.height, body.radius, look.body, strokes.body),
    new Graphics()
      .roundRect(-shape.bodyWidth / 2 + shape.plate.x, local(body.y) + body.plateY, shape.plate.width, body.plateHeight, body.plateRadius)
      .fill(look.plate),
    head(heroClass, look, strokes),
    arm(heroClass, look, strokes, true),
  );
  if (heroClass === HeroClass.Bruiser) {
    const { pad } = HERO_STYLE.rig;
    for (const x of pad.xs) {
      group.addChild(
        box(x, local(pad.y), pad.width, pad.height, pad.radius, look.accent, strokes.body),
        new Graphics().rect(x + 2, local(pad.y) + 1, pad.width - 4, pad.highlight).fill(look.plate),
      );
    }
  }
  return group;
}

/** The two legs, each turning about the top centre of its box. */
function legs(heroClass: HeroClass, look: HeroLook, strokes: Strokes): Container {
  const { legs: l, hipY } = HERO_STYLE.rig;
  const width = HERO_STYLE.shape[heroClass].legWidth;
  const pair = new Container();
  l.xs.forEach((x, i) => {
    pair.addChild(pivoted(i === 0 ? "legL" : "legR", x + 3, hipY, 0, box(-width / 2, 0, width, l.height, l.radius, look.legs, strokes.limb)));
  });
  return pair;
}

/** The grey II above the head, hidden until the Wait clip shows it. It is not mirrored with the rig. */
function pauseMark(): Graphics {
  const { y, barWidth, barHeight, gap, color } = HERO_STYLE.rig.pause;
  const left = -gap / 2 - barWidth;
  const mark = new Graphics().rect(left, y, barWidth, barHeight).rect(gap / 2, y, barWidth, barHeight).fill(color);
  mark.label = "pause";
  mark.alpha = 0;
  return mark;
}

/**
 * A Hero as a vector figure, the Hero rig of docs/design/animation, with its feet at (0, 0): contact shadow, Squad ring
 * and the rig, which faces right and is mirrored for the enemy. Every part is its own Graphics or container, so later
 * clips can move it. A hit Hero is flat white, an Exhausted one grey and slumped. `scale` is the camera scale, so the
 * outline keeps its width on screen. The Controller's beacon carries the label `BEACON_LABEL`.
 */
export function heroFigure(heroClass: HeroClass, enemy: boolean, pose: HeroPose, scale: number): Container {
  const { outline, ring, shadow, exhausted, hit, exhaustedSquash, line } = HERO_STYLE;
  const team = heroLook(heroClass, enemy);
  const flat = pose === "hit" ? hit : pose === "exhausted" ? exhausted : undefined;
  const look: HeroLook = flat === undefined ? team : { ...team, body: flat, plate: flat, legs: flat, arms: flat, accent: flat, head: flat };
  const stroke = (screenWidth: number): Stroke => ({ width: worldLineWidth(screenWidth, scale), color: outline.color, join: "round" });
  const strokes: Strokes = { body: stroke(line.body), limb: stroke(line.limb) };
  const hips = torso(heroClass, look, strokes);
  if (pose === "exhausted") hips.scale.y = exhaustedSquash;
  const rig = new Container();
  rig.addChild(legs(heroClass, look, strokes), hips);
  if (enemy) rig.scale.x = -1;
  const figure = new Container();
  figure.addChild(
    new Graphics().ellipse(0, 0, shadow.radiusX, shadow.radiusY).fill(shadow),
    new Graphics().ellipse(0, 0, ring.radiusX, ring.radiusY).stroke({ width: worldLineWidth(ring.width, scale), color: enemy ? ring.enemy : ring.own }),
    rig,
    pauseMark(),
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
export function marksFigure(marks: HeroMarks, scale: number): Container {
  const { ruby, icon } = HERO_STYLE.marks;
  const line = { width: worldLineWidth(HERO_STYLE.outline.width, scale), color: HERO_STYLE.outline.color, join: "round" as const };
  const container = new Container();
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

/** The translucent blue shield in front of the Hero, an upright ellipse with a brighter edge. */
export function shieldBubble(scale: number): Graphics {
  const { fill, fillAlpha, edgeAlpha, radiusX, radiusY, centerY } = HERO_STYLE.marks.bubble;
  return new Graphics()
    .ellipse(0, centerY, radiusX, radiusY)
    .fill({ color: fill, alpha: fillAlpha })
    .stroke({ width: worldLineWidth(2, scale), color: fill, alpha: edgeAlpha });
}
