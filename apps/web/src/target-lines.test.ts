import {
  ActionKind,
  EventKind,
  HERO_DECKS,
  HeroClass,
  type EnemyView,
  type GridPosition,
  type HeroView,
  type MatchEvent,
  parseGrid,
  type QueuedAction,
  type SquadPlan,
  SquadId,
  Visibility,
} from "game-core";
import { createLocalHost } from "game-core/local-host";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames } from "./playback";
import { SegmentStyle } from "./shot-lines";
import { crossfireRings, LineKind, LineTone, plannedTargetLines, replayTargetLines, RingSegment } from "./target-lines";

const grid = parseGrid(["#########", "#.......#", "#...#...#", "#.......#", "#.......#", "#########"]);

const cardIndex = (heroClass: HeroClass, name: string) => HERO_DECKS[heroClass].findIndex((card) => card.name === name);
const hero = (id: string, heroClass: HeroClass, position: GridPosition): HeroView =>
  ({ id, heroClass, position, exhausted: false }) as unknown as HeroView;
const visible = (id: string, position: GridPosition): EnemyView =>
  ({ id, heroClass: HeroClass.Assassin, visibility: Visibility.Visible, position }) as unknown as EnemyView;
const ghost = (id: string, position: GridPosition): EnemyView =>
  ({ id, heroClass: HeroClass.Assassin, visibility: Visibility.Ghost, position }) as unknown as EnemyView;
const unknown = (id: string): EnemyView => ({ id, heroClass: HeroClass.Assassin, visibility: Visibility.Unknown });

const bruiser = hero("b", HeroClass.Bruiser, { col: 1, row: 1 });
const controller = hero("c", HeroClass.Controller, { col: 1, row: 3 });
const heroes = [bruiser, controller];

const plan = (heroId: string, queue: QueuedAction[]): SquadPlan => ({ squad: "a", heroes: [{ heroId, queue }] }) as unknown as SquadPlan;
const attack = (target: string): QueuedAction => ({ kind: ActionKind.Primary, card: cardIndex(HeroClass.Bruiser, "Slam Shot"), target });

