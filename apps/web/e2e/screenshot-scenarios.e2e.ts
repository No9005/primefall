import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "../scripts/screenshots";
import { SCENARIO_SCREENSHOT_NAMES } from "../scripts/scenarios";

// The screenshot tool starts its own dev server and browser. It exits non-zero on a page error, a control it cannot
// find or a missing PNG. CI runs one scenario to keep the pull request job short; `npm run test:e2e` locally runs all.
const scenarios = process.env.CI ? ["shockwave-overdrive"] : Object.keys(SCENARIO_SCREENSHOT_NAMES);

test("the screenshot scenarios run without page errors and write every listed PNG", async () => {
  test.setTimeout(scenarios.length * 180_000);
  for (const name of scenarios) {
    execFileSync("npx", ["vite-node", "scripts/screenshots.ts", "--scenario", name], { cwd: path.join(import.meta.dirname, ".."), stdio: "pipe" });
    for (const file of SCENARIO_SCREENSHOT_NAMES[name]!) {
      const png = path.join(OUTPUT_DIR, name, file);
      expect(existsSync(png), `${name}/${file} exists`).toBe(true);
      expect(statSync(png).size, `${name}/${file} is not empty`).toBeGreaterThan(0);
    }
  }
});
