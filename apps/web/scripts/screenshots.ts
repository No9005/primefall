// Screenshot tool for agents and reviewers: `npm run screenshots -w apps/web`.
// Starts the Vite dev server, plays the standard path in Chromium at 844 x 390 and writes PNGs with stable names
// to apps/web/screenshots/ (git-ignored), so a run before and after a change can be compared name by name.
import { chromium, type Browser, type Page } from "@playwright/test";
import { type CardDefinition, CardTarget, coverAt, CoverKind, findTiles, type GridPosition, HERO_DECKS, HeroClass, MatchEndReason, MatchMode, moveDestinations, SquadId, reachableMoveDestinations, REACTOR_DECK, TileKind, Visibility } from "game-core";
import { SNAPSHOT_VERSION } from "game-core/local-host";
import { buildSquadView, createMatch, type MatchState, startRound } from "game-core/server";
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

/** On the Hero Select: taps a Hero and Start. */
async function chooseHeroAndStart(page: Page, hero: HeroClass): Promise<void> {
  await page.getByTestId(`hero-${hero}`).click();
  await page.getByRole("button", { name: "START" }).click();
}

/** Screens that are not a match scenario, played by clicking through the app. Their frames are in the order they are taken. */
export const SCREEN_SCENARIOS: Record<string, { description: string; shots: readonly string[] }> = {
  "hero-select": {
    description: "The Hero Select: nothing selected, each Hero ready (Bruiser mid-shots, Controller with the drone out, Assassin Hidden), the card list",
    shots: ["01-idle.png", "02-bruiser-ready.png", "03-controller-ready.png", "04-assassin-ready.png", "05-cards.png"],
  },
  options: {
    description: "The start screen with the Options button, the Options screen (Pixel art chosen, then Original)",
    shots: ["01-start.png", "02-pixel.png", "03-original.png"],
  },
  glossary: {
    description: "The Glossary from the start screen: the Heroes group (two frames), the Numbers, Board and HUD groups, scrolled",
    shots: ["01-heroes.png", "05-heroes-more.png", "06-heroes-end.png", "07-heroes-last.png", "02-numbers.png", "08-numbers-more.png", "03-board.png", "09-board-more.png", "10-board-end.png", "04-hud.png", "11-hud-more.png"],
  },
  "attack-defend": {
    description: "Attack and Defend: the start screen, the side screen (both roles), the role banner and the planning HUD of both roles, the Resolution bar, the four end screens",
    shots: [
      "01-start.png",
      "02-side-attack.png",
      "03-side-defend.png",
      "04-role-banner-attack.png",
      "05-role-banner-defend.png",
      "06-hud-attacker.png",
      "07-hud-defender.png",
      "08-hud-resolution.png",
      "09-end-attacker-victory.png",
      "10-end-defender-victory.png",
      "11-end-attacker-defeat.png",
      "12-end-defender-defeat.png",
    ],
  },
};

/** The start screen and the Options screen with each choice. */
async function playOptions(browser: Browser): Promise<void> {
  const directory = path.join(OUTPUT_DIR, "options");
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(URL);
  await page.getByTestId("start-screen").waitFor();
  await page.screenshot({ path: path.join(directory, "01-start.png") });
  await page.getByTestId("options-button").click();
  await page.getByTestId("options").waitFor();
  await page.screenshot({ path: path.join(directory, "02-pixel.png") });
  await page.getByTestId("style-original").click();
  await page.screenshot({ path: path.join(directory, "03-original.png") });
  await page.getByTestId("options-back").click();
  await page.getByTestId("start-screen").waitFor();
  if (errors.length > 0) throw new Error(`options: ${errors.join("; ")}`);
  checkWritten(directory, SCREEN_SCENARIOS.options!.shots);
}

const MORE_FRAMES: Record<string, readonly string[]> = {
  Heroes: ["05-heroes-more.png", "06-heroes-end.png", "07-heroes-last.png"],
  Numbers: ["08-numbers-more.png"],
  Board: ["09-board-more.png", "10-board-end.png"],
  HUD: ["11-hud-more.png"],
};

