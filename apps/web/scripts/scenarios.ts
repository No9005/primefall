// Named screenshot scenarios: each puts the match into a chosen state so a state the standard path never reaches
// (an Overdrive effect, Exhaustion, a Hero in fog) can be looked at. The Match State is built here, in Node, with the
// real rules API and plain edits; the tool resumes it in the browser through the Resume button, and the real local
// host plays the Resolution. Nothing here forges a rule. To add a scenario: see "Screenshots of UI changes" in
// docs/agents/software-factory.md.
import { ActionKind, type CardIndex, type GridPosition, HeroClass, type HeroPlan, type QueuedAction, type SquadPlan, SquadId, TileKind, withTile } from "game-core";
import { createMatch, type HeroState, type MatchState, recordSightings, startRound } from "game-core/server";

/** How a Hand card is used in a planning step. `overdrive` is the primary effect in its Overdrive face. */
export type StepUse = "primary" | "overdrive" | "pitch" | "move" | "block";

export type PlanStep =
  /**
   * A card of the Hand, by its position (0 = leftmost), used in a role. A Move needs the destination `tile`; a
   * primary or overdrive use of a card aimed at a tile or area (Breach Charge, Scout Drone, Deploy Cover) needs the
   * tile that is tapped.
   */
  | { slot: number; use: StepUse; tile?: GridPosition; target?: string }
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
  /** The Player Hero's class; the Bruiser when absent. `heroId` must be the Left Squad's Hero of this class. */
  playerHero?: HeroClass;
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
 * Left Squad. Only the Bruiser is played in the UI, and the AI never plays Deploy Cover
 * or Scout Drone, so these effects cannot be played in a scenario; they start in place.
 */
function placeHalfCover(match: MatchState, position: GridPosition): void {
  match.placedCover.push({ squad: SquadId.Left, position: { ...position } });
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

// Controller cards. These scenarios keep the Bruiser as the Player Hero, so the Controller's card is played by the allied
// AI, which plays only simple Attacks (isSimpleAttack in cards.ts). A scenario with `playerHero` set can play the other
// cards itself.
const CONTROLLER_PULSE_BOLT = 0;
const CONTROLLER_TAG_ROUND = 2;
const CONTROLLER_SHOCK_PULSE = 3;
/** The rest of the Controller's Hand: Utility cards only, so the AI plays the Attack under test (it plays the first Attack in the Hand that is in Range). */
const CONTROLLER_FILLER_CARDS: readonly CardIndex[] = [11, 9, 5];

/**
 * The allied Controller stands on open floor two tiles from an enemy Bruiser (Controller Range is 2): the AI plans an
 * Attack with the card under test. The player's Bruiser just waits.
 */
function controllerAttack(name: string, description: string, seed: number, card: CardIndex): Scenario {
  return {
    name,
    description,
    buildMatch: () =>
      stage(seed, (hero) => {
        arrange(hero(`${SquadId.Left}-controller`), { col: 12, row: 3 }, { hand: [card, ...CONTROLLER_FILLER_CARDS] });
        // An enemy with Attacks in its Hand shoots back instead of walking out of the Controller's Range.
        arrange(hero("right-bruiser"), { col: 14, row: 3 }, { hand: [0, 1, 2, 3] });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400, 1000, 1800, 2600],
  };
}

// The rest of the Bruiser's Deck list (packages/game-core/src/cards.ts).
const BRUISER_CONCUSSION_ROUND = 2;
const BRUISER_CONCUSSION_ROUND_2 = 3;
const BRUISER_FORWARD_DEPLOY = 8;
const BRUISER_SUPPRESS = 9;
const BRUISER_REINFORCE = 10;
const BRUISER_ADRENAL_SURGE = 11;

const ALLY_CONTROLLER = `${SquadId.Left}-controller`;
const ENEMY_BRUISER = `${SquadId.Right}-bruiser`;

/**
 * A Bruiser card played from the Hand's first slot, paid by pitching the next slots (a card of Energy cost 2 needs two
 * Pitches). `edit` places the other Heroes where the effect is visible. The enemies hold Attacks, so the AI shoots
 * back instead of walking away.
 */
function bruiserCard(
  name: string,
  description: string,
  seed: number,
  card: CardIndex,
  pitches: number,
  play: Omit<Extract<PlanStep, { slot: number }>, "slot">,
  edit: (hero: (id: string) => HeroState, match: MatchState) => void,
  resolutionShotsMs: readonly number[] = [600, 1300, 2000, 3000, 4500],
): Scenario {
  const fillers = [BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, BRUISER_CONCUSSION_ROUND, BRUISER_CONCUSSION_ROUND_2].filter((index) => index !== card);
  return {
    name,
    description,
    buildMatch: () =>
      stage(seed, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [card, ...fillers.slice(0, 3)] });
        edit(hero, match);
      }),
    heroId: PLAYER_BRUISER,
    steps: [...Array.from({ length: pitches }, (_, index): PlanStep => ({ slot: index + 1, use: "pitch" })), { slot: 0, ...play }],
    resolutionShotsMs,
  };
}

