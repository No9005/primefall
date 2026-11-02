import { chebyshevDistance, type CardIndex, type GridPosition, type QueuedAction } from "game-core";
import type { TapTarget } from "./board-layout";
import { blockAction, CardUse, moveAction, primaryAction } from "./planning-selection";

// Dragging a card from the Hand: the mapping from a drop point to one use of the card is pure; the React and Pixi
// code only draw the zones and report points.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function rectContains({ left, top, right, bottom }: Rect, { x, y }: Point): boolean {
  return x >= left && x <= right && y >= top && y <= bottom;
}

/** What the board has under a point: the Hero or highlighted tile the tap picking finds, and the tile below it. */
export interface BoardPick {
  target: TapTarget;
  ground: GridPosition | undefined;
}

/** Where things are on screen. The board is asked what it has under a point. */
export interface DropLayout {
  board: Rect;
  blockChip: Rect;
  energyOrb: Rect;
  pickBoard: (point: Point) => BoardPick;
}

/** Where the dragged card could go, whether or not the use is allowed right now (`reasons` decides that). */
export interface DropPlaces {
  /** The selected Hero: the target of cards that need none, and the Hero a tile card is thrown from. */
  selfId: string;
  /** Heroes that are a valid target of the Primary effect. */
  heroIds: readonly string[];
  /** Tiles that are the tile target of the Primary effect (Breach Charge, Scout Drone, Deploy Cover). */
  primaryTiles: readonly GridPosition[];
  /** Tiles the Hero can Move 2 to. */
  moveTiles: readonly GridPosition[];
  /** A card that needs no target is played on the board within `radius` tiles of `center`. */
  here: { center: GridPosition; radius: number } | undefined;
}

/** One use of a card, with the target it was dropped on. */
export interface DropUse {
  use: CardUse;
  /** The Hero the Primary effect targets (the selected Hero for a card without a Hero target). */
  heroId?: string;
  tile?: GridPosition;
}

export interface DropProbe {
  /** The use a release at this point performs; `undefined` when it does nothing. */
  drop?: DropUse;
  /** The place is a use that is not allowed right now: why (the reasons of the card sheet). */
  blockedReason?: string;
  /** The label of the zone under the point. */
  label?: string;
}

const sameTile = (a: GridPosition, b: GridPosition) => a.col === b.col && a.row === b.row;

/** The verb a Primary effect shows on its zone, for example ATTACK. */
export type PrimaryVerb = string;

/** Resolves a drop point to the use it performs, if any, and says why a place that is not allowed does nothing. */
export function probeDrop(
  point: Point,
  layout: DropLayout,
  places: DropPlaces,
  reasons: Record<CardUse, string | undefined>,
  verb: PrimaryVerb,
): DropProbe {
  const place = (drop: DropUse, label: string): DropProbe => {
    const blockedReason = reasons[drop.use];
    return blockedReason === undefined ? { drop, label } : { blockedReason };
  };
  if (rectContains(layout.energyOrb, point)) return place({ use: CardUse.Pitch }, "PITCH +1");
  if (rectContains(layout.blockChip, point)) return place({ use: CardUse.Block }, "BLOCK 2");
  if (!rectContains(layout.board, point)) return {};

  const { target, ground } = layout.pickBoard(point);
  if (target.kind === "hero" && places.heroIds.includes(target.id)) {
    return place({ use: CardUse.Primary, heroId: target.id }, verb);
  }
  if (target.kind === "tile") {
    const tile = target.tile;
    if (places.primaryTiles.some((candidate) => sameTile(candidate, tile))) {
      return place({ use: CardUse.Primary, heroId: places.selfId, tile }, verb);
    }
    if (places.moveTiles.some((candidate) => sameTile(candidate, tile))) return place({ use: CardUse.Move, tile }, "MOVE 2");
  }
  const { here } = places;
  if (here && ground && chebyshevDistance(here.center, ground) <= here.radius) {
    return place({ use: CardUse.Primary, heroId: places.selfId }, "PLAY HERE");
  }
  return {};
}

export function resolveDrop(
  point: Point,
  layout: DropLayout,
  places: DropPlaces,
  reasons: Record<CardUse, string | undefined>,
): DropUse | undefined {
  return probeDrop(point, layout, places, reasons, "").drop;
}

/** The Queue and pitched cards after a drop; the same entries the tap flow builds. */
export function applyDrop(
  card: CardIndex,
  drop: DropUse,
  queue: readonly QueuedAction[],
  pitched: readonly CardIndex[],
): { queue: readonly QueuedAction[]; pitched: readonly CardIndex[] } {
  switch (drop.use) {
    case CardUse.Pitch:
      return { queue, pitched: [...pitched, card] };
    case CardUse.Block:
      return { queue: [...queue, blockAction(card)], pitched };
    case CardUse.Move:
      return { queue: [...queue, moveAction(card, drop.tile!)], pitched };
    case CardUse.Primary:
      return { queue: [...queue, primaryAction(card, drop.heroId!, { tile: drop.tile })], pitched };
  }
}
