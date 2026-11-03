import { defineConfig } from "@playwright/test";

// CI uses the Chrome already installed on GitHub's ubuntu-latest; set E2E_CHROMIUM=1 to use Playwright's own Chromium.
const channel = process.env.E2E_CHROMIUM ? undefined : "chrome";
const port = 4173;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  outputDir: "e2e-results",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel,
    viewport: { width: 844, height: 390 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  // Serves the already built app (`npm run build` first; the root `test:e2e` script does both).
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
