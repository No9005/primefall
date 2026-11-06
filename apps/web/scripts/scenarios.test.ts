import { coverAt, CoverKind, EventKind, HeroClass, SquadId, validatePlan, Visibility } from "game-core";
import { restoreLocalHost, SNAPSHOT_VERSION } from "game-core/local-host";
import { buildSquadView, canSquadSeeHero, type MatchState } from "game-core/server";
import { describe, expect, it } from "vitest";
import { parseArgs } from "./screenshots";
import { preparedPlan, SCENARIO_NAMES, SCENARIOS, type Scenario, scenarioRounds, scenarioScreenshotNames } from "./scenarios";

describe("screenshot scenarios", () => {
  it("have unique kebab-case names", () => {
    expect(new Set(SCENARIO_NAMES).size).toBe(SCENARIOS.length);
    for (const name of SCENARIO_NAMES) expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("name a non-empty, unique list of PNGs each", () => {
    for (const scenario of SCENARIOS) {
      const names = scenarioScreenshotNames(scenario);
      expect(names.length).toBeGreaterThan(2);
      expect(new Set(names).size).toBe(names.length);
      expect(names[0]).toBe("01-planned.png");
      expect(names.at(-1)).toMatch(/^\d\d-after\.png$/);
      for (const name of names.slice(1, -1)) expect(name).toMatch(/^\d\d-(round\d-)?(planned|resolution-t\d+)\.png$/);
    }
  });

  describe.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))("%s", (_name, scenario) => {
    it("builds a Match State the local host resumes, with a plan that passes validatePlan", async () => {
      const match = scenario.buildMatch();
      const host = restoreLocalHost(JSON.stringify({ version: SNAPSHOT_VERSION, match }));
      expect(host).toBeDefined();
      const view = await host!.getSquadView(SquadId.Left);
      expect(validatePlan(view, preparedPlan(scenario, match))).toEqual([]);
    });

    it("has a Round 2 plan that passes validatePlan against the Squad View of Round 2", async () => {
      if (!scenario.secondRound) return;
      const match = scenario.buildMatch();
      const host = restoreLocalHost(JSON.stringify({ version: SNAPSHOT_VERSION, match }))!;
      await host.submitPlan(preparedPlan(scenario, match));
      const next = (JSON.parse(host.snapshot()) as { match: MatchState }).match;
      expect(next.round).toBe(2);
      const view = await host.getSquadView(SquadId.Left);
      expect(validatePlan(view, preparedPlan(scenario, next, scenario.secondRound.steps))).toEqual([]);
    });

    it("is deterministic", () => {
      expect(scenario.buildMatch()).toEqual(scenario.buildMatch());
    });
  });
});

describe("memory scenarios stage what their names say", () => {
  const scenario = (name: string) => SCENARIOS.find((candidate) => candidate.name === name)!;
  /** Plays the scenario's Rounds through the local host; returns the Match State at the start of each following Round. */
  async function playRounds(name: string): Promise<MatchState[]> {
    const staged = scenario(name);
    const match = staged.buildMatch();
    const host = restoreLocalHost(JSON.stringify({ version: SNAPSHOT_VERSION, match }))!;
    const states: MatchState[] = [match];
    for (const round of scenarioRounds(staged)) {
      const current = states.at(-1)!;
      await host.submitPlan(preparedPlan(staged, current, round.steps));
      states.push((JSON.parse(host.snapshot()) as { match: MatchState }).match);
    }
    return states;
  }

  it("cover-placed-expires: the Half Cover stands after Resolution 1 and is gone after Resolution 2", async () => {
    const [start, afterOne, afterTwo] = await playRounds("cover-placed-expires");
    expect(coverAt(start!.grid, { col: 10, row: 3 })).toBe(CoverKind.Half);
    expect(coverAt(afterOne!.grid, { col: 10, row: 3 })).toBe(CoverKind.Half);
    expect(coverAt(afterTwo!.grid, { col: 10, row: 3 })).toBe(CoverKind.None);
  });

  it("cover-destroyed: Breach Charge destroys the Half Cover", async () => {
    const [start, after] = await playRounds("cover-destroyed");
    expect(coverAt(start!.grid, { col: 8, row: 2 })).toBe(CoverKind.Half);
    expect(coverAt(after!.grid, { col: 8, row: 2 })).toBe(CoverKind.None);
  });

  it("scout-drone-area-over-time: the area lasts two Resolutions and shows the enemy behind the wall", async () => {
    const [start, afterOne, afterTwo] = await playRounds("scout-drone-area-over-time");
    expect(start!.revealedAreas).toHaveLength(1);
    expect(afterOne!.revealedAreas).toHaveLength(1);
    expect(afterTwo!.revealedAreas).toHaveLength(0);
    expect(canSquadSeeHero(start!, SquadId.Left, start!.heroes.find((hero) => hero.id === "right-assassin")!)).toBe(true);
    expect(start!.ghosts[SquadId.Left]["right-assassin"]?.position).toEqual({ col: 12, row: 7 });
  });

  it("ghost-enemy: starts as a Ghost and is seen again after the Move", async () => {
    const [start, after] = await playRounds("ghost-enemy");
    const enemyAt = (state: MatchState) => buildSquadView(state, SquadId.Left).enemies.find((candidate) => candidate.id === "right-assassin")!;
    expect(enemyAt(start!).visibility).toBe(Visibility.Ghost);
    expect(enemyAt(after!).visibility).toBe(Visibility.Visible);
  });
});

