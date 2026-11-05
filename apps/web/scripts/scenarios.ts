// Named screenshot scenarios: each puts the match into a chosen state so a state the standard path never reaches
// (an Overdrive effect, Exhaustion, a Hero in fog) can be looked at. The Match State is built here, in Node, with the
// real rules API and plain edits; the tool resumes it in the browser through the Resume button, and the real local
// host plays the Resolution. Nothing here forges a rule. To add a scenario: see "Screenshots of UI changes" in
// docs/agents/software-factory.md.
import { ActionKind, type CardIndex, type GridPosition, type HeroPlan, type QueuedAction, type SquadPlan, SquadId, tileAt, TileKind, withTile } from "game-core";
import { createMatch, type HeroState, type MatchState, recordSightings, startRound } from "game-core/server";

/** How a Hand card is used in a planning step. `overdrive` is the primary effect in its Overdrive face. */
export type StepUse = "primary" | "overdrive" | "pitch" | "move" | "block";

export type PlanStep =
  /**
   * A card of the Hand, by its position (0 = leftmost), used in a role. A Move needs the destination `tile`; a
   * primary or overdrive use of a card aimed at a tile or area (Breach Charge, Scout Drone, Deploy Cover) needs the
   * tile that is tapped.
   */
  | { slot: number; use: StepUse; tile?: GridPosition }
  /** The Wait card: one Tick of nothing. */
  | { wait: true };

/** One planned Round: the steps the player takes and when frames are taken in its Resolution. */
export interface RoundScript {
  steps: readonly PlanStep[];
  /** Milliseconds after the Resolution bar appears at which a frame is taken. */
  resolutionShotsMs: readonly number[];
}

export interface Scenario {
  /** kebab-case; the folder under apps/web/screenshots/. */
  name: string;
  /** What the scenario is for, shown by `--list`. */
  description: string;
  /** Builds the Match State at the start of Round 1. Deterministic: same result every call. */
  buildMatch: () => MatchState;
  /** The player's Hero (always of the Left Squad) and its steps, driven through the UI in this order. */
  heroId: string;
  steps: readonly PlanStep[];
  /** Milliseconds after the Resolution bar appears at which a frame is taken. */
  resolutionShotsMs: readonly number[];
  /**
   * For effects that last more than one Resolution: what the player does in Round 2. Its steps must not need the
   * Hero's position or Hand (use Wait): the tool aims from the Hero's start position and the Round 2 Hand is drawn by the rules.
   */
  secondRound?: RoundScript;
}

const PLAYER_BRUISER = `${SquadId.Left}-bruiser`;

function heroOf(match: MatchState, id: string): HeroState {
  const hero = match.heroes.find((candidate) => candidate.id === id);
  if (!hero) throw new Error(`No Hero ${id}`);
  return hero;
}

/** Puts a Hero on a tile with the given Hand, Discard and Exile; every other card of its Deck list is in the Deck. */
function arrange(hero: HeroState, position: GridPosition, cards: { hand: CardIndex[]; discard?: CardIndex[]; exile?: CardIndex[]; deck?: CardIndex[] }): void {
  const { hand, discard = [], exile = [] } = cards;
  const taken = new Set([...hand, ...discard, ...exile]);
  const all = Array.from({ length: hero.hand.length + hero.deck.length + hero.discard.length + hero.exile.length }, (_, index) => index);
  hero.position = { ...position };
  hero.hand = hand;
  hero.discard = discard;
  hero.exile = exile;
  hero.deck = cards.deck ?? all.filter((index) => !taken.has(index));
}

/**
 * The state Deploy Cover leaves behind, written the way the rules write it: Half Cover on an empty tile for the
 * Left Squad, and the tile kind to restore. Only the Bruiser is played in the UI, and the AI never plays Deploy Cover
 * or Scout Drone, so these effects cannot be played in a scenario; they start in place.
 */
