// Named screenshot scenarios: each puts the match into a chosen state so a state the standard path never reaches
// (an Overdrive effect, Exhaustion, a Hero in fog) can be looked at. The Match State is built here, in Node, with the
// real rules API and plain edits; the tool resumes it in the browser through the Resume button, and the real local
// host plays the Resolution. Nothing here forges a rule. To add a scenario: see "Screenshots of UI changes" in
// docs/agents/software-factory.md.
import { ActionKind, type CardIndex, type GridPosition, type HeroPlan, type QueuedAction, type SquadPlan, SquadId } from "game-core";
import { createMatch, type HeroState, type MatchState, recordSightings, startRound } from "game-core/server";

/** How a Hand card is used in a planning step. `overdrive` is the primary effect in its Overdrive face. */
export type StepUse = "primary" | "overdrive" | "pitch" | "move" | "block";

export type PlanStep =
  /**
   * A card of the Hand, by its position (0 = leftmost), used in a role. A Move needs the destination `tile`; a Primary
   * or Overdrive that names an enemy Hero needs its id as `target` (the tool taps that Hero or Ghost on the board).
   */
  | { slot: number; use: StepUse; tile?: GridPosition; target?: string }
  /** The Wait card: one Tick of nothing. */
  | { wait: true };

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
const BRUISER_SHOCKWAVE = 5;
const BRUISER_BULWARK = 6;

const PLAYER_ASSASSIN = `${SquadId.Left}-assassin`;
// Assassin Deck list indices (the first copy of each card).
const PRECISION_SHOT = 0;
const PIERCING_ROUND = 2;
const LONG_SHOT = 4;
const GHOST_SHOT = 6;
const EXECUTION_ROUND = 7;
const VANISH = 8;
const MARK_TARGET = 10;
const REPOSITION = 11;
/** Cards that fill the rest of an Assassin's Hand; the ones in slots 1 and 2 are the Pitch for Energy. */
const ASSASSIN_FILLERS: CardIndex[] = [9, 1, 3];

/** The Squad remembers an enemy Hero at a tile it can no longer see (a Ghost). */
function remember(match: MatchState, enemyId: string, position: GridPosition): void {
  const enemy = heroOf(match, enemyId);
  match.ghosts[SquadId.Left][enemyId] = {
    position: { ...position },
    deckCount: enemy.deck.length,
    discardCount: enemy.discard.length,
    exileCount: enemy.exile.length,
    lastSeenRound: match.round,
  };
}

interface AssassinSetup {
  name: string;
  description: string;
  seed: number;
  at: GridPosition;
  card: CardIndex;
  /** Enemy Heroes moved onto a tile; the others stay at their spawn, out of sight. */
  enemies?: Record<string, GridPosition>;
  /** Enemy Heroes that are Hidden on their tile, so the Squad does not see them. */
  hidden?: string[];
  /** Ghost memories of the Left Squad: enemy id and the tile it was last seen on. */
  ghosts?: Record<string, GridPosition>;
  /** Energy from Pitch: one card is enough for every card but Execution Round. */
  pitch?: number;
  /** The Assassin's steps after the Pitch. */
  use: Extract<PlanStep, { slot: number }>[];
  shots?: readonly number[];
}

/** An Assassin of the Left Squad plays the card in slot 0 of a Hand; the enemy Squad is AI-planned. */
function assassinScenario(setup: AssassinSetup): Scenario {
  const pitchSteps: PlanStep[] = Array.from({ length: setup.pitch ?? 1 }, (_, index) => ({ slot: index + 1, use: "pitch" }));
  return {
    name: setup.name,
    description: setup.description,
    buildMatch: () =>
      stage(setup.seed, (hero, match) => {
        arrange(hero(PLAYER_ASSASSIN), setup.at, { hand: [setup.card, ...ASSASSIN_FILLERS] });
        for (const [id, position] of Object.entries(setup.enemies ?? {})) hero(id).position = { ...position };
        for (const id of setup.hidden ?? []) hero(id).hidden = 2;
        for (const [id, position] of Object.entries(setup.ghosts ?? {})) remember(match, id, position);
      }),
    heroId: PLAYER_ASSASSIN,
    steps: [...pitchSteps, ...setup.use],
    resolutionShotsMs: setup.shots ?? [500, 1100, 1800, 2600],
  };
}

const RIGHT_BRUISER = "right-bruiser";
const RIGHT_ASSASSIN = "right-assassin";
const SHOOT_AT_BRUISER = { slot: 0, use: "primary", target: RIGHT_BRUISER } as const;

