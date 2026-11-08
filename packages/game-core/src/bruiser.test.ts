import { describe, expect, it } from "vitest";
import { withFullCover } from "./full-cover-fixture";
import { cardIndex, HeroClass } from "./cards";
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
const idx = (name: string, copy = 0) => cardIndex(HeroClass.Bruiser, name, copy);
// Pitch fodder: the second Slam Shot, both Bulwarks and the first Charge.
const SLAM_SHOT = idx("Slam Shot");
const CONCUSSION_ROUND = idx("Concussion Round");
const BREACH_CHARGE = idx("Breach Charge");
const SHOCKWAVE = idx("Shockwave");
const ADRENAL_SURGE = idx("Adrenal Surge");
const PITCH = [idx("Slam Shot", 1), idx("Bulwark"), idx("Bulwark", 1), idx("Charge")];

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
  it("Slam Shot deals 2 damage at Range 2 and 3 damage at Range 1 (ADR 0025)", () => {
    const far = fight({ [ENEMY]: { col: 11, row: 5 } });
    const afterFar = resolveRound(far, [play(far, SLAM_SHOT, {}, 1)]).match;
    expect(deckSize(far, ENEMY) - deckSize(afterFar, ENEMY)).toBe(2);
    const close = fight();
    const afterClose = resolveRound(close, [play(close, SLAM_SHOT, {}, 1)]).match;
    expect(deckSize(close, ENEMY) - deckSize(afterClose, ENEMY)).toBe(3);
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
    const fullCover = { col: 15, row: 1 };
    const match = withFullCover(fight({ [BRUISER]: { col: 15, row: 4 }, [ENEMY]: { col: 13, row: 7 } }), fullCover);
    expect(coverAt(match.grid, fullCover)).toBe(CoverKind.Full);
    const { match: after, events } = blast(match, fullCover);
    expect(coverAt(after.grid, fullCover)).toBe(CoverKind.None);
    expect(events).toContainEqual(expect.objectContaining({ kind: EventKind.CoverDestroyed, to: fullCover }));
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

describe("Adrenal Surge", () => {
  it("gives this Hero +1 Attack that lasts across Rounds", () => {
    const match = fight();
    const { match: after, events } = resolveRound(match, [play(match, ADRENAL_SURGE, { target: BRUISER })]);
    expect(hero(after, BRUISER).attackBonus).toBe(1);
    expect(events).toContainEqual({ kind: EventKind.AttackBonusGained, tick: 1, heroId: BRUISER, amount: 1, card: "Adrenal Surge" });
    const next = fight({ [ENEMY]: { col: 11, row: 5 } });
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
