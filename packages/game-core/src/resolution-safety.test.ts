import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { createMatch, type HeroState, type MatchState, startRound } from "./match";
import { ActionKind, MAX_QUEUE_LENGTH, type QueuedAction } from "./plan";
import { resolveRound } from "./resolution";

const HERO_ID = "left-bruiser";

const heroOf = (match: MatchState): HeroState => match.heroes.find((hero) => hero.id === HERO_ID)!;
const allCards = (hero: HeroState) => [...hero.hand, ...hero.deck, ...hero.discard, ...hero.exile].sort();

/** A Round-1 match where the Bruiser stands in open ground. */
function openMatch(): MatchState {
  const match = startRound(createMatch(5));
  heroOf(match).position = { col: 8, row: 3 };
  return match;
}

const resolve = (match: MatchState, queue: QueuedAction[], pitched: number[] = []) =>
  resolveRound(match, [{ squad: SquadId.Left, heroes: [{ heroId: HERO_ID, queue, pitched }] }]);

const move = (card: number, col: number): QueuedAction => ({ kind: ActionKind.Move, card, destination: { col, row: 3 } });

describe("resolveRound with plans that were not validated", () => {
  it("fails an action whose card is not in the Hand and still resolves the rest of the Queue", () => {
    const match = openMatch();
    const hero = heroOf(match);
    const foreign = hero.deck[0]!;
    const { match: after, events } = resolve(match, [move(foreign, 10), move(hero.hand[0]!, 10)]);

    expect(events.filter(({ kind }) => kind === EventKind.ActionFailed).map(({ tick }) => tick)).toEqual([1]);
    expect(heroOf(after).position).toEqual({ col: 10, row: 3 });
    expect(heroOf(after).hand).toEqual(hero.hand.slice(1));
    expect(heroOf(after).discard).toEqual([...hero.discard, hero.hand[0]]);
    expect(allCards(heroOf(after))).toEqual(allCards(hero));
  });

  it("plays a card used twice in one Queue only once", () => {
    const match = openMatch();
    const hero = heroOf(match);
    const card = hero.hand[0]!;
    const { match: after, events } = resolve(match, [move(card, 10), move(card, 12)]);

    expect(events.filter(({ kind }) => kind === EventKind.ActionFailed).map(({ tick }) => tick)).toEqual([2]);
    expect(heroOf(after).position).toEqual({ col: 10, row: 3 });
    expect(heroOf(after).discard.filter((discarded) => discarded === card)).toHaveLength(1);
    expect(allCards(heroOf(after))).toEqual(allCards(hero));
  });

  it("fails a queued card that was also pitched", () => {
    const match = openMatch();
    const hero = heroOf(match);
    const card = hero.hand[0]!;
    const { match: after, events } = resolve(match, [move(card, 10)], [card]);

    expect(events.map(({ kind }) => kind)).toEqual([EventKind.ActionFailed]);
    expect(heroOf(after).position).toEqual({ col: 8, row: 3 });
    expect(allCards(heroOf(after))).toEqual(allCards(hero));
  });

  it("ignores a pitched card that is not in the Hand", () => {
    const match = openMatch();
    const hero = heroOf(match);
    const { match: after } = resolve(match, [], [hero.deck[0]!, hero.hand[0]!, hero.hand[0]!]);

    expect(heroOf(after).hand).toEqual(hero.hand.slice(1));
    expect(heroOf(after).deck).toEqual(hero.deck);
    expect(allCards(heroOf(after))).toEqual(allCards(hero));
  });

  it("does not resolve actions beyond the Queue limit", () => {
    const match = openMatch();
    const hero = heroOf(match);
    // A fifth card in the Hand, so only the Queue limit (not the Hand) can stop the fifth action.
    hero.hand.push(hero.deck.pop()!);
    const queue = hero.hand.slice(0, MAX_QUEUE_LENGTH).map((card, i) => move(card, 9 + (i % 2)));
    const extra = hero.hand[MAX_QUEUE_LENGTH]!;
    const before = allCards(hero);
    const { match: after, events } = resolve(match, [...queue, move(extra, 12)]);

    expect(queue).toHaveLength(MAX_QUEUE_LENGTH);
    expect(events.filter(({ kind }) => kind === EventKind.ActionFailed).map(({ tick }) => tick)).toEqual([MAX_QUEUE_LENGTH + 1]);
    expect(heroOf(after).hand).toEqual([extra]);
    expect(allCards(heroOf(after))).toEqual(before);
  });
});
