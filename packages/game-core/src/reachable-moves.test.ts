import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, startRound } from "./match";
import { ActionKind, chebyshevDistance, reachableMoveDestinations } from "./plan";
import { NOTSTROM_MAP, TileKind, tileAt } from "./notstrom-map";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";

describe("reachableMoveDestinations", () => {
  it("leaves out a tile behind a Wall corner but keeps straight paths", () => {
    // The Wall at (10,5) blocks the diagonal first step (9,5) -> (10,4).
    const offered = reachableMoveDestinations({ col: 9, row: 5 });
    expect(offered).not.toContainEqual({ col: 11, row: 3 });
    expect(offered).toContainEqual({ col: 9, row: 4 });
    expect(offered).toContainEqual({ col: 9, row: 3 });
  });

  it("only offers destinations that the Resolution reaches when nothing else is in the way", () => {
    for (let row = 0; row < NOTSTROM_MAP.height; row++) {
      for (let col = 0; col < NOTSTROM_MAP.width; col++) {
        const from = { col, row };
        if (tileAt(NOTSTROM_MAP, from) === undefined || tileAt(NOTSTROM_MAP, from) === TileKind.Wall) continue;
        // The Resolution does not change its input, so one Match State serves every destination of this tile.
        const match = startRound(createMatch(5));
        const others = match.heroes.filter((hero) => hero.id !== BRUISER);
        // Keep the other Heroes out of the way so only Walls can stop the Move.
        if (others.some((hero) => chebyshevDistance(hero.position, from) <= 3)) continue;
        const bruiser = match.heroes.find((hero) => hero.id === BRUISER)!;
        bruiser.position = from;
        for (const destination of reachableMoveDestinations(from, match.grid)) {
          const plan = {
            squad: SquadId.Left,
            heroes: [{ heroId: BRUISER, queue: [{ kind: ActionKind.Move as const, card: bruiser.hand[0]!, destination }] }],
          };
          const { match: after, events } = resolveRound(match, [plan]);
          expect(events.map(({ kind }) => kind)).not.toContain(EventKind.MoveBlocked);
          expect(after.heroes.find((hero) => hero.id === BRUISER)!.position).toEqual(destination);
        }
      }
    }
  }, 30_000);
});
