import { describe, expect, it } from "vitest";
import { EventKind, SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, MAX_QUEUE_LENGTH, PlanIssueKind, type QueuedAction, type SquadPlan, validatePlan } from "./plan";
import { resolveRound } from "./resolution";

const BRUISER = "left-bruiser";
const WAIT: QueuedAction = { kind: ActionKind.Wait };

const planOf = (queue: QueuedAction[]): SquadPlan => ({ squad: SquadId.Left, heroes: [{ heroId: BRUISER, queue }] });
const bruiserOf = (match: MatchState) => match.heroes.find((hero) => hero.id === BRUISER)!;

function setup() {
  const match = startRound(createMatch(5));
  bruiserOf(match).position = { col: 8, row: 3 };
  return match;
}

describe("Wait", () => {
  it("leaves the Hero in place during the Tick of the Wait", () => {
    const match = setup();
    const [first, second, third] = bruiserOf(match).hand;
    const queue: QueuedAction[] = [
      { kind: ActionKind.Move, card: first!, destination: { col: 10, row: 3 } },
      WAIT,
      { kind: ActionKind.Move, card: third ?? second!, destination: { col: 12, row: 3 } },
    ];
    const { events } = resolveRound(match, [planOf(queue)]);
    const stepsIn = (tick: number) => events.filter((event) => event.kind === EventKind.Step && event.tick === tick);
    expect(stepsIn(1)).toHaveLength(2);
    expect(stepsIn(2)).toHaveLength(0);
    expect(stepsIn(3)).toHaveLength(2);
    expect(events.filter((event) => event.kind === EventKind.Wait).map(({ tick, heroId }) => [tick, heroId])).toEqual([[2, BRUISER]]);
  });

  it("is legal anywhere up to the cap, and illegal above it", () => {
    const view = buildSquadView(setup(), SquadId.Left);
    expect(validatePlan(view, planOf(Array(MAX_QUEUE_LENGTH).fill(WAIT)))).toEqual([]);
    const issues = validatePlan(view, planOf(Array(MAX_QUEUE_LENGTH + 1).fill(WAIT)));
    expect(issues.map(({ kind }) => kind)).toEqual([PlanIssueKind.QueueTooLong]);
  });

  it("uses no card and no Energy and emits one event per Wait", () => {
    const match = setup();
    const before = bruiserOf(match);
    const { match: after, events } = resolveRound(match, [planOf([WAIT, WAIT])]);
    const bruiser = bruiserOf(after);
    expect(bruiser.hand).toEqual(before.hand);
    expect(bruiser.discard).toEqual(before.discard);
    expect(bruiser.position).toEqual(before.position);
    expect(events.filter((event) => event.kind === EventKind.Wait)).toHaveLength(2);
    expect(events.some((event) => event.kind === EventKind.ActionFailed)).toBe(false);
  });
});
