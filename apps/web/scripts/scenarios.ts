// Named screenshot scenarios: each puts the match into a chosen state so a state the standard path never reaches
// (Exhaustion, a Hero in fog) can be looked at. The Match State is built here, in Node, with the
// real rules API and plain edits; the tool resumes it in the browser through the Resume button, and the real local
// host plays the Resolution. Nothing here forges a rule. To add a scenario: see "Screenshots of UI changes" in
// docs/agents/software-factory.md.
import { ActionKind, type CardIndex, cardIndex, type GridPosition, HeroClass, type HeroPlan, type QueuedAction, type SquadPlan, SquadId, TileKind, withTile } from "game-core";
import { createMatch, type HeroState, type MatchState, recordSightings, startRound } from "game-core/server";

/** How a Hand card is used in a planning step. */
export type StepUse = "primary" | "pitch" | "move";

export type PlanStep =
  /**
   * A card of the Hand, by its position (0 = leftmost), used in a role. A Move needs the destination `tile`; a
   * primary use of a card aimed at a tile or area (Urban Renewal, Site Survey, Temporary Solution) needs the
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
 * The state Temporary Solution leaves behind, written the way the rules write it: Half Cover on an empty tile for the
 * Left Squad. Only the Bruiser is played in the UI, and the AI never plays Temporary Solution
 * or Site Survey, so these effects cannot be played in a scenario; they start in place.
 */
function placeHalfCover(match: MatchState, position: GridPosition): void {
  match.placedCover.push({ squad: SquadId.Left, position: { ...position } });
  match.grid = withTile(match.grid, position, TileKind.HalfCover);
}

/** Half Cover placed by a Squad, written the way the rules write it (the order of `match.placedCover` is the order of placing). */
function placeCoverFor(match: MatchState, squad: SquadId, position: GridPosition): void {
  match.placedCover.push({ squad, position: { ...position } });
  match.grid = withTile(match.grid, position, TileKind.HalfCover);
}

/** The Left Controller stands near three Placed Cover tiles of its Squad, and the enemy has one in sight. */
function controllerWithThreeCovers(match: MatchState, hero: (id: string) => HeroState, hand: CardIndex[]): void {
  arrange(hero(`${SquadId.Left}-controller`), { col: 13, row: 4 }, { hand });
  for (const tile of [{ col: 12, row: 4 }, { col: 13, row: 3 }, { col: 15, row: 3 }]) placeCoverFor(match, SquadId.Left, tile);
  placeCoverFor(match, SquadId.Right, { col: 16, row: 2 });
}

/** Round 1 of a fresh match with the edits applied; Ghost memory and Fog of War are brought up to date afterwards. */
function stage(seed: number, edit: (hero: (id: string) => HeroState, match: MatchState) => void): MatchState {
  const match = startRound(createMatch(seed));
  edit((id) => heroOf(match, id), match);
  recordSightings(match);
  return match;
}

// Card indices in the Deck lists of packages/game-core/src/cards.ts.
const BRUISER_HANDLE_WITH_CARE = cardIndex(HeroClass.Bruiser, "Handle With Care");
const BRUISER_HANDLE_WITH_CARE_2 = cardIndex(HeroClass.Bruiser, "Handle With Care", 1);
const BRUISER_HARD_HAT = cardIndex(HeroClass.Bruiser, "Hard Hat");

// Controller cards. These scenarios keep the Bruiser as the Player Hero, so the Controller's card is played by the allied
// AI, which plays only simple Attacks (isSimpleAttack in cards.ts). A scenario with `playerHero` set can play the other
// cards itself.
const CONTROLLER_PRICE_TAG = cardIndex(HeroClass.Controller, "Price Tag");
/** The rest of the Controller's Hand: Utility cards only, so the AI plays the Attack under test (it plays the first Attack in the Hand that is in Range). */
const CONTROLLER_FILLER_CARDS: readonly CardIndex[] = [cardIndex(HeroClass.Controller, "Site Survey"), cardIndex(HeroClass.Controller, "Temporary Solution"), cardIndex(HeroClass.Controller, "Heavy Metal")];

