import { describe, expect, it } from "vitest";
import { cardIndex, HERO_DECKS, HeroClass } from "./cards";
import { withFullCover } from "./full-cover-fixture";
import { AttackFailReason, EventKind, SquadId, Visibility } from "./host";
import { buildSquadView, createMatch, type MatchState, recordSightings, SIGHT_RANGE, startRound } from "./match";
import { ActionKind, type QueuedAction, type SquadPlan, validatePlan, PlanIssueKind } from "./plan";
import { resolveRound } from "./resolution";

const ASSASSIN = "left-assassin";
const ENEMY = "right-bruiser";
const idx = (name: string, copy = 0) => cardIndex(HeroClass.Assassin, name, copy);
const LONG_SHOT = idx("Long Shot");
const VANISH = idx("Vanish");
const PERSONAL_SPACE = idx("Personal Space");
const SHIELD_BREAKER = idx("Shield Breaker");
// A second Long Shot, a second Vanish and a second Personal Space serve as Pitch fodder.
const PITCH = idx("Long Shot", 1);
const PITCH_2 = idx("Vanish", 1);

// Row 1 is open floor up to col 14; (18,8) is Half Cover (H) with open floor on both sides; the tests that need Full Cover put it on (15,1).
const OPEN = { col: 2, row: 1 };
const HALF_COVER = { col: 18, row: 8 };
const FULL_COVER = { col: 15, row: 1 };

const hero = (match: MatchState, id: string) => match.heroes.find((candidate) => candidate.id === id)!;
const primary = (card: number, target: string): QueuedAction => ({ kind: ActionKind.Primary, card, target });
const plan = (queue: QueuedAction[], pitched: number[] = [PITCH], squad = SquadId.Left, heroId = ASSASSIN): SquadPlan => ({
  squad,
  heroes: [{ heroId, queue, pitched }],
});

/** The Assassin at `from` with the given cards in the Hand and the enemy Bruiser `distance` tiles to the right (or at `enemyAt`). */
function scene(from = OPEN, enemyAt = { col: from.col + 3, row: from.row }, hand = [PITCH, LONG_SHOT, SHIELD_BREAKER, PERSONAL_SPACE]) {
  const match = startRound(createMatch(5));
  hero(match, ASSASSIN).position = { ...from };
  hero(match, ASSASSIN).hand = hand;
  hero(match, ENEMY).position = { ...enemyAt };
  recordSightings(match);
  return match;
}
const at = (distance: number) => scene(OPEN, { col: OPEN.col + distance, row: OPEN.row });
// Row 3 is open floor from col 2 to col 11: the far shots are fired along it.
const LANE = { col: 2, row: 3 };
const along = (distance: number) => scene(LANE, { col: LANE.col + distance, row: LANE.row });

const deckLoss = (before: MatchState, after: MatchState, id = ENEMY) => hero(before, id).deck.length - hero(after, id).deck.length;
const fire = (match: MatchState, card = LONG_SHOT) => resolveRound(match, [plan([primary(card, ENEMY)])]);
const result = ({ events }: Pick<ReturnType<typeof fire>, "events">) => events.find(({ kind }) => kind === EventKind.AttackHit || kind === EventKind.AttackFailed);

describe("Long Shot", () => {
  it("deals 3 damage from Range 3 to 7 and misses closer than 3", () => {
    for (const distance of [3, 5, 7]) expect(result(fire(at(distance)))).toMatchObject({ kind: EventKind.AttackHit, damage: 3 });
    expect(result(fire(at(2)))).toMatchObject({ kind: EventKind.AttackFailed, reason: AttackFailReason.TooClose });
  });

  it("is blocked by Full Cover and reduced by Half Cover", () => {
    const half = scene({ col: 15, row: 8 }, HALF_COVER);
    expect(deckLoss(half, fire(half).match)).toBe(2);
    const full = withFullCover(scene({ col: 11, row: 1 }, FULL_COVER), FULL_COVER);
    expect(result(fire(full))).toMatchObject({ kind: EventKind.AttackFailed, reason: AttackFailReason.FullCover });
  });

  describe("beyond Range 7", () => {
    /** The enemy `distance` tiles away, shown by a Site Survey area so that it is Visible from afar. */
    const shown = (distance: number): MatchState => {
      const match = along(distance);
      match.revealedAreas.push({ squad: SquadId.Left, center: { col: LANE.col + distance, row: LANE.row }, size: 3, remaining: 2 });
      recordSightings(match);
      return match;
    };

    it("is out of Range for a Kit that is not Hidden and a target that is not Marked", () => {
      expect(result(fire(shown(8)))).toMatchObject({ kind: EventKind.AttackFailed, reason: AttackFailReason.OutOfRange });
    });

    it("reaches up to Range 9 for a Marked target, with the damage of the Mark and no bonus", () => {
      const match = shown(9);
      hero(match, ENEMY).marked = 2;
      expect(result(fire(match))).toMatchObject({ kind: EventKind.AttackHit, damage: 4, marked: 1 });
      // Range 10 is too far even for a Marked target (the lane ends at col 11, so the Kit steps back).
      const tenth = scene({ col: 1, row: 3 }, { col: 11, row: 3 });
      hero(tenth, ENEMY).marked = 2;
      expect(result(fire(tenth))).toMatchObject({ reason: AttackFailReason.OutOfRange });
    });

    it("reaches up to Range 9 for a Hidden Kit, which sees that far, and deals +1 damage there", () => {
      for (const distance of [8, 9]) {
        const match = along(distance);
        hero(match, ASSASSIN).hidden = 2;
        const { events } = fire(match);
        expect(events.find(({ kind }) => kind === EventKind.AttackHit), `Range ${distance}`).toMatchObject({ damage: 4 });
        expect(events).toContainEqual({ kind: EventKind.HiddenEnded, tick: 1, heroId: ASSASSIN });
      }
      const near = along(7);
      hero(near, ASSASSIN).hidden = 2;
      expect(result(fire(near))).toMatchObject({ damage: 3 });
    });
  });
});

