import { describe, expect, it } from "vitest";
import { aiStyleFor, planSquad, sampleWorlds, WORLDS } from "./ai";
import { SquadId, Visibility } from "./host";
import { buildSquadView, createMatch, matchFromSquadView, recordSightings, startRound } from "./match";
import { chebyshevDistance } from "./plan";
import { tileAt, TileKind } from "./reactor-deck";

const key = ({ col, row }: { col: number; row: number }) => `${col},${row}`;

describe("worlds for the enemies the Squad cannot see", () => {
  it("is one empty world when every enemy is Visible", () => {
    const match = startRound(createMatch(3));
    match.heroes.filter((hero) => hero.squad === SquadId.Right).forEach((hero, i) => (hero.position = { col: 6, row: 3 + i }));
    match.heroes.filter((hero) => hero.squad === SquadId.Left).forEach((hero, i) => (hero.position = { col: 5, row: 3 + i }));
    const view = buildSquadView(match, SquadId.Left);
    expect(view.enemies.every((enemy) => enemy.visibility === Visibility.Visible)).toBe(true);
    expect(sampleWorlds(view, 3)).toEqual([new Map()]);
  });

  it("puts hidden enemies on tiles the Squad does not see, that are no Wall and no own Hero, within their reach", () => {
    const view = buildSquadView(startRound(createMatch(11)), SquadId.Left);
    const worlds = sampleWorlds(view, 11);
    expect(worlds).toHaveLength(WORLDS);
    expect(worlds[0]!.size).toBe(0);
    const seen = new Set(view.visibleTiles.map(key));
    const own = new Set(view.heroes.map((hero) => key(hero.position)));
    for (const world of worlds.slice(1)) {
      for (const tile of world.values()) {
        expect(seen.has(key(tile))).toBe(false);
        expect(own.has(key(tile))).toBe(false);
        expect(tileAt(view.grid, tile)).not.toBe(TileKind.Wall);
      }
      // No two enemies on one tile.
      expect(new Set([...world.values()].map(key)).size).toBe(world.size);
    }
  });

  it("keeps a Ghost within reach of the tile it was last seen on, and gives the same worlds for the same view and seed", () => {
    const match = startRound(createMatch(5));
    match.heroes.filter((hero) => hero.squad === SquadId.Left).forEach((hero, i) => (hero.position = { col: 5, row: 3 + i }));
    const assassin = match.heroes.find((hero) => hero.id === "right-assassin")!;
    assassin.position = { col: 7, row: 4 };
    recordSightings(match);
    // It walks out of sight and two Rounds pass: the Squad remembers a Ghost on (7, 4).
    assassin.position = { col: 28, row: 12 };
    match.round = 3;
    const view = buildSquadView(match, SquadId.Left);
    const ghost = view.enemies.find((enemy) => enemy.id === "right-assassin");
    expect(ghost?.visibility).toBe(Visibility.Ghost);
    const worlds = sampleWorlds(view, 5);
    const placed = worlds.slice(1).flatMap((world) => (world.has("right-assassin") ? [world.get("right-assassin")!] : []));
    expect(placed.length).toBeGreaterThan(0);
    for (const tile of placed) expect(chebyshevDistance({ col: 7, row: 4 }, tile)).toBeLessThanOrEqual(2 * 6);
    expect(sampleWorlds(view, 5)).toEqual(worlds);
  });

  it("builds a Match State with an imagined enemy standing where it was imagined, and reads nothing else", () => {
    const view = buildSquadView(startRound(createMatch(7)), SquadId.Left);
    const [, imagined] = sampleWorlds(view, 7);
    const sim = matchFromSquadView(view, 7, imagined);
    for (const [id, tile] of imagined!) {
      const hero = sim.heroes.find((candidate) => candidate.id === id)!;
      expect(hero.position).toEqual(tile);
      expect(hero.exhausted).toBe(false);
    }
    expect(matchFromSquadView(view, 7)).toEqual(matchFromSquadView(view, 7, new Map()));
  });
});

describe("planning under Fog of War", () => {
  it("gives the same plan for the same Squad View, wherever the hidden enemies really stand", () => {
    const seed = 21;
    const a = startRound(createMatch(seed));
    const b = startRound(createMatch(seed));
    // The Right Heroes move to other tiles that the Left Squad still does not see.
    b.heroes.filter((hero) => hero.squad === SquadId.Right).forEach((hero, i) => (hero.position = { col: hero.position.col, row: hero.position.row + 1 - i }));
    const viewA = buildSquadView(a, SquadId.Left);
    const viewB = buildSquadView(b, SquadId.Left);
    expect(viewB).toEqual(viewA);
    const plan = (view: typeof viewA) => planSquad(view, undefined, aiStyleFor(seed, SquadId.Left), seed);
    expect(plan(viewB)).toEqual(plan(viewA));
  });
});