/**
 * The allied Controller stands on open floor two tiles from an enemy Bruiser (Price Tag has Range 3): the AI plans an
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
const BRUISER_TIME_FOR_COFFEE = cardIndex(HeroClass.Bruiser, "Time for Coffee");
const BRUISER_BUY_ONE_GET_TWO = cardIndex(HeroClass.Bruiser, "Buy One, Get Two");
const BRUISER_EXPRESS_DELIVERY = cardIndex(HeroClass.Bruiser, "Express Delivery");
const BRUISER_CARGO_HOOK = cardIndex(HeroClass.Bruiser, "Cargo Hook");
const CONTROLLER_URBAN_RENEWAL = cardIndex(HeroClass.Controller, "Urban Renewal");
const CONTROLLER_TEMPORARY_SOLUTION = cardIndex(HeroClass.Controller, "Temporary Solution");
const CONTROLLER_HEAVY_METAL = cardIndex(HeroClass.Controller, "Heavy Metal");

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
  const fillers = [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, BRUISER_TIME_FOR_COFFEE, BRUISER_BUY_ONE_GET_TWO].filter((index) => index !== card);
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
// Kit's Deck list indices (the first copy of each card).
const LONG_SHOT = cardIndex(HeroClass.Assassin, "Long Shot");
const SHIELD_BREAKER = cardIndex(HeroClass.Assassin, "Shield Breaker");
const VANISH = cardIndex(HeroClass.Assassin, "Vanish");
const PERSONAL_SPACE = cardIndex(HeroClass.Assassin, "Personal Space");
/** Cards that fill the rest of Kit's Hand (the card under test is left out); the ones in slots 1 and 2 are the Pitch for Energy. */
const ASSASSIN_FILLERS: readonly CardIndex[] = [PERSONAL_SPACE, cardIndex(HeroClass.Assassin, "Long Shot", 1), VANISH, SHIELD_BREAKER];

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
  /** Kit is Hidden when the Round starts. */
  selfHidden?: boolean;
  /** Energy from Pitch: one card is enough, as every card costs 1. */
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
      stage(setup.seed, (hero) => {
        arrange(hero(PLAYER_ASSASSIN), setup.at, { hand: [setup.card, ...ASSASSIN_FILLERS.filter((index) => index !== setup.card).slice(0, 3)] });
        // An enemy placed for the shot has an empty Hand, so the AI leaves it where it stands (it would walk out of Range or sight).
        for (const [id, position] of Object.entries(setup.enemies ?? {})) arrange(hero(id), position, { hand: [] });
        for (const id of setup.hidden ?? []) hero(id).hidden = 2;
        if (setup.selfHidden) hero(PLAYER_ASSASSIN).hidden = 2;
      }),
    playerHero: HeroClass.Assassin,
    heroId: PLAYER_ASSASSIN,
    steps: [...pitchSteps, ...setup.use],
    resolutionShotsMs: setup.shots ?? [500, 1100, 1800, 2600],
  };
}

const RIGHT_BRUISER = "right-bruiser";
const SHOOT_AT_BRUISER = { slot: 0, use: "primary", target: RIGHT_BRUISER } as const;

const ASSASSIN_SCENARIOS: readonly Scenario[] = [
  assassinScenario({
    name: "long-shot",
    description: "Kit fires Long Shot (3 damage) at an enemy Bruiser at Range 6.",
    seed: 23, at: { col: 8, row: 3 }, card: LONG_SHOT, enemies: { [RIGHT_BRUISER]: { col: 14, row: 3 } },
    use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "long-shot-hidden",
    description: "Kit is Hidden and fires Long Shot at an enemy Bruiser at Range 9: beyond 7 a Hidden Kit hits for 1 more, and the shot reveals Kit.",
    seed: 24, at: { col: 4, row: 3 }, card: LONG_SHOT, enemies: { [RIGHT_BRUISER]: { col: 13, row: 3 } },
    selfHidden: true, use: [SHOOT_AT_BRUISER],
    shots: [500, 1200, 2200, 3200],
  }),
  assassinScenario({
    name: "personal-space",
    description: "Kit fires Personal Space (1 damage, Knockback) at an enemy Bruiser two tiles away and pushes it three tiles away.",
    seed: 25, at: { col: 10, row: 3 }, card: PERSONAL_SPACE, enemies: { [RIGHT_BRUISER]: { col: 12, row: 3 } },
    use: [SHOOT_AT_BRUISER],
    shots: [500, 1200, 2200, 3200],
  }),
  assassinScenario({
    name: "assassin-shield-breaker",
    description: "Kit fires Shield Breaker (2 Piercing Damage, ignores Cover) at an enemy Bruiser on Half Cover at Range 4.",
    seed: 29, at: { col: 9, row: 3 }, card: SHIELD_BREAKER, enemies: { [RIGHT_BRUISER]: { col: 13, row: 2 } },
    use: [SHOOT_AT_BRUISER],
  }),
  assassinScenario({
    name: "vanish",
    description: "Kit plays Vanish where it stands and ends the Resolution Hidden.",
    seed: 30, at: { col: 6, row: 3 }, card: VANISH,
    use: [{ slot: 0, use: "primary" }],
    shots: [500, 1200, 2000, 3000],
  }),
];

