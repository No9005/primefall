import { describe, expect, it } from "vitest";
import { cardIndex, HERO_DECKS, HeroClass } from "./cards";
import { withFullCover } from "./full-cover-fixture";
import { EventKind, SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, recordSightings, SIGHT_RANGE, startRound } from "./match";
import { ActionKind, PlanIssueKind, type QueuedAction, type SquadPlan, validatePlan } from "./plan";
import { resolveRound } from "./resolution";
import { Visibility } from "./host";

const ASSASSIN = "left-assassin";
const ENEMY = "right-bruiser";
const idx = (name: string, copy = 0) => cardIndex(HeroClass.Assassin, name, copy);
// Precision Shot is card 0; a second Long Shot serves as Pitch.
const COVER_BREAKER = idx("Cover Breaker");
const SHIELD_BREAKER = idx("Shield Breaker");
const LONG_SHOT = idx("Long Shot");
const GHOST_SHOT = idx("Ghost Shot");
const EXECUTION_ROUND = idx("Execution Round");
const VANISH = idx("Vanish");
const REPOSITION = idx("Reposition");
const PITCH = idx("Long Shot", 1);

// Row 1 is open floor; (18,8) is Half Cover (H) with open floor on both sides; the tests that need Full Cover put it at (15,1).
const OPEN = { col: 2, row: 1 };
const HALF_COVER = { col: 18, row: 8 };
const FULL_COVER = { col: 15, row: 1 };

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const primary = (card: number, target: string, overdrive?: boolean): QueuedAction => ({
  kind: ActionKind.Primary,
  card,
  target,
  ...(overdrive ? { overdrive } : {}),
});
const plan = (queue: QueuedAction[], pitched: number[] = [PITCH], squad = SquadId.Left, heroId = ASSASSIN): SquadPlan => ({
  squad,
  heroes: [{ heroId, queue, pitched }],
});

/** The Assassin at `from` with the given cards in the Hand and the enemy Bruiser at `enemyAt`. */
function scene(from = OPEN, enemyAt = { col: from.col + 3, row: from.row }, hand = [PITCH, VANISH, GHOST_SHOT, REPOSITION]) {
  const match = startRound(createMatch(5));
  hero(match, ASSASSIN).position = { ...from };
  hero(match, ASSASSIN).hand = hand;
  hero(match, ENEMY).position = { ...enemyAt };
  recordSightings(match);
  return match;
}

const deckLoss = (before: MatchState, after: MatchState, id = ENEMY) => hero(before, id).deck.length - hero(after, id).deck.length;

describe("Precision Shot, Cover Breaker and Execution Round", () => {
  it("Execution Round deals 3 damage for 2 Energy", () => {
    const match = scene(OPEN, undefined, [PITCH, 0, EXECUTION_ROUND, REPOSITION]);
    const { match: after } = resolveRound(match, [plan([primary(EXECUTION_ROUND, ENEMY)], [PITCH, 0])]);
    expect(deckLoss(match, after)).toBe(3);
  });

  it("Execution Round ignores Half Cover (ADR 0025): 3 damage through it, where Precision Shot is reduced", () => {
    const hand = [PITCH, EXECUTION_ROUND, 0, REPOSITION];
    const match = scene({ col: 15, row: 8 }, HALF_COVER, hand);
    const execution = resolveRound(match, [plan([primary(EXECUTION_ROUND, ENEMY)], [PITCH, 0])]).match;
    expect(deckLoss(match, execution)).toBe(3);
  });

  it("Cover Breaker ignores Half Cover while a Precision Shot is reduced by it", () => {
    const attacker = { col: 15, row: 8 };
    const hand = [PITCH, COVER_BREAKER, 0, REPOSITION];
    const match = scene(attacker, HALF_COVER, hand);
    const breaker = resolveRound(match, [plan([primary(COVER_BREAKER, ENEMY)])]).match;
    const precision = resolveRound(match, [plan([primary(0, ENEMY)])]).match;
    expect([deckLoss(match, breaker), deckLoss(match, precision)]).toEqual([2, 1]);
  });
});