const ASSASSIN_SCENARIOS: readonly Scenario[] = [
  assassinScenario({
    name: "precision-shot",
    description: "An Assassin fires Precision Shot at an enemy Bruiser in the open at Range 4.",
    seed: 21, at: { col: 10, row: 3 }, card: PRECISION_SHOT, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "piercing-round",
    description: "An Assassin fires Piercing Round at an enemy Bruiser standing on Half Cover, which the shot ignores.",
    seed: 22, at: { col: 9, row: 3 }, card: PIERCING_ROUND, enemies: { [RIGHT_BRUISER]: { col: 13, row: 2 } },
    use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "long-shot",
    description: "An Assassin fires Long Shot (normal face) at an enemy Bruiser at Range 6.",
    seed: 23, at: { col: 8, row: 3 }, card: LONG_SHOT, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "long-shot-overdrive",
    description: "An Assassin fires Long Shot in Overdrive at an enemy Bruiser at Range 6: the thick gold tracer, 4 damage.",
    seed: 24, at: { col: 8, row: 3 }, card: LONG_SHOT, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    use: [{ ...SHOOT_AT_BRUISER, use: "overdrive" }],
  }),
  assassinScenario({
    name: "ghost-shot",
    description: "An Assassin fires Ghost Shot (normal face) at a visible enemy Bruiser.",
    seed: 25, at: { col: 10, row: 3 }, card: GHOST_SHOT, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "ghost-shot-overdrive",
    description: "An Assassin fires Ghost Shot in Overdrive at the last known position of a Ghost; the enemy Assassin is still Hidden there, so the shot hits.",
    seed: 26, at: { col: 10, row: 3 }, card: GHOST_SHOT, enemies: { [RIGHT_ASSASSIN]: { col: 13, row: 3 } },
    hidden: [RIGHT_ASSASSIN], ghosts: { [RIGHT_ASSASSIN]: { col: 13, row: 3 } },
    use: [{ slot: 0, use: "overdrive", target: RIGHT_ASSASSIN }],
  }),
  assassinScenario({
    name: "ghost-shot-overdrive-miss",
    description: "An Assassin fires Ghost Shot in Overdrive at the last known position of a Ghost that has left the tile: the shot hits nobody.",
    seed: 27, at: { col: 10, row: 3 }, card: GHOST_SHOT, ghosts: { [RIGHT_BRUISER]: { col: 13, row: 3 } },
    use: [{ slot: 0, use: "overdrive", target: RIGHT_BRUISER }],
  }),
  assassinScenario({
    name: "execution-round",
    description: "An Assassin fires Execution Round (2 Energy, 3 damage) at an enemy Bruiser at Range 4.",
    seed: 28, at: { col: 10, row: 3 }, card: EXECUTION_ROUND, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    pitch: 2, use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "vanish",
    description: "An Assassin plays Vanish and moves two tiles onto Half Cover, so it ends the Resolution Hidden.",
    seed: 29, at: { col: 6, row: 2 }, card: VANISH,
    use: [{ slot: 0, use: "primary" }, { slot: 3, use: "move", tile: { col: 8, row: 2 } }],
    shots: [500, 1200, 2000, 3000],
  }),
  assassinScenario({
    name: "mark-target",
    description: "An Assassin plays Mark Target (normal face) on an enemy Bruiser in sight.",
    seed: 30, at: { col: 10, row: 3 }, card: MARK_TARGET, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "mark-target-overdrive",
    description: "An Assassin plays Mark Target in Overdrive on an enemy Bruiser within Range 5: Marked plus 1 damage.",
    seed: 31, at: { col: 10, row: 3 }, card: MARK_TARGET, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    use: [{ ...SHOOT_AT_BRUISER, use: "overdrive" }],
  }),
  assassinScenario({
    name: "reposition",
    description: "An Assassin plays Reposition and then moves three tiles with one Move.",
    seed: 32, at: { col: 6, row: 3 }, card: REPOSITION,
    use: [{ slot: 0, use: "primary" }, { slot: 3, use: "move", tile: { col: 9, row: 3 } }],
    shots: [500, 1200, 2000, 3000],
  }),
];

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
  ...ASSASSIN_SCENARIOS,
];

export const SCENARIO_NAMES: readonly string[] = SCENARIOS.map((scenario) => scenario.name);

/** The PNG names a scenario writes, in order: the plan, one per Resolution time, and the next Round. */
export function scenarioScreenshotNames(scenario: Scenario): string[] {
  const number = (position: number) => String(position).padStart(2, "0");
  return [
    "01-planned.png",
    ...scenario.resolutionShotsMs.map((ms, index) => `${number(index + 2)}-resolution-t${ms}.png`),
    `${number(scenario.resolutionShotsMs.length + 2)}-after.png`,
  ];
}

export const SCENARIO_SCREENSHOT_NAMES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  SCENARIOS.map((scenario) => [scenario.name, scenarioScreenshotNames(scenario)]),
);

/** The plan the steps build, as the UI will queue it, for checking against the Squad View with `validatePlan`. */
export function preparedPlan(scenario: Scenario, match: MatchState): SquadPlan {
  const hero = heroOf(match, scenario.heroId);
  const pitched: CardIndex[] = [];
  const queue: QueuedAction[] = [];
  for (const step of scenario.steps) {
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
    } else queue.push({ kind: ActionKind.Primary, card, target: step.target ?? hero.id, overdrive: step.use === "overdrive" });
  }
  const heroPlan: HeroPlan = { heroId: hero.id, queue, pitched };
  return { squad: hero.squad, heroes: [heroPlan] };
}
