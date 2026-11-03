import type { HeroClass } from "game-core";
import { Container, Graphics } from "pixi.js";
import { HERO_STYLE } from "./hero-style";
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
