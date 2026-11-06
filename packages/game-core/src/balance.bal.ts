// Balance harness: `npm run balance` plays many AI-versus-AI matches for every variant below and prints one table, so a
// change of a number (card damage, Deck size, ...) can be judged by the same seeds before and after.
//   BALANCE_SEEDS=500   matches per variant (default 300)
//   BALANCE_ONLY=name   run only the variants whose name contains this text (the baseline always runs)
//   BALANCE_SEED_OFFSET=1000   first seed minus one, to repeat a table with other matches
// Each setting can also be given as an npm flag, which a command that must not start with a variable (the software
// factory allows only `npm ...` commands) can use: `npm run balance --balance-seeds=200 --balance-only=style`.
// A variant is a set of data-level tweaks. They are applied to the card data and the Match State around the real rules,
// never inside them, so the harness changes no rule. A rule that needs code (for example a new Prime Zone rule) is tried
// on a branch and measured with the same table. The AI is the measuring instrument, not a player: read its numbers as
// comparisons between variants.

import { it, vi } from "vitest";
import { AiStyle, aiStyleFor, planSquad } from "./ai";
import { CardTarget, CardType, EffectKind, HERO_DECKS, HeroClass } from "./cards";
import { type AttackAndDefendRules, EventKind, MatchEndReason, MatchMode, type MatchModeSetting, ROUND_LIMIT, SquadId, ZoneTie } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { ActionKind, type HeroPlan, type SquadPlan } from "./plan";
import { resolveRound } from "./resolution";

// `BLOCK_SHIELD` is a constant of plan.ts that the rules read, so the harness cannot assign it. The mock below makes the
// imported binding read a value the harness sets for the variant (the `blockShield` tweak). This changes no rule and no
// shipped file; a variant that does not set it gets the real value.
const block = vi.hoisted(() => ({ shield: undefined as number | undefined }));
vi.mock("./plan", async (importOriginal) => {
  const original = await importOriginal<typeof import("./plan")>();
  return Object.defineProperty({ ...original }, "BLOCK_SHIELD", { get: () => block.shield ?? original.BLOCK_SHIELD, enumerable: true });
});

interface Tweaks {
  /** Damage of the Damage effect of the named cards. */
  cardDamage?: Record<string, number>;
  /** Energy cost of the named cards. */
  cardCost?: Record<string, number>;
  /** Range of the named cards. */
  cardRange?: Record<string, number>;
  /** Every Hero starts with this permanent Attack bonus. */
  attackBonus?: number;
  /** Cards cut from the top of every Deck before the match. */
  deckCut?: number;
  /** Pitched cards go to the Exile instead of the Discard. */
  pitchExile?: boolean;
  /** Cards every living Hero loses from the Deck to the Exile after each Resolution. */
  fatiguePerRound?: number;
  /** Plays Attack and Defend with these rules instead of the classic mode (the Defender side alternates by seed parity). */
  attackAndDefend?: AttackAndDefendRules;
  /** Shield a Block creates instead of the real value (2). */
  blockShield?: number;
  /** AI Styles of the Left and Right Squad; without it both play the default (Balanced) Style. "seeded" takes them from the match seed. */
  styles?: readonly [AiStyle, AiStyle] | "seeded";
}

const squadStyle = (tweaks: Tweaks, match: MatchState, squad: SquadId): AiStyle =>
  tweaks.styles === "seeded"
    ? aiStyleFor(match.seed, squad)
    : (tweaks.styles?.[squad === SquadId.Left ? 0 : 1] ?? AiStyle.Balanced);

/** Every ordered pair of AI Styles, to see how a Style fares against the default and against each other. */
function styleVariants(): Record<string, Tweaks> {
  const variants: Record<string, Tweaks> = { "style: from seed": { styles: "seeded" } };
  const all = Object.values(AiStyle);
  for (const left of all) {
    for (const right of all) {
      if (left !== AiStyle.Balanced || right !== AiStyle.Balanced) variants[`style: ${left} (L) vs ${right} (R)`] = { styles: [left, right] };
    }
  }
  return variants;
}