describe("Shield Breaker (Piercing Damage)", () => {
  const hand = [PITCH, 0, SHIELD_BREAKER, REPOSITION];
  const fire = (match: MatchState) => resolveRound(match, [plan([primary(SHIELD_BREAKER, ENEMY)], [PITCH, 0])]);

  it("ignores Shield 3: nothing is absorbed and 2 cards leave the Deck, where a Precision Shot is absorbed", () => {
    const match = scene(OPEN, { col: 6, row: 1 }, [PITCH, 0, SHIELD_BREAKER, LONG_SHOT]);
    hero(match, ENEMY).shield = 3;
    const { match: after, events } = fire(match);
    expect(deckLoss(match, after)).toBe(2);
    expect(events).toContainEqual(expect.objectContaining({ kind: EventKind.AttackHit, absorbed: 0, damage: 2 }));
    const precision = resolveRound(match, [plan([primary(LONG_SHOT, ENEMY)])]);
    expect(deckLoss(match, precision.match)).toBe(0);
    expect(precision.events).toContainEqual(expect.objectContaining({ kind: EventKind.AttackHit, absorbed: 2, damage: 0 }));
  });

  it("is reduced by 1 by Half Cover and blocked by Full Cover", () => {
    const half = scene({ col: 15, row: 8 }, HALF_COVER, hand);
    expect(deckLoss(half, fire(half).match)).toBe(1);
    const full = withFullCover(scene({ col: 12, row: 1 }, FULL_COVER, hand), FULL_COVER);
    expect(deckLoss(full, fire(full).match)).toBe(0);
  });

  it("misses beyond Range 4", () => {
    const match = scene(OPEN, { col: 7, row: 1 }, hand);
    expect(deckLoss(match, fire(match).match)).toBe(0);
  });

  it("is one Shield Breaker and one Cover Breaker in the 9-card Deck", () => {
    const names = HERO_DECKS[HeroClass.Assassin].map(({ name }) => name);
    expect(names).toHaveLength(9);
    expect(names.filter((name) => name === "Shield Breaker")).toHaveLength(1);
    expect(names.filter((name) => name === "Cover Breaker")).toHaveLength(1);
    expect(names).not.toContain("Piercing Round");
  });
});

describe("Reposition", () => {
  const destination = (col: number) => ({ kind: ActionKind.Move as const, card: 0, destination: { col, row: 1 } });
  const hand = [PITCH, REPOSITION, 0, VANISH];

  it("turns the next Move into Move 3", () => {
    const match = scene(OPEN, { col: 15, row: 1 }, hand);
    const { match: after } = resolveRound(match, [plan([primary(REPOSITION, ASSASSIN), destination(5)])]);
    expect(hero(after, ASSASSIN).position).toEqual({ col: 5, row: 1 });
  });

  it("does not stretch a second Move", () => {
    const match = scene(OPEN, { col: 15, row: 1 }, [PITCH, REPOSITION, 0, 3]);
    const queue = [primary(REPOSITION, ASSASSIN), destination(5), { ...destination(8), card: 3 }];
    const { match: after } = resolveRound(match, [plan(queue)]);
    expect(hero(after, ASSASSIN).position).toEqual({ col: 7, row: 1 });
  });

  it("is accepted by planning only for the Move that follows it", () => {
    const match = scene(OPEN, { col: 15, row: 1 }, hand);
    const view = buildSquadView(match, SquadId.Left);
    const issues = (queue: QueuedAction[]) =>
      validatePlan(view, plan(queue)).filter(({ kind }) => kind === PlanIssueKind.BadDestination);
    expect(issues([primary(REPOSITION, ASSASSIN), destination(5)])).toEqual([]);
    expect(issues([destination(5)])).toHaveLength(1);
  });
});

describe("Hidden", () => {
  const vanished = (from = HALF_COVER) => {
    const match = scene(from, { col: 15, row: 1 });
    return resolveRound(match, [plan([primary(VANISH, ASSASSIN)])]);
  };

  it("Vanish makes the Hero Hidden on a Cover tile and shows it in its own Squad View", () => {
    const { match: after, events } = vanished();
    expect(events).toContainEqual({ kind: EventKind.HiddenGained, tick: 1, heroId: ASSASSIN, card: "Vanish" });
    expect(buildSquadView(after, SquadId.Left).heroes.find(({ id }) => id === ASSASSIN)?.hidden).toBe(true);
  });

  it("Vanish fails outside Cover", () => {
    const { match: after, events } = vanished(OPEN);
    expect(events).toEqual([{ kind: EventKind.ActionFailed, tick: 1, heroId: ASSASSIN }]);
    expect(hero(after, ASSASSIN).hidden).toBe(0);
  });

  it("lasts two Resolutions: the Hero stays Hidden through the next one", () => {
    const { match: after } = vanished();
    expect(hero(after, ASSASSIN).hidden).toBe(1);
    const second = resolveRound(startRound(after), []).match;
    expect(hero(second, ASSASSIN).hidden).toBe(0);
  });

  it("hides the Hero from enemies, also on a tile in their sight", () => {
    const match = scene(HALF_COVER, { col: 21, row: 8 });
    expect(buildSquadView(match, SquadId.Right).enemies.find(({ id }) => id === ASSASSIN)?.visibility).toBe(Visibility.Visible);
    const { match: after } = resolveRound(match, [plan([primary(VANISH, ASSASSIN)])]);
    const seen = buildSquadView(after, SquadId.Right).enemies.find(({ id }) => id === ASSASSIN);
    // The enemy keeps only the Ghost of where it last saw the Assassin.
    expect(seen?.visibility).toBe(Visibility.Ghost);
  });

  it("ends when the Hero attacks", () => {
    const match = scene(HALF_COVER, { col: 21, row: 8 }, [PITCH, VANISH, 0, REPOSITION]);
    hero(match, ASSASSIN).hidden = 2;
    // An enemy Hero cannot see a Hidden Assassin, but the Assassin sees the enemy and may attack it.
    const { match: after, events } = resolveRound(match, [plan([primary(0, ENEMY)])]);
    expect(events).toContainEqual({ kind: EventKind.HiddenEnded, tick: 1, heroId: ASSASSIN });
    expect(hero(after, ASSASSIN).hidden).toBe(0);
  });

  it("gives a Hidden Assassin sight range 9 instead of 7", () => {
    const open = { col: 2, row: 3 };
    const enemyAt = { col: open.col + 9, row: open.row };
    const seenBy = (hidden: number) => {
      const match = scene(open, enemyAt);
      hero(match, ASSASSIN).hidden = hidden;
      return buildSquadView(match, SquadId.Left).enemies.find(({ id }) => id === ENEMY)?.visibility;
    };
    expect(seenBy(0)).toBe(Visibility.Unknown);
    expect(seenBy(2)).toBe(Visibility.Visible);
    expect([SIGHT_RANGE, 9]).toEqual([7, 9]);
  });

  it("does not leak a Hidden Hero's steps to an enemy that sees the tiles", () => {
    const match = scene(OPEN, { col: 8, row: 1 });
    hero(match, ASSASSIN).hidden = 2;
    const queue: QueuedAction[] = [{ kind: ActionKind.Move, card: PITCH, destination: { col: 4, row: 1 } }];
    const resolution = resolveRound(match, [plan(queue, [])]);
    const perceived = resolution.perceivedBy.flatMap((squads, i) => (squads.includes(SquadId.Right) ? [resolution.events[i]] : []));
    expect(perceived).toEqual([]);
  });
});

