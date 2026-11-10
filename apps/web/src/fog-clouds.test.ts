import { describe, expect, it } from "vitest";
import { cloudPattern, driftOffset, driftUv, fogAlphas, fogDuringWalk, fogShape } from "./fog-clouds";

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

describe("fogDuringWalk", () => {
  const width = 12;
  const grid = { width, height: 3 };
  const tile = (col: number, row: number) => ({ col, row });
  // One Hero walks from column 1 to column 5 on row 1 and sees 2 tiles each way (a stand-in for the real sight).
  const sightAt = (col: number) => [-2, -1, 0, 1, 2].map((d) => tile(col + d, 1));
  const startFog = fogShape(grid, sightAt(1), [tile(1, 1)]);
  const endFog = fogShape(grid, sightAt(5), [tile(5, 1)]);
  const fogAt = (fog: Float32Array, col: number) => fog[width + col]!;
  const walk = (at: number) => fogDuringWalk(new Float32Array(startFog.length), startFog, endFog, width, [{ from: tile(1, 1), to: tile(5, 1), at: tile(at, 1) }]);

  it("equals the start fog when nobody has walked", () => expect([...walk(1)]).toEqual([...startFog]));
  it("equals the end fog when the Hero is at the end of its walk", () => expect([...walk(5)]).toEqual([...endFog]));
  it("lifts a tile that is clear at the end only, gradually as the Hero comes closer", () => {
    expect(fogAt(startFog, 7)).toBe(1);
    expect(fogAt(endFog, 7)).toBe(0);
    expect(fogAt(walk(3), 7)).toBeLessThan(fogAt(walk(2), 7));
    expect(fogAt(walk(2), 7)).toBeLessThan(1);
    expect(fogAt(walk(3), 7)).toBeGreaterThan(0);
  });
  it("fogs over a tile that is clear at the start only, as the Hero walks away", () => {
    expect(fogAt(startFog, 0)).toBe(0);
    expect(fogAt(endFog, 0)).toBe(1);
    expect(fogAt(walk(3), 0)).toBeGreaterThan(fogAt(walk(2), 0));
    expect(fogAt(walk(2), 0)).toBeGreaterThan(0);
    expect(fogAt(walk(3), 0)).toBeLessThan(1);
  });
  it("keeps a tile clear that a second Hero still sees", () => {
    const both = fogShape(grid, [...sightAt(5), ...sightAt(1)], [tile(5, 1), tile(1, 1)]);
    const out = fogDuringWalk(new Float32Array(both.length), startFog, both, width, [
      { from: tile(1, 1), to: tile(5, 1), at: tile(3, 1) },
      { from: tile(1, 1), to: tile(1, 1), at: tile(1, 1) },
    ]);
    expect(fogAt(out, 0)).toBe(0);
  });
  it("never leaves the range between the two fogs", () => {
    for (const at of [1, 2, 3, 4, 5]) {
      walk(at).forEach((alpha, index) => {
        expect(alpha).toBeGreaterThanOrEqual(Math.min(startFog[index]!, endFog[index]!) - 1e-6);
        expect(alpha).toBeLessThanOrEqual(Math.max(startFog[index]!, endFog[index]!) + 1e-6);
      });
    }
  });
});