export const SCENARIOS: readonly Scenario[] = [
  bruiserCard("handle-with-care", "A Bruiser fires Handle With Care (2 damage, 3 at Range 1; Range 1 to 2) at an enemy Bruiser two tiles away.", 31, BRUISER_HANDLE_WITH_CARE, 1, { use: "primary", target: ENEMY_BRUISER }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("handle-with-care-left", "The mirror of handle-with-care: the Bruiser fires at an enemy Bruiser two tiles to its left, turns to it and keeps facing it.", 31, BRUISER_HANDLE_WITH_CARE, 1, { use: "primary", target: ENEMY_BRUISER }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 10, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("time-for-coffee", "A Bruiser fires Time for Coffee (1 damage and Slow, Range 3) at an enemy Bruiser two tiles away.", 32, BRUISER_TIME_FOR_COFFEE, 1, { use: "primary", target: ENEMY_BRUISER }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  {
    name: "urban-renewal",
    description: "Tilly plays Urban Renewal on a Half Cover tile next to an enemy Bruiser: the bomb lands, the 3 x 3 area blows up, the Bruiser takes 2 damage, the Cover is destroyed, and Tilly pulls the rubble into her hand: Scrap.",
    buildMatch: () =>
      stage(33, (hero, match) => {
        arrange(hero(`${SquadId.Left}-controller`), { col: 12, row: 3 }, { hand: [CONTROLLER_URBAN_RENEWAL, 0, 1, 2] });
        arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
        placeHalfCover(match, { col: 14, row: 4 });
      }),
    playerHero: HeroClass.Controller,
    heroId: `${SquadId.Left}-controller`,
    steps: [
      { slot: 1, use: "pitch" },
      { slot: 0, use: "primary", tile: { col: 14, row: 4 } },
    ],
    resolutionShotsMs: [700, 1000, 1300, 1700, 2600, 3300, 4200, 5000],
  },
  bruiserCard("buy-one-get-two", "A Bruiser plays Buy One, Get Two on an enemy Bruiser two tiles away: two shots, 2 damage each.", 34, BRUISER_BUY_ONE_GET_TWO, 1, { use: "primary", target: ENEMY_BRUISER }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("hard-hat", "A Bruiser plays Hard Hat: the Shield (2) bubble appears and soaks the enemy Handle With Care shots of the Resolution.", 36, BRUISER_HARD_HAT, 1, { use: "primary" }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("express-delivery", "A Bruiser plays Express Delivery on an enemy Bruiser four tiles away: Shield 2 first, then it closes in and ends next to the enemy.", 42, BRUISER_EXPRESS_DELIVERY, 1, { use: "primary", target: ENEMY_BRUISER }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 16, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  bruiserCard("cargo-hook", "A Bruiser plays Cargo Hook on an enemy Bruiser five tiles away: it is dragged all the way next to the Bruiser.", 43, BRUISER_CARGO_HOOK, 1, { use: "primary", target: ENEMY_BRUISER }, (hero) => {
    arrange(hero(ENEMY_BRUISER), { col: 17, row: 3 }, ENEMIES_WITH_ATTACKS);
  }),
  {
    name: "charge-and-hit",
    description: "A Bruiser plays Express Delivery on an enemy Bruiser two tiles away, then Handle With Care at Range 1: the hit carries the tag CLOSE +1.",
    buildMatch: () =>
      stage(42, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [BRUISER_EXPRESS_DELIVERY, BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, BRUISER_TIME_FOR_COFFEE] });
        arrange(hero(ENEMY_BRUISER), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
      }),
    heroId: PLAYER_BRUISER,
    steps: [
      { slot: 2, use: "pitch" },
      { slot: 3, use: "pitch" },
      { slot: 0, use: "primary", target: ENEMY_BRUISER },
      { slot: 1, use: "primary", target: ENEMY_BRUISER },
    ],
    resolutionShotsMs: [600, 1300, 2000, 2700, 3400, 4500],
  },
  {
    name: "hidden-seen",
    description: "An enemy Assassin is Hidden inside a Site Survey area of the Squad: shown translucent with a cyan ring, an eye and the tag HIDDEN · SEEN, not unmasked.",
    buildMatch: () =>
      stage(45, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        arrange(hero("right-assassin"), { col: 14, row: 3 }, { hand: [0, 1, 2, 3] });
        hero("right-assassin").hidden = 2;
        match.revealedAreas.push({ squad: SquadId.Left, center: { col: 14, row: 3 }, size: 3, remaining: 2 });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400, 1500],
  },
  {
    name: "exhaustion",
    description: "A Bruiser with its last card in the Hand and an empty Deck and Discard becomes Exhausted at the end of the Resolution and leaves a wreck.",
    buildMatch: () =>
      stage(12, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [BRUISER_HARD_HAT], deck: [] });
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
        arrange(hero(PLAYER_BRUISER), { col: 4, row: 1 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
      }),
    heroId: PLAYER_BRUISER,
    // Row 1 and a destination without Cover in front of it: a tall prop would catch the tap instead of the tile.
    steps: [{ slot: 0, use: "move", tile: { col: 6, row: 1 } }],
    resolutionShotsMs: [800, 2500],
  },
  controllerAttack("price-tag", "The allied Controller fires Price Tag at an enemy Bruiser two tiles away: 1 damage and Marked; the player's Bruiser waits.", 22, CONTROLLER_PRICE_TAG),
  {
    name: "cover-placed-stays",
    description: "Half Cover placed by Temporary Solution stands through Resolution 1 and is still there after Resolution 2.",
    buildMatch: () =>
      stage(21, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 8, row: 3 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        placeHalfCover(match, { col: 10, row: 3 });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400, 1500, 3000],
    secondRound: { steps: [{ wait: true }], resolutionShotsMs: [400, 1500, 3000] },
  },
  {
    name: "cover-drop",
    description: "The Controller plays Temporary Solution: the crate drops onto the tile, lands and unfolds into the striped bars, which stay.",
    buildMatch: () =>
      stage(25, (hero) => {
        arrange(hero(`${SquadId.Left}-controller`), { col: 11, row: 3 }, { hand: [CONTROLLER_TEMPORARY_SOLUTION, 0, 1, 2] });
      }),
    playerHero: HeroClass.Controller,
    heroId: `${SquadId.Left}-controller`,
    steps: [
      { slot: 1, use: "pitch" },
      { slot: 0, use: "primary", tile: { col: 13, row: 3 } },
    ],
    resolutionShotsMs: [260, 330, 400, 460, 520, 580, 640, 700],
  },
  {
    name: "heavy-metal",
    description: "Tilly plays Heavy Metal on a tile in front of an enemy Bruiser: scrap rains on the 3 x 3 area, which stays violet with wire and the tag SCRAP FIELD; in the next Resolution it is still there.",
    buildMatch: () =>
      stage(46, (hero) => {
        arrange(hero(`${SquadId.Left}-controller`), { col: 11, row: 3 }, { hand: [CONTROLLER_HEAVY_METAL, 0, 1, 2] });
        arrange(hero(ENEMY_BRUISER), { col: 17, row: 3 }, ENEMIES_WITH_ATTACKS);
      }),
    playerHero: HeroClass.Controller,
    heroId: `${SquadId.Left}-controller`,
    steps: [
      { slot: 1, use: "pitch" },
      { slot: 0, use: "primary", tile: { col: 14, row: 3 } },
    ],
    resolutionShotsMs: [700, 1200, 2000, 3000],
    secondRound: { steps: [{ wait: true }], resolutionShotsMs: [400, 1500] },
  },
  {
    name: "placed-cover-marks",
    description: "Three Placed Cover tiles of the Squad carry four teal corner marks and the chip COVER ●●● 3 / 3; an enemy Placed Cover in sight is not marked.",
    buildMatch: () => stage(26, (hero, match) => controllerWithThreeCovers(match, hero, [CONTROLLER_TEMPORARY_SOLUTION, 0, 1, 2])),
    playerHero: HeroClass.Controller,
    heroId: `${SquadId.Left}-controller`,
    steps: [{ wait: true }],
    resolutionShotsMs: [400],
  },
  {
    name: "placed-cover-fourth",
    description: "The Controller plans Temporary Solution for a fourth tile: the oldest gets a dashed amber outline (OLDEST · GOES), the new tile a dashed teal one, the chip reads ●●● → 3 / 3; in the Resolution the oldest crumbles and the new Cover drops.",
    buildMatch: () => stage(27, (hero, match) => controllerWithThreeCovers(match, hero, [CONTROLLER_TEMPORARY_SOLUTION, 0, 1, 2])),
    playerHero: HeroClass.Controller,
    heroId: `${SquadId.Left}-controller`,
    steps: [
      { slot: 1, use: "pitch" },
      { slot: 0, use: "primary", tile: { col: 12, row: 2 } },
    ],
    resolutionShotsMs: [300, 600, 900, 1200, 1500, 1900, 2500],
  },
  {
    name: "scanned-by-enemy",
    description: "The enemy's Site Survey scans the area round the player's Hero: a dashed amber outline with an amber sweep and the tag SCANNED · 2 (not who looks, not what is seen).",
    buildMatch: () =>
      stage(28, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        match.revealedAreas.push({ squad: SquadId.Right, center: { col: 12, row: 3 }, size: 3, remaining: 2 });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [300, 900, 1500],
  },
  {
    name: "cover-natural",
    description: "The map's own Half and Full Cover next to the waiting Bruiser: blue shield panels on a plinth and the shield glyphs.",
    buildMatch: () =>
      stage(26, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 8, row: 3 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400],
  },
  {
    name: "cover-rest-loop",
    description: "Kit rests on a Half Cover tile while the Bruiser waits: frames over the whole Resolution show the Cover rest loop, which never stands up and crouches again (the taking of Cover over and over).",
    buildMatch: () =>
      stage(26, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 8, row: 3 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        arrange(hero(PLAYER_ASSASSIN), { col: 8, row: 2 }, { hand: [] });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [200, 500, 800, 1100, 1400, 1700, 2000, 2300, 2600, 2900],
  },
  {
    name: "zone-wall-depth",
    description: "The Prime Zone before it is active (Round 1): a Hero in front of the zone is drawn over the laser wall, a Hero inside it under the wall, and the posts at the back stand behind the core's light.",
    buildMatch: () =>
      stage(27, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 22, row: 15 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        arrange(hero(PLAYER_ASSASSIN), { col: 22, row: 13 }, { hand: [] });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400],
  },
  {
    name: "outpost-tint",
    description: "The Outposts have a yellowish tint on the floor and a border, as the Prime Zone has its own.",
    buildMatch: () =>
      stage(28, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 19, row: 3 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400],
  },
  {
    name: "cover-destroyed",
    description: "Tilly plays Urban Renewal on a Half Cover tile; the Cover is destroyed and the scorch tile stays.",
    buildMatch: () =>
      stage(22, (hero) => {
        arrange(hero(`${SquadId.Left}-controller`), { col: 6, row: 3 }, { hand: [CONTROLLER_URBAN_RENEWAL, 0, 1, 2] });
      }),
    playerHero: HeroClass.Controller,
    heroId: `${SquadId.Left}-controller`,
    steps: [
      { slot: 1, use: "pitch" },
      { slot: 0, use: "primary", tile: { col: 8, row: 2 } },
    ],
    resolutionShotsMs: [400, 1200, 2800],
  },
  {
    name: "scout-drone-area-over-time",
    description: "A Site Survey area (3 x 3, 2 Resolutions left) shows an enemy Hero behind a wall in Resolutions 1 and 2; then the fog closes.",
    buildMatch: () =>
      stage(23, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        // Behind the wall of row 5: out of sight for the Squad until the area covers it. The sighting makes it a Ghost later.
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
      stage(25, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 15, row: 2 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        // Seen 6 tiles away, then 8 tiles away on the Outpost, beyond the sight range of 7: the Squad remembers the first tile.
        hero("right-assassin").position = { col: 21, row: 2 };
        recordSightings(match);
        hero("right-assassin").position = { col: 23, row: 2 };
      }),
    heroId: PLAYER_BRUISER,
    // The enemy holds the Outpost; the Move brings it to 6 tiles.
    steps: [{ slot: 0, use: "move", tile: { col: 17, row: 2 } }],
    resolutionShotsMs: [800, 2500],
  },
  {
    name: "ghost-returns",
    description: "An enemy Assassin seen two Rounds ago is out of sight and shown as a Ghost far from where it really stands; the Bruiser then moves close enough to see it: the Ghost must not slide across the map to the real tile (frames every 300 ms).",
    buildMatch: () =>
      stage(25, (hero, match) => {
        arrange(hero(PLAYER_BRUISER), { col: 15, row: 2 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        // Seen at 21,2, then it walked on to 23,4 unseen; the Squad remembers the first tile.
        hero("right-assassin").position = { col: 21, row: 2 };
        recordSightings(match);
        hero("right-assassin").position = { col: 23, row: 4 };
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ slot: 0, use: "move", tile: { col: 17, row: 2 } }],
    resolutionShotsMs: [100, 400, 700, 1000, 1300, 1600, 1900, 2200, 2500, 3000],
  },
  {
    name: "walk-glide",
    description: "A Bruiser walks two tiles with one Move: frames inside a step show the figure between two tiles, walking from A to B.",
    buildMatch: () =>
      stage(14, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 4, row: 1 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
      }),
    heroId: PLAYER_BRUISER,
    // Row 1 and a destination without Cover in front of it: a tall prop would catch the tap instead of the tile.
    steps: [{ slot: 0, use: "move", tile: { col: 6, row: 1 } }],
    resolutionShotsMs: [150, 300, 450, 600, 850, 1100],
  },
  {
    name: "walk-glide-left",
    description: "The mirror of walk-glide: the Bruiser walks two tiles the other way and faces the way it walks, during and after the step.",
    buildMatch: () =>
      stage(14, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 6, row: 1 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ slot: 0, use: "move", tile: { col: 4, row: 1 } }],
    resolutionShotsMs: [150, 300, 450, 600, 850, 1100],
  },
  {
    name: "crossfire",
    description: "Two enemies with Attacks shoot the waiting Bruiser in consecutive Ticks: the second hit shows CROSSFIRE +1 above the damage numbers.",
    buildMatch: () =>
      stage(31, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 12, row: 3 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        // Both enemies stand in Range and in sight with Attacks in their Hands, so the AI shoots the Bruiser.
        arrange(hero("right-bruiser"), { col: 14, row: 3 }, ENEMIES_WITH_ATTACKS);
        arrange(hero("right-assassin"), { col: 15, row: 4 }, ENEMIES_WITH_ATTACKS);
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ wait: true }],
    resolutionShotsMs: [400, 900, 1400, 1900, 2600, 3200],
  },
  {
    name: "crossfire-ring",
    description: "Planning: the Bruiser and the allied Controller (Price Tag) both plan an Attack on the same enemy, so the Tick ring shows a possible Crossfire (orange segments, +1 ? chip).",
    buildMatch: () =>
      stage(31, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 4, row: 1 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        arrange(hero("left-controller"), { col: 4, row: 2 }, { hand: [CONTROLLER_PRICE_TAG, ...CONTROLLER_FILLER_CARDS] });
        arrange(hero("right-bruiser"), { col: 6, row: 1 }, ENEMIES_WITH_ATTACKS);
        arrange(hero("right-assassin"), { col: 20, row: 6 }, ENEMIES_WITH_ATTACKS);
      }),
    heroId: PLAYER_BRUISER,
    steps: [{ slot: 1, use: "pitch" }, { slot: 0, use: "primary", target: "right-bruiser" }],
    resolutionShotsMs: [400],
  },
  {
    name: "double-attack-ring",
    description: "Planning: the Bruiser attacks the same enemy in Ticks 1 and 2 and the allies are out of reach: the ring has two teal segments, no Crossfire.",
    buildMatch: () =>
      stage(31, (hero) => {
        arrange(hero(PLAYER_BRUISER), { col: 4, row: 1 }, { hand: [BRUISER_HANDLE_WITH_CARE, BRUISER_HANDLE_WITH_CARE_2, 2, 3] });
        arrange(hero("right-bruiser"), { col: 6, row: 1 }, ENEMIES_WITH_ATTACKS);
        arrange(hero("right-assassin"), { col: 20, row: 6 }, ENEMIES_WITH_ATTACKS);
      }),
    heroId: PLAYER_BRUISER,
    steps: [
      { slot: 2, use: "pitch" },
      { slot: 3, use: "pitch" },
      { slot: 0, use: "primary", target: "right-bruiser" },
      { slot: 1, use: "primary", target: "right-bruiser" },
    ],
    resolutionShotsMs: [400],
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
    else if (step.use === "move") {
      if (!step.tile) throw new Error(`${scenario.name}: a Move needs a tile`);
      queue.push({ kind: ActionKind.Move, card, destination: step.tile });
    } else queue.push({ kind: ActionKind.Primary, card, target: step.target ?? hero.id, ...(step.tile ? { tile: step.tile } : {}) });
  }
  const heroPlan: HeroPlan = { heroId: hero.id, queue, pitched };
  return { squad: hero.squad, heroes: [heroPlan] };
}
