import { describe, expect, it } from "vitest";
import { HeroClass } from "./cards";
import { buildSquadView, createMatch, startRound } from "./match";
import { SquadId, type SquadView } from "./host";
import { ActionKind, cardRangeArea, energyPool, isInCardRange, type MoveAction, PlanIssueKind, type QueuedAction, type SquadPlan, validatePlan } from "./plan";
import { type GridPosition, parseGrid } from "./notstrom-map";

// The enemy Bruiser stands in sight of the Squad; the other enemies are still Unknown.
const match = startRound(createMatch(9));
match.heroes.find((hero) => hero.id === "right-bruiser")!.position = { col: 7, row: 7 };
const view = buildSquadView(match, SquadId.Left);
const enemy = view.enemies.find((candidate) => candidate.id === "right-bruiser")!;
const bruiser = view.heroes.find((hero) => hero.heroClass === HeroClass.Bruiser)!;
const near = (offset: number): GridPosition => ({ col: bruiser.position.col + offset, row: bruiser.position.row });
const move = (card: number, destination: GridPosition): MoveAction => ({ kind: ActionKind.Move, card, destination });
const planFor = (...queue: MoveAction[]) => ({ squad: SquadId.Left, heroes: [{ heroId: bruiser.id, queue }] });
const kinds = (...queue: MoveAction[]) => validatePlan(view, planFor(...queue)).map((issue) => issue.kind);

describe("validatePlan", () => {
  it("accepts empty and valid plans", () => {
    expect(kinds()).toEqual([]);
    expect(kinds(move(bruiser.hand[0]!, near(2)))).toEqual([]);
  });

  it("accepts a chain of moves, each measured from the end of the previous one", () => {
    expect(kinds(move(bruiser.hand[0]!, near(2)), move(bruiser.hand[1]!, near(4)))).toEqual([]);
  });

  it("rejects a card that is not in the Hand", () => {
    const outside = [...Array(12).keys()].find((index) => !bruiser.hand.includes(index))!;
    expect(kinds(move(outside, near(1)))).toEqual([PlanIssueKind.CardNotInHand]);
  });

  it("rejects a card used twice", () => {
    const card = bruiser.hand[0]!;
    expect(kinds(move(card, near(1)), move(card, near(2)))).toEqual([PlanIssueKind.CardUsedTwice]);
  });

  it("rejects a Queue longer than 4", () => {
    const moves = [1, 2, 3, 4, 5].map((i) => move(bruiser.hand[i % 4]!, near(i)));
    expect(kinds(...moves)).toContain(PlanIssueKind.QueueTooLong);
  });

  it("rejects destinations that are too far, unchanged, outside the Grid or a Wall", () => {
    expect(kinds(move(bruiser.hand[0]!, near(4)))).toEqual([PlanIssueKind.BadDestination]);
    expect(kinds(move(bruiser.hand[0]!, near(0)))).toEqual([PlanIssueKind.BadDestination]);
    expect(kinds(move(bruiser.hand[0]!, { col: -1, row: 4 }))).toEqual([PlanIssueKind.BadDestination]);
    // (0, 7) is a Wall, one tile away from the Bruiser's Drop Point tile.
    expect(kinds(move(bruiser.hand[0]!, { col: 0, row: 7 }))).toEqual([PlanIssueKind.BadDestination]);
  });

  it("names the Queue slot of the action that breaks a rule", () => {
    const issues = validatePlan(view, planFor(move(bruiser.hand[0]!, near(2)), move(bruiser.hand[1]!, near(9))));
    expect(issues.map((issue) => issue.slot)).toEqual([1]);
  });

  it("rejects an unknown Hero and another Squad's plan", () => {
    expect(validatePlan(view, { squad: SquadId.Left, heroes: [{ heroId: "x", queue: [] }] })[0]!.kind).toBe(PlanIssueKind.UnknownHero);
    expect(validatePlan(view, { squad: SquadId.Right, heroes: [] })[0]!.kind).toBe(PlanIssueKind.WrongSquad);
  });

  it("gives every issue a reason to show", () => {
    expect(validatePlan(view, planFor(move(999, near(5))))[0]!.message).not.toBe("");
  });
});

