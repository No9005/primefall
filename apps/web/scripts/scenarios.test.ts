import { SquadId, validatePlan } from "game-core";
import { restoreLocalHost, SNAPSHOT_VERSION } from "game-core/local-host";
import { describe, expect, it } from "vitest";
import { parseArgs } from "./screenshots";
import { preparedPlan, SCENARIO_NAMES, SCENARIOS, scenarioScreenshotNames } from "./scenarios";

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
      for (const name of names.slice(1, -1)) expect(name).toMatch(/^\d\d-resolution-t\d+\.png$/);
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

    it("is deterministic", () => {
      expect(scenario.buildMatch()).toEqual(scenario.buildMatch());
    });
  });
});

describe("screenshot tool arguments", () => {
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
