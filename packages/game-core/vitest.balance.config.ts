import { defineConfig } from "vitest/config";

// Only the balance harness (`npm run balance`); neither `npm test` nor `npm run sim` picks up `*.bal.ts`.
export default defineConfig({ test: { include: ["src/**/*.bal.ts"], testTimeout: 1_800_000 } });
