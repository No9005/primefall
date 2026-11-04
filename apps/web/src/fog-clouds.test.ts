import { describe, expect, it } from "vitest";
import { cloudPattern, driftOffset, driftUv, fogAlphas, fogShape } from "./fog-clouds";

const seen = (...tiles: [number, number][]) => new Set(tiles.map(([col, row]) => `${col},${row}`));

describe("fogAlphas", () => {
  const alphas = fogAlphas(7, 7, seen([3, 3]));
  const at = (col: number, row: number) => alphas[row * 7 + col]!;

  it("has no fog on a seen tile", () => expect(at(3, 3)).toBe(0));
  it("is full from two tiles away", () => {
    expect(at(5, 3)).toBe(1);
    expect(at(0, 0)).toBe(1);
  });
  it("is graded next to the seen area", () => {
    expect(at(4, 3)).toBeCloseTo(0.5);
    expect(at(4, 4)).toBeGreaterThan(0.5);
    expect(at(4, 4)).toBeLessThan(1);
  });
  it("is full everywhere when nothing is seen", () => expect([...fogAlphas(3, 3, seen())].every((alpha) => alpha === 1)).toBe(true));
});

describe("fogShape", () => {
  it("depends only on the own sight, never on an enemy", () => {
    const grid = { width: 6, height: 6 };
    const visible = [{ col: 1, row: 1 }, { col: 2, row: 1 }];
    const own = [{ col: 1, row: 1 }];
    // An enemy stands at (4, 4), outside the sight. fogShape has no enemy input, so that tile stays fully fogged
    // and the fog is exactly that of the visible and own tiles alone.
    const enemy = { col: 4, row: 4 };
    const fog = fogShape(grid, visible, own);
    expect(fog).toEqual(fogAlphas(6, 6, seen([1, 1], [2, 1])));
    expect(fog[enemy.row * 6 + enemy.col]).toBe(1);
  });
  it("lights the tiles of the own Heroes", () => {
    expect(fogShape({ width: 4, height: 4 }, [], [{ col: 2, row: 2 }])[2 * 4 + 2]).toBe(0);
  });
});

describe("driftOffset", () => {
  it("moves layer A at 8 px per second along (1, 0.3)", () => {
    const { x, y } = driftOffset("a", 1000, false);
    expect(Math.hypot(x, y)).toBeCloseTo(8);
    expect(y / x).toBeCloseTo(0.3);
  });
  it("moves layer B at 14 px per second the opposite way", () => {
    const a = driftOffset("a", 1000, false);
    const b = driftOffset("b", 1000, false);
    expect(Math.hypot(b.x, b.y)).toBeCloseTo(14);
    expect(b.x * a.x + b.y * a.y).toBeLessThan(0);
  });
  it("is the same at the same time and zero at the start", () => {
    expect(driftOffset("a", 2500, false)).toEqual(driftOffset("a", 2500, false));
    const start = driftOffset("b", 0, false);
    expect(Math.hypot(start.x, start.y)).toBe(0);
  });
  it("stands still with reduced motion", () => {
    expect(driftOffset("a", 9000, true)).toEqual({ x: 0, y: 0 });
    expect(driftUv("b", 9000, true)).toEqual({ u: 0, v: 0 });
  });
  it("wraps the texture shift into 0..1", () => {
    const { u, v } = driftUv("b", 10_000_000, false);
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThan(1);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

describe("cloudPattern", () => {
  it("is the same every time and uses the whole range", () => {
    const pattern = cloudPattern(32);
    expect(pattern).toEqual(cloudPattern(32));
    expect(Math.min(...pattern)).toBe(0);
    expect(Math.max(...pattern)).toBe(255);
  });
});
