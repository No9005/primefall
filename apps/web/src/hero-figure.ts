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
  /** The light edge drawn outside the dark outline: its colour and the width it adds on each side. */
  rim: { color: number; width: number };
}
interface Strokes {
  body: Stroke;
  limb: Stroke;
}

/**
 * A shape with the dark outline framed by the light rim. The wide light stroke goes first and the fill covers its inner
 * half, so only the part outside the dark outline shows.
 */
function rimmed(shape: (graphics: Graphics) => Graphics, fill: number, line: Stroke): Graphics {
  const graphics = new Graphics();
  shape(graphics).stroke({ width: line.width + 2 * line.rim.width, color: line.rim.color, join: line.join });
  return shape(graphics).fill(fill).stroke({ width: line.width, color: line.color, join: line.join });
}

/** A rounded box with the dark outline. */
function box(rect: { x: number; y: number; width: number; height: number; radius: number }, fill: number, line: Stroke): Graphics {
  return rimmed((g) => g.roundRect(rect.x, rect.y, rect.width, rect.height, rect.radius), fill, line);
}

/** A polygon given in fractions of its box, with the dark outline. */
function polygon(shape: { x: number; y: number; width: number; height: number; points: readonly number[] }, fill: number, line: Stroke): Graphics {
  const points = shape.points.map((value, i) => (i % 2 === 0 ? shape.x + value * shape.width : shape.y + value * shape.height));
  return rimmed((g) => g.poly(points), fill, line);
}

/** A container that turns about (x, y); its label is the name the clip player finds it by. */
function pivoted(label: string, x: number, y: number, degrees: number, ...children: (Graphics | Container)[]): Container {
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
  const children: (Graphics | Container)[] = [box({ x: -2, y: -1, width: shape.armWidth, height: a.height, radius: a.radius }, look.arms, strokes.limb)];
  if (front) {
    const { gun } = shape;
    const gunX = -2 + weapon.x;
    const gunY = -1 + weapon.y;
    // The weapon is its own part, so an Exhausted Assassin can fling its rifle away.
    const weaponParts = [box({ x: gunX, y: gunY, width: gun.width, height: gun.height, radius: weapon.radius }, gun.color, strokes.limb)];
    if (heroClass === HeroClass.Assassin) weaponParts.push(new Graphics().rect(gunX + scope.x, gunY + scope.y, scope.width, scope.height).fill(scope.color));
    children.push(pivoted("gun", 0, 0, 0, ...weaponParts), box({ x: -3, y: 7, width: a.hand, height: a.hand, radius: a.hand / 2 }, HERO_STYLE.skin, strokes.limb));
  } else if (heroClass === HeroClass.Controller) {
    children.push(box({ x: -2 + wrist.x, y: -1 + wrist.y, width: wrist.width, height: wrist.height, radius: 1 }, wrist.color, strokes.limb));
  }
  return pivoted(front ? "armF" : "armB", side.shoulderX, a.shoulderY - hipY, side.angle, ...children);
}

/** The head with its visor slit, and the Assassin's hood on it; it turns about the bottom centre. */
function head(heroClass: HeroClass, look: HeroLook, strokes: Strokes): Container {
  const { head: h, hood, hipY } = HERO_STYLE.rig;
  const visorX = h.size / 2 - HERO_STYLE.shape[heroClass].visorRight - h.visorWidth;
  const parts = [rimmed((g) => g.circle(0, -h.size / 2, h.size / 2), look.head, strokes.body)];
  if (heroClass === HeroClass.Assassin) parts.push(polygon({ ...hood, y: hood.y - h.pivotY }, look.accent, strokes.body));
  parts.push(new Graphics().rect(visorX, h.visorY - h.size, h.visorWidth, h.visorHeight).fill(look.visor));
  return pivoted("head", 0, h.pivotY - hipY, 0, ...parts);
}

