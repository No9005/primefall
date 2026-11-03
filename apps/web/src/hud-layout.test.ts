import { reachableMoveDestinations } from "game-core";
import { describe, expect, it } from "vitest";
import type { Rect } from "./card-drag";
import { computeCamera, frameMoveCamera, gridToWorld } from "./board-layout";
import { cardSheetRect, commitRect, freeBoardArea, handRect, zoomColumnRect } from "./hud-layout";

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
        const sheet = cardSheetRect(view, undefined);
        for (const state of [{ kind: "idle" }, { kind: "sheet", sheet }, { kind: "picking" }] as const) {
          const free = freeBoardArea(view, state);
          expect(inView(free)).toBe(true);
          expect(free.right - free.left).toBeGreaterThan(200);
          expect(free.bottom - free.top).toBeGreaterThan(state.kind === "sheet" ? 50 : 100);
        }
      });

      it("is larger while a target is picked than when the whole HUD is shown", () => {
        const idle = freeBoardArea(view, { kind: "idle" });
        const picking = freeBoardArea(view, { kind: "picking" });
        const area = (rect: Rect) => (rect.right - rect.left) * (rect.bottom - rect.top);
        expect(area(picking)).toBeGreaterThan(area(idle));
      });

      it("starts below the card sheet while the sheet is open", () => {
        const sheet = cardSheetRect(view, undefined);
        const free = freeBoardArea(view, { kind: "sheet", sheet });
        expect(free.top).toBeGreaterThan(sheet.bottom);
        expect(overlaps(free, sheet)).toBe(false);
      });

      it("keeps clear of the hand, Commit and the zoom buttons while a target is picked", () => {
        const free = freeBoardArea(view, { kind: "picking" });
        // The hand collapses to the Energy orb and a chip of 88 px, which the left inset leaves room for.
        for (const hud of [commitRect(view), zoomColumnRect(view), { ...handRect(view), right: 6 + 40 + 6 + 88 }]) {
          expect(overlaps(free, hud)).toBe(false);
        }
      });
    });
  }
});

describe("the card sheet", () => {
  for (const view of VIEWS) {
    describe(`at ${view.width} x ${view.height}`, () => {
      const heroes = [undefined, { x: 150, y: 200 }, { x: view.width / 2, y: 120 }, { x: view.width - 150, y: 200 }];

      it("is at most 45 % of the width wide and covers neither the hand, Commit nor the zoom and rotate buttons", () => {
        for (const hero of heroes) {
          const sheet = cardSheetRect(view, hero);
          expect(sheet.right - sheet.left).toBeLessThanOrEqual(view.width * 0.45 + 1e-6);
          expect(sheet.bottom - sheet.top).toBeLessThanOrEqual(112);
          for (const hud of [handRect(view), commitRect(view), zoomColumnRect(view)]) {
            expect(overlaps(sheet, hud)).toBe(false);
          }
        }
      });

      it("is on the side the Hero is not on", () => {
        const heroLeft = { x: 240, y: 100 };
        const heroRight = { x: view.width - 160, y: 100 };
        const besideLeftHero = cardSheetRect(view, heroLeft);
        const besideRightHero = cardSheetRect(view, heroRight);
        expect(contains(besideLeftHero, heroLeft)).toBe(false);
        expect(contains(besideRightHero, heroRight)).toBe(false);
        expect(besideLeftHero.left).toBeGreaterThan(besideRightHero.left);
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