describe("plannedTargetLines", () => {
  it("draws a teal Attack line numbered with its Tick when the shot can hit", () => {
    const move: QueuedAction = { kind: ActionKind.Move, card: 0, destination: { col: 1, row: 1 } };
    const lines = plannedTargetLines(grid, heroes, [visible("e", { col: 3, row: 1 })], [plan("b", [move, attack("e")])]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: LineKind.Attack, tone: LineTone.Clear, tick: 2, own: true, from: bruiser.position, to: { col: 3, row: 1 } });
    expect(lines[0]!.shot?.cross).toBeUndefined();
    expect(lines[0]).toMatchObject({ planned: true, unreachable: false });
  });

  it("checks an Attack from the position after the Moves before it", () => {
    const far = parseGrid(["####################", "#..................#", "####################"]);
    const target = [visible("e", { col: 18, row: 1 })];
    const move: QueuedAction = { kind: ActionKind.Move, card: 0, destination: { col: 16, row: 1 } };
    const [before] = plannedTargetLines(far, [bruiser], target, [plan("b", [attack("e")])]);
    const [after] = plannedTargetLines(far, [bruiser], target, [plan("b", [move, attack("e")])]);
    expect(before).toMatchObject({ unreachable: true, tone: LineTone.Red });
    expect(after).toMatchObject({ unreachable: false, tone: LineTone.Clear, from: { col: 16, row: 1 } });
  });

  it("hints that a Tick 4 shot may miss, with the reason, and says nothing when it can hit", () => {
    const far = parseGrid(["####################", "#..................#", "####################"]);
    const target = [visible("e", { col: 18, row: 1 })];
    const move: QueuedAction = { kind: ActionKind.Move, card: 0, destination: { col: 3, row: 1 } };
    const wait: QueuedAction = { kind: ActionKind.Wait };
    const [tooFar] = plannedTargetLines(far, [bruiser], target, [plan("b", [move, wait, wait, attack("e")])]);
    expect(tooFar).toMatchObject({ tick: 4, unreachable: true, missHint: "may miss: out of Range from the planned position" });
    const closer: QueuedAction = { kind: ActionKind.Move, card: 0, destination: { col: 16, row: 1 } };
    const [inReach] = plannedTargetLines(far, [bruiser], target, [plan("b", [closer, wait, wait, attack("e")])]);
    expect(inReach!.missHint).toBeUndefined();
    const [walled] = plannedTargetLines(grid, [hero("b", HeroClass.Bruiser, { col: 3, row: 2 })], [visible("e", { col: 5, row: 2 })], [plan("b", [attack("e")])]);
    expect(walled!.missHint).toBe("may miss: no clear shot from the planned position");
  });

  it("draws a red line with the blocked tile where a Wall stops the shot", () => {
    const shooter = hero("b", HeroClass.Bruiser, { col: 2, row: 2 });
    const [line] = plannedTargetLines(grid, [shooter], [visible("e", { col: 5, row: 2 })], [plan("b", [attack("e")])]);
    expect(line).toMatchObject({ kind: LineKind.Attack, tone: LineTone.Red });
    expect(line!.shot?.cross).toEqual({ col: 4, row: 2 });
    expect(line!.shot?.segments.map((segment) => segment.style)).toEqual([SegmentStyle.Stopped, SegmentStyle.Beyond]);
  });

  it("draws a red line to a target out of Range, without a cross", () => {
    const far = parseGrid(["####################", "#..................#", "####################"]);
    const [line] = plannedTargetLines(far, [bruiser], [visible("e", { col: 18, row: 1 })], [plan("b", [attack("e")])]);
    expect(line).toMatchObject({ tone: LineTone.Red });
    expect(line!.shot?.cross).toBeUndefined();
    expect(line!.shot?.segments[0]!.style).toBe(SegmentStyle.Stopped);
  });

  it("draws an Attack line to a Ghost's last known tile", () => {
    const [line] = plannedTargetLines(grid, heroes, [ghost("e", { col: 4, row: 1 })], [plan("b", [attack("e")])]);
    expect(line).toMatchObject({ kind: LineKind.Attack, to: { col: 4, row: 1 } });
  });

  it("draws an ally effect as an Ally line to the allied Hero", () => {
    const reinforce: QueuedAction = { kind: ActionKind.Primary, card: cardIndex(HeroClass.Bruiser, "Reinforce"), target: "c" };
    expect(plannedTargetLines(grid, heroes, [], [plan("b", [reinforce])])).toMatchObject([
      { kind: LineKind.Ally, tone: LineTone.Clear, tick: 1, from: bruiser.position, to: controller.position },
    ]);
  });

  it("draws a tile effect as a Tile line ending on the tile", () => {
    const breach: QueuedAction = { kind: ActionKind.Primary, card: cardIndex(HeroClass.Bruiser, "Breach Charge"), target: "b", tile: { col: 4, row: 2 } };
    expect(plannedTargetLines(grid, heroes, [], [plan("b", [breach])])).toMatchObject([
      { kind: LineKind.Tile, tick: 1, to: { col: 4, row: 2 } },
    ]);
  });

  it("draws no line for Block, Move or a self effect", () => {
    const bulwark: QueuedAction = { kind: ActionKind.Primary, card: cardIndex(HeroClass.Bruiser, "Bulwark"), target: "b" };
    const queue: QueuedAction[] = [{ kind: ActionKind.Block, card: 0 }, { kind: ActionKind.Move, card: 1, destination: { col: 2, row: 1 } }, bulwark];
    expect(plannedTargetLines(grid, heroes, [], [plan("b", queue)])).toEqual([]);
  });

  it("never draws a line to an Unknown enemy", () => {
    expect(plannedTargetLines(grid, heroes, [unknown("e")], [plan("b", [attack("e")])])).toEqual([]);
  });

  it("reads only the plans it is given and no enemy plan or data beyond the Squad View", () => {
    // An enemy Hero planning in the same plan list is not in `heroes`, so it yields nothing.
    const enemyPlan = plan("e", [attack("b")]);
    expect(plannedTargetLines(grid, heroes, [visible("e", { col: 5, row: 1 })], [enemyPlan])).toEqual([]);
    const view = visible("e", { col: 5, row: 1 });
    const hidden = new Proxy(unknown("u"), {
      get: (target, key) => {
        if (key !== "id" && key !== "visibility") throw new Error(`read ${String(key)} of an Unknown enemy`);
        return target[key as "id" | "visibility"];
      },
    });
    expect(() => plannedTargetLines(grid, heroes, [view, hidden], [plan("b", [attack("u")])])).not.toThrow();
  });
});

