// Balance harness: `npm run balance` plays many AI-versus-AI matches for every variant below and prints one table, so a
// change of a number (card damage, Deck size, ...) can be judged by the same seeds before and after.
//   BALANCE_SEEDS=500   matches per variant (default 300)
//   BALANCE_ONLY=name   run only the variants whose name contains this text (the baseline always runs)
// A variant is a set of data-level tweaks. They are applied to the card data and the Match State around the real rules,
// never inside them, so the harness changes no rule. A rule that needs code (for example a new Prime Zone rule) is tried
// on a branch and measured with the same table. The AI is the measuring instrument, not a player: read its numbers as
// comparisons between variants.

import { it } from "vitest";
import { planSquad } from "./ai";
import { DEFAULT_EXPERIMENT, type Experiment, experiment } from "./experiment";
import { EffectKind, HERO_DECKS } from "./cards";
import { EventKind, MatchEndReason, ROUND_LIMIT, SquadId } from "./host";
import { buildSquadView, createMatch, type MatchState, startRound } from "./match";
import { resolveRound } from "./resolution";

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
  /** EXPERIMENT rule switches (see experiment.ts); `defender` here is true: the Defender alternates by seed parity. */
  rules?: Partial<Omit<Experiment, "defender">> & { defender?: boolean };
}

const VARIANTS: Record<string, Tweaks> = {
  baseline: {},
  "damage +1": { attackBonus: 1 },
  "Deck 9": { deckCut: 3 },
  "Pitch exiles": { pitchExile: true },
  "Deck 9 + Pitch exiles": { deckCut: 3, pitchExile: true },
  "attacks cost 2": { cardCost: { "Slam Shot": 2, "Pulse Bolt": 2, "Precision Shot": 2 } },
  "1 zone decay": { rules: { zoneDecay: true } },
  "2 hold needs pitch (AI pitches)": { rules: { holdNeedsPitch: true, aiPitchInZone: true } },
  "2b hold needs pitch (AI does not)": { rules: { holdNeedsPitch: true } },
  "3 defender (R10)": { rules: { defender: true } },
  "3b defender, attacker wins ties": { rules: { defender: true, attackerWinsTies: true } },
  "3c defender R14, attacker ties": { rules: { defender: true, attackerWinsTies: true, defenderRounds: 14 } },
  "1+2": { rules: { zoneDecay: true, holdNeedsPitch: true, aiPitchInZone: true } },
  "1+Deck 9+Pitch exiles": { rules: { zoneDecay: true }, deckCut: 3, pitchExile: true },
  "2+Deck 9+Pitch exiles": { rules: { holdNeedsPitch: true, aiPitchInZone: true }, deckCut: 3, pitchExile: true },
  "1+2+Deck 9+Pitch exiles": { rules: { zoneDecay: true, holdNeedsPitch: true, aiPitchInZone: true }, deckCut: 3, pitchExile: true },
  "3b+1": { rules: { defender: true, attackerWinsTies: true, zoneDecay: true } },
  "1x2 zone decay 2": { rules: { zoneDecay: true, zoneDecayAmount: 2 } },
  "roles AI": { rules: { aiRoles: true } },
  "roles AI + 1": { rules: { aiRoles: true, zoneDecay: true } },
  "roles AI + 1x2": { rules: { aiRoles: true, zoneDecay: true, zoneDecayAmount: 2 } },
  "roles AI + 1+2": { rules: { aiRoles: true, zoneDecay: true, holdNeedsPitch: true, aiPitchInZone: true } },
  "roles AI + 2": { rules: { aiRoles: true, holdNeedsPitch: true, aiPitchInZone: true } },
  "roles AI + 3b": { rules: { aiRoles: true, defender: true, attackerWinsTies: true } },
  "roles AI + 3b+1": { rules: { aiRoles: true, defender: true, attackerWinsTies: true, zoneDecay: true } },
  "roles AI + 1+Deck 9+Pitch exiles": { rules: { aiRoles: true, zoneDecay: true }, deckCut: 3, pitchExile: true },
  "roles AI + 1+2+Deck 9+Pitch exiles": { rules: { aiRoles: true, zoneDecay: true, holdNeedsPitch: true, aiPitchInZone: true }, deckCut: 3, pitchExile: true },
  "3b+Deck 9+Pitch exiles": { rules: { defender: true, attackerWinsTies: true }, deckCut: 3, pitchExile: true },
  "3b+1+Deck 9+Pitch exiles": { rules: { defender: true, attackerWinsTies: true, zoneDecay: true }, deckCut: 3, pitchExile: true },
};

/** What a match should feel like; the table marks a column that misses its target. */
const TARGETS = {
  roundsMin: 8,
  roundsMax: 12,
  stallsMaxPercent: 2,
  exhaustionMinPercent: 30,
  sideSpreadMaxPercent: 5,
};

const cardsOf = () => [...new Set(Object.values(HERO_DECKS).flatMap((deck) => [...deck]))];

function applyCardTweaks(tweaks: Tweaks): () => void {
  const cards = cardsOf();
  const original = cards.map((card) => structuredClone(card));
  for (const card of cards) {
    const target = card as unknown as { energyCost: number; range?: number; effects: { kind: EffectKind; amount?: number }[] };
    if (tweaks.cardCost?.[card.name] !== undefined) target.energyCost = tweaks.cardCost[card.name]!;
    if (tweaks.cardRange?.[card.name] !== undefined) target.range = tweaks.cardRange[card.name]!;
    const damage = tweaks.cardDamage?.[card.name];
    if (damage !== undefined) for (const effect of target.effects) if (effect.kind === EffectKind.Damage) effect.amount = damage;
  }
  return () => cards.forEach((card, index) => Object.assign(card, original[index]));
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
  defenceHeld: number;
  attackerWins: number;
}