/** The torso group: everything that leans and bobs with the hip, with the class parts. */
function torso(heroClass: HeroClass, look: HeroLook, strokes: Strokes): Container {
  const { body, hipY } = HERO_STYLE.rig;
  const shape = HERO_STYLE.shape[heroClass];
  const group = new Container();
  group.label = "torso";
  group.position.set(0, hipY);
  if (heroClass === HeroClass.Assassin) group.addChild(assassinCape(look, strokes));
  if (heroClass === HeroClass.Controller) group.addChild(...controllerBackpack(look, strokes));
  // The body and its plate turn about the middle of the body (a lean out of Full Cover).
  const bodyMiddle = localY(body.y) + body.height / 2;
  group.addChild(
    arm(heroClass, look, strokes, false),
    pivoted(
      "body",
      0,
      bodyMiddle,
      0,
      box({ x: -shape.bodyWidth / 2, y: -body.height / 2, width: shape.bodyWidth, height: body.height, radius: body.radius }, look.body, strokes.body),
      new Graphics()
        .roundRect(-shape.bodyWidth / 2 + shape.plate.x, -body.height / 2 + body.plateY, shape.plate.width, body.plateHeight, body.plateRadius)
        .fill(look.plate),
    ),
    head(heroClass, look, strokes),
    arm(heroClass, look, strokes, true),
  );
  // Silhouettes of body and head over the figure, shown only while a clip moves them: white for the flash of a Hit,
  // the Exhausted grey for a Hero that goes grey.
  group.addChild(silhouette(heroClass, "flash", HERO_STYLE.hit), silhouette(heroClass, "grey", HERO_STYLE.exhausted));
  if (heroClass === HeroClass.Assassin) group.addChild(silhouette(heroClass, "cloak", HERO_STYLE.rig.cloakFlash));
  if (heroClass === HeroClass.Controller) group.addChild(controllerSparks());
  if (heroClass === HeroClass.Bruiser) group.addChild(...bruiserPads(look, strokes));
  return group;
}

/** Y in the torso group, whose origin is the hip. */
const localY = (y: number) => y - HERO_STYLE.rig.hipY;

/** The cape hangs from the top right of its box, where it turns. */
function assassinCape(look: HeroLook, strokes: Strokes): Container {
  const { cape } = HERO_STYLE.rig;
  const hang = cape.x + cape.width * cape.pivot;
  return pivoted("cape", hang, localY(cape.y), 0, polygon({ ...cape, x: cape.x - hang, y: 0 }, look.arms, strokes.body));
}

/** The backpack, antenna and the beacon with its red twin (see the Exhausted clip). */
function controllerBackpack(look: HeroLook, strokes: Strokes): Graphics[] {
  const { pack, antenna, beacon } = HERO_STYLE.rig;
  const light = new Graphics().circle(beacon.x, localY(beacon.y), beacon.radius).fill(beacon.color);
  light.label = BEACON_LABEL;
  // The red light an Exhausted Controller's beacon turns into.
  const redLight = new Graphics().circle(beacon.x, localY(beacon.y), beacon.radius).fill(HERO_STYLE.rig.sparks.red);
  redLight.label = "beaconRed";
  redLight.alpha = 0;
  return [
    box({ x: pack.x, y: localY(pack.y), width: pack.width, height: pack.height, radius: pack.radius }, look.legs, strokes.body),
    new Graphics().rect(antenna.x, localY(antenna.y), antenna.width, antenna.height).fill(antenna.color),
    light,
    redLight,
  ];
}

/** An overlay of body and head in one colour, hidden until a clip shows it. */
function silhouette(heroClass: HeroClass, label: string, color: number): Graphics {
  const { body, head: h } = HERO_STYLE.rig;
  const shape = HERO_STYLE.shape[heroClass];
  const overlay = new Graphics()
    .roundRect(-shape.bodyWidth / 2, localY(body.y), shape.bodyWidth, body.height, body.radius)
    .circle(0, localY(h.pivotY) - h.size / 2, h.size / 2)
    .fill(color);
  overlay.label = label;
  overlay.alpha = 0;
  return overlay;
}

/** The sparks of the Controller's backpack, hidden until the Exhausted clip shows them. */
function controllerSparks(): Graphics {
  const { sparks } = HERO_STYLE.rig;
  const spark = new Graphics();
  for (const { x, y, color } of sparks.dots) spark.circle(x, localY(y), sparks.radius).fill(color);
  spark.label = "sparks";
  spark.alpha = 0;
  return spark;
}

function bruiserPads(look: HeroLook, strokes: Strokes): Graphics[] {
  const { pad } = HERO_STYLE.rig;
  return pad.xs.flatMap((x) => [
    box({ x, y: localY(pad.y), width: pad.width, height: pad.height, radius: pad.radius }, look.accent, strokes.body),
    new Graphics().rect(x + 2, localY(pad.y) + 1, pad.width - 4, pad.highlight).fill(look.plate),
  ]);
}