function placeHalfCover(match: MatchState, position: GridPosition, remaining: number): void {
  match.placedCover.push({ squad: SquadId.Left, position: { ...position }, originalKind: tileAt(match.grid, position)!, remaining });
  match.grid = withTile(match.grid, position, TileKind.HalfCover);
}

/** Round 1 of a fresh match with the edits applied; Ghost memory and Fog of War are brought up to date afterwards. */
function stage(seed: number, edit: (hero: (id: string) => HeroState, match: MatchState) => void): MatchState {
  const match = startRound(createMatch(seed));
  edit((id) => heroOf(match, id), match);
  recordSightings(match);
  return match;
}

// Card indices in the Deck lists of packages/game-core/src/cards.ts.
const BRUISER_SLAM_SHOT = 0;
const BRUISER_SLAM_SHOT_2 = 1;
const BRUISER_BREACH_CHARGE = 4;
const BRUISER_SHOCKWAVE = 5;
const BRUISER_BULWARK = 6;

export const SCENARIOS: readonly Scenario[] = [
  {
    name: "shockwave-overdrive",
    description: "A Bruiser plays Shockwave in Overdrive with two enemy Heroes within Range 1.",
    buildMatch: () =>
      stage(11, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [BRUISER_SHOCKWAVE, BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, BRUISER_BULWARK] });
        arrange(hero("right-bruiser"), { col: 13, row: 3 }, { hand: [0, 1, 2, 3] });
        arrange(hero("right-controller"), { col: 12, row: 4 }, { hand: [0, 1, 2, 3] });
        arrange(hero("right-assassin"), { col: 14, row: 3 }, { hand: [0, 1, 2, 3] });
      }),
    heroId: PLAYER_BRUISER,
    steps: [
      { slot: 1, use: "pitch" },
      { slot: 2, use: "pitch" },
      { slot: 0, use: "overdrive" },
    ],
    resolutionShotsMs: [400, 1000, 1800, 2600],
  },
  {
    name: "exhaustion",
    description: "A Bruiser with its last card in the Hand and an empty Deck and Discard becomes Exhausted at the end of the Resolution and leaves a wreck.",
    buildMatch: () =>
      stage(12, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [BRUISER_BULWARK], deck: [] });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [800, 2000, 3500],
  },
  {
    name: "hero-in-fog",
    description: "A Bruiser moves onto a tile the enemy Squad cannot see.",
    buildMatch: () =>
      stage(13, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 4, row: 1 }, { hand: [BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, 2, 3] });
      }),
    heroId: PLAYER_BRUISER,
    // Row 1 and a destination without Cover in front of it: a tall prop would catch the tap instead of the tile.
    steps: [{ slot: 0, use: "move", tile: { col: 6, row: 1 } }],
    resolutionShotsMs: [800, 2500],
  },
  {
    name: "cover-placed-expires",
    description: "Half Cover placed by Deploy Cover (2 Resolutions left) stands through Resolution 1 and expires at the end of Resolution 2.",
    buildMatch: () =>
      stage(21, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 8, row: 3 }, { hand: [BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, 2, 3] });
        placeHalfCover(match, { col: 10, row: 3 }, 2);
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400, 1500, 3000],
    secondRound: { steps: [{ wait: true }], resolutionShotsMs: [400, 1500, 3000] },
  },
  {
    name: "cover-destroyed",
    description: "A Bruiser plays Breach Charge on a Half Cover tile; the Cover is destroyed and the scorch tile stays.",
    buildMatch: () =>
      stage(22, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 6, row: 3 }, { hand: [BRUISER_BREACH_CHARGE, BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, BRUISER_BULWARK] });
      }),
    heroId: PLAYER_BRUISER,
    steps: [
      { slot: 1, use: "pitch" },
      { slot: 2, use: "pitch" },
      { slot: 0, use: "primary", tile: { col: 8, row: 2 } },
    ],
    resolutionShotsMs: [400, 1200, 2800],
  },
  {
    name: "scout-drone-area-over-time",
    description: "A Scout Drone area (3 x 3, 2 Resolutions left) shows an enemy Hero behind a wall in Resolutions 1 and 2; then the fog closes.",
    buildMatch: () =>
      stage(23, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 8, row: 3 }, { hand: [BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, 2, 3] });
        // Behind the wall of row 6: out of sight for the Squad until the area covers it. The sighting makes it a Ghost later.
        hero("right-assassin").position = { col: 12, row: 7 };
        match.revealedAreas.push({ squad: SquadId.Left, center: { col: 12, row: 6 }, size: 3, remaining: 2 });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400, 1500, 3000],
    secondRound: { steps: [{ wait: true }], resolutionShotsMs: [400, 1500, 3000] },
  },
  {
    name: "ghost-enemy",
    description: "An enemy Assassin seen earlier is out of sight and shown as a Ghost with the last seen tag; the Bruiser then moves close enough to see it again.",
    buildMatch: () =>
      stage(24, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 7, row: 8 }, { hand: [BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, 2, 3] });
        // Seen 6 tiles away, then 8 tiles away on the Prime Zone, beyond the sight range of 7: the Squad remembers the first tile.
        hero("right-assassin").position = { col: 13, row: 8 };
        recordSightings(match);
        hero("right-assassin").position = { col: 15, row: 8 };
      }),
    heroId: PLAYER_BRUISER,
    // The enemy holds the Prime Zone; the Move brings it to 6 tiles.
    steps: [{ slot: 0, use: "move", tile: { col: 9, row: 8 } }],
    resolutionShotsMs: [800, 2500],
  },
];