describe("validatePlan: Pitch, Energy and Block", () => {
  // Block exists in Attack and Defend only; the classic mode has none.
  const planKinds = (pitched: number[], queue: QueuedAction[]) =>
    validatePlan(view, { squad: SquadId.Left, heroes: [{ heroId: bruiser.id, queue, pitched }] }).map((issue) => issue.kind);

  it("gives 1 Energy per pitched card", () => {
    expect(energyPool([])).toBe(0);
    expect(energyPool(bruiser.hand.slice(0, 3))).toBe(3);
  });

  it("rejects a Queue whose Energy costs exceed the pool and accepts one that fits", () => {
    // Every card costs 1 Energy: two Attacks need two pitched cards.
    const assassin = view.heroes.find((hero) => hero.heroClass === HeroClass.Assassin)!;
    const withHand: SquadView = {
      ...view,
      heroes: view.heroes.map((hero) => (hero === assassin ? { ...hero, hand: [6, 7, 0, 1] } : hero)),
    };
    const actions: QueuedAction[] = [
      { kind: ActionKind.Primary, card: 6, target: enemy.id },
      { kind: ActionKind.Primary, card: 7, target: enemy.id },
    ];
    const kindsFor = (pitched: number[]) =>
      validatePlan(withHand, { squad: SquadId.Left, heroes: [{ heroId: assassin.id, queue: actions, pitched }] }).map((issue) => issue.kind);
    expect(kindsFor([])).toEqual([PlanIssueKind.NotEnoughEnergy]);
    expect(kindsFor([0])).toEqual([PlanIssueKind.NotEnoughEnergy]);
    expect(kindsFor([0, 1])).toEqual([]);
  });

  it("needs an enemy Hero as the target of an Attack", () => {
    const attack = (card: number, target: string): QueuedAction => ({ kind: ActionKind.Primary, card, target });
    const withHand: SquadView = {
      ...view,
      heroes: view.heroes.map((hero) => (hero === bruiser ? { ...hero, hand: [0, 1, 5, 7] } : hero)),
    };
    const check = (queue: QueuedAction[]) =>
      validatePlan(withHand, { squad: SquadId.Left, heroes: [{ heroId: bruiser.id, queue, pitched: [1] }] }).map((issue) => issue.kind);
    expect(check([attack(0, enemy.id)])).toEqual([]);
    expect(check([attack(0, bruiser.id)])).toEqual([PlanIssueKind.BadTarget]);
    expect(check([attack(0, "nobody")])).toEqual([PlanIssueKind.BadTarget]);
    // Only a Visible enemy can be targeted: right-controller is still Unknown.
    expect(check([attack(0, "right-controller")])).toEqual([PlanIssueKind.BadTarget]);
    // Bruiser card 5 is Hard Hat: a self card, so an enemy is no target.
    expect(check([attack(5, enemy.id)])).toEqual([PlanIssueKind.BadTarget]);
  });

  it("accepts a Visible enemy that is out of Range, because the Attack is checked in the Tick it fires", () => {
    const farAway: SquadView = {
      ...view,
      heroes: view.heroes.map((hero) => (hero === bruiser ? { ...hero, hand: [0, 1, 2, 3] } : hero)),
      enemies: view.enemies.map((other) => (other === enemy ? { ...other, position: { col: 17, row: 10 } } : other)),
    };
    const plan: SquadPlan = {
      squad: SquadId.Left,
      heroes: [{ heroId: bruiser.id, queue: [{ kind: ActionKind.Primary, card: 0, target: enemy.id }], pitched: [1] }],
    };
    expect(validatePlan(farAway, plan)).toEqual([]);
  });

  it("plans a self Utility card on this Hero only", () => {
    const controller = view.heroes.find((hero) => hero.heroClass === HeroClass.Controller)!;
    const withHand: SquadView = {
      ...view,
      heroes: view.heroes.map((hero) => (hero === bruiser ? { ...hero, hand: [5, 6, 0, 1] } : hero === controller ? { ...hero, hand: [9, 0, 1, 2] } : hero)),
    };
    const use = (card: number, target: string): QueuedAction => ({ kind: ActionKind.Primary, card, target });
    const check = (heroId: string, queue: QueuedAction[], pitched: number[] = [0, 1]) =>
      validatePlan(withHand, { squad: SquadId.Left, heroes: [{ heroId, queue, pitched }] }).map((issue) => issue.kind);
    // Hard Hat (Bruiser 5) is self only.
    expect(check(bruiser.id, [use(5, bruiser.id)])).toEqual([]);
    expect(check(bruiser.id, [use(5, controller.id)])).toEqual([PlanIssueKind.BadTarget]);
    expect(check(bruiser.id, [use(5, enemy.id)])).toEqual([PlanIssueKind.BadTarget]);
    // Utility cards cost Energy like Attacks.
    expect(check(bruiser.id, [use(5, bruiser.id)], [])).toEqual([PlanIssueKind.NotEnoughEnergy]);
  });

  it("rejects any plan for an Exhausted Hero", () => {
    const exhausted: SquadView = {
      ...view,
      heroes: view.heroes.map((hero) => (hero === bruiser ? { ...hero, exhausted: true } : hero)),
    };
    const plan = { squad: SquadId.Left, heroes: [{ heroId: bruiser.id, queue: [move(bruiser.hand[0]!, near(1))] }] };
    expect(validatePlan(exhausted, plan).map((issue) => issue.kind)).toEqual([PlanIssueKind.HeroExhausted]);
  });

  it("lets a card fulfil only one role per Round", () => {
    const [a] = bruiser.hand;
    expect(planKinds([a!], [move(a!, near(1))])).toEqual([PlanIssueKind.CardUsedTwice]);
    expect(planKinds([a!, a!], [])).toEqual([PlanIssueKind.CardUsedTwice]);
  });

  it("rejects pitching a card that is not in the Hand", () => {
    const outside = [...Array(12).keys()].find((index) => !bruiser.hand.includes(index))!;
    expect(planKinds([outside], [])).toEqual([PlanIssueKind.CardNotInHand]);
  });
});

