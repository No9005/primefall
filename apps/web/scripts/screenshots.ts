// Screenshot tool for agents and reviewers: `npm run screenshots -w apps/web`.
// Starts the Vite dev server, plays the standard path in Chromium at 844 x 390 and writes PNGs with stable names
// to apps/web/screenshots/ (git-ignored), so a run before and after a change can be compared name by name.
import { chromium, type Page } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The standard set, in the order the path plays them. Names are stable on purpose; do not rename without need. */
export const SCREENSHOT_NAMES = [
  "01-planning.png",
  "02-card-armed.png",
  "03-move-queued.png",
  "04-resolution-start.png",
  "05-resolution-mid.png",
  "06-round-2.png",
] as const;

export type ScreenshotName = (typeof SCREENSHOT_NAMES)[number];

export const VIEWPORT = { width: 844, height: 390 };
const PORT = 4174;
const URL = `http://127.0.0.1:${PORT}`;
const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const OUTPUT_DIR = path.join(webRoot, "screenshots");

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The dev server did not answer at ${URL}`);
}

function ensureChromium(): void {
  if (existsSync(chromium.executablePath())) return;
  execFileSync("npx", ["playwright", "install", "chromium"], { cwd: webRoot, stdio: "inherit" });
}

/** Taps points over the board until the armed Move card shows up in the queue (the game decides which tiles are legal). */
async function queueMove(page: Page): Promise<void> {
  const box = (await page.locator(".board canvas").boundingBox())!;
  const queue = page.getByRole("region", { name: "Queue" });
  for (const [x, y] of [[0.6, 0.38], [0.5, 0.5], [0.55, 0.45], [0.45, 0.55], [0.65, 0.33]] as const) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    if ((await queue.getByRole("button", { name: /^Remove action/ }).count()) > 0) return;
  }
  throw new Error("No tapped tile accepted the Move card");
}

async function playStandardPath(page: Page): Promise<void> {
  const shoot = (name: ScreenshotName) => page.screenshot({ path: path.join(OUTPUT_DIR, name) });

  await page.goto(URL);
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByTestId("round").filter({ hasText: "ROUND 1" }).waitFor();
  const hand = page.getByRole("list", { name: "Hand" });
  await hand.getByRole("button").last().waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector(".hand-bar button:disabled"), undefined, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500); // the first software-rendered frames
  await shoot("01-planning.png");

  await hand.getByRole("button").last().click();
  await page.getByRole("group", { name: "Use card as" }).getByRole("button", { name: /^Move/ }).click();
  await page.getByTestId("floating-card").waitFor();
  await page.waitForTimeout(800); // the camera eases onto the Hero
  await shoot("02-card-armed.png");

  await queueMove(page);
  await page.waitForTimeout(500);
  await shoot("03-move-queued.png");

  await page.getByRole("button", { name: "Commit" }).click();
  await page.locator(".callout-word", { hasText: "RESOLUTION" }).waitFor();
  await shoot("04-resolution-start.png");
  await page.getByTestId("resolution-bar").waitFor();
  await page.waitForTimeout(3000);
  await shoot("05-resolution-mid.png");

  await page.getByTestId("round").filter({ hasText: "ROUND 2" }).waitFor({ timeout: 40_000 });
  await page.waitForTimeout(1500);
  await shoot("06-round-2.png");
}

async function main(): Promise<void> {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  ensureChromium();

  const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { cwd: webRoot, stdio: "ignore" });
  try {
    await waitForServer();
    const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--no-sandbox", "--enable-unsafe-swiftshader"] });
    try {
      const page = await browser.newPage({ viewport: VIEWPORT });
      await playStandardPath(page);
    } finally {
      await browser.close();
    }
    console.log(`Screenshots written to ${OUTPUT_DIR}:\n${SCREENSHOT_NAMES.join("\n")}`);
  } finally {
    server.kill();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
