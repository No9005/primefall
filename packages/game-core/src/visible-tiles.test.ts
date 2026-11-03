import { describe, expect, it } from "vitest";
import { SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, recordSightings, SIGHT_RANGE, startRound } from "./match";
import { findTiles, type GridPosition, hasLineOfSight, REACTOR_DECK, TileKind } from "./reactor-deck";

const LEFT_BRUISER = "left-bruiser";
const RIGHT_BRUISER = "right-bruiser";

/** A Round-1 match where only the given Heroes are active, standing on the given tiles; the rest are Exhausted. */
function setup(placements: Record<string, GridPosition>): MatchState {
  const match = startRound(createMatch(5));
  for (const hero of match.heroes) {
    const position = placements[hero.id];
    if (position) hero.position = position;
    else hero.exhausted = true;
  }
  recordSightings(match);
  return match;
}

const key = ({ col, row }: GridPosition) => `${col},${row}`;
const visibleKeys = (match: MatchState, squad: SquadId) => new Set(buildSquadView(match, squad).visibleTiles.map(key));

describe("SquadView.visibleTiles", () => {
  it("lists the tiles in sight range with Line of Sight, including the Hero's own tile", () => {
    const origin = { col: 8, row: 5 };
    const match = setup({ [LEFT_BRUISER]: origin });
    const seen = visibleKeys(match, SquadId.Left);
    const expected = new Set<string>();
    for (let row = 0; row < REACTOR_DECK.height; row++) {
      for (let col = 0; col < REACTOR_DECK.width; col++) {
        const tile = { col, row };
        const inRange = Math.max(Math.abs(col - origin.col), Math.abs(row - origin.row)) <= SIGHT_RANGE;
        if (inRange && hasLineOfSight(REACTOR_DECK, origin, tile)) expected.add(key(tile));
      }
    }
    expect(seen).toEqual(expected);
    expect(seen.has(key(origin))).toBe(true);
    expect(seen.has(key({ col: origin.col + SIGHT_RANGE + 1, row: origin.row }))).toBe(false);
  });

  it("is blocked by a Wall: the tile behind it is dark", () => {
    // The Wall at (4,4) blocks the straight line from (3,4) to (6,4).
    const seen = visibleKeys(setup({ [LEFT_BRUISER]: { col: 3, row: 4 } }), SquadId.Left);
    expect(seen.has(key({ col: 6, row: 4 }))).toBe(false);
  });

  it("does not show the Prime Zone from the Spawn area, but does from a Hero standing in it", () => {
    const primeZone = findTiles(REACTOR_DECK, TileKind.PrimeZone);
    const fresh = startRound(createMatch(3));
    expect(primeZone.some((tile) => visibleKeys(fresh, SquadId.Left).has(key(tile)))).toBe(false);

    const standing = primeZone[0]!;
    const seen = visibleKeys(setup({ [LEFT_BRUISER]: standing }), SquadId.Left);
    expect(seen.has(key(standing))).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
    expect(primeZone.filter((tile) => seen.has(key(tile))).length).toBeGreaterThan(1);
  });

  it("is computed from each Squad's own Heroes, and does not reveal an enemy in an unseen tile", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 1, row: 1 }, [RIGHT_BRUISER]: { col: 14, row: 9 } });
    const enemyPosition = match.heroes.find((hero) => hero.id === RIGHT_BRUISER)!.position;
    const left = visibleKeys(match, SquadId.Left);
    const right = visibleKeys(match, SquadId.Right);

    expect(left.has(key({ col: 1, row: 1 }))).toBe(true);
    expect(left.has(key({ col: 14, row: 9 }))).toBe(false);
    expect(right.has(key({ col: 14, row: 9 }))).toBe(true);
    expect(right.has(key({ col: 1, row: 1 }))).toBe(false);
    // The enemy stands in a tile the left Squad does not see: it is neither listed nor otherwise recoverable.
    expect(left.has(key(enemyPosition))).toBe(false);
    expect(JSON.stringify(buildSquadView(match, SquadId.Left).visibleTiles)).not.toContain(JSON.stringify(enemyPosition));
  });
});
