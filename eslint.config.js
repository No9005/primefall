import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Browser-only globals the rules package must never touch (ADR 0017: pure, no browser APIs).
const browserGlobals = ["window", "document", "navigator", "localStorage", "sessionStorage", "indexedDB", "fetch", "requestAnimationFrame", "setTimeout", "setInterval"];

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "docs/**", ".claude/**", ".scratch/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["**/*.{ts,tsx}"], languageOptions: { globals: globals.browser } },
  {
    // Compare against enum members, never string literals (project rule in CLAUDE.md).
    files: ["packages/**/*.ts", "apps/**/*.{ts,tsx}", "tools/**/*.ts"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { "@typescript-eslint/no-unsafe-enum-comparison": "error" },
  },
  {
    // Leftover scratch work in tests is caught by lint, not by the reviewer (CODING_STANDARDS.md).
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-console": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name=/^(describe|it|test)$/][callee.property.name=/^(only|skip)$/]",
          message: "Do not commit .only or .skip tests.",
        },
      ],
    },
  },
  {
    // Readability warnings for product code (CODING_STANDARDS.md, "Readability"). They become errors file by
    // file once the cleanup ticket has removed the existing hits. Tests are excluded.
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "apps/web/e2e/**"],
    rules: {
      "no-nested-ternary": "warn",
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],
      "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],
      "max-statements": ["warn", 30],
    },
  },
  {
    // Files cleaned of readability warnings (#188): the six rules are errors here, with the same thresholds.
    files: ["apps/web/src/effects-layer.ts", "apps/web/src/weapon-effects.ts", "packages/game-core/src/balance.bal.ts"],
    rules: {
      "no-nested-ternary": "error",
      complexity: ["error", 15],
      "max-depth": ["error", 4],
      "max-params": ["error", 5],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
      "max-statements": ["error", 30],
    },
  },
  { files: ["*.js", "**/*.config.ts"], languageOptions: { globals: globals.node } },
  {
    // game-core is deterministic and pure: no browser APIs, no Math.random (use the seeded PRNG).
    files: ["packages/game-core/**/*.ts"],
    languageOptions: { globals: Object.fromEntries(browserGlobals.map((g) => [g, "off"])) },
    rules: {
      "no-restricted-globals": ["error", ...browserGlobals.map((name) => ({ name, message: "game-core must not use browser APIs (ADR 0017)." }))],
      "no-restricted-properties": ["error", { object: "Math", property: "random", message: "Use the seeded PRNG in the Match State (ADR 0017)." }],
    },
  },
  {
    // apps/web may only use the shared and local-host entry points, never the server simulation.
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["game-core/server", "game-core/server/*"], message: "apps/web must not import the server entry point (ADR 0017)." }] }],
    },
  },
  {
    // The screenshot tool runs in Node, never ships to the browser, and builds Match States with the real rules (apps/web/scripts/scenarios.ts).
    files: ["apps/web/scripts/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
);