describe("Assassin scenarios stage what their names say", () => {
  /** Plays Round 1 of the scenario through the local host and returns the events of the player's Assassin. */
  async function assassinEvents(name: string) {
    const staged = SCENARIOS.find((candidate) => candidate.name === name)!;
    const match = staged.buildMatch();
    const host = restoreLocalHost(JSON.stringify({ version: SNAPSHOT_VERSION, match }))!;
    const { events } = await host.submitPlan(preparedPlan(staged, match));
    return events.filter((event) => event.heroId === staged.heroId);
  }
  const hit = (damage: number) => expect.objectContaining({ kind: "attackHit", damage });

  it.each([
    ["precision-shot", 2],
    ["cover-breaker", 2],
    ["assassin-shield-breaker", 2],
    ["long-shot", 2],
    ["long-shot-overdrive", 4],
    ["ghost-shot", 2],
    ["ghost-shot-overdrive", 2],
    ["execution-round", 3],
  ])("%s hits for %i", async (name, damage) => {
    expect(await assassinEvents(name)).toEqual([hit(damage)]);
  });

  it("ghost-shot-overdrive-miss finds nobody on the remembered tile", async () => {
    expect(await assassinEvents("ghost-shot-overdrive-miss")).toEqual([expect.objectContaining({ kind: "attackFailed", reason: "emptyTile" })]);
  });

  it("vanish ends the Resolution Hidden", async () => {
    expect((await assassinEvents("vanish")).map((event) => event.kind)).toEqual(["step", "step", "hiddenGained"]);
  });

  it("mark-target marks, and in Overdrive also hits for 1", async () => {
    expect((await assassinEvents("mark-target")).map((event) => event.kind)).toEqual(["markedApplied"]);
    expect((await assassinEvents("mark-target-overdrive")).map((event) => event.kind)).toEqual(["markedApplied", "attackHit"]);
  });

  it("reposition moves three tiles with one Move", async () => {
    expect((await assassinEvents("reposition")).filter((event) => event.kind === EventKind.Step)).toHaveLength(3);
  });
});

describe("a scenario with another Player Hero", () => {
  it("can be staged: the Controller's Wait plan passes validatePlan", async () => {
    const base = SCENARIOS[0]!;
    const scenario: Scenario = { ...base, playerHero: HeroClass.Controller, heroId: `${SquadId.Left}-controller`, steps: [{ wait: true }] };
    const match = scenario.buildMatch();
    const host = restoreLocalHost(JSON.stringify({ version: SNAPSHOT_VERSION, match }))!;
    const view = await host.getSquadView(SquadId.Left);
    expect(validatePlan(view, preparedPlan(scenario, match))).toEqual([]);
  });
});

describe("screenshot tool arguments", () => {
  it("plays the standard path with a Player Hero", () => {
    expect(parseArgs(["--hero", "assassin"])).toEqual({ list: false, scenarios: [], hero: HeroClass.Assassin });
    expect(parseArgs(["--hero", "wizard"]).error).toBeDefined();
  });

  it("plays the standard path without arguments", () => {
    expect(parseArgs([])).toEqual({ list: false, scenarios: [] });
  });

  it("reads --list, one scenario and all", () => {
    expect(parseArgs(["--list"]).list).toBe(true);
    expect(parseArgs(["--scenario", "exhaustion"]).scenarios).toEqual(["exhaustion"]);
    expect(parseArgs(["--scenario", "all"]).scenarios).toEqual(SCENARIO_NAMES);
  });

  it("reports an unknown or missing scenario name", () => {
    expect(parseArgs(["--scenario", "nope"]).error).toContain("nope");
    expect(parseArgs(["--scenario"]).error).toBeDefined();
  });
});

describe("crossfire scenario stages what its name says", () => {
  it("two different enemies hit the Bruiser and a hit carries Crossfire", async () => {
    const staged = SCENARIOS.find((candidate) => candidate.name === "crossfire")!;
    const match = staged.buildMatch();
    const host = restoreLocalHost(JSON.stringify({ version: SNAPSHOT_VERSION, match }))!;
    const { events } = await host.submitPlan(preparedPlan(staged, match));
    const hits = events.filter((event) => event.kind === EventKind.AttackHit && event.targetId === staged.heroId);
    expect(new Set(hits.map((hit) => hit.heroId)).size).toBeGreaterThan(1);
    expect(hits.some((hit) => (hit.crossfire ?? 0) > 0)).toBe(true);
  });
});
