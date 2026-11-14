import { findTiles, REACTOR_DECK, TileKind } from "game-core";
import { describe, expect, it } from "vitest";
import { boardBounds, clampCamera, fitCamera, frameMoveCamera, frameSquadCamera, gridToWorld, PIXEL_MAX_SCALE, PIXEL_WORLD_SCALE, PIXEL_ZOOMS, pixelStepScale, zoomAt, zoomOnPoint } from "./board-layout";

const PHONE = { width: 844, height: 390, pixel: true };
const ART_ZOOMS = PIXEL_ZOOMS.map((zoom) => zoom * PIXEL_WORLD_SCALE);

describe("the camera of the Pixel art style", () => {
  it("fits the whole board at 0.5x on a landscape phone", () => {
    expect(fitCamera(PHONE).scale).toBe(0.5 * PIXEL_WORLD_SCALE);
  });

  it("fits at the largest whole step that shows the whole board, and never below 0.5x", () => {
    expect(fitCamera({ width: 4000, height: 2400, pixel: true }).scale).toBe(2 * PIXEL_WORLD_SCALE);
    expect(fitCamera({ width: 200, height: 100, pixel: true }).scale).toBe(0.5 * PIXEL_WORLD_SCALE);
  });

  it("keeps the fitted board centred", () => {
    const fitted = fitCamera(PHONE);
    const bounds = boardBounds(REACTOR_DECK);
    expect(fitted.x + ((bounds.left + bounds.right) / 2) * fitted.scale).toBeCloseTo(PHONE.width / 2);
    expect(fitted.y + ((bounds.top + bounds.bottom) / 2) * fitted.scale).toBeCloseTo(PHONE.height / 2);
  });

  it("rounds a zoom down to a whole step", () => {
    expect(pixelStepScale(0.3 * PIXEL_WORLD_SCALE)).toBe(0.5 * PIXEL_WORLD_SCALE);
    expect(pixelStepScale(1.7 * PIXEL_WORLD_SCALE)).toBe(1 * PIXEL_WORLD_SCALE);
    expect(pixelStepScale(9 * PIXEL_WORLD_SCALE)).toBe(2 * PIXEL_WORLD_SCALE);
  });

  it("clamps every camera to a step, so zooming never lands between two", () => {
    for (const scale of [0.1, 0.13, 0.2, 0.3, 0.45, 0.6, 5]) {
      const camera = clampCamera({ scale, x: 0, y: 0 }, PHONE);
      expect(ART_ZOOMS).toContain(camera.scale);
    }
    expect(zoomAt(fitCamera(PHONE), 0.9 * PIXEL_WORLD_SCALE, 400, 200, PHONE).scale).toBe(0.5 * PIXEL_WORLD_SCALE);
    expect(zoomAt(fitCamera(PHONE), 1.2 * PIXEL_WORLD_SCALE, 400, 200, PHONE).scale).toBe(1 * PIXEL_WORLD_SCALE);
  });

  it("starts at 1x on the own Squad", () => {
    const zone = findTiles(REACTOR_DECK, TileKind.PrimeZone)[12]!;
    const camera = frameSquadCamera([{ col: 2, row: 11 }, { col: 2, row: 12 }], zone, PHONE, { left: 0, top: 0, right: 844, bottom: 390 });
    expect(camera.scale).toBe(1 * PIXEL_WORLD_SCALE);
    const hero = gridToWorld({ col: 2, row: 11 });
    expect(camera.x + hero.x * camera.scale).toBeGreaterThan(0);
    expect(camera.x + hero.x * camera.scale).toBeLessThan(PHONE.width);
  });

  it("zooms on a Hero at 2x and frames a Move on a whole step", () => {
    expect(zoomOnPoint(gridToWorld({ col: 20, row: 12 }), PHONE).scale).toBe(PIXEL_MAX_SCALE);
    const framed = frameMoveCamera({ col: 10, row: 10 }, [{ col: 11, row: 10 }, { col: 12, row: 10 }], PHONE);
    expect(ART_ZOOMS).toContain(framed.scale);
  });

  it("leaves the camera of the Original style continuous", () => {
    const free = { width: 844, height: 390 };
    expect(ART_ZOOMS).not.toContain(fitCamera(free).scale);
  });
});