function playMatch(seed: number, tweaks: Tweaks, totals: Totals): void {
  const created = createMatch(seed);
  created.round = seed % 2 === 0 ? 0 : 1; // half of the matches start one Round later (the AI yields by Round parity)
  const { defender: defends, ...rules } = tweaks.rules ?? {};
  Object.assign(experiment, DEFAULT_EXPERIMENT, rules);
  experiment.defender = defends ? (seed % 2 === 0 ? SquadId.Left : SquadId.Right) : undefined;
  if (experiment.defender) {
    const col = experiment.defender === SquadId.Left ? 14 : 16;
    created.heroes.filter((hero) => hero.squad === experiment.defender).forEach((hero, i) => (hero.position = { col, row: 7 + i }));
  }
  for (const hero of created.heroes) {
    if (tweaks.attackBonus) hero.attackBonus = tweaks.attackBonus;
    if (tweaks.deckCut) hero.deck = hero.deck.slice(tweaks.deckCut);
  }
  let match: MatchState = startRound(created);
  let exhausted = 0;
  for (let round = 1; round <= ROUND_LIMIT * 2 && !match.result; round++) {
    const plans = [SquadId.Left, SquadId.Right].map((squad) => planSquad(buildSquadView(match, squad)));
    const resolution = resolveRound(match, plans);
    for (const event of resolution.events) {
      if (event.kind === EventKind.AttackHit) {
        totals.hits++;
        totals.damage += event.damage ?? 0;
      }
      if (event.kind === EventKind.Exhausted) exhausted++;
    }
    const next = resolution.match;
    if (tweaks.pitchExile) {
      for (const hero of next.heroes) {
        const pitched = plans.flatMap((plan) => plan.heroes).find((plan) => plan.heroId === hero.id)?.pitched ?? [];
        for (const card of pitched) {
          const at = hero.discard.indexOf(card);
          if (at >= 0) hero.exile.push(...hero.discard.splice(at, 1));
        }
      }
    }
    if (tweaks.fatiguePerRound && !next.result) {
      for (const hero of next.heroes.filter((candidate) => !candidate.exhausted)) {
        for (let i = 0; i < tweaks.fatiguePerRound && hero.deck.length > 0; i++) hero.exile.push(hero.deck.pop()!);
      }
    }
    match = next.result ? next : startRound(next);
  }
  totals.rounds.push(match.round);
  const reason = match.result?.reason;
  if (reason === MatchEndReason.PrimeZoneHeld) totals.zoneEnds++;
  if (reason === MatchEndReason.RoundLimit || !reason) totals.stalls++;
  if (reason === MatchEndReason.DefenceHeld) totals.defenceHeld++;
  if (experiment.defender && match.result?.winner && match.result.winner !== experiment.defender) totals.attackerWins++;
  Object.assign(experiment, DEFAULT_EXPERIMENT);
  if (exhausted > 0) totals.exhaustedMatches++;
  totals.exhaustedHeroes += exhausted;
  if (match.result?.winner === SquadId.Left) totals.leftWins++;
  if (match.result?.winner === SquadId.Right) totals.rightWins++;
}

const pad = (text: string, width: number) => text.padEnd(width);

it("prints one table for all variants", () => {
  const seeds = Number(process.env.BALANCE_SEEDS ?? 300);
  const only = process.env.BALANCE_ONLY;
  const rows: string[][] = [];
  for (const [name, tweaks] of Object.entries(VARIANTS)) {
    if (name !== "baseline" && only && !name.includes(only)) continue;
    const restore = applyCardTweaks(tweaks);
    const totals: Totals = { rounds: [], stalls: 0, zoneEnds: 0, exhaustedMatches: 0, exhaustedHeroes: 0, hits: 0, damage: 0, leftWins: 0, rightWins: 0, defenceHeld: 0, attackerWins: 0 };
    try {
      for (let seed = 1; seed <= seeds; seed++) playMatch(seed, tweaks, totals);
    } finally {
      restore();
    }
    const percent = (count: number) => (count / seeds) * 100;
    const averageRounds = totals.rounds.reduce((sum, round) => sum + round, 0) / seeds;
    const stalls = percent(totals.stalls);
    const exhaustion = percent(totals.exhaustedMatches);
    const decided = totals.leftWins + totals.rightWins;
    const spread = decided === 0 ? 0 : Math.abs(percent(totals.leftWins) - percent(totals.rightWins));
    const mark = (ok: boolean) => (ok ? "" : " !");
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
      tweaks.rules?.defender ? `${percent(totals.attackerWins).toFixed(0)}% / ${percent(totals.defenceHeld).toFixed(0)}%` : "",
    ]);
  }
  const header = ["variant", "rounds", "stalls", "zone win", "w/ exhaustion", "exh. heroes", "hits", "damage", "L/R spread", "att.win/def.timeout"];
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column]!.length)));
  const line = (cells: string[]) => cells.map((cell, column) => pad(cell, widths[column]!)).join("  ");
  console.log(`\n${seeds} matches per variant, AI against AI. "!" = misses its target (rounds ${TARGETS.roundsMin}-${TARGETS.roundsMax}, stalls <= ${TARGETS.stallsMaxPercent}%, exhaustion >= ${TARGETS.exhaustionMinPercent}%, side spread <= ${TARGETS.sideSpreadMaxPercent}%)`);
  console.log(line(header));
  rows.forEach((row) => console.log(line(row)));
});

