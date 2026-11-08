import { cardIndex, HeroClass } from "./cards";
import { describe, expect, it } from "vitest";
import { withFullCover } from "./full-cover-fixture";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type SquadPlan } from "./plan";
import type { GridPosition } from "./reactor-deck";
import { getSquadEvents, resolveRound } from "./resolution";

const LEFT_BRUISER = "left-bruiser";
const LEFT_CONTROLLER = "left-controller";
const RIGHT_BRUISER = "right-bruiser";
const RIGHT_CONTROLLER = "right-controller";
// Bruiser card 5 is Shockwave: 2 Energy, Range 1, damage 2 to every enemy Hero in Range, then Knockback 2.
const SHOCKWAVE = cardIndex(HeroClass.Bruiser, "Shockwave");

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;

/** The Left Bruiser plays Shockwave, paid with two pitched cards. */
const shockwavePlan = (): SquadPlan => ({
  squad: SquadId.Left,
  heroes: [
    {
      heroId: LEFT_BRUISER,
      queue: [{ kind: ActionKind.Primary, card: SHOCKWAVE, target: LEFT_BRUISER }],
      pitched: [0, 1],
    },
  ],
});

/** Places Heroes on the given tiles; every other Hero stays on its spawn tile, far away. */
function setup(positions: Record<string, GridPosition>): MatchState {
  const match = startRound(createMatch(5));
  hero(match, LEFT_BRUISER).hand = [SHOCKWAVE, 0, 1, 2];
  for (const [id, position] of Object.entries(positions)) hero(match, id).position = position;
  return match;
}

const knockbacks = (events: readonly { kind: EventKind }[]) => events.filter(({ kind }) => kind === EventKind.Knockback);

describe("Shockwave: area damage and Knockback", () => {
  it("damages every enemy Hero in Range 1 and pushes each two tiles directly away", () => {
    const match = setup({
      [LEFT_BRUISER]: { col: 3, row: 5 },
      [RIGHT_BRUISER]: { col: 4, row: 5 },
      [RIGHT_CONTROLLER]: { col: 4, row: 4 },
    });
    const decks = [RIGHT_BRUISER, RIGHT_CONTROLLER].map((id) => hero(match, id).deck.length);
    const { match: after, events } = resolveRound(match, [shockwavePlan()]);
    expect(hero(after, RIGHT_BRUISER).deck).toHaveLength(decks[0]! - 2);
    expect(hero(after, RIGHT_CONTROLLER).deck).toHaveLength(decks[1]! - 2);
    expect(hero(after, RIGHT_BRUISER).position).toEqual({ col: 6, row: 5 });
    // A diagonal neighbour is pushed along the diagonal.
    expect(hero(after, RIGHT_CONTROLLER).position).toEqual({ col: 6, row: 2 });
    expect(events.filter(({ kind }) => kind === EventKind.AttackHit)).toHaveLength(2);
    expect(knockbacks(events)).toHaveLength(4);
  });

  it("does not damage or push allied Heroes or enemies out of Range", () => {
    const match = setup({
      [LEFT_BRUISER]: { col: 8, row: 5 },
      [LEFT_CONTROLLER]: { col: 7, row: 5 },
      [RIGHT_BRUISER]: { col: 10, row: 5 },
    });
    const allyDeck = hero(match, LEFT_CONTROLLER).deck.length;
    const { match: after, events } = resolveRound(match, [shockwavePlan()]);
    expect(hero(after, LEFT_CONTROLLER).deck).toHaveLength(allyDeck);
    expect(hero(after, LEFT_CONTROLLER).position).toEqual({ col: 7, row: 5 });
    expect(hero(after, RIGHT_BRUISER).position).toEqual({ col: 10, row: 5 });
    expect(events).toEqual([]);
  });

  it("applies Shield before Deck Damage", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 8, row: 5 }, [RIGHT_BRUISER]: { col: 9, row: 5 } });
    hero(match, RIGHT_BRUISER).shield = 1;
    const deck = hero(match, RIGHT_BRUISER).deck.length;
    const { match: after } = resolveRound(match, [shockwavePlan()]);
    expect(hero(after, RIGHT_BRUISER).deck).toHaveLength(deck - 1);
  });

  it("stops at a Wall and ends early without error", () => {
    // The Wall is at column 5, row 6: the target is pushed one tile, then stopped.
    const match = setup({ [LEFT_BRUISER]: { col: 5, row: 3 }, [RIGHT_BRUISER]: { col: 5, row: 4 } });
    const { match: after, events } = resolveRound(match, [shockwavePlan()]);
    expect(hero(after, RIGHT_BRUISER).position).toEqual({ col: 5, row: 5 });
    expect(knockbacks(events)).toHaveLength(1);
  });

  it("does not move a Hero that stands right in front of a Wall", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 5, row: 4 }, [RIGHT_BRUISER]: { col: 5, row: 5 } });
    const { match: after, events } = resolveRound(match, [shockwavePlan()]);
    expect(hero(after, RIGHT_BRUISER).position).toEqual({ col: 5, row: 5 });
    expect(knockbacks(events)).toHaveLength(0);
  });

  it("stops at a Full Cover tile", () => {
    const match = withFullCover(setup({ [LEFT_BRUISER]: { col: 15, row: 3 }, [RIGHT_BRUISER]: { col: 15, row: 2 } }), { col: 15, row: 1 });
    const { match: after, events } = resolveRound(match, [shockwavePlan()]);
    expect(hero(after, RIGHT_BRUISER).position).toEqual({ col: 15, row: 2 });
    expect(knockbacks(events)).toHaveLength(0);
  });

  it("stops in front of another Hero", () => {
    const match = setup({
      [LEFT_BRUISER]: { col: 8, row: 5 },
      [RIGHT_BRUISER]: { col: 9, row: 5 },
      [RIGHT_CONTROLLER]: { col: 11, row: 5 },
    });
    const { match: after, events } = resolveRound(match, [shockwavePlan()]);
    expect(hero(after, RIGHT_BRUISER).position).toEqual({ col: 10, row: 5 });
    expect(hero(after, RIGHT_CONTROLLER).position).toEqual({ col: 11, row: 5 });
    expect(knockbacks(events)).toHaveLength(1);
  });

  it("does nothing, without a failure, when no enemy Hero is in Range", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 8, row: 5 }, [RIGHT_BRUISER]: { col: 12, row: 5 } });
    const { events } = resolveRound(match, [shockwavePlan()]);
    expect(events).toEqual([]);
  });

  it("shows the push in the events of both Squads", () => {
    const match = setup({ [LEFT_BRUISER]: { col: 8, row: 5 }, [RIGHT_BRUISER]: { col: 9, row: 5 } });
    const resolution = resolveRound(match, [shockwavePlan()]);
    for (const squad of [SquadId.Left, SquadId.Right]) {
      expect(knockbacks(getSquadEvents(squad, resolution))).toEqual([
        { kind: EventKind.Knockback, tick: 1, heroId: RIGHT_BRUISER, from: { col: 9, row: 5 }, to: { col: 10, row: 5 }, card: "Shockwave" },
        { kind: EventKind.Knockback, tick: 1, heroId: RIGHT_BRUISER, from: { col: 10, row: 5 }, to: { col: 11, row: 5 }, card: "Shockwave" },
      ]);
    }
  });
});
