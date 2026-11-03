import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const READABILITY_RULES = ["no-nested-ternary", "complexity", "max-depth", "max-params", "max-lines-per-function", "max-statements"];

const rootDirectory = new URL("../../../", import.meta.url).pathname;

async function severityOf(file: string, rule: string): Promise<unknown> {
  const config = await new ESLint({ cwd: rootDirectory }).calculateConfigForFile(`${rootDirectory}${file}`);
  const setting = config?.rules?.[rule];
  return Array.isArray(setting) ? setting[0] : setting;
}

describe("readability lint rules", () => {
  it.each(READABILITY_RULES)("%s is a warning for product code", async (rule) => {
    for (const file of ["packages/game-core/src/plan.ts", "apps/web/src/main.tsx"]) {
      expect([file, await severityOf(file, rule)]).toEqual([file, 1]);
    }
  });

  it.each(READABILITY_RULES)("%s is off for test files", async (rule) => {
    for (const file of ["packages/game-core/src/plan.test.ts", "apps/web/e2e/smoke.test.ts", "apps/web/src/App.test.tsx"]) {
      const severity = await severityOf(file, rule);
      expect([file, severity === undefined || severity === 0]).toEqual([file, true]);
    }
  });
});