const CLASSIC_VARIANTS: Record<string, Tweaks> = {
  baseline: {},
  "damage +1": { attackBonus: 1 },
  "Deck 9": { deckCut: 3 },
  "Pitch exiles": { pitchExile: true },
  "Deck 9 + Pitch exiles": { deckCut: 3, pitchExile: true },
  block1: { blockShield: 1 },
  "attacks cost 2": { cardCost: { "Slam Shot": 2, "Pulse Bolt": 2, "Precision Shot": 2 } },
};

const DATA_TWEAKS: Record<string, Tweaks> = {
  "": {},
  " + Deck 9": { deckCut: 3 },
  " + Pitch exiles": { pitchExile: true },
};

/** Attack and Defend: Round limit x tie rule x Zone Decay, each with the data-level tweaks. */
function attackAndDefendVariants(): Record<string, Tweaks> {
  const variants: Record<string, Tweaks> = {};
  for (const [suffix, data] of Object.entries(DATA_TWEAKS)) {
    for (const roundLimit of [10, 12, 14]) {
      for (const zoneTie of [ZoneTie.Attacker, ZoneTie.Defender]) {
        for (const zoneDecay of [0, 1, 2]) {
          variants[`A&D limit ${roundLimit}, tie ${zoneTie}, decay ${zoneDecay}${suffix}`] = {
            ...data,
            attackAndDefend: { roundLimit, zoneTie, zoneDecay },
          };
        }
      }
    }
  }
  return variants;
}

const VARIANTS: Record<string, Tweaks> = { ...CLASSIC_VARIANTS, ...styleVariants(), ...attackAndDefendVariants() };

/** What a match should feel like; the table marks a column that misses its target. */
const TARGETS = {
  roundsMin: 8,
  roundsMax: 12,
  stallsMaxPercent: 2,
  exhaustionMinPercent: 30,
  sideSpreadMaxPercent: 5,
  attackerWinMinPercent: 40,
  attackerWinMaxPercent: 60,
};

/** The Defender is the Left Squad in matches with an even seed and the Right Squad in matches with an odd seed. */
const defenderOf = (seed: number) => (seed % 2 === 0 ? SquadId.Left : SquadId.Right);

const cardsOf = () => [...new Set(Object.values(HERO_DECKS).flatMap((deck) => [...deck]))];

function applyCardTweaks(tweaks: Tweaks): () => void {
  const cards = cardsOf();
  const original = cards.map((card) => structuredClone(card));
  block.shield = tweaks.blockShield;
  for (const card of cards) {
    const target = card as unknown as { energyCost: number; range?: number; effects: { kind: EffectKind; amount?: number }[] };
    if (tweaks.cardCost?.[card.name] !== undefined) target.energyCost = tweaks.cardCost[card.name]!;
    if (tweaks.cardRange?.[card.name] !== undefined) target.range = tweaks.cardRange[card.name]!;
    const damage = tweaks.cardDamage?.[card.name];
    if (damage !== undefined) for (const effect of target.effects) if (effect.kind === EffectKind.Damage) effect.amount = damage;
  }
  return () => {
    block.shield = undefined;
    cards.forEach((card, index) => Object.assign(card, original[index]));
  };
}

// "Exposed Hero": a staged situation, not a match. A Hero of the Left Squad stands on a Prime Zone tile and does not move
// away; a Bruiser and an Assassin of the Right Squad stand two tiles from it, in Range and Line of Sight, and attack it
// with as many Attack cards as their Hand and Pitch allow in every Round. The other Heroes plan nothing.
const EXPOSED_TILE = { col: 14, row: 8 };
const ENEMY_TILES = [{ col: 16, row: 7 }, { col: 16, row: 9 }];
const ENEMY_CLASSES = [HeroClass.Bruiser, HeroClass.Assassin];
const EXPOSED_ROUND_CAP = 10;

