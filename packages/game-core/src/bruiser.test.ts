import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, PlanIssueKind, type PrimaryAction, type SquadPlan, validatePlan } from "./plan";
import { CoverKind, coverAt, type GridPosition } from "./reactor-deck";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";
const CONTROLLER = "left-controller";
const ENEMY = "right-bruiser";
const ENEMY_CONTROLLER = "right-controller";
const ENEMY_ASSASSIN = "right-assassin";
// Bruiser cards: 0 and 1 Slam Shot, 2 Concussion Round, 4 Breach Charge, 5 Shockwave, 8 Forward Deploy,
// 9 Suppress, 11 Adrenal Surge. The other cards of the Hand serve as Pitch.
const SLAM_SHOT = 0;
const CONCUSSION_ROUND = 2;
const BREACH_CHARGE = 4;
const SHOCKWAVE = 5;
const FORWARD_DEPLOY = 8;
const SUPPRESS = 9;
const ADRENAL_SURGE = 11;
const PITCH = [1, 3, 6, 7];

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const deckSize = (match: MatchState, id: string) => hero(match, id).deck.length;

/** A fight in the Prime Zone: this Bruiser at (9,5), the enemy Bruiser at (10,5). */
function fight(positions: Record<string, GridPosition> = {}): MatchState {
  const match = startRound(createMatch(5));
  const placed: Record<string, GridPosition> = {
    [BRUISER]: { col: 9, row: 5 },
    [ENEMY]: { col: 10, row: 5 },
    [CONTROLLER]: { col: 9, row: 3 },
    [ENEMY_CONTROLLER]: { col: 13, row: 8 },
    [ENEMY_ASSASSIN]: { col: 13, row: 9 },
    ...positions,
  };
  for (const [id, position] of Object.entries(placed)) hero(match, id).position = position;
  return match;
}

/** The Bruiser plays `card` with enough Pitch for its Energy cost. */
function play(match: MatchState, card: number, action: Partial<PrimaryAction> = {}, energy = 2): SquadPlan {
  hero(match, BRUISER).hand = [card, ...PITCH.slice(0, 3)];
  return {
    squad: SquadId.Left,
    heroes: [
      {
        heroId: BRUISER,
        queue: [{ kind: ActionKind.Primary, card, target: ENEMY, ...action }],
        pitched: PITCH.slice(0, energy),
      },
    ],
  };
}

describe("Slam Shot and Concussion Round", () => {
  it("Slam Shot deals 2 damage", () => {
    const match = fight();
    const after = resolveRound(match, [play(match, SLAM_SHOT, {}, 1)]).match;
    expect(deckSize(match, ENEMY) - deckSize(after, ENEMY)).toBe(2);
  });

  it("Concussion Round deals 2 damage and Slows the target until the end of the next Resolution", () => {
    const match = fight();
    const after = resolveRound(match, [play(match, CONCUSSION_ROUND, {}, 1)]).match;
    expect(deckSize(match, ENEMY) - deckSize(after, ENEMY)).toBe(2);
    expect(hero(after, ENEMY).slow).toBe(1);
  });
});

describe("Breach Charge Overdrive", () => {
  const blast = (match: MatchState, tile: GridPosition) =>
    resolveRound(match, [play(match, BREACH_CHARGE, { target: BRUISER, tile, overdrive: true })]);

  it("hurts every Hero on and next to the tile, allies and the caster included, and no one further away", () => {
    const match = fight({ [CONTROLLER]: { col: 9, row: 4 }, [ENEMY_CONTROLLER]: { col: 11, row: 5 }, [ENEMY_ASSASSIN]: { col: 12, row: 5 } });
    const { match: after } = blast(match, { col: 10, row: 5 });
    for (const id of [ENEMY, CONTROLLER, ENEMY_CONTROLLER, BRUISER]) {
      expect(deckSize(match, id) - deckSize(after, id), id).toBe(2);
    }
    expect(deckSize(after, ENEMY_ASSASSIN)).toBe(deckSize(match, ENEMY_ASSASSIN));
  });

  it("destroys any Cover on the tile, Full Cover included", () => {
    const nest = { col: 15, row: 1 };
    const match = fight({ [BRUISER]: { col: 15, row: 4 }, [ENEMY]: { col: 13, row: 7 } });
    expect(coverAt(match.grid, nest)).toBe(CoverKind.Full);
    const { match: after, events } = blast(match, nest);
    expect(coverAt(after.grid, nest)).toBe(CoverKind.None);
    expect(events).toContainEqual(expect.objectContaining({ kind: EventKind.CoverDestroyed, to: nest }));
  });

  it("Exiles the card", () => {
    const match = fight();
    // The caster is hurt by its own blast, so its Deck Damage lands in the Exile as well.
    const caster = hero(blast(match, { col: 10, row: 5 }).match, BRUISER);
    expect(caster.exile).toContain(BREACH_CHARGE);
    expect(caster.discard).not.toContain(BREACH_CHARGE);
  });
});