describe("Shield Breaker", () => {
  const breaker = (match: MatchState) => fire(match, SHIELD_BREAKER);

  it("ignores Shield 3: nothing is absorbed and 2 cards leave the Deck, where a Long Shot is absorbed", () => {
    const match = at(4);
    hero(match, ENEMY).shield = 3;
    const { match: after, events } = breaker(match);
    expect(deckLoss(match, after)).toBe(2);
    expect(events).toContainEqual(expect.objectContaining({ kind: EventKind.AttackHit, absorbed: 0, damage: 2 }));
    expect(result(fire(match))).toMatchObject({ absorbed: 3, damage: 0 });
  });

  it("ignores Half Cover: 2 damage through it, where a Long Shot is reduced", () => {
    const match = scene({ col: 15, row: 8 }, HALF_COVER);
    expect(deckLoss(match, breaker(match).match)).toBe(2);
  });

  it("ignores Full Cover, on the target and in the way, but not a Wall", () => {
    const onTarget = withFullCover(scene({ col: 12, row: 1 }, FULL_COVER), FULL_COVER);
    expect(deckLoss(onTarget, breaker(onTarget).match)).toBe(2);
    // Full Cover on the way blocks the Line of Sight of a Long Shot, but not of a Shield Breaker.
    const inTheWay = withFullCover(scene({ col: 3, row: 3 }, { col: 7, row: 3 }), { col: 5, row: 3 });
    // A Squad mate next to the enemy sees it, so it stays Visible for Kit.
    hero(inTheWay, "left-controller").position = { col: 6, row: 3 };
    recordSightings(inTheWay);
    expect(result(fire(inTheWay))).toMatchObject({ reason: AttackFailReason.NoLineOfSight });
    expect(deckLoss(inTheWay, breaker(inTheWay).match)).toBe(2);
  });

  it("reaches Range 2 to 4", () => {
    expect(result(breaker(at(1)))).toMatchObject({ reason: AttackFailReason.TooClose });
    expect(result(breaker(at(2)))).toMatchObject({ kind: EventKind.AttackHit });
    expect(result(breaker(at(5)))).toMatchObject({ reason: AttackFailReason.OutOfRange });
  });
});

describe("Personal Space (Knockback)", () => {
  const push = (distance: number, edit?: (match: MatchState) => void) => {
    const before = along(distance);
    edit?.(before);
    return { before, ...fire(before, PERSONAL_SPACE) };
  };

  it("deals 1 damage and pushes the target 3 tiles away from Kit, one slide event per tile", () => {
    const { before, match: after, events } = push(2);
    expect(deckLoss(before, after)).toBe(1);
    expect(hero(after, ENEMY).position).toEqual({ col: LANE.col + 5, row: LANE.row });
    const slides = events.filter(({ kind }) => kind === EventKind.Pull);
    expect(slides).toHaveLength(3);
    expect(slides[0]).toMatchObject({ heroId: ENEMY, casterId: ASSASSIN, from: { col: 4, row: 3 }, to: { col: 5, row: 3 }, card: "Personal Space" });
  });

  it("works at Range 1 and 2 only", () => {
    expect(hero(push(1).match, ENEMY).position).toEqual({ col: LANE.col + 4, row: LANE.row });
    expect(result(push(3))).toMatchObject({ reason: AttackFailReason.OutOfRange });
  });

  it("stops at Full Cover and at another Hero", () => {
    const blocked = push(2, (match) => withFullCover(match, { col: 6, row: 3 }));
    expect(hero(blocked.match, ENEMY).position).toEqual({ col: 5, row: 3 });
    const crowded = push(2, (match) => {
      hero(match, "right-controller").position = { col: 7, row: 3 };
    });
    expect(hero(crowded.match, ENEMY).position).toEqual({ col: 6, row: 3 });
  });

  it("leaves the target where a Long Shot hits it: 5 tiles away", () => {
    const view = buildSquadView(push(2).match, SquadId.Left);
    expect(view.enemies.find(({ id }) => id === ENEMY)).toMatchObject({ visibility: Visibility.Visible, position: { col: 7, row: 3 } });
  });
});