/** The Glossary opened from the start screen: one frame per group, the screen scrolled to the top of the group. */
async function playGlossary(browser: Browser): Promise<void> {
  const directory = path.join(OUTPUT_DIR, "glossary");
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(URL);
  await page.getByTestId("glossary-button").click();
  // The pictures are rendered in one go; they are all there when the last image has loaded.
  await page.locator(".glossary-picture img").last().waitFor();
  await page.waitForTimeout(500);
  const groups = ["Heroes", "Numbers", "Board", "HUD"];
  for (const [index, group] of groups.entries()) {
    await page.getByTestId(`glossary-group-${group}`).evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(directory, `0${index + 1}-${group.toLowerCase()}.png`) });
    // The Heroes and Board groups are long: further frames down, the rest of the group.
    const more = MORE_FRAMES[group] ?? [];
    for (const shot of more) {
      await page.getByTestId("glossary-body").evaluate((element) => element.scrollBy(0, 340));
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(directory, shot) });
    }
  }
  await page.getByTestId("glossary-back").click();
  await page.getByTestId("start-screen").waitFor();
  if (errors.length > 0) throw new Error(`glossary: ${errors.join("; ")}`);
  checkWritten(directory, SCREEN_SCENARIOS.glossary!.shots);
}

/** The four end screens: the match is built in Node, finished by an edit of its result, and resumed in the browser. */
const END_SCREENS = [
  { shot: "09-end-attacker-victory.png", defender: SquadId.Right, winner: SquadId.Left, reason: MatchEndReason.PrimeZoneHeld, round: 7 },
  { shot: "10-end-defender-victory.png", defender: SquadId.Left, winner: SquadId.Left, reason: MatchEndReason.DefenceHeld, round: 12 },
  { shot: "11-end-attacker-defeat.png", defender: SquadId.Right, winner: SquadId.Right, reason: MatchEndReason.DefenceHeld, round: 12 },
  { shot: "12-end-defender-defeat.png", defender: SquadId.Left, winner: SquadId.Right, reason: MatchEndReason.AllHeroesExhausted, round: 9 },
] as const;

/** Looks at the Attack and Defend screens in the order of the design sheets. */
async function playAttackDefend(browser: Browser): Promise<void> {
  const directory = path.join(OUTPUT_DIR, "attack-defend");
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const errors: string[] = [];
  const open = async (init?: { snapshot: string }): Promise<Page> => {
    const page = await browser.newPage({ viewport: VIEWPORT });
    page.setDefaultTimeout(SCENARIO_ACTION_TIMEOUT_MS);
    page.on("pageerror", (error) => errors.push(error.message));
    if (init) await page.addInitScript(([key, value]) => localStorage.setItem(key!, value!), [STORAGE_KEY, init.snapshot]);
    return page;
  };
  const shoot = (page: Page, name: string) => page.screenshot({ path: path.join(directory, name) });
  const snapshotOf = (match: MatchState) => JSON.stringify({ version: SNAPSHOT_VERSION, match });
  const startOf = (defender: SquadId) => startRound(createMatch(42, { kind: MatchMode.AttackAndDefend, defender }));

  // The start screen with a saved match (so that Resume match is there) and the side screen.
  let page = await open({ snapshot: snapshotOf(startOf(SquadId.Right)) });
  await page.goto(URL);
  await page.getByTestId("start-screen").waitFor();
  await page.waitForTimeout(300);
  await shoot(page, "01-start.png");
  await page.getByTestId("play-attack-defend").click();
  // The preview rests for 2 s at the start of its camera move; the frames are taken in that rest, once the board is drawn.
  await page.locator(".sd-stage canvas").waitFor();
  await page.waitForTimeout(700);
  await shoot(page, "02-side-attack.png");
  await page.getByTestId("side-defend").click();
  await page.locator(".sd-stage canvas").waitFor();
  await page.waitForTimeout(700);
  await shoot(page, "03-side-defend.png");
  await page.close();

  // The role banner (held on screen by ?hold=banner) and the planning HUD of each role.
  for (const [role, bannerShot, hudShot] of [["attack", "04-role-banner-attack.png", "06-hud-attacker.png"], ["defend", "05-role-banner-defend.png", "07-hud-defender.png"]] as const) {
    page = await open();
    await page.goto(`${URL}/?hero=bruiser&role=${role}&hold=banner`);
    await page.getByTestId("play-attack-defend").click();
    await page.getByTestId("role-banner").waitFor();
    await page.waitForTimeout(1500);
    await shoot(page, bannerShot);
    await page.close();
    page = await open();
    await page.goto(`${URL}/?hero=bruiser&role=${role}`);
    await page.getByTestId("play-attack-defend").click();
    await page.getByTestId("role-banner").waitFor({ state: "detached" });
    await page.getByRole("list", { name: "Hand" }).getByRole("button").last().waitFor({ state: "visible" });
    await page.waitForTimeout(1500);
    await shoot(page, hudShot);
    if (role === "attack") {
      await page.locator(".wait-card").click();
      await page.getByRole("button", { name: "Commit" }).click();
      await page.getByTestId("resolution-bar").waitFor();
      await page.waitForTimeout(1800);
      await shoot(page, "08-hud-resolution.png");
    }
    await page.close();
  }

  for (const { shot, defender, winner, reason, round } of END_SCREENS) {
    const match = startOf(defender);
    const finished: MatchState = { ...match, result: { winner, reason, round, deckTotals: { [SquadId.Left]: 14, [SquadId.Right]: 9 } } };
    page = await open({ snapshot: snapshotOf(finished) });
    await page.goto(URL);
    await page.getByTestId("resume").click();
    await page.getByTestId("end-screen").waitFor();
    await page.waitForTimeout(300);
    await shoot(page, shot);
    await page.close();
  }
  if (errors.length > 0) throw new Error(`attack-defend: ${errors.join("; ")}`);
  checkWritten(directory, SCREEN_SCENARIOS["attack-defend"]!.shots);
}