/** The most Attack cards of the Hand that the Energy of the other Hand cards pays for (Pitch gives 1 Energy per card). */
function attackPlan(match: MatchState, heroId: string, target: string): HeroPlan {
  const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
  const cards = HERO_DECKS[hero.heroClass];
  const attacks = hero.hand
    .filter((card) => cards[card]!.type === CardType.Attack && cards[card]!.target === CardTarget.VisibleEnemy)
    .sort((a, b) => cards[a]!.energyCost - cards[b]!.energyCost);
  for (let count = attacks.length; count > 0; count--) {
    const chosen = attacks.slice(0, count);
    const cost = chosen.reduce((sum, card) => sum + cards[card]!.energyCost, 0);
    const rest = hero.hand.filter((card) => !chosen.includes(card));
    if (rest.length >= cost) {
      const queue = chosen.map((card) => ({ kind: ActionKind.Primary as const, card, target }));
      return { heroId, queue, pitched: rest.slice(0, cost) };
    }
  }
  return { heroId, queue: [] };
}

/** Gives the enemy a freshly shuffled full Deck except for its Hand, so that it can attack every Round instead of running out of cards. */
function refillEnemy(match: MatchState, heroId: string, salt: number): void {
  const hero = match.heroes.find((candidate) => candidate.id === heroId)!;
  const deck = HERO_DECKS[hero.heroClass].map((_, index) => index).filter((card) => !hero.hand.includes(card));
  let state = (match.seed * 7919 + salt * 104729) >>> 0;
  for (let i = deck.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  Object.assign(hero, { deck, discard: [], exile: [], exhausted: false });
}

/** Rounds until the exposed Hero is Exhausted (the cap if it survives), with or without a Block in the first Tick of every Round. */
function exposedRounds(seed: number, heroClass: HeroClass, blocks: boolean): { rounds: number; exhausted: boolean } {
  const created = createMatch(seed);
  const exposedId = `${SquadId.Left}-${heroClass}`;
  created.heroes.find((hero) => hero.id === exposedId)!.position = { ...EXPOSED_TILE };
  ENEMY_CLASSES.forEach((enemyClass, i) => {
    created.heroes.find((hero) => hero.id === `${SquadId.Right}-${enemyClass}`)!.position = { ...ENEMY_TILES[i]! };
  });
  let match = startRound(created);
  for (let round = 1; round <= EXPOSED_ROUND_CAP; round++) {
    const exposed = match.heroes.find((hero) => hero.id === exposedId)!;
    const left: HeroPlan[] = blocks ? [{ heroId: exposedId, queue: [{ kind: ActionKind.Block, card: exposed.hand[0]! }] }] : [];
    const right = ENEMY_CLASSES.map((enemyClass) => `${SquadId.Right}-${enemyClass}`).map((id) => attackPlan(match, id, exposedId));
    const resolution = resolveRound(match, [
      { squad: SquadId.Left, heroes: left },
      { squad: SquadId.Right, heroes: right },
    ]);
    if (resolution.events.some((event) => event.kind === EventKind.Exhausted && event.heroId === exposedId)) return { rounds: round, exhausted: true };
    // Two enemies in the Zone against one Hero would end the match by Prime Zone hold: this situation measures Exhaustion only.
    match = { ...resolution.match, result: undefined, primeZone: { progress: 0 } };
    // The enemies are the constant of this measurement: give them Decks again, then draw a new Hand for everyone.
    ENEMY_CLASSES.forEach((enemyClass) => refillEnemy(match, `${SquadId.Right}-${enemyClass}`, round));
    match = startRound(match);
  }
  return { rounds: EXPOSED_ROUND_CAP, exhausted: false };
}

/** Mean Rounds until Exhaustion per Hero class and case; Heroes that survive the cap count as the cap and are counted next to it. */
function exposedCells(seeds: number, offset: number): string[] {
  return Object.values(HeroClass).flatMap((heroClass) =>
    [false, true].map((blocks) => {
      const results = Array.from({ length: seeds }, (_, i) => exposedRounds(offset + i + 1, heroClass, blocks));
      const mean = results.reduce((sum, result) => sum + result.rounds, 0) / seeds;
      const survived = results.filter((result) => !result.exhausted).length;
      return survived > 0 ? `${mean.toFixed(1)} (${survived} survive)` : mean.toFixed(1);
    }),
  );
}

interface Totals {
  rounds: number[];
  stalls: number;
  zoneEnds: number;
  exhaustedMatches: number;
  exhaustedHeroes: number;
  hits: number;
  damage: number;
  leftWins: number;
  rightWins: number;
  /** Attack and Defend: matches the Attacker won, matches Defence Held, Exhaustions of Defender Heroes. */
  attackerWins: number;
  defenceHeld: number;
  defenderExhaustions: number;
  /** Matches the Attacker won, by the Defender side (Left, Right), and the matches played per side. */
  attackerWinsByDefender: Record<SquadId, number>;
  matchesByDefender: Record<SquadId, number>;
}

function prepareMatch(seed: number, tweaks: Tweaks): MatchState {
  const mode: MatchModeSetting = tweaks.attackAndDefend
    ? { kind: MatchMode.AttackAndDefend, defender: defenderOf(seed), ...tweaks.attackAndDefend }
    : { kind: MatchMode.Classic };
  const created = createMatch(seed, mode);
  // Half of the matches start one Round later (the AI yields by Round parity). In Attack and Defend the seed parity
  // already picks the Defender side, so the first Round follows the next bit to keep the two apart.
  created.round = (tweaks.attackAndDefend ? Math.floor(seed / 2) : seed) % 2 === 0 ? 0 : 1;
  for (const hero of created.heroes) {
    if (tweaks.attackBonus) hero.attackBonus = tweaks.attackBonus;
    if (tweaks.deckCut) hero.deck = hero.deck.slice(tweaks.deckCut);
  }
  return startRound(created);
}

/** Pitched cards go to the Exile instead of the Discard. */
function exilePitchedCards(next: MatchState, plans: SquadPlan[]): void {
  for (const hero of next.heroes) {
    const pitched = plans.flatMap((plan) => plan.heroes).find((plan) => plan.heroId === hero.id)?.pitched ?? [];
    for (const card of pitched) {
      const at = hero.discard.indexOf(card);
      if (at >= 0) hero.exile.push(...hero.discard.splice(at, 1));
    }
  }
}

function applyFatigue(next: MatchState, cards: number): void {
  for (const hero of next.heroes.filter((candidate) => !candidate.exhausted)) {
    for (let i = 0; i < cards && hero.deck.length > 0; i++) hero.exile.push(hero.deck.pop()!);
  }
}

/** Plays one Round, adds its attack hits to the totals and returns the next Match State and the Exhaustion events. */
function playRound(match: MatchState, tweaks: Tweaks, totals: Totals): { match: MatchState; exhausted: number } {
  const plans = [SquadId.Left, SquadId.Right].map((squad) => planSquad(buildSquadView(match, squad), undefined, squadStyle(tweaks, match, squad)));
  const resolution = resolveRound(match, plans);
  const defender = match.mode.kind === MatchMode.AttackAndDefend ? match.mode.defender : undefined;
  let exhausted = 0;
  let previous: (typeof resolution.events)[number] | undefined;
  for (const event of resolution.events) {
    if (event.kind === EventKind.AttackHit) {
      // An Attack that empties the Deck gives two AttackHit events (before and after the shuffle): count it once.
      const secondHalf = previous?.kind === EventKind.DeckShuffled && previous.heroId === event.targetId;
      if (!secondHalf) totals.hits++;
      totals.damage += event.damage ?? 0;
    }
    previous = event;
    if (event.kind === EventKind.Exhausted) {
      exhausted++;
      if (match.heroes.find((hero) => hero.id === event.heroId)?.squad === defender) totals.defenderExhaustions++;
    }
  }
  const next = resolution.match;
  if (tweaks.pitchExile) exilePitchedCards(next, plans);
  if (tweaks.fatiguePerRound && !next.result) applyFatigue(next, tweaks.fatiguePerRound);
  return { match: next.result ? next : startRound(next), exhausted };
}

function recordTotals(match: MatchState, exhausted: number, totals: Totals): void {
  totals.rounds.push(match.round);
  const reason = match.result?.reason;
  if (reason === MatchEndReason.PrimeZoneHeld) totals.zoneEnds++;
  if (reason === MatchEndReason.RoundLimit || !reason) totals.stalls++;
  if (exhausted > 0) totals.exhaustedMatches++;
  totals.exhaustedHeroes += exhausted;
  if (match.result?.winner === SquadId.Left) totals.leftWins++;
  if (match.result?.winner === SquadId.Right) totals.rightWins++;
  if (match.mode.kind !== MatchMode.AttackAndDefend) return;
  const { defender } = match.mode;
  const attackerWon = match.result?.winner !== undefined && match.result.winner !== defender;
  if (attackerWon) {
    totals.attackerWins++;
    totals.attackerWinsByDefender[defender]++;
  }
  if (reason === MatchEndReason.DefenceHeld) totals.defenceHeld++;
  totals.matchesByDefender[defender]++;
}

function playMatch(seed: number, tweaks: Tweaks, totals: Totals): void {
  let match = prepareMatch(seed, tweaks);
  let exhausted = 0;
  for (let round = 1; round <= ROUND_LIMIT * 2 && !match.result; round++) {
    const played = playRound(match, tweaks, totals);
    match = played.match;
    exhausted += played.exhausted;
  }
  recordTotals(match, exhausted, totals);
}

/** A setting from `BALANCE_<NAME>` or from the npm flag `--balance-<name>` (npm passes it on as `npm_config_balance_<name>`). */
const setting = (name: string): string | undefined => process.env[`BALANCE_${name.toUpperCase()}`] ?? process.env[`npm_config_balance_${name}`];

const pad = (text: string, width: number) => text.padEnd(width);

/** Plays the matches of one variant and, for the classic mode, the staged exposed-Hero Rounds, with the variant's tweaks applied. */
function playVariant(tweaks: Tweaks, seeds: number, offset: number): { totals: Totals; exposed?: string[] } {
  const restore = applyCardTweaks(tweaks);
  const totals: Totals = {
    rounds: [],
    stalls: 0,
    zoneEnds: 0,
    exhaustedMatches: 0,
    exhaustedHeroes: 0,
    hits: 0,
    damage: 0,
    leftWins: 0,
    rightWins: 0,
    attackerWins: 0,
    defenceHeld: 0,
    defenderExhaustions: 0,
    attackerWinsByDefender: { [SquadId.Left]: 0, [SquadId.Right]: 0 },
    matchesByDefender: { [SquadId.Left]: 0, [SquadId.Right]: 0 },
  };
  try {
    for (let seed = offset + 1; seed <= offset + seeds; seed++) playMatch(seed, tweaks, totals);
    // The staged situation does not depend on the AI Style or the mode: measure it once per data-level variant.
    const staged = !tweaks.attackAndDefend && !tweaks.styles;
    return { totals, exposed: staged ? exposedCells(seeds, offset) : undefined };
  } finally {
    restore();
  }
}

it("prints one table for all variants", async () => {
  const seeds = Number(setting("seeds") ?? 300);
  const only = setting("only");
  const rows: string[][] = [];
  const exposedRows: string[][] = [];
  const offset = Number(setting("seed_offset") ?? 0);
  for (const [name, tweaks] of Object.entries(VARIANTS)) {
    if (name !== "baseline" && only && !name.includes(only)) continue;
    // A variant takes seconds of synchronous work: yield so that the test runner can keep talking to its worker.
    // eslint-disable-next-line no-restricted-globals -- the harness runs in Node, only the shipped code must avoid browser APIs
    await new Promise((resolve) => setTimeout(resolve, 0));
    const { totals, exposed } = playVariant(tweaks, seeds, offset);
    if (exposed) exposedRows.push([name, ...exposed]);
    const percent = (count: number) => (count / seeds) * 100;
    const averageRounds = totals.rounds.reduce((sum, round) => sum + round, 0) / seeds;
    const stalls = percent(totals.stalls);
    const exhaustion = percent(totals.exhaustedMatches);
    const decided = totals.leftWins + totals.rightWins;
    const spread = decided === 0 ? 0 : Math.abs(percent(totals.leftWins) - percent(totals.rightWins));
    const mark = (ok: boolean) => (ok ? "" : " !");
    const modeColumns = (): string[] => {
      if (!tweaks.attackAndDefend) return ["-", "-", "-", "-"];
      const attackerWin = percent(totals.attackerWins);
      const share = (count: number, of: number) => (of === 0 ? 0 : (count / of) * 100);
      const bySide = (side: SquadId) => share(totals.attackerWinsByDefender[side], totals.matchesByDefender[side]);
      const sideSpread = Math.abs(bySide(SquadId.Left) - bySide(SquadId.Right));
      const defenderShare = share(totals.defenderExhaustions, totals.exhaustedHeroes);
      return [
        `${attackerWin.toFixed(0)}%${mark(attackerWin >= TARGETS.attackerWinMinPercent && attackerWin <= TARGETS.attackerWinMaxPercent)}`,
        `${percent(totals.defenceHeld).toFixed(0)}%`,
        `${defenderShare.toFixed(0)}%`,
        `${sideSpread.toFixed(0)}%${mark(sideSpread <= TARGETS.sideSpreadMaxPercent)}`,
      ];
    };
    rows.push([
      name,
      `${averageRounds.toFixed(1)}${mark(averageRounds >= TARGETS.roundsMin && averageRounds <= TARGETS.roundsMax)}`,
      `${stalls.toFixed(0)}%${mark(stalls <= TARGETS.stallsMaxPercent)}`,
      `${percent(totals.zoneEnds).toFixed(0)}%`,
      `${exhaustion.toFixed(0)}%${mark(exhaustion >= TARGETS.exhaustionMinPercent)}`,
      (totals.exhaustedHeroes / seeds).toFixed(2),
      (totals.hits / seeds).toFixed(0),
      (totals.damage / seeds).toFixed(1),
      `${spread.toFixed(0)}%${mark(spread <= TARGETS.sideSpreadMaxPercent)}`,
      `${percent(totals.leftWins).toFixed(0)}%`,
      `${percent(totals.rightWins).toFixed(0)}%`,
      ...modeColumns(),
    ]);
  }
  const header = [
    "variant", "rounds", "stalls", "zone win", "w/ exhaustion", "exh. heroes", "hits", "damage", "L/R spread", "L wins", "R wins",
    "attacker win", "defence held", "exh. on Defender", "Defender side spread",
  ];
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column]!.length)));
  const line = (cells: string[]) => cells.map((cell, column) => pad(cell, widths[column]!)).join("  ");
  console.log(`\n${seeds} matches per variant, AI against AI. "!" = misses its target (rounds ${TARGETS.roundsMin}-${TARGETS.roundsMax}, stalls <= ${TARGETS.stallsMaxPercent}%, exhaustion >= ${TARGETS.exhaustionMinPercent}%, side spread <= ${TARGETS.sideSpreadMaxPercent}%)`);
  console.log(line(header));
  rows.forEach((row) => console.log(line(row)));
  const exposedHeader = ["exposed Hero, mean Rounds", ...Object.values(HeroClass).flatMap((heroClass) => [`${heroClass} no Block`, `${heroClass} Block`])];
  const exposedWidths = exposedHeader.map((title, column) => Math.max(title.length, ...exposedRows.map((row) => row[column]!.length)));
  const exposedLine = (cells: string[]) => cells.map((cell, column) => pad(cell, exposedWidths[column]!)).join("  ");
  console.log(`\nExposed Hero: a Left Hero on a Prime Zone tile, a Bruiser and an Assassin two tiles away attack it every Round. Mean Rounds until Exhausted (targets: 2 without Block, 3-4 with Block; cap ${EXPOSED_ROUND_CAP})`);
  console.log(exposedLine(exposedHeader));
  exposedRows.forEach((row) => console.log(exposedLine(row)));
});