describe("Hidden (Vanish)", () => {
  const vanished = (from = OPEN) => {
    const match = scene(from, { col: 15, row: 1 }, [PITCH, VANISH, LONG_SHOT, PITCH_2]);
    return resolveRound(match, [plan([primary(VANISH, ASSASSIN)])]);
  };

  it("makes the Hero Hidden wherever it stands, also on open ground, and shows it in its own Squad View", () => {
    const { match: after, events } = vanished(OPEN);
    expect(events).toEqual([{ kind: EventKind.HiddenGained, tick: 1, heroId: ASSASSIN, card: "Vanish" }]);
    expect(buildSquadView(after, SquadId.Left).heroes.find(({ id }) => id === ASSASSIN)?.hidden).toBe(true);
  });

  it("lasts two Resolutions: the Hero stays Hidden through the next one", () => {
    const { match: after } = vanished();
    expect(hero(after, ASSASSIN).hidden).toBe(1);
    const second = resolveRound(startRound(after), []).match;
    expect(hero(second, ASSASSIN).hidden).toBe(0);
  });

  it("hides the Hero from enemies, also on a tile in their sight", () => {
    const match = scene(HALF_COVER, { col: 21, row: 8 }, [PITCH, VANISH, LONG_SHOT, PITCH_2]);
    expect(buildSquadView(match, SquadId.Right).enemies.find(({ id }) => id === ASSASSIN)?.visibility).toBe(Visibility.Visible);
    const { match: after } = resolveRound(match, [plan([primary(VANISH, ASSASSIN)])]);
    // The enemy keeps only the Ghost of where it last saw the Assassin.
    expect(buildSquadView(after, SquadId.Right).enemies.find(({ id }) => id === ASSASSIN)?.visibility).toBe(Visibility.Ghost);
  });

  it("ends when the Hero attacks", () => {
    const match = scene(HALF_COVER, { col: 21, row: 8 });
    hero(match, ASSASSIN).hidden = 2;
    const { match: after, events } = fire(match);
    expect(events).toContainEqual({ kind: EventKind.HiddenEnded, tick: 1, heroId: ASSASSIN });
    expect(hero(after, ASSASSIN).hidden).toBe(0);
  });

  it("ends when the Hero takes damage", () => {
    // Tilly's Urban Renewal hits an area without needing to see who stands in it.
    const match = scene(OPEN, { col: 15, row: 1 });
    hero(match, ASSASSIN).hidden = 2;
    const renewal = cardIndex(HeroClass.Controller, "Urban Renewal");
    hero(match, "right-controller").position = { col: 5, row: 1 };
    hero(match, "right-controller").hand = [renewal, 1, 2, 3];
    const blast: SquadPlan = {
      squad: SquadId.Right,
      heroes: [{ heroId: "right-controller", queue: [{ kind: ActionKind.Primary, card: renewal, target: "right-controller", tile: OPEN }], pitched: [1] }],
    };
    const { match: after, events } = resolveRound(match, [blast]);
    expect(events).toContainEqual(expect.objectContaining({ kind: EventKind.AttackHit, targetId: ASSASSIN }));
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

describe("Kit's Deck", () => {
  it("has 9 cards: 3 Long Shot, 2 Vanish, 2 Personal Space, 2 Shield Breaker, each at 1 Energy", () => {
    const deck = HERO_DECKS[HeroClass.Assassin];
    const count = (name: string) => deck.filter((card) => card.name === name).length;
    expect([count("Long Shot"), count("Vanish"), count("Personal Space"), count("Shield Breaker")]).toEqual([3, 2, 2, 2]);
    expect(deck).toHaveLength(9);
    expect(deck.every((card) => card.energyCost === 1)).toBe(true);
  });

  it("is planned against a Visible enemy only", () => {
    const match = scene();
    const issues = (card: number, target: string) =>
      validatePlan(buildSquadView(match, SquadId.Left), plan([primary(card, target)])).map(({ kind }) => kind);
    expect(issues(LONG_SHOT, ENEMY)).toEqual([]);
    expect(issues(LONG_SHOT, "right-controller")).toEqual([PlanIssueKind.BadTarget]);
  });
});
