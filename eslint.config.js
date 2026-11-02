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
);
