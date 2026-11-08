import type { MatchState } from "./match";
import { type GridPosition, TileKind } from "./reactor-deck";

/** Test fixture: the Reactor Deck has no Full Cover tile, so tests that need one put it on a copy of the grid. */
export function withFullCover(match: MatchState, ...tiles: GridPosition[]): MatchState {
  const rows = match.grid.tiles.map((line) => [...line]);
  for (const { col, row } of tiles) rows[row]![col] = TileKind.FullCover;
  match.grid = { ...match.grid, tiles: rows };
  return match;
}
