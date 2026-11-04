import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan } from "./plan";
import type { GridPosition } from "./reactor-deck";
import { resolveRound } from "./resolution";

const LEFT_BRUISER = "left-bruiser";
const LEFT_CONTROLLER = "left-controller";
const RIGHT_BRUISER = "right-bruiser";
// Bruiser cards 0 and 1 are Slam Shot: damage 2, Range 3, cost 1. Cards 2 and 3 serve as Move or Block.
const SLAM_SHOT = 0;

const hero = (match: MatchState, heroId: string) => match.heroes.find((candidate) => candidate.id === heroId)!;
const sorted = (cards: number[]) => [...cards].sort((a, b) => a - b);
const attack = (target: string): QueuedAction => ({ kind: ActionKind.Primary, card: SLAM_SHOT, target });
const planOf = (squad: SquadId, heroId: string, queue: QueuedAction[], pitched: number[] = []): SquadPlan => ({
  squad,
  heroes: [{ heroId, queue, pitched }],
});
const leftAttacks = () => planOf(SquadId.Left, LEFT_BRUISER, [attack(RIGHT_BRUISER)], [1]);
const rightAttacks = () => planOf(SquadId.Right, RIGHT_BRUISER, [attack(LEFT_BRUISER)], [1]);

/** Left and right Bruiser facing each other with a clear line, two tiles apart; both hold cards 0 to 3. */
function duel(positions: Record<string, GridPosition> = {}): MatchState {
  const match = startRound(createMatch(5));
  match.heroes.find((candidate) => candidate.id === LEFT_BRUISER)!.position = { col: 8, row: 5 };
  hero(match, RIGHT_BRUISER).position = { col: 10, row: 5 };
  for (const id of [LEFT_BRUISER, RIGHT_BRUISER]) hero(match, id).hand = [0, 1, 2, 3];
  for (const [id, position] of Object.entries(positions)) hero(match, id).position = position;
  return match;
}

describe("Attacks and Deck Damage", () => {
  it("removes one card from the top of the target's Deck per damage point", () => {
    const match = duel();
    const deck = [...hero(match, RIGHT_BRUISER).deck];
    const { match: after, events } = resolveRound(match, [leftAttacks()]);
    expect(hero(after, RIGHT_BRUISER).deck).toEqual(deck.slice(0, -2));
    expect(hero(after, RIGHT_BRUISER).exile).toEqual(deck.slice(-2));
    expect(events).toEqual([
      { kind: EventKind.AttackHit, tick: 1, heroId: LEFT_BRUISER, targetId: RIGHT_BRUISER, absorbed: 0, damage: 2, card: "Slam Shot", distance: 2 },
    ]);
  });

  it("lets Shield absorb damage before the Deck loses cards", () => {
    const match = duel();
    const deckSize = hero(match, RIGHT_BRUISER).deck.length;
    const block = planOf(SquadId.Right, RIGHT_BRUISER, [{ kind: ActionKind.Block, card: 2 }]);
    const { match: after, events } = resolveRound(match, [leftAttacks(), block]);
    expect(hero(after, RIGHT_BRUISER).deck).toHaveLength(deckSize);
    expect(events.find(({ kind }) => kind === EventKind.AttackHit)).toMatchObject({ absorbed: 2, damage: 0 });
  });

  it("passes the part of the damage that Shield does not absorb on to the Deck", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).shield = 1;
    const { events } = resolveRound(match, [leftAttacks()]);
    expect(events[0]).toMatchObject({ absorbed: 1, damage: 1 });
  });

  it("resolves simultaneous Attacks in both directions", () => {
    const match = duel();
    const sizes = [LEFT_BRUISER, RIGHT_BRUISER].map((id) => hero(match, id).deck.length);
    const { match: after } = resolveRound(match, [leftAttacks(), rightAttacks()]);
    expect([LEFT_BRUISER, RIGHT_BRUISER].map((id) => hero(after, id).deck.length)).toEqual(sizes.map((size) => size - 2));
  });

  it("removes only as many cards as the Deck holds", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).deck = [7];
    expect(resolveRound(match, [leftAttacks()]).events[0]).toMatchObject({ damage: 1 });
  });

  it("attacks the target where it stands after the movement of the same Tick", () => {
    const match = duel({ [RIGHT_BRUISER]: { col: 12, row: 5 } });
    const moveIn = planOf(SquadId.Right, RIGHT_BRUISER, [{ kind: ActionKind.Move, card: 2, destination: { col: 10, row: 5 } }]);
    expect(resolveRound(match, [leftAttacks(), moveIn]).events.at(-1)!.kind).toBe(EventKind.AttackHit);
  });
});

