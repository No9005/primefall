import { defineConfig } from "vitest/config";

// A match with the AI takes seconds on the 45 by 25 map (several tests play whole matches), so the default 5 s per test is
// too short on a loaded machine: a recorded seed or the lookahead test then fails on time, not on what it checks.
export default defineConfig({
  test: {
    testTimeout: 30_000,
  },
});
