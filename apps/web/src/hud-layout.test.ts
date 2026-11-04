import { reachableMoveDestinations } from "game-core";
import { describe, expect, it } from "vitest";
import type { Rect } from "./card-drag";
import { computeCamera, frameMoveCamera, gridToWorld } from "./board-layout";
import { commitRect, freeBoardArea, handRect, waitCardRect } from "./hud-layout";

const VIEWS = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
];

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const contains = (rect: Rect, point: { x: number; y: number }) =>
  point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

describe("the free board area", () => {
  for (const view of VIEWS) {
    describe(`at ${view.width} x ${view.height}`, () => {
      const inView = (rect: Rect) => rect.left >= 0 && rect.top >= 0 && rect.right <= view.width && rect.bottom <= view.height;

      it("is a non-empty part of the view in every HUD state", () => {
        for (const state of [{ kind: "idle" }, { kind: "picking" }] as const) {
          const free = freeBoardArea(view, state);
          expect(inView(free)).toBe(true);
          expect(free.right - free.left).toBeGreaterThan(200);
          expect(free.bottom - free.top).toBeGreaterThan(100);
        }
      });

      it("is larger while a target is picked than when the whole HUD is shown", () => {
        const idle = freeBoardArea(view, { kind: "idle" });
        const picking = freeBoardArea(view, { kind: "picking" });
        const area = (rect: Rect) => (rect.right - rect.left) * (rect.bottom - rect.top);
        expect(area(picking)).toBeGreaterThan(area(idle));
      });

      it("keeps clear of Commit while a target is picked", () => {
        const free = freeBoardArea(view, { kind: "picking" });
        expect(overlaps(free, commitRect(view))).toBe(false);
      });
    });
  }
});

describe("the HUD elements at the right and bottom", () => {
  for (const view of VIEWS) {
    describe(`at ${view.width} x ${view.height}`, () => {
      it("do not overlap each other, even with a fifth Queue row", () => {
        const elements = [commitRect(view, 5), handRect(view), waitCardRect(view)];
        elements.forEach((a, i) => elements.slice(i + 1).forEach((b) => expect(overlaps(a, b), `${i}`).toBe(false)));
      });

      it("keep clear of the idle free board area", () => {
        const free = freeBoardArea(view, { kind: "idle" });
        for (const hud of [commitRect(view, 5), handRect(view), waitCardRect(view)]) expect(overlaps(free, hud)).toBe(false);
      });

      it("stay inside the view", () => {
        for (const rect of [commitRect(view, 5), waitCardRect(view)]) {
          expect(rect.left >= 0 && rect.top >= 0 && rect.right <= view.width && rect.bottom <= view.height).toBe(true);
        }
      });
    });
  }
});

describe("framing a pick inside the free area", () => {
  for (const view of VIEWS) {
    describe(`at ${view.width} x ${view.height}`, () => {
      const free = freeBoardArea(view, { kind: "picking" });
      const fitted = computeCamera(view.width, view.height);
      const heroes = [
        { name: "on the left edge", tile: { col: 0, row: 8 } },
        { name: "in the middle", tile: { col: 15, row: 8 } },
        { name: "on the right edge", tile: { col: 30, row: 8 } },
        { name: "in the top left corner", tile: { col: 0, row: 0 } },
        { name: "in the bottom right corner", tile: { col: 30, row: 16 } },
      ];
      for (const { name, tile } of heroes) {
        it(`shows a Hero ${name} and every lit tile of its Move inside the free area`, () => {
          const highlights = reachableMoveDestinations(tile);
          const camera = frameMoveCamera(tile, highlights, view, free);
          for (const target of [tile, ...highlights]) {
            const world = gridToWorld(target);
            const screen = { x: world.x * camera.scale + camera.x, y: world.y * camera.scale + camera.y };
            expect(contains(free, screen), `${target.col},${target.row} at ${screen.x},${screen.y}`).toBe(true);
          }
        });
      }

      it("zooms out as far as needed to fit far tiles, but not past the fitted view", () => {
        const far = [{ col: 0, row: 0 }, { col: 30, row: 16 }];
        const camera = frameMoveCamera({ col: 15, row: 8 }, far, view, free);
        expect(camera.scale).toBeCloseTo(fitted.scale);
      });
    });
  }
});