/** The two legs, each turning about the top centre of its box. */
function legs(heroClass: HeroClass, look: HeroLook, strokes: Strokes): Container {
  const { legs: l, hipY } = HERO_STYLE.rig;
  const width = HERO_STYLE.shape[heroClass].legWidth;
  const pair = new Container();
  l.xs.forEach((x, i) => {
    pair.addChild(pivoted(i === 0 ? "legL" : "legR", x + 3, hipY, 0, box({ x: -width / 2, y: 0, width, height: l.height, radius: l.radius }, look.legs, strokes.limb)));
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

/** The flat colour a hit or Exhausted Hero is drawn in; undefined for the team colours. */
function flatColor(pose: HeroPose): number | undefined {
  if (pose === "hit") return HERO_STYLE.hit;
  return pose === "exhausted" ? HERO_STYLE.exhausted : undefined;
}

/**
 * A Hero as a vector figure, the Hero rig of docs/design/animation, with its feet at (0, 0): contact shadow, Squad ring
 * and the rig, which faces right and is mirrored for the enemy. Every part is its own Graphics or container, so later
 * clips can move it. A hit Hero is flat white, an Exhausted one grey and slumped. `scale` is the camera scale, so the
 * outline keeps its width on screen. The Controller's beacon carries the label `BEACON_LABEL`.
 */
export function heroFigure(heroClass: HeroClass, enemy: boolean, pose: HeroPose, scale: number): Container {
  const { outline, ring, shadow, exhaustedSquash, line, rim } = HERO_STYLE;
  const team = heroLook(heroClass, enemy);
  const flat = flatColor(pose);
  const look: HeroLook = flat === undefined ? team : { ...team, body: flat, plate: flat, legs: flat, arms: flat, accent: flat, head: flat };
  // The whole figure is magnified, so strokes are drawn thinner to keep their width on screen.
  const inner = scale * HERO_STYLE.figureScale;
  const rimEdge = { color: enemy ? rim.enemy : rim.own, width: worldLineWidth(rim.width, inner) };
  const stroke = (screenWidth: number): Stroke => ({ width: worldLineWidth(screenWidth, inner), color: outline.color, join: "round", rim: rimEdge });
  const strokes: Strokes = { body: stroke(line.body), limb: stroke(line.limb) };
  const hips = torso(heroClass, look, strokes);
  if (pose === "exhausted") hips.scale.y = exhaustedSquash;
  const rig = new Container();
  rig.label = "rig";
  rig.addChild(legs(heroClass, look, strokes), hips);
  if (enemy) rig.scale.x = -1;
  // The Squad ring flashes red when the Hero is hit.
  const ringFlash = new Graphics()
    .ellipse(0, 0, ring.radiusX, ring.radiusY)
    .fill({ color: ring.enemy, alpha: 0.33 })
    .stroke({ width: worldLineWidth(ring.width, scale * HERO_STYLE.figureScale), color: ring.enemy });
  ringFlash.label = "ring";
  ringFlash.alpha = 0;
  const ringColor = enemy ? ring.enemy : ring.own;
  const teamRing = new Graphics()
    .ellipse(0, 0, ring.radiusX, ring.radiusY)
    .stroke({ width: worldLineWidth(ring.width + ring.glowExtra, inner), color: ringColor, alpha: ring.glowAlpha })
    .ellipse(0, 0, ring.radiusX, ring.radiusY)
    .stroke({ width: worldLineWidth(ring.width, inner), color: ringColor });
  teamRing.label = "teamRing";
  const figure = new Container();
  figure.scale.set(HERO_STYLE.figureScale);
  figure.addChild(new Graphics().ellipse(0, 0, shadow.radiusX, shadow.radiusY).fill(shadow), teamRing, ringFlash, rig);
  if (heroClass === HeroClass.Assassin) figure.addChild(flungRifle(enemy, strokes.limb));
  if (heroClass === HeroClass.Controller) figure.addChild(scoutDrone(enemy, strokes.limb));
  figure.addChild(pauseMark());
  return figure;
}

/** The Scout Drone: a flat blue disc with a flickering rotor, hidden until the clip flies it; mirrored with the Hero like the rig. */
function scoutDrone(enemy: boolean, line: Stroke): Container {
  const { x, y, width, height, color, rotor } = HERO_STYLE.rig.drone;
  const side = new Container();
  if (enemy) side.scale.x = -1;
  const blade = pivoted(
    "rotor",
    x + rotor.dx + rotor.width / 2,
    y + rotor.dy + rotor.height / 2,
    0,
    new Graphics().rect(-rotor.width / 2, -rotor.height / 2, rotor.width, rotor.height).fill({ color: rotor.color, alpha: rotor.alpha }),
  );
  side.addChild(pivoted("drone", 0, 0, 0, box({ x, y, width, height, radius: height / 2 }, color, line), blade));
  side.getChildByLabel("drone")!.alpha = 0;
  return side;
}

/** The rifle an Exhausted Assassin flings away: hidden until the clip throws it, and mirrored with the Hero like the rig. */
function flungRifle(enemy: boolean, line: Stroke): Container {
  const { x, y, width, height, color, scope } = HERO_STYLE.rig.flungRifle;
  const side = new Container();
  if (enemy) side.scale.x = -1;
  side.addChild(
    pivoted(
      "dropGun",
      x,
      y,
      0,
      box({ x: -width / 2, y: 0, width, height, radius: 2 }, color, line),
      new Graphics().rect(scope.x, scope.y, scope.width, scope.height).fill(scope.color),
    ),
  );
  side.getChildByLabel("dropGun")!.alpha = 0;
  return side;
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
