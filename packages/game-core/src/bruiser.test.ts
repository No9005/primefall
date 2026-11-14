import { describe, expect, it } from "vitest";
import { cardIndex, HeroClass } from "./cards";
import { EventKind, SquadId } from "./host";
import { createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type PrimaryAction, type SquadPlan } from "./plan";
import { type GridPosition } from "./reactor-deck";
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
const SHOCKWAVE = idx("Shockwave");
const ADRENAL_SURGE = idx("Adrenal Surge");
const PITCH = [idx("Slam Shot", 1), idx("Bulwark"), idx("Bulwark", 1), idx("Charge")];

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const deckSize = (match: MatchState, id: string) => hero(match, id).deck.length;

/** A fight in the Prime Zone: this Bruiser at (21,12), the enemy Bruiser at (22,12). */
function fight(positions: Record<string, GridPosition> = {}): MatchState {
  const match = startRound(createMatch(5));
  const placed: Record<string, GridPosition> = {
    [BRUISER]: { col: 21, row: 12 },
    [ENEMY]: { col: 22, row: 12 },
    [CONTROLLER]: { col: 21, row: 10 },
    [ENEMY_CONTROLLER]: { col: 25, row: 15 },
    [ENEMY_ASSASSIN]: { col: 25, row: 16 },
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
    const far = fight({ [ENEMY]: { col: 23, row: 12 } });
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

describe("Shockwave", () => {
  it("deals 2 damage and pushes the enemy back 2 tiles", () => {
    const match = fight();
    const after = resolveRound(match, [play(match, SHOCKWAVE)]).match;
    expect(deckSize(match, ENEMY) - deckSize(after, ENEMY)).toBe(2);
    expect(hero(after, ENEMY).position).toEqual({ col: 24, row: 12 });
    expect(hero(after, BRUISER).exile).toEqual([]);
  });

});

describe("Adrenal Surge", () => {
  it("gives this Hero +1 Attack that lasts across Rounds", () => {
    const match = fight();
    const { match: after, events } = resolveRound(match, [play(match, ADRENAL_SURGE, { target: BRUISER })]);
    expect(hero(after, BRUISER).attackBonus).toBe(1);
    expect(events).toContainEqual({ kind: EventKind.AttackBonusGained, tick: 1, heroId: BRUISER, amount: 1, card: "Adrenal Surge" });
    const next = fight({ [ENEMY]: { col: 23, row: 12 } });
    hero(next, BRUISER).attackBonus = hero(after, BRUISER).attackBonus;
    const slammed = resolveRound(next, [play(next, SLAM_SHOT, {}, 1)]).match;
    expect(deckSize(next, ENEMY) - deckSize(slammed, ENEMY)).toBe(3);
  });

});