describe("replayTargetLines", () => {
  const event = (partial: Partial<MatchEvent> & Pick<MatchEvent, "kind" | "heroId">): MatchEvent => ({ tick: 1, ...partial });
  const positions: Record<string, GridPosition> = { b: { col: 1, row: 1 }, c: { col: 1, row: 3 }, e: { col: 5, row: 1 }, u: { col: 6, row: 3 } };
  const positionOf = (id: string) => positions[id];

  it("shows a teal line for each hit and a red line with a cross for a failed shot, in the Tick of the event", () => {
    const events = [
      event({ kind: EventKind.AttackHit, heroId: "b", targetId: "e", tick: 2, damage: 2 }),
      event({ kind: EventKind.AttackFailed, heroId: "c", targetId: "e", tick: 3 }),
    ];
    const lines = replayTargetLines(events, heroes, [visible("e", positions.e!)], positionOf);
    expect(lines).toMatchObject([
      { heroId: "b", tick: 2, tone: LineTone.Clear, to: positions.e },
      { heroId: "c", tick: 3, tone: LineTone.Red },
    ]);
    expect(lines[0]!.shot?.cross).toBeUndefined();
    expect(lines[1]!.shot?.cross).toEqual(positions.e);
  });

  it("shows a tile line for a Cover event", () => {
    const events = [event({ kind: EventKind.CoverDestroyed, heroId: "b", to: { col: 4, row: 2 } })];
    expect(replayTargetLines(events, heroes, [], positionOf)).toMatchObject([{ kind: LineKind.Tile, to: { col: 4, row: 2 } }]);
  });

  it("shows an enemy's action in red only while that enemy is Visible", () => {
    const events = [event({ kind: EventKind.AttackHit, heroId: "e", targetId: "b" }), event({ kind: EventKind.AttackHit, heroId: "u", targetId: "b" })];
    const lines = replayTargetLines(events, heroes, [visible("e", positions.e!), ghost("u", positions.u!)], positionOf);
    expect(lines).toMatchObject([{ heroId: "e", own: false, tone: LineTone.Red }]);
  });

  it("shows no line to an Unknown enemy", () => {
    const events = [event({ kind: EventKind.AttackFailed, heroId: "b", targetId: "u" })];
    expect(replayTargetLines(events, heroes, [unknown("u")], positionOf)).toEqual([]);
  });

  it("draws nothing for events that are not actions on a target", () => {
    const events = [event({ kind: EventKind.Step, heroId: "b", to: { col: 2, row: 1 } }), event({ kind: EventKind.ShieldGained, heroId: "b", amount: 2 })];
    expect(replayTargetLines(events, heroes, [], positionOf)).toEqual([]);
  });
});