describe("Range and Line of Sight", () => {
  it("fails an Attack beyond Range, leaves the target alone and still discards the cards", () => {
    const match = duel({ [RIGHT_BRUISER]: { col: 12, row: 5 } });
    const { match: after, events } = resolveRound(match, [leftAttacks()]);
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.AttackFailed]);
    expect(hero(after, RIGHT_BRUISER).deck).toEqual(hero(match, RIGHT_BRUISER).deck);
    expect(hero(after, LEFT_BRUISER).discard).toEqual([1, SLAM_SHOT]);
  });

  it("measures Range as Chebyshev distance", () => {
    const near = duel({ [LEFT_BRUISER]: { col: 8, row: 11 }, [RIGHT_BRUISER]: { col: 11, row: 14 } });
    expect(resolveRound(near, [leftAttacks()]).events[0]!.kind).toBe(EventKind.AttackHit);
    const far = duel({ [LEFT_BRUISER]: { col: 8, row: 11 }, [RIGHT_BRUISER]: { col: 12, row: 14 } });
    expect(resolveRound(far, [leftAttacks()]).events[0]!.kind).toBe(EventKind.AttackFailed);
  });

  it("is blocked by a Wall", () => {
    // (8,6) is a Wall between (8,5) and (8,7).
    const match = duel({ [LEFT_BRUISER]: { col: 8, row: 5 }, [RIGHT_BRUISER]: { col: 8, row: 7 } });
    expect(resolveRound(match, [leftAttacks()]).events[0]!.kind).toBe(EventKind.AttackFailed);
  });

  it("is not blocked by an allied Hero in the line", () => {
    const match = duel({
      [LEFT_BRUISER]: { col: 5, row: 5 },
      [RIGHT_BRUISER]: { col: 3, row: 5 },
      [LEFT_CONTROLLER]: { col: 4, row: 5 },
    });
    expect(resolveRound(match, [leftAttacks()]).events[0]!.kind).toBe(EventKind.AttackHit);
  });

  it("does not affect the later actions of the Queue when it fails", () => {
    const match = duel({ [RIGHT_BRUISER]: { col: 14, row: 5 } });
    const queue = [attack(RIGHT_BRUISER), { kind: ActionKind.Move as const, card: 2, destination: { col: 9, row: 5 } }];
    const { match: after, events } = resolveRound(match, [planOf(SquadId.Left, LEFT_BRUISER, queue, [1])]);
    expect(events.map(({ kind, tick }) => [kind, tick])).toEqual([[EventKind.AttackFailed, 1], [EventKind.Step, 2]]);
    expect(hero(after, LEFT_BRUISER).position).toEqual({ col: 9, row: 5 });
  });
});