describe("Shockwave", () => {
  it("deals 2 damage and pushes the enemy back 2 tiles", () => {
    const match = fight();
    const after = resolveRound(match, [play(match, SHOCKWAVE)]).match;
    expect(deckSize(match, ENEMY) - deckSize(after, ENEMY)).toBe(2);
    expect(hero(after, ENEMY).position).toEqual({ col: 12, row: 5 });
    expect(hero(after, BRUISER).exile).toEqual([]);
  });

  it("deals 3 damage in Overdrive, still pushes back 2 tiles and Exiles the card", () => {
    const match = fight();
    const after = resolveRound(match, [play(match, SHOCKWAVE, { overdrive: true })]).match;
    expect(deckSize(match, ENEMY) - deckSize(after, ENEMY)).toBe(3);
    expect(hero(after, ENEMY).position).toEqual({ col: 12, row: 5 });
    expect(hero(after, BRUISER).exile).toEqual([SHOCKWAVE]);
  });
});

describe("Forward Deploy", () => {
  it("gives an allied Hero an additional Move 2 towards the chosen tile", () => {
    const match = fight();
    const { match: after, events } = resolveRound(match, [
      play(match, FORWARD_DEPLOY, { target: CONTROLLER, tile: { col: 11, row: 3 } }, 1),
    ]);
    expect(hero(after, CONTROLLER).position).toEqual({ col: 11, row: 3 });
    expect(events.filter(({ kind }) => kind === EventKind.Step)).toHaveLength(2);
  });

  it("needs a destination tile when planned", () => {
    const match = fight();
    const issues = (action: Partial<PrimaryAction>) => {
      const plan = play(match, FORWARD_DEPLOY, { target: CONTROLLER, ...action }, 1);
      return validatePlan(buildSquadView(match, SquadId.Left), plan);
    };
    expect(issues({}).map(({ kind }) => kind)).toEqual([PlanIssueKind.BadTarget]);
    expect(issues({ tile: { col: 9, row: 4 } })).toEqual([]);
  });
});

describe("Suppress", () => {
  it("Slows a visible enemy", () => {
    const match = fight();
    const { match: after, events } = resolveRound(match, [play(match, SUPPRESS, {}, 1)]);
    expect(events).toContainEqual(expect.objectContaining({ kind: EventKind.SlowApplied, targetId: ENEMY }));
    expect(hero(after, ENEMY).slow).toBe(1);
  });
});

describe("Adrenal Surge", () => {
  it("gives this Hero +1 Attack that lasts across Rounds", () => {
    const match = fight();
    const { match: after, events } = resolveRound(match, [play(match, ADRENAL_SURGE, { target: BRUISER })]);
    expect(hero(after, BRUISER).attackBonus).toBe(1);
    expect(events).toContainEqual({ kind: EventKind.AttackBonusGained, tick: 1, heroId: BRUISER, amount: 1, card: "Adrenal Surge" });
    const next = fight();
    hero(next, BRUISER).attackBonus = hero(after, BRUISER).attackBonus;
    const slammed = resolveRound(next, [play(next, SLAM_SHOT, {}, 1)]).match;
    expect(deckSize(next, ENEMY) - deckSize(slammed, ENEMY)).toBe(3);
  });

  it("gives this Hero and an allied Hero +1 Attack in Overdrive and Exiles the card", () => {
    const match = fight();
    const { match: after } = resolveRound(match, [play(match, ADRENAL_SURGE, { target: CONTROLLER, overdrive: true })]);
    expect(hero(after, BRUISER).attackBonus).toBe(1);
    expect(hero(after, CONTROLLER).attackBonus).toBe(1);
    expect(hero(after, ENEMY).attackBonus).toBe(0);
    expect(hero(after, BRUISER).exile).toEqual([ADRENAL_SURGE]);
  });

  it("is planned in Overdrive only with an allied Hero as its target", () => {
    const match = fight();
    const issues = (target: string) => {
      const plan = play(match, ADRENAL_SURGE, { target, overdrive: true });
      return validatePlan(buildSquadView(match, SquadId.Left), plan).map(({ kind }) => kind);
    };
    expect(issues(CONTROLLER)).toEqual([]);
    expect(issues(BRUISER)).toEqual([PlanIssueKind.BadTarget]);
  });
});