describe("replayTargetLines over a recorded Resolution", () => {
  it("draws a line in its Tick for every resolved attack and Cover event the simulation emits", async () => {
    const host = createLocalHost(7);
    let attackLines = 0;
    for (let round = 0; round < 4; round++) {
      const left = await host.getSquadView(SquadId.Left);
      const right = await host.getSquadView(SquadId.Right);
      if (left.result) break;
      // Both Squads' start tiles, so every Hero has a position; all enemies count as Visible to isolate the event mapping.
      const positions: Record<string, GridPosition> = {};
      for (const h of [...left.heroes, ...right.heroes]) positions[h.id] = h.position;
      const enemies = right.heroes.map((h) => visible(h.id, h.position));
      const ownPlan = await host.getAllyPlan(SquadId.Left, left.heroes.map((h) => h.id));
      const { events } = await host.submitPlan(ownPlan);

      for (const frame of buildPlaybackFrames(events)) {
        Object.assign(positions, frame.moves);
        const lines = replayTargetLines(frame.events, left.heroes, enemies, (id) => positions[id]);
        const drawn = frame.events.filter((e) =>
          [EventKind.AttackHit, EventKind.AttackFailed, EventKind.CoverDestroyed, EventKind.CoverPlaced].includes(e.kind),
        );
        for (const e of drawn) {
          expect(lines.some((l) => l.heroId === e.heroId && l.tick === e.tick)).toBe(true);
        }
        for (const l of lines) expect(l.tick).toBe(frame.tick);
        attackLines += lines.filter((l) => l.kind === LineKind.Attack).length;
      }
    }
    expect(attackLines).toBeGreaterThan(0);
  });
});

describe("crossfireRings", () => {
  const wait: QueuedAction = { kind: ActionKind.Wait };
  const block: QueuedAction = { kind: ActionKind.Block, card: 0 };
  const second = hero("c", HeroClass.Bruiser, { col: 1, row: 3 });
  const squad = [bruiser, second];
  const targets = [visible("e", { col: 3, row: 2 }), visible("f", { col: 5, row: 3 })];
  const plans = (queueB: QueuedAction[], queueC: QueuedAction[]): SquadPlan[] =>
    [{ squad: "a", heroes: [{ heroId: "b", queue: queueB }, { heroId: "c", queue: queueC }] }] as unknown as SquadPlan[];
  const ringsOf = (planList: SquadPlan[], enemies: EnemyView[] = targets) => crossfireRings(plannedTargetLines(grid, squad, enemies, planList), enemies);
  const E = RingSegment.Empty;
  const A = RingSegment.Attack;
  const X = RingSegment.Crossfire;

  it("marks consecutive Ticks of two different Heroes as Crossfire", () => {
    expect(ringsOf(plans([attack("e")], [wait, attack("e")]))).toMatchObject([{ targetId: "e", segments: [X, X, E, E] }]);
  });

  it("marks the same Tick of two different Heroes as Crossfire", () => {
    expect(ringsOf(plans([attack("e")], [attack("e")]))[0]!.segments).toEqual([X, E, E, E]);
  });

  it("does not mark Ticks 1 and 3", () => {
    expect(ringsOf(plans([attack("e")], [wait, wait, attack("e")]))[0]!.segments).toEqual([A, E, A, E]);
  });

  it("does not mark the same Hero attacking in two consecutive Ticks", () => {
    expect(ringsOf(plans([attack("e"), attack("e")], [wait]))[0]!.segments).toEqual([A, A, E, E]);
  });

  it("counts Ticks from the Queue position, whatever is in between", () => {
    expect(ringsOf(plans([attack("e"), block, attack("e")], [wait]))[0]!.segments).toEqual([A, E, A, E]);
  });

  it("gives each target its own ring", () => {
    const rings = ringsOf(plans([attack("e")], [wait, attack("f")]));
    expect(rings.map((ring) => [ring.targetId, ring.segments])).toEqual([["e", [A, E, E, E]], ["f", [E, A, E, E]]]);
  });

  it("shows no ring for a Ghost or an Unknown enemy", () => {
    expect(ringsOf(plans([attack("e")], [attack("u")]), [ghost("e", { col: 3, row: 2 }), unknown("u")])).toEqual([]);
  });
});
