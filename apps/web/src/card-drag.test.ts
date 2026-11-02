import { ActionKind, type CardIndex, type QueuedAction } from "game-core";
import { describe, expect, it } from "vitest";
import { applyDrop, type BoardPick, type DropLayout, type DropPlaces, type Point, probeDrop, resolveDrop } from "./card-drag";
import { blockAction, CardUse, moveAction, primaryAction } from "./planning-selection";

const allowed: Record<CardUse, string | undefined> = {
  [CardUse.Primary]: undefined,
  [CardUse.Pitch]: undefined,
  [CardUse.Move]: undefined,
  [CardUse.Block]: undefined,
};

const places: DropPlaces = {
  selfId: "left-bruiser",
  heroIds: ["right-assassin"],
  primaryTiles: [{ col: 6, row: 2 }],
  moveTiles: [{ col: 3, row: 1 }, { col: 6, row: 2 }],
  here: { center: { col: 2, row: 2 }, radius: 2 },
};

// A board that covers the right of a 1000 x 500 screen; what it has under a point is set by the point's x.
const board: Record<number, BoardPick> = {
  500: { target: { kind: "hero", id: "right-assassin" }, ground: { col: 7, row: 3 } },
  510: { target: { kind: "hero", id: "left-controller" }, ground: { col: 8, row: 8 } },
  520: { target: { kind: "tile", tile: { col: 6, row: 2 } }, ground: { col: 6, row: 2 } },
  530: { target: { kind: "tile", tile: { col: 3, row: 1 } }, ground: { col: 3, row: 1 } },
  540: { target: { kind: "none" }, ground: { col: 3, row: 3 } },
  550: { target: { kind: "none" }, ground: { col: 9, row: 9 } },
};
const layout: DropLayout = {
  board: { left: 300, top: 0, right: 1000, bottom: 500 },
  blockChip: { left: 10, top: 100, right: 130, bottom: 140 },
  energyOrb: { left: 10, top: 400, right: 50, bottom: 440 },
  pickBoard: ({ x }) => board[x] ?? { target: { kind: "none" }, ground: undefined },
};
const at = (x: number, y = 250): Point => ({ x, y });

describe("resolveDrop", () => {
  it("drops on an enemy Hero that is a valid target as the Primary effect on it", () => {
    expect(resolveDrop(at(500), layout, places, allowed)).toEqual({ use: CardUse.Primary, heroId: "right-assassin" });
  });

  it("ignores a Hero that is not a valid target", () => {
    expect(resolveDrop(at(510), layout, places, allowed)).toBeUndefined();
  });

  it("drops on a tile target as the Primary effect aimed at that tile, thrown from the selected Hero", () => {
    expect(resolveDrop(at(520), layout, places, allowed)).toEqual({ use: CardUse.Primary, heroId: "left-bruiser", tile: { col: 6, row: 2 } });
  });

  it("drops on a highlighted tile as a Move", () => {
    expect(resolveDrop(at(530), layout, places, allowed)).toEqual({ use: CardUse.Move, tile: { col: 3, row: 1 } });
  });

  it("drops on the board near the Hero as the Primary effect of a card that needs no target", () => {
    expect(resolveDrop(at(540), layout, places, allowed)).toEqual({ use: CardUse.Primary, heroId: "left-bruiser" });
    expect(resolveDrop(at(540), layout, { ...places, here: undefined }, allowed)).toBeUndefined();
  });

  it("does nothing on the board far from the Hero", () => {
    expect(resolveDrop(at(550), layout, places, allowed)).toBeUndefined();
  });

  it("drops on the Block chip as Block and on the Energy orb as Pitch", () => {
    expect(resolveDrop(at(60, 120), layout, places, allowed)).toEqual({ use: CardUse.Block });
    expect(resolveDrop(at(30, 420), layout, places, allowed)).toEqual({ use: CardUse.Pitch });
  });

  it("does nothing outside every zone", () => {
    expect(resolveDrop(at(200, 300), layout, places, allowed)).toBeUndefined();
    expect(resolveDrop(at(1200), layout, places, allowed)).toBeUndefined();
  });

  it("returns none for a use that is not allowed and says why", () => {
    const reasons = { ...allowed, [CardUse.Primary]: "needs 2 Energy", [CardUse.Block]: "Queue is full", [CardUse.Move]: "Queue is full" };
    for (const x of [500, 520, 530, 540]) expect(resolveDrop(at(x), layout, places, reasons)).toBeUndefined();
    expect(resolveDrop(at(60, 120), layout, places, reasons)).toBeUndefined();
    expect(probeDrop(at(500), layout, places, reasons, "ATTACK").blockedReason).toBe("needs 2 Energy");
    expect(probeDrop(at(60, 120), layout, places, reasons, "ATTACK").blockedReason).toBe("Queue is full");
    expect(resolveDrop(at(30, 420), layout, places, reasons)).toEqual({ use: CardUse.Pitch });
  });

  it("labels the zone under the point", () => {
    expect(probeDrop(at(500), layout, places, allowed, "ATTACK").label).toBe("ATTACK");
    expect(probeDrop(at(530), layout, places, allowed, "ATTACK").label).toBe("MOVE 2");
    expect(probeDrop(at(540), layout, places, allowed, "USE").label).toBe("PLAY HERE");
  });
});

describe("applyDrop", () => {
  const card: CardIndex = 3;
  const queue: readonly QueuedAction[] = [{ kind: ActionKind.Block, card: 0 }];

  it("adds the same Queue entry as the tap flow for Primary, Move and Block", () => {
    const primary = resolveDrop(at(500), layout, places, allowed)!;
    expect(applyDrop(card, primary, queue, []).queue).toEqual([...queue, primaryAction(card, "right-assassin")]);
    expect(applyDrop(card, primary, queue, []).queue.at(-1)).toEqual({ kind: ActionKind.Primary, card, target: "right-assassin" });

    const tile = resolveDrop(at(520), layout, places, allowed)!;
    expect(applyDrop(card, tile, queue, []).queue.at(-1)).toEqual({ kind: ActionKind.Primary, card, target: "left-bruiser", tile: { col: 6, row: 2 } });

    const move = resolveDrop(at(530), layout, places, allowed)!;
    expect(applyDrop(card, move, queue, []).queue.at(-1)).toEqual(moveAction(card, { col: 3, row: 1 }));
    expect(applyDrop(card, move, queue, []).queue.at(-1)).toEqual({ kind: ActionKind.Move, card, destination: { col: 3, row: 1 } });

    const block = resolveDrop(at(60, 120), layout, places, allowed)!;
    expect(applyDrop(card, block, queue, []).queue.at(-1)).toEqual(blockAction(card));
    expect(applyDrop(card, block, queue, []).queue.at(-1)).toEqual({ kind: ActionKind.Block, card });
  });

  it("pitches the card without touching the Queue, like the tap flow", () => {
    const pitch = resolveDrop(at(30, 420), layout, places, allowed)!;
    expect(applyDrop(card, pitch, queue, [1])).toEqual({ queue, pitched: [1, card] });
  });
});
