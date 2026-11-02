import { defineConfig } from "vitest/config";

// Only the balance simulation; the default config (`npm test`) never picks up `*.sim.ts`.
export default defineConfig({ test: { include: ["src/**/*.sim.ts"], testTimeout: 600_000 } });