export const SCENARIO_NAMES: readonly string[] = SCENARIOS.map((scenario) => scenario.name);

/** The rounds the player plays in a scenario, in order. */
export function scenarioRounds(scenario: Scenario): RoundScript[] {
  return [{ steps: scenario.steps, resolutionShotsMs: scenario.resolutionShotsMs }, ...(scenario.secondRound ? [scenario.secondRound] : [])];
}

/**
 * The PNG names a scenario writes, in order: per Round the plan and one frame per Resolution time (Round 2 frames
 * carry `round2-`), then the start of the next Round.
 */
export function scenarioScreenshotNames(scenario: Scenario): string[] {
  const names: string[] = [];
  const next = (label: string) => names.push(`${String(names.length + 1).padStart(2, "0")}-${label}.png`);
  scenarioRounds(scenario).forEach((round, index) => {
    const prefix = index === 0 ? "" : `round${index + 1}-`;
    next(`${prefix}planned`);
    for (const ms of round.resolutionShotsMs) next(`${prefix}resolution-t${ms}`);
  });
  next("after");
  return names;
}

export const SCENARIO_SCREENSHOT_NAMES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  SCENARIOS.map((scenario) => [scenario.name, scenarioScreenshotNames(scenario)]),
);

/** The plan the steps build, as the UI will queue it, for checking against the Squad View with `validatePlan`. */
export function preparedPlan(scenario: Scenario, match: MatchState, steps: readonly PlanStep[] = scenario.steps): SquadPlan {
  const hero = heroOf(match, scenario.heroId);
  const pitched: CardIndex[] = [];
  const queue: QueuedAction[] = [];
  for (const step of steps) {
    if ("wait" in step) {
      queue.push({ kind: ActionKind.Wait });
      continue;
    }
    const card = hero.hand[step.slot];
    if (card === undefined) throw new Error(`${scenario.name}: no card in slot ${step.slot}`);
    if (step.use === "pitch") pitched.push(card);
    else if (step.use === "block") queue.push({ kind: ActionKind.Block, card });
    else if (step.use === "move") {
      if (!step.tile) throw new Error(`${scenario.name}: a Move needs a tile`);
      queue.push({ kind: ActionKind.Move, card, destination: step.tile });
    } else queue.push({ kind: ActionKind.Primary, card, target: hero.id, ...(step.tile ? { tile: step.tile } : {}), overdrive: step.use === "overdrive" });
  }
  const heroPlan: HeroPlan = { heroId: hero.id, queue, pitched };
  return { squad: hero.squad, heroes: [heroPlan] };
}
