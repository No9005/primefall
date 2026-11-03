import { describe, expect, it } from "vitest";
import { computeCamera, gridToWorld, pickTileAt, resolveTap, viewToWorld, zoomAt } from "./board-layout";
import { type DropLayout, type DropPlaces, type Point, probeDrop } from "./card-drag";
import { CardUse } from "./planning-selection";

// Touch targets have a minimum size in screen pixels, whatever the board is fitted to (issue 148).

const allowed: Record<CardUse, string | undefined> = {
  [CardUse.Primary]: undefined,
  [CardUse.Pitch]: undefined,
  [CardUse.Move]: undefined,
  [CardUse.Block]: undefined,
};

describe("minimum touch size of Heroes", () => {
  const hero = { id: "ally", position: { col: 10, row: 8 } };
  const candidates = { heroes: [hero], targetableIds: ["ally"], highlights: [] };

  for (const view of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
    it(`picks a Hero 15 px away on screen but not one 40 px away at ${view.width} x ${view.height}, fitted, zoomed out and zoomed in`, () => {
      const fitted = computeCamera(view.width, view.height);
      // The zoom cannot go below the fitted scale, so asking for less gives the fitted camera again.
      const zoomedOut = zoomAt(fitted, fitted.scale * 0.5, view.width / 2, view.height / 2, view);
      const zoomedIn = zoomAt(fitted, fitted.scale * 2, view.width / 2, view.height / 2, view);
      for (const camera of [fitted, zoomedOut, zoomedIn]) {
        const centre = gridToWorld(hero.position);
        const screen = { x: centre.x * camera.scale + camera.x, y: centre.y * camera.scale + camera.y };
        const tapAt = (dx: number) => {
          const { x, y } = viewToWorld(screen.x + dx, screen.y, view.width, view.height, undefined, camera);
          return resolveTap(x, y, candidates, undefined, undefined, camera.scale);
        };
        expect(tapAt(15)).toEqual({ kind: "hero", id: "ally" });
        expect(tapAt(-15)).toEqual({ kind: "hero", id: "ally" });
        expect(tapAt(40).kind).toBe("none");
      }
    });
  }
});

describe("minimum touch size of tiles and card drops", () => {
  const tile = { col: 10, row: 8 };
  const view = { width: 844, height: 390 };
  const camera = computeCamera(view.width, view.height);
  const bottomCorner = gridToWorld({ col: tile.col + 0.5, row: tile.row + 0.5 });
  const below = (px: number): Point => ({ x: bottomCorner.x * camera.scale + camera.x, y: bottomCorner.y * camera.scale + camera.y + px });
  const highlights = [tile];

  it("picks a highlighted tile within 22 px of its floor and none farther away", () => {
    const tapBelow = (px: number) => {
      const { x, y } = viewToWorld(below(px).x, below(px).y, view.width, view.height, undefined, camera);
      return resolveTap(x, y, { heroes: [], targetableIds: [], highlights }, undefined, undefined, camera.scale);
    };
    expect(tapBelow(15)).toEqual({ kind: "tile", tile });
    expect(tapBelow(40)).toEqual({ kind: "none" });
  });

  const layout: DropLayout = {
    board: { left: 0, top: 0, right: view.width, bottom: view.height },
    blockChip: { left: -10, top: -10, right: -5, bottom: -5 },
    energyOrb: { left: -10, top: -10, right: -5, bottom: -5 },
    hud: [],
    pickBoard: (point) => {
      const { x, y } = viewToWorld(point.x, point.y, view.width, view.height, undefined, camera);
      return { target: resolveTap(x, y, { heroes: [], targetableIds: [], highlights }, undefined, undefined, camera.scale), ground: pickTileAt(x, y) };
    },
  };
  const places: DropPlaces = { selfId: "ally", heroIds: [], primaryTiles: [], moveTiles: [tile], here: undefined };

  it("plays Move to the tile when dropped 15 px beside it, and shows that tile; far from any tile it cancels", () => {
    const probe = probeDrop(below(15), layout, places, allowed, "USE");
    expect(probe.drop).toEqual({ use: CardUse.Move, tile });
    expect(probe.label).toBe("MOVE 2");
    expect(probeDrop(below(80), layout, places, allowed, "USE").drop).toBeUndefined();
  });
});
