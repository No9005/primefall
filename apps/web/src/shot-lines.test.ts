import { CoverKind, type EnemyView, parseGrid, Visibility } from "game-core";
import { describe, expect, it } from "vitest";
import { dashRuns, drawShot, drawShots, SegmentStyle, shotInWorld } from "./shot-lines";
import { gridToWorld } from "./terrain";

const grid = parseGrid(["#########", "#.......#", "#...#...#", "#.H...F.#", "#.......#", "#########"]);
const attacker = { col: 1, row: 1 };

const visible = (id: string, position: { col: number; row: number }): EnemyView => ({
  id,
  heroClass: "bruiser",
  visibility: Visibility.Visible,
  position,
  shield: 0,
  deckCount: 8,
  discardCount: 0,
  exileCount: 0,
  exhausted: false,
  slowed: false,
  marked: false,
}) as unknown as EnemyView;

describe("drawShot", () => {
  it("draws one clear line and rings the target", () => {
    const shot = drawShot(grid, attacker, { id: "e", position: { col: 5, row: 1 } }, 6);
    expect(shot.segments.map((segment) => segment.style)).toEqual([SegmentStyle.Clear]);
    expect(shot).toMatchObject({ ringed: true, coverKind: CoverKind.None });
    expect(shot.cross).toBeUndefined();
    expect(shot.coverTile).toBeUndefined();
  });

  it.each([0, 45, 90, 135, 180, 225, 270, 315])("starts and ends at the chests of the Heroes, drawn from the terrain's projection at %i degrees", (angle) => {
    const shot = shotInWorld(drawShot(grid, attacker, { id: "e", position: { col: 5, row: 1 } }, 6), angle);
    const from = gridToWorld(attacker, angle);
    const to = gridToWorld({ col: 5, row: 1 }, angle);
    const [segment] = shot.segments;
    expect(segment!.to.x - segment!.from.x).toBeCloseTo(to.x - from.x);
    expect(segment!.to.y - segment!.from.y).toBeCloseTo(to.y - from.y);
  });

  it("stops a blocked shot at the Wall with a cross and continues in grey, without a ring", () => {
    const shot = drawShot(grid, { col: 2, row: 2 }, { id: "e", position: { col: 6, row: 2 } }, 6);
    expect(shot.segments.map((segment) => segment.style)).toEqual([SegmentStyle.Stopped, SegmentStyle.Beyond]);
    expect(shot.cross).toBeDefined();
    expect(shot.ringed).toBe(false);
    expect(shot.segments[0]!.to).toEqual(shot.cross);
    expect(shotInWorld(shot).segments[0]!.to).toEqual(shotInWorld(shot).cross);
  });

  it("marks the Cover tile of a target on Half Cover", () => {
    const shot = drawShot(grid, { col: 5, row: 3 }, { id: "e", position: { col: 2, row: 3 } }, 6);
    expect(shot).toMatchObject({ coverKind: CoverKind.Half, coverTile: { col: 2, row: 3 }, ringed: true });
  });

  it("marks Full Cover and does not ring the target", () => {
    const shot = drawShot(grid, { col: 3, row: 3 }, { id: "e", position: { col: 6, row: 3 } }, 6);
    expect(shot).toMatchObject({ coverKind: CoverKind.Full, coverTile: { col: 6, row: 3 }, ringed: false });
  });

  it("stops at the end of the Range without a cross", () => {
    const shot = drawShot(grid, attacker, { id: "e", position: { col: 7, row: 1 } }, 3);
    expect(shot.segments.map((segment) => segment.style)).toEqual([SegmentStyle.Stopped, SegmentStyle.Beyond]);
    expect(shot.cross).toBeUndefined();
    expect(shot.ringed).toBe(false);
  });
});

describe("dashRuns", () => {
  it("cuts a line into dashes of the given length with gaps between, the last one cut short", () => {
    expect(dashRuns({ x: 0, y: 0 }, { x: 28, y: 0 }, 8, 4)).toEqual([
      { from: { x: 0, y: 0 }, to: { x: 8, y: 0 } },
      { from: { x: 12, y: 0 }, to: { x: 20, y: 0 } },
      { from: { x: 24, y: 0 }, to: { x: 28, y: 0 } },
    ]);
  });

  it("returns nothing for a line of no length", () => {
    expect(dashRuns({ x: 3, y: 3 }, { x: 3, y: 3 }, 8, 4)).toEqual([]);
  });
});

describe("drawShots", () => {
  it("creates no line for an Unknown or Ghost enemy", () => {
    const unknown = { id: "u", heroClass: "bruiser", visibility: Visibility.Unknown } as unknown as EnemyView;
    const ghost = { id: "g", heroClass: "bruiser", visibility: Visibility.Ghost, position: { col: 5, row: 1 } } as unknown as EnemyView;
    expect(drawShots(grid, attacker, 6, [unknown, ghost], ["u", "g"])).toEqual([]);
  });

  it("draws only to the requested Visible enemies", () => {
    const enemies = [visible("a", { col: 5, row: 1 }), visible("b", { col: 6, row: 4 })];
    expect(drawShots(grid, attacker, 6, enemies, ["b"]).map((shot) => shot.targetId)).toEqual(["b"]);
  });
});