describe("cardRangeArea", () => {
  const grid = parseGrid(["#########", "#.......#", "#...#...#", "#.......#", "#.......#", "#########"]);
  const positions = (tiles: ReturnType<typeof cardRangeArea>) => tiles.map(({ position }) => position);

  it("is the square of tiles within the Range, without the origin, cut at the Grid edge", () => {
    const tiles = positions(cardRangeArea(grid, { col: 0, row: 0 }, { range: 2 }));
    expect(tiles).toHaveLength(3 * 3 - 1);
    expect(tiles).not.toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 2, row: 2 });
    expect(tiles).not.toContainEqual({ col: 3, row: 0 });
  });

  it("marks Walls as blocked and is empty for a card without a Range", () => {
    const tiles = cardRangeArea(grid, { col: 3, row: 3 }, { range: 1 });
    expect(tiles.find(({ position }) => position.col === 4 && position.row === 2)?.blocked).toBe(true);
    expect(tiles.find(({ position }) => position.col === 2 && position.row === 3)?.blocked).toBe(false);
    expect(cardRangeArea(grid, { col: 3, row: 3 }, {})).toEqual([]);
  });

  it("isInCardRange agrees with the drawn area for every tile", () => {
    const origin = { col: 3, row: 3 };
    const card = { range: 2 };
    const inArea = positions(cardRangeArea(grid, origin, card));
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        const position = { col, row };
        const isOrigin = col === origin.col && row === origin.row;
        expect(isInCardRange(origin, card, position) && !isOrigin).toBe(inArea.some((tile) => tile.col === col && tile.row === row));
      }
    }
    expect(isInCardRange(origin, {}, { col: 8, row: 5 })).toBe(true);
  });
});