describe("Ghost Shot Overdrive", () => {
  const hand = [PITCH, GHOST_SHOT, 0, REPOSITION];

  /** The Left Squad remembers the enemy Bruiser at `ghostAt`; the enemy is now elsewhere (`standing`). */
  function ghostScene(ghostAt: { col: number; row: number }, standing: { col: number; row: number }, occupant?: { col: number; row: number }) {
    const match = scene(OPEN, standing, hand);
    match.ghosts[SquadId.Left][ENEMY] = {
      position: ghostAt, deckCount: 9, discardCount: 0, exileCount: 0, lastSeenRound: 1,
    };
    if (occupant) hero(match, "right-controller").position = occupant;
    return match;
  }
  const shoot = (match: MatchState) => resolveRound(match, [plan([primary(GHOST_SHOT, ENEMY, true)])]);

  it("hits an enemy that stands on the remembered tile", () => {
    // The Bruiser has left (it stands far away); another enemy Hero now occupies the Ghost's tile.
    const match = ghostScene({ col: 5, row: 1 }, { col: 15, row: 1 }, { col: 5, row: 1 });
    const { match: after } = shoot(match);
    expect(deckLoss(match, after, "right-controller")).toBe(2);
    expect(hero(after, ASSASSIN).exile).toEqual([GHOST_SHOT]);
  });

  it("hits the enemy that is still there", () => {
    const match = ghostScene({ col: 5, row: 1 }, { col: 5, row: 1 });
    // The enemy is Visible, so the Ghost memory is replaced when the Round starts; keep the old one.
    const { match: after } = shoot(match);
    expect(deckLoss(match, after)).toBe(2);
  });

  it("misses an empty tile", () => {
    const match = ghostScene({ col: 5, row: 1 }, { col: 15, row: 1 });
    const { match: after, events } = shoot(match);
    expect(events.map(({ kind }) => kind)).toContain(EventKind.AttackFailed);
    expect(after.heroes.map((candidate) => candidate.deck.length)).toEqual(match.heroes.map((candidate) => candidate.deck.length));
  });

  it("is blocked by Full Cover and reduced by Half Cover", () => {
    const full = withFullCover(ghostScene(FULL_COVER, { col: 15, row: 5 }), FULL_COVER);
    hero(full, ASSASSIN).position = { col: 12, row: 1 };
    hero(full, ENEMY).position = FULL_COVER;
    expect(deckLoss(full, shoot(full).match)).toBe(0);
    const half = ghostScene(HALF_COVER, HALF_COVER);
    hero(half, ASSASSIN).position = { col: 15, row: 8 };
    expect(deckLoss(half, shoot(half).match)).toBe(1);
  });

  it("is planned against a Ghost only", () => {
    const match = ghostScene({ col: 5, row: 1 }, { col: 15, row: 1 });
    const issues = (target: string) =>
      validatePlan(buildSquadView(match, SquadId.Left), plan([primary(GHOST_SHOT, target, true)])).map(({ kind }) => kind);
    expect(issues(ENEMY)).toEqual([]);
    expect(issues("right-controller")).toEqual([PlanIssueKind.BadTarget]);
  });
});