describe("Deck Damage and the Discard", () => {
  it("exiles exactly the points that Shield does not absorb", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).shield = 1;
    const deck = [...hero(match, RIGHT_BRUISER).deck];
    const { match: after } = resolveRound(match, [leftAttacks()]);
    expect(hero(after, RIGHT_BRUISER).exile).toEqual(deck.slice(-1));
    expect(hero(after, RIGHT_BRUISER).deck).toEqual(deck.slice(0, -1));
  });

  it("shuffles the Discard into an emptied Deck and goes on exiling: burn, shuffle, burn", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).deck = [7];
    hero(match, RIGHT_BRUISER).discard = [4, 5, 6];
    const { match: after, events } = resolveRound(match, [leftAttacks()]);
    expect(events.map(({ kind, damage, amount }) => [kind, damage ?? amount])).toEqual([
      [EventKind.AttackHit, 1],
      [EventKind.DeckShuffled, 3],
      [EventKind.AttackHit, 1],
    ]);
    expect(events[1]).toMatchObject({ heroId: RIGHT_BRUISER });
    const right = hero(after, RIGHT_BRUISER);
    expect(right.exile).toHaveLength(2);
    expect(right.exile[0]).toBe(7);
    expect(sorted([...right.deck, right.exile[1]!])).toEqual([4, 5, 6]);
  });

  it("shuffles the Discard into an empty Deck at the end of a Resolution, never the Exile", () => {
    const match = duel();
    const bruiser = hero(match, RIGHT_BRUISER);
    bruiser.deck = [];
    bruiser.hand = [0, 1, 2, 3];
    bruiser.discard = [4, 5];
    bruiser.exile = [8, 9];
    const { match: after, events } = resolveRound(match, [planOf(SquadId.Right, RIGHT_BRUISER, [{ kind: ActionKind.Wait }], [0])]);
    const right = hero(after, RIGHT_BRUISER);
    expect(sorted(right.deck)).toEqual([0, 4, 5]);
    expect(right.discard).toEqual([]);
    expect(right.exile).toEqual([8, 9]);
    expect(events).toContainEqual({ kind: EventKind.DeckShuffled, tick: 1, heroId: RIGHT_BRUISER, amount: 3 });
  });

  it("gives the same piles for the same Match State and plans", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).deck = [7];
    hero(match, RIGHT_BRUISER).discard = [4, 5, 6];
    const first = resolveRound(match, [leftAttacks()]);
    const second = resolveRound(match, [leftAttacks()]);
    expect(second).toEqual(first);
  });
});

describe("Exhaustion", () => {
  it("takes effect after the Resolution, once the Deck is empty", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).deck = [7, 8];
    const { match: after, events } = resolveRound(match, [leftAttacks()]);
    expect(hero(after, RIGHT_BRUISER).exhausted).toBe(true);
    expect(events.at(-1)).toEqual({ kind: EventKind.Exhausted, tick: 1, heroId: RIGHT_BRUISER });
  });

  it("lets a Hero that loses its last card complete its committed action", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).deck = [7, 8];
    const counter = planOf(
      SquadId.Right,
      RIGHT_BRUISER,
      [{ kind: ActionKind.Move, card: 2, destination: { col: 10, row: 5 } }, attack(LEFT_BRUISER)],
      [1],
    );
    const leftDeck = hero(match, LEFT_BRUISER).deck.length;
    const { match: after, events } = resolveRound(match, [leftAttacks(), counter]);
    expect(events.filter(({ kind }) => kind === EventKind.AttackHit).map(({ tick }) => tick)).toEqual([1, 2]);
    expect(hero(after, LEFT_BRUISER).deck).toHaveLength(leftDeck - 2);
    // Its three played cards went to the Discard, so there is something to shuffle and it is not Exhausted.
    expect(hero(after, RIGHT_BRUISER).exhausted).toBe(false);
  });

  it("does not count the Hand: a Hero holding cards is Exhausted when Deck and Discard are empty", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).deck = [7, 8];
    expect(hero(match, RIGHT_BRUISER).hand).toHaveLength(4);
    const { match: after } = resolveRound(match, [leftAttacks()]);
    expect(hero(after, RIGHT_BRUISER).exhausted).toBe(true);
  });

  it("does not Exhaust a Hero with an empty Deck and a Discard that holds cards", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).deck = [7, 8];
    hero(match, RIGHT_BRUISER).discard = [4, 5];
    const { match: after, events } = resolveRound(match, [leftAttacks()]);
    expect(hero(after, RIGHT_BRUISER).exhausted).toBe(false);
    expect(sorted(hero(after, RIGHT_BRUISER).deck)).toEqual([4, 5]);
    expect(events.some(({ kind }) => kind === EventKind.Exhausted)).toBe(false);
  });

  it("ignores the plans of an Exhausted Hero and fails Attacks against it", () => {
    const match = duel();
    hero(match, RIGHT_BRUISER).exhausted = true;
    const { events } = resolveRound(match, [leftAttacks(), rightAttacks()]);
    expect(events.map(({ kind }) => kind)).toEqual([EventKind.AttackFailed]);
  });

  it("stops drawing for an Exhausted Hero", () => {
    const match = duel();
    const exhausted = hero(match, RIGHT_BRUISER);
    exhausted.exhausted = true;
    exhausted.hand = [];
    expect(hero(startRound(match), RIGHT_BRUISER).hand).toEqual([]);
  });
});
