// Screenshot tool for agents and reviewers: `npm run screenshots -w apps/web`.
// Starts the Vite dev server, plays the standard path in Chromium at 844 x 390 and writes PNGs with stable names
// to apps/web/screenshots/ (git-ignored), so a run before and after a change can be compared name by name.
import { chromium, type Browser, type Page } from "@playwright/test";
import { type CardDefinition, CardTarget, coverAt, CoverKind, findTiles, type GridPosition, HERO_DECKS, HeroClass, moveDestinations, reachableMoveDestinations, REACTOR_DECK, TileKind, Visibility } from "game-core";
import { SNAPSHOT_VERSION } from "game-core/local-host";
import { buildSquadView, type MatchState } from "game-core/server";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frameMoveCamera, frameSquadCamera, gridToWorld } from "../src/board-layout";
import { freeBoardArea } from "../src/hud-layout";
import { type PlanStep, SCENARIO_NAMES, SCENARIO_SCREENSHOT_NAMES, SCENARIOS, type Scenario, scenarioRounds, scenarioScreenshotNames, type StepUse } from "./scenarios";

/** The standard set, in the order the path plays them. Names are stable on purpose; do not rename without need. */
export const SCREENSHOT_NAMES = [
  "01-planning.png",
  "02-card-armed.png",
  "03-move-queued.png",
  "04-resolution-start.png",
  "05-resolution-mid.png",
  "06-round-2.png",
  "07-card-pressed.png",
  "08-card-pulled.png",
  "09-card-parked.png",
  "10-card-back-in-hand.png",
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

/**
 * The Chromium to launch. Playwright's own build when it is installed; otherwise one that is already on the machine:
 * `CHROMIUM_PATH`, or the `chromium` link a sandbox keeps in `PLAYWRIGHT_BROWSERS_PATH` (its build can be a different
 * version than the one this Playwright expects, which works for screenshots). Only when none exists is one downloaded.
 */
export function findChromium(env: NodeJS.ProcessEnv = process.env, exists: (file: string) => boolean = existsSync): string | undefined {
  const candidates = [chromium.executablePath(), env.CHROMIUM_PATH, env.PLAYWRIGHT_BROWSERS_PATH && path.join(env.PLAYWRIGHT_BROWSERS_PATH, "chromium")];
  return candidates.find((file): file is string => typeof file === "string" && file !== "" && exists(file));
}

function ensureChromium(): string | undefined {
  const found = findChromium();
  if (found) return found;
  execFileSync("npx", ["playwright", "install", "chromium"], { cwd: webRoot, stdio: "inherit" });
  return undefined;
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

async function playStandardPath(page: Page, hero?: HeroClass): Promise<void> {
  const shoot = (name: ScreenshotName) => page.screenshot({ path: path.join(OUTPUT_DIR, name) });

  await page.goto(hero ? `${URL}/?hero=${hero}` : URL);
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
  // The big callout is gone within a second; the bar stays for the playback.
  await page.getByTestId("resolution-bar").waitFor();
  await shoot("04-resolution-start.png");
  await page.waitForTimeout(3000);
  await shoot("05-resolution-mid.png");

  await page.getByTestId("round").filter({ hasText: "ROUND 2" }).waitFor({ timeout: 40_000 });
  await page.waitForTimeout(1500);
  await shoot("06-round-2.png");

  // The card pull with a real pointer: press, drag up (the faces fade in), release in the middle (parked), then a low release.
  const fan = (await hand.boundingBox())!;
  const grab = { x: fan.x + fan.width * 0.08, y: fan.y + 30 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await shoot("07-card-pressed.png");
  await page.mouse.move(grab.x + 60, grab.y - 40, { steps: 4 });
  await page.mouse.move(grab.x + 140, grab.y - 100, { steps: 4 });
  await page.waitForTimeout(300);
  await shoot("08-card-pulled.png");
  await page.mouse.move(400, 215, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await shoot("09-card-parked.png");
  await page.mouse.click(700, 60); // outside the faces: the card goes back
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(200, 330, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await shoot("10-card-back-in-hand.png");
}

const STORAGE_KEY = "primefall.match"; // apps/web/src/match-storage.ts
const PLAYER_HERO_STORAGE_KEY = "primefall.playerHero"; // the same
const SCENARIO_ACTION_TIMEOUT_MS = 10_000;
const USE_FACE_NAMES: Record<StepUse, RegExp | string> = {
  primary: "Primary",
  overdrive: "Overdrive",
  pitch: /^Pitch/,
  move: /^Move/,
  block: /^Block/,
};

/** Taps the card of a Hand slot and picks the role in the "Use card as" group. */
async function useCardAs(page: Page, slot: number, use: StepUse): Promise<void> {
  await page.getByRole("list", { name: "Hand" }).getByRole("button").nth(slot).click();
  const face = page.getByRole("group", { name: "Use card as" }).getByRole("button", { name: USE_FACE_NAMES[use] });
  await face.waitFor();
  await page.waitForTimeout(600); // the faces fade in
  await face.click();
}

/**
 * Queues a Move to a tile with one tap. The camera is the one the app eases to when a Move is armed (the Hero and its
 * lit tiles framed in the free part of the view), computed with the app's own layout functions, so the tap lands on
 * the tile centre. The queue row names the tile it got: another tile fails the step.
 */
async function queueMoveTo(page: Page, slot: number, from: GridPosition, to: GridPosition): Promise<void> {
  const box = (await page.locator(".board canvas").boundingBox())!;
  const view = { width: box.width, height: box.height };
  await useCardAs(page, slot, "move");
  await page.getByTestId("floating-card").waitFor();
  await page.waitForTimeout(800); // the camera eases onto the Hero
  const camera = frameMoveCamera(from, reachableMoveDestinations(from), view, freeBoardArea(view, { kind: "picking" }));
  const world = gridToWorld(to);
  await page.mouse.click(box.x + camera.x + world.x * camera.scale, box.y + camera.y + world.y * camera.scale);
  const queue = page.getByRole("region", { name: "Queue" });
  await queue.getByText(`to ${to.col} · ${to.row}`).waitFor();
}

/** The Cards of the Hero's Deck, for the Range of a card that is aimed at a tile. */
function cardOf(match: MatchState, heroId: string, slot: number): CardDefinition {
  const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
  return HERO_DECKS[hero.heroClass][hero.hand[slot]!]!;
}

/**
 * Aims a card at a tile with one tap, like `queueMoveTo`: the tiles the card can be aimed at frame the camera (the
 * same list PlanningScreen builds: every non-Wall tile within Range, for Deploy Cover only empty ones).
 */
async function aimCardAt(page: Page, match: MatchState, heroId: string, step: { slot: number; use: StepUse; tile: GridPosition }): Promise<void> {
  const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
  const card = cardOf(match, heroId, step.slot);
  const view = buildSquadView(match, hero.squad);
  const occupied = [...view.heroes, ...view.enemies.filter((enemy) => enemy.visibility === Visibility.Visible)].map((unit) => unit.position);
  const lit = moveDestinations(hero.position, REACTOR_DECK, card.range ?? Math.max(REACTOR_DECK.width, REACTOR_DECK.height)).filter(
    (tile) =>
      card.target !== CardTarget.EmptyTile ||
      (coverAt(match.grid, tile) === CoverKind.None &&
        !view.placedCover.some((cover) => cover.col === tile.col && cover.row === tile.row) &&
        !occupied.some((position) => position.col === tile.col && position.row === tile.row)),
  );
  const box = (await page.locator(".board canvas").boundingBox())!;
  const size = { width: box.width, height: box.height };
  await useCardAs(page, step.slot, step.use);
  await page.getByTestId("floating-card").waitFor();
  await page.waitForTimeout(800); // the camera eases onto the Hero
  const camera = frameMoveCamera(hero.position, lit, size, freeBoardArea(size, { kind: "picking" }));
  const world = gridToWorld(step.tile);
  await page.mouse.click(box.x + camera.x + world.x * camera.scale, box.y + camera.y + world.y * camera.scale);
  await page.getByRole("region", { name: "Queue" }).getByText(`to ${step.tile.col} · ${step.tile.row}`).waitFor();
}

/**
 * Aims a card at a Hero with one tap (Forward Deploy then taps a tile for the ally to move to). Picking a Hero does not
 * move the camera, so it is still the start framing the board computes: the own Squad and the Prime Zone.
 */
async function aimCardAtHero(page: Page, match: MatchState, heroId: string, step: { slot: number; use: StepUse; target: string; tile?: GridPosition }): Promise<void> {
  const squad = match.heroes.find((candidate) => candidate.id === heroId)!.squad;
  const target = match.heroes.find((candidate) => candidate.id === step.target)!;
  const box = (await page.locator(".board canvas").boundingBox())!;
  const size = { width: box.width, height: box.height };
  const tiles = findTiles(REACTOR_DECK, TileKind.PrimeZone);
  const zone = { col: tiles.reduce((sum, tile) => sum + tile.col, 0) / tiles.length, row: tiles.reduce((sum, tile) => sum + tile.row, 0) / tiles.length };
  const own = match.heroes.filter((hero) => hero.squad === squad).map((hero) => hero.position);
  const queue = page.getByRole("region", { name: "Queue" });
  const queued = await queue.getByRole("button", { name: /^Remove action/ }).count();
  await useCardAs(page, step.slot, step.use);
  await page.getByTestId("floating-card").waitFor();
  await page.waitForTimeout(800);
  const camera = frameSquadCamera(own, zone, size, freeBoardArea(size, { kind: "idle" }));
  const world = gridToWorld(target.position);
  await page.mouse.click(box.x + camera.x + world.x * camera.scale, box.y + camera.y + world.y * camera.scale);
  if (step.tile) {
    await page.waitForTimeout(800); // the camera eases onto the ally and its Move tiles
    const framed = frameMoveCamera(target.position, moveDestinations(target.position), size, freeBoardArea(size, { kind: "picking" }));
    const tileWorld = gridToWorld(step.tile);
    await page.mouse.click(box.x + framed.x + tileWorld.x * framed.scale, box.y + framed.y + tileWorld.y * framed.scale);
  }
  await page.waitForFunction(
    (count) => document.querySelectorAll('[aria-label="Queue"] button[aria-label^="Remove action"]').length > count,
    queued,
  );
}

async function driveStep(page: Page, match: MatchState, heroId: string, step: PlanStep): Promise<void> {
  if ("wait" in step) {
    await page.locator(".wait-card").click();
    return;
  }
  const from = match.heroes.find((hero) => hero.id === heroId)!.position;
  if (step.use === "move") {
    if (!step.tile) throw new Error("A Move step needs a tile");
    await queueMoveTo(page, step.slot, from, step.tile);
  } else if (step.target) {
    await aimCardAtHero(page, match, heroId, { ...step, target: step.target });
  } else if (step.tile) {
    await aimCardAt(page, match, heroId, { ...step, tile: step.tile });
  } else {
    await useCardAs(page, step.slot, step.use);
  }
  await page.getByRole("list", { name: "Hand" }).getByRole("button").first().waitFor({ state: "visible" });
  await page.waitForTimeout(500);
}

/** Every frame is checked after the run: a missing or empty PNG fails the scenario. */
function checkWritten(directory: string, names: readonly string[]): void {
  for (const name of names) {
    const file = path.join(directory, name);
    if (!existsSync(file) || statSync(file).size === 0) throw new Error(`Missing or empty screenshot: ${file}`);
  }
}

async function playScenario(browser: Browser, scenario: Scenario): Promise<void> {
  const directory = path.join(OUTPUT_DIR, scenario.name);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const names = scenarioScreenshotNames(scenario);
  const shoot = (name: string) => page.screenshot({ path: path.join(directory, name) });

  const match = scenario.buildMatch();
  const snapshot = JSON.stringify({ version: SNAPSHOT_VERSION, match });
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.setDefaultTimeout(SCENARIO_ACTION_TIMEOUT_MS);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    // The page has no favicon; the browser asks for it anyway.
    if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) errors.push(`console error: ${message.text()} (${message.location().url})`);
  });
  await page.addInitScript(
    ([key, value, heroKey, hero]) => {
      localStorage.setItem(key!, value!);
      localStorage.setItem(heroKey!, hero!);
    },
    [STORAGE_KEY, snapshot, PLAYER_HERO_STORAGE_KEY, scenario.playerHero ?? HeroClass.Bruiser],
  );
  try {
    await page.goto(URL);
    await page.getByTestId("resume").click();
    await page.getByTestId("round").filter({ hasText: "ROUND 1" }).waitFor();
    const hand = page.getByRole("list", { name: "Hand" });
    await hand.getByRole("button").last().waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.querySelector(".hand-bar button:disabled"), undefined, { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500); // the first software-rendered frames

    let frame = 0;
    for (const [index, round] of scenarioRounds(scenario).entries()) {
      if (index > 0) {
        await page.getByTestId("round").filter({ hasText: `ROUND ${index + 1}` }).waitFor({ timeout: 40_000 });
        await page.waitForTimeout(1500);
      }
      for (const step of round.steps) await driveStep(page, match, scenario.heroId, step);
      await page.waitForTimeout(500);
      await shoot(names[frame++]!);

      await page.getByRole("button", { name: "Commit" }).click();
      await page.getByTestId("resolution-bar").waitFor();
      const started = Date.now();
      for (const ms of round.resolutionShotsMs) {
        await page.waitForTimeout(Math.max(0, ms - (Date.now() - started)));
        await shoot(names[frame++]!);
      }
    }
    await page.getByTestId("round").filter({ hasText: `ROUND ${scenarioRounds(scenario).length + 1}` }).waitFor({ timeout: 40_000 });
    await page.waitForTimeout(1500);
    await shoot(names[frame]!);
  } catch (error) {
    await page.screenshot({ path: path.join(directory, "failed.png") }).catch(() => {}); // what the page showed when the step failed
    throw error;
  } finally {
    await page.close();
  }
  if (errors.length > 0) throw new Error(`${scenario.name}: ${errors.join("; ")}`);
  checkWritten(directory, names);
}

export interface CliOptions {
  list: boolean;
  /** Scenario names to play; empty for the standard path. */
  scenarios: string[];
  /** Set when the arguments name a scenario that does not exist or are malformed. */
  error?: string;
  /** The Player Hero of the standard path (`--hero controller`); the Bruiser when absent. */
  hero?: HeroClass;
}

/** Reads `--list`, `--scenario <name>`, `--scenario all` and `--hero <class>`. No arguments: the standard path. */
export function parseArgs(args: readonly string[]): CliOptions {
  if (args.includes("--list")) return { list: true, scenarios: [] };
  const heroAt = args.indexOf("--hero");
  if (heroAt >= 0) {
    const hero = Object.values(HeroClass).find((heroClass) => heroClass === args[heroAt + 1]);
    if (!hero) return { list: false, scenarios: [], error: `--hero needs one of ${Object.values(HeroClass).join(", ")}` };
    return { list: false, scenarios: [], hero };
  }
  const at = args.indexOf("--scenario");
  if (at < 0) return { list: false, scenarios: [] };
  const name = args[at + 1];
  if (name === undefined || name.startsWith("--")) return { list: false, scenarios: [], error: "--scenario needs a name" };
  if (name === "all") return { list: false, scenarios: [...SCENARIO_NAMES] };
  if (!SCENARIO_NAMES.includes(name)) return { list: false, scenarios: [], error: `Unknown scenario "${name}"` };
  return { list: false, scenarios: [name] };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.list || options.error) {
    if (options.error) console.error(`${options.error}. Valid names: all, ${SCENARIO_NAMES.join(", ")}`);
    else for (const scenario of SCENARIOS) console.log(`${scenario.name}\t${scenario.description}`);
    process.exitCode = options.error ? 1 : 0;
    return;
  }
  if (options.scenarios.length === 0) rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const executablePath = ensureChromium();

  const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { cwd: webRoot, stdio: "ignore" });
  try {
    await waitForServer();
    const browser = await chromium.launch({ executablePath, args: ["--use-gl=swiftshader", "--no-sandbox", "--enable-unsafe-swiftshader"] });
    try {
      if (options.scenarios.length === 0) {
        const page = await browser.newPage({ viewport: VIEWPORT });
        await playStandardPath(page, options.hero);
      }
      for (const name of options.scenarios) {
        await playScenario(browser, SCENARIOS.find((scenario) => scenario.name === name)!);
        console.log(`Scenario ${name}: ${path.join(OUTPUT_DIR, name)}\n${SCENARIO_SCREENSHOT_NAMES[name]!.join("\n")}`);
      }
    } finally {
      await browser.close();
    }
    if (options.scenarios.length === 0) console.log(`Screenshots written to ${OUTPUT_DIR}:\n${SCREENSHOT_NAMES.join("\n")}`);
  } finally {
    server.kill();
  }
}

// vite-node (the `screenshots` script) does not put the script path into argv, so tests that import this module are told apart by vitest.
if (!process.env.VITEST) {
  main().then(
    () => process.exit(process.exitCode ?? 0),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
