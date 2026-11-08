import { describe, expect, it } from "vitest";
import { cardIndex, HeroClass } from "./cards";
import { SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, PlanIssueKind, type SquadPlan, validatePlan } from "./plan";
import { resolveRound } from "./resolution";

const ASSASSIN = "left-assassin";
const TARGET = "right-bruiser";
// Assassin cards 1 and 2 are Long Shot (Range 7, cost 1, damage 2; Overdrive 4 at Range 6 or 7); Precision Shot (0)
// serves as Pitch.
const LONG_SHOT = cardIndex(HeroClass.Assassin, "Long Shot");
const OTHER_LONG_SHOT = cardIndex(HeroClass.Assassin, "Long Shot", 1);
const PRECISION_SHOT = 0;
const COVER_BREAKER = cardIndex(HeroClass.Assassin, "Cover Breaker");

const hero = (match: MatchState, heroId: string) => match.heroes.find((candidate) => candidate.id === heroId)!;

/** The Assassin and the enemy Bruiser on the open top row, `distance` tiles apart. */
function shootout(distance: number): MatchState {
  const match = startRound(createMatch(5));
  hero(match, ASSASSIN).position = { col: 2, row: 1 };
  hero(match, ASSASSIN).hand = [LONG_SHOT, OTHER_LONG_SHOT, PRECISION_SHOT, 3];
  hero(match, TARGET).position = { col: 2 + distance, row: 1 };
  return match;
}

const shot = (overdrive: boolean, card = LONG_SHOT): SquadPlan => ({
  squad: SquadId.Left,
  heroes: [
    { heroId: ASSASSIN, queue: [{ kind: ActionKind.Primary, card, target: TARGET, overdrive }], pitched: [PRECISION_SHOT] },
  ],
});

const damageDealt = (distance: number, overdrive: boolean) => {
  const match = shootout(distance);
  return hero(match, TARGET).deck.length - hero(resolveRound(match, [shot(overdrive)]).match, TARGET).deck.length;
};

describe("Long Shot", () => {
  it("deals 2 damage at every Range in its standard mode", () => {
    expect([5, 6, 7].map((distance) => damageDealt(distance, false))).toEqual([2, 2, 2]);
  });

  it("deals 4 damage in Overdrive at Range 6 or 7 and 2 closer", () => {
    expect([5, 6, 7].map((distance) => damageDealt(distance, true))).toEqual([2, 4, 4]);
  });
});

describe("Overdrive and the Exile", () => {
  it("Exiles an overdriven card instead of discarding it, and discards a standard one", () => {
    const overdriven = hero(resolveRound(shootout(6), [shot(true)]).match, ASSASSIN);
    expect(overdriven.exile).toEqual([LONG_SHOT]);
    expect(overdriven.discard).toEqual([PRECISION_SHOT]);
    const standard = hero(resolveRound(shootout(6), [shot(false)]).match, ASSASSIN);
    expect(standard.exile).toEqual([]);
    expect(standard.discard).toEqual([PRECISION_SHOT, LONG_SHOT]);
  });

  it("never returns an Exiled card, also after a new Deck cycle", () => {
    const match = shootout(6);
    hero(match, ASSASSIN).deck = [];
    hero(match, ASSASSIN).discard = [8, 9];
    const after = startRound(resolveRound(match, [shot(true)]).match);
    const assassin = hero(after, ASSASSIN);
    expect(assassin.exile).toContain(LONG_SHOT);
    expect([...assassin.hand, ...assassin.deck, ...assassin.discard]).not.toContain(LONG_SHOT);
  });

  it("counts the Exiled card in the Squad View", () => {
    const after = resolveRound(shootout(6), [shot(true)]).match;
    const view = buildSquadView(after, SquadId.Left);
    expect(view.heroes.find((candidate) => candidate.id === ASSASSIN)!.exileCount).toBe(1);
  });

  it("lets a second Long Shot behave identically", () => {
    const match = shootout(7);
    const before = hero(match, TARGET).deck.length;
    const after = resolveRound(match, [shot(true, OTHER_LONG_SHOT)]).match;
    expect(before - hero(after, TARGET).deck.length).toBe(4);
  });
});

describe("validatePlan and Overdrive", () => {
  const view = buildSquadView(shootout(6), SquadId.Left);

  it("accepts a card with an Overdrive", () => {
    expect(validatePlan(view, shot(true))).toEqual([]);
  });

  it("rejects Overdrive on a card without one and says why", () => {
    const plan = shot(true);
    const [hero0] = plan.heroes;
    const noOverdrive: SquadPlan = {
      ...plan,
      heroes: [{ ...hero0!, queue: [{ kind: ActionKind.Primary, card: COVER_BREAKER, target: TARGET, overdrive: true }], pitched: [PRECISION_SHOT] }],
    };
    const issues = validatePlan(view, noOverdrive);
    expect(issues.map((issue) => issue.kind)).toEqual([PlanIssueKind.NoOverdrive]);
    expect(issues[0]!.message).toContain("Cover Breaker has no Overdrive");
  });

  it("fails an Overdrive action on a card without one in the simulation and keeps the card", () => {
    const match = shootout(6);
    const plan: SquadPlan = {
      squad: SquadId.Left,
      heroes: [
        { heroId: ASSASSIN, queue: [{ kind: ActionKind.Primary, card: COVER_BREAKER, target: TARGET, overdrive: true }], pitched: [PRECISION_SHOT] },
      ],
    };
    const after = resolveRound(match, [plan]).match;
    expect(hero(after, ASSASSIN).exile).toEqual([]);
    expect(hero(after, TARGET).deck).toHaveLength(hero(match, TARGET).deck.length);
  });
});

describe("the Attack bonus in the Squad View", () => {
  it("shows the permanent Attack bonus of own Heroes, so a loaded match can draw its badge", () => {
    const match = shootout(3);
    hero(match, ASSASSIN).attackBonus = 1;
    const view = buildSquadView(match, SquadId.Left);
    expect(view.heroes.find((own) => own.id === ASSASSIN)?.attackBonus).toBe(1);
    expect(view.heroes.filter((own) => own.id !== ASSASSIN).every((own) => own.attackBonus === 0)).toBe(true);
  });
});
