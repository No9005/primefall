import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, startRound } from "./match";
import { ActionKind, chebyshevDistance, reachableMoveDestinations } from "./plan";
import { REACTOR_DECK, TileKind, tileAt } from "./reactor-deck";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";

describe("reachableMoveDestinations", () => {
  it("leaves out a tile behind a Wall corner but keeps straight paths", () => {
    // The Wall at (5,6) blocks the diagonal first step (5,5) -> (4,6).
    const offered = reachableMoveDestinations({ col: 5, row: 5 });
    expect(offered).not.toContainEqual({ col: 3, row: 7 });
    expect(offered).toContainEqual({ col: 4, row: 5 });
    expect(offered).toContainEqual({ col: 3, row: 5 });
  });

  it("only offers destinations that the Resolution reaches when nothing else is in the way", () => {
    for (let row = 0; row < REACTOR_DECK.height; row++) {
      for (let col = 0; col < REACTOR_DECK.width; col++) {
        const from = { col, row };
        if (tileAt(REACTOR_DECK, from) === undefined || tileAt(REACTOR_DECK, from) === TileKind.Wall) continue;
        for (const destination of reachableMoveDestinations(from)) {
          const match = startRound(createMatch(5));
          const others = match.heroes.filter((hero) => hero.id !== BRUISER);
          // Keep the other Heroes out of the way so only Walls can stop the Move.
          if (others.some((hero) => chebyshevDistance(hero.position, from) <= 3)) continue;
          const bruiser = match.heroes.find((hero) => hero.id === BRUISER)!;
          bruiser.position = from;
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
  });
});