const ENEMIES_WITH_ATTACKS = { hand: [0, 1, 2, 3] };

// Assassin cards: the Player Hero is the Assassin, so the player plays them in the UI (?hero=assassin).
const PLAYER_ASSASSIN = `${SquadId.Left}-assassin`;
// Assassin Deck list indices (the first copy of each card).
const PRECISION_SHOT = 0;
const COVER_BREAKER = 2;
const SHIELD_BREAKER = 3;
const LONG_SHOT = 4;
const GHOST_SHOT = 6;
const EXECUTION_ROUND = 7;
const VANISH = 8;
const MARK_TARGET = 10;
const REPOSITION = 11;
/** Cards that fill the rest of an Assassin's Hand; the ones in slots 1 and 2 are the Pitch for Energy. */
const ASSASSIN_FILLERS: CardIndex[] = [9, 1, 5];

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
        // An enemy placed for the shot has an empty Hand, so the AI leaves it where it stands (it would walk out of Range or sight).
        for (const [id, position] of Object.entries(setup.enemies ?? {})) arrange(hero(id), position, { hand: [] });
        for (const id of setup.hidden ?? []) hero(id).hidden = 2;
        for (const [id, position] of Object.entries(setup.ghosts ?? {})) remember(match, id, position);
      }),
    playerHero: HeroClass.Assassin,
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
    name: "cover-breaker",
    description: "An Assassin fires Cover Breaker at an enemy Bruiser standing on Half Cover, which the shot ignores.",
    seed: 22, at: { col: 9, row: 3 }, card: COVER_BREAKER, enemies: { [RIGHT_BRUISER]: { col: 13, row: 2 } },
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
    shots: [450, 520, 620, 1100],
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
    name: "assassin-shield-breaker",
    description: "An Assassin fires Shield Breaker (2 Energy, 2 Piercing Damage) at an enemy Bruiser at Range 4.",
    seed: 29, at: { col: 10, row: 3 }, card: SHIELD_BREAKER, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    pitch: 2, use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "execution-round",
    description: "An Assassin fires Execution Round (2 Energy, 3 damage) at an enemy Bruiser at Range 4.",
    seed: 28, at: { col: 10, row: 3 }, card: EXECUTION_ROUND, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    pitch: 2, use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "vanish",
    description: "An Assassin moves two tiles onto Half Cover and plays Vanish there (Hidden needs Cover under the Hero), so it ends the Resolution Hidden.",
    seed: 29, at: { col: 6, row: 2 }, card: VANISH,
    use: [{ slot: 3, use: "move", tile: { col: 8, row: 2 } }, { slot: 0, use: "primary" }],
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
  bruiserCard("slam-shot", "A Bruiser fires Slam Shot (2 damage, Range 3) at an enemy Bruiser two tiles away.", 31, BRUISER_SLAM_SHOT, 1, { use: "primary", target: ENEMY_BRUISER }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("concussion-round", "A Bruiser fires Concussion Round (2 damage and Slow) at an enemy Bruiser two tiles away.", 32, BRUISER_CONCUSSION_ROUND, 1, { use: "primary", target: ENEMY_BRUISER }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("breach-charge", "A Bruiser plays Breach Charge on a Half Cover tile in front of an enemy Bruiser: the Cover is destroyed, the enemy behind it is not hurt.", 33, BRUISER_BREACH_CHARGE, 2, { use: "primary", tile: { col: 14, row: 4 } }, (hero, match) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
    placeHalfCover(match, { col: 14, row: 4 });
  }),
  bruiserCard(
    "breach-charge-overdrive",
    "A Bruiser plays Breach Charge in Overdrive on a Half Cover tile with enemy Heroes around it: the Cover is destroyed and every Hero at and around the tile takes 2 damage.",
    34,
    BRUISER_BREACH_CHARGE,
    2,
    { use: "overdrive", tile: { col: 14, row: 4 } },
    (hero, match) => {
      arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
      arrange(hero(`${SquadId.Right}-controller`), { col: 15, row: 3 }, ENEMIES_WITH_ATTACKS);
      placeHalfCover(match, { col: 14, row: 4 });
    },
  ),
  bruiserCard("shockwave", "A Bruiser plays Shockwave: 2 damage and knockback to two enemy Heroes within Range 1.", 35, BRUISER_SHOCKWAVE, 2, { use: "primary" }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 13, row: 3 }, ENEMIES_WITH_ATTACKS);
    arrange(hero(`${SquadId.Right}-controller`), { col: 12, row: 4 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("bulwark", "A Bruiser plays Bulwark: the Shield (3) bubble appears and soaks the enemy Slam Shots of the Resolution.", 36, BRUISER_BULWARK, 1, { use: "primary" }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard(
    "forward-deploy",
    "A Bruiser plays Forward Deploy on the allied Controller: it gets an extra Move of 2 tiles.",
    37,
    BRUISER_FORWARD_DEPLOY,
    1,
    { use: "primary", target: ALLY_CONTROLLER, tile: { col: 11, row: 5 } },
    (hero) => {
      arrange(hero(ALLY_CONTROLLER), { col: 10, row: 3 }, { hand: [0, 1, 2, 3] });
    },
  ),
  bruiserCard("suppress", "A Bruiser plays Suppress on an enemy Bruiser: Slow, and it cannot go Hidden.", 38, BRUISER_SUPPRESS, 1, { use: "primary", target: ENEMY_BRUISER }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("reinforce", "A Bruiser plays Reinforce on the allied Controller: Shield (2) on the ally while the enemy shoots.", 39, BRUISER_REINFORCE, 1, { use: "primary", target: ALLY_CONTROLLER }, (hero) => {
    arrange(hero(ALLY_CONTROLLER), { col: 11, row: 3 }, { hand: [0, 1, 2, 3] });
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("adrenal-surge", "A Bruiser plays Adrenal Surge: a permanent +1 Attack for itself.", 40, BRUISER_ADRENAL_SURGE, 2, { use: "primary" }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard(
    "adrenal-surge-overdrive",
    "A Bruiser plays Adrenal Surge in Overdrive: the Bruiser and the allied Controller each gain the permanent +1 Attack.",
    41,
    BRUISER_ADRENAL_SURGE,
    2,
    { use: "overdrive", target: ALLY_CONTROLLER },
    (hero) => {
      arrange(hero(ALLY_CONTROLLER), { col: 11, row: 3 }, { hand: [0, 1, 2, 3] });
      arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
    },
  ),
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
  controllerAttack("pulse-bolt", "The allied Controller fires Pulse Bolt (2 damage, Range 2) at an enemy Bruiser two tiles away; the player's Bruiser waits.", 21, CONTROLLER_PULSE_BOLT),
  controllerAttack("tag-round", "The allied Controller fires Tag Round at an enemy Bruiser two tiles away: 1 damage and Marked; the player's Bruiser waits.", 22, CONTROLLER_TAG_ROUND),
  controllerAttack("shock-pulse", "The allied Controller fires Shock Pulse at an enemy Bruiser two tiles away: 1 damage and Slow; the player's Bruiser waits.", 23, CONTROLLER_SHOCK_PULSE),
  {
    name: "cover-placed-stays",
    description: "Half Cover placed by Deploy Cover stands through Resolution 1 and is still there after Resolution 2.",
    buildMatch: () =>
      stage(21, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 8, row: 3 }, { hand: [BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, 2, 3] });
        placeHalfCover(match, { col: 10, row: 3 });
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
  {
    name: "walk-glide",
    description: "A Bruiser walks two tiles with one Move: frames inside a step show the figure between two tiles, walking from A to B.",
    buildMatch: () =>
      stage(14, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 4, row: 1 }, { hand: [BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, 2, 3] });
      }),
    heroId: PLAYER_BRUISER,
    // Row 1 and a destination without Cover in front of it: a tall prop would catch the tap instead of the tile.
    steps: [{ slot: 0, use: "move", tile: { col: 6, row: 1 } }],
    resolutionShotsMs: [150, 300, 450, 600, 850, 1100],
  },
  {
    name: "crossfire",
    description: "Two enemies with Attacks shoot the waiting Bruiser in consecutive Ticks: the second hit shows CROSSFIRE +1 above the damage numbers.",
    buildMatch: () =>
      stage(31, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [BRUISER_SLAM_SHOT, BRUISER_SLAM_SHOT_2, 2, 3] });
        // Both enemies stand in Range and in sight with Attacks in their Hands, so the AI shoots the Bruiser.
        arrange(hero("right-bruiser"), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
        arrange(hero("right-assassin"), { col: 15, row: 4 }, ENEMIES_WITH_ATTACKS);
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400, 900, 1400, 1900, 2600, 3200],
  },
  ...ASSASSIN_SCENARIOS,
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
    } else queue.push({ kind: ActionKind.Primary, card, target: step.target ?? hero.id, ...(step.tile ? { tile: step.tile } : {}), overdrive: step.use === "overdrive" });
  }
  const heroPlan: HeroPlan = { heroId: hero.id, queue, pitched };
  return { squad: hero.squad, heroes: [heroPlan] };
}