/** Looks at the Hero Select at the moments the design sheets show: the Bruiser mid-shots, the drone out, the Assassin Hidden. */
async function playHeroSelect(browser: Browser): Promise<void> {
  const directory = path.join(OUTPUT_DIR, "hero-select");
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const shoot = (name: string) => page.screenshot({ path: path.join(directory, name) });
  await page.goto(URL);
  await page.getByTestId("play-classic").click();
  await page.getByTestId("hero-canvas").and(page.locator("[data-ready]")).waitFor();
  await page.waitForTimeout(800);
  await shoot("01-idle.png");
  await page.getByTestId("hero-bruiser").click();
  await page.waitForTimeout(2100); // the second of the three shots (at 22 %, 34 % and 46 % of 6 s; the frame is taken a little late)
  await shoot("02-bruiser-ready.png");
  await page.getByTestId("hero-controller").click();
  await page.waitForTimeout(3300); // the drone is out and hovers
  await shoot("03-controller-ready.png");
  await page.getByTestId("hero-assassin").click();
  await page.waitForTimeout(3300); // invisible, the label floats up
  await shoot("04-assassin-ready.png");
  await page.getByRole("button", { name: "VIEW CARDS" }).click();
  await page.getByTestId("card-list").waitFor();
  await shoot("05-cards.png");
  if (errors.length > 0) throw new Error(`hero-select: ${errors.join("; ")}`);
  checkWritten(directory, SCREEN_SCENARIOS["hero-select"]!.shots);
}

async function playStandardPath(page: Page, hero?: HeroClass): Promise<void> {
  const shoot = (name: ScreenshotName) => page.screenshot({ path: path.join(OUTPUT_DIR, name) });

  await page.goto(hero ? `${URL}/?hero=${hero}` : URL);
  await page.getByTestId("play-classic").click();
  // Without ?hero= the Hero Select comes first: the Bruiser, then Start.
  if (!hero) await chooseHeroAndStart(page, HeroClass.Bruiser);
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
  if (!SCENARIO_NAMES.includes(name) && !(name in SCREEN_SCENARIOS)) return { list: false, scenarios: [], error: `Unknown scenario "${name}"` };
  return { list: false, scenarios: [name] };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.list || options.error) {
    if (options.error) console.error(`${options.error}. Valid names: all, ${[...SCENARIO_NAMES, ...Object.keys(SCREEN_SCENARIOS)].join(", ")}`);
    else {
      for (const scenario of SCENARIOS) console.log(`${scenario.name}\t${scenario.description}`);
      for (const [name, screen] of Object.entries(SCREEN_SCENARIOS)) console.log(`${name}\t${screen.description}`);
    }
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
        if (name in SCREEN_SCENARIOS) {
          if (name === "attack-defend") await playAttackDefend(browser);
          else if (name === "glossary") await playGlossary(browser);
          else if (name === "options") await playOptions(browser);
          else await playHeroSelect(browser);
          console.log(`Scenario ${name}: ${path.join(OUTPUT_DIR, name)}\n${SCREEN_SCENARIOS[name]!.shots.join("\n")}`);
          continue;
        }
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
