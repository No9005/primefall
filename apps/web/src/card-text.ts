import type { CardDefinition } from "game-core";
import { describeEffects } from "./planning-selection";

// The text on the face of a card (docs/design/cards/): the rules text with its keywords coloured, and the flavour line.
// Written as in the reference page; a card without a designed text shows the text built from its effects, and no flavour.

/** A keyword colour of the text box: `dmg`, `shield`, `slow`, `ghost`, `energy`, `scrap`, `cover`, `marked`. */
export type KeywordKind = "dmg" | "shield" | "slow" | "ghost" | "energy" | "scrap" | "cover" | "marked" | "hid";

export type TextRun = string | { keyword: KeywordKind; text: string };

interface DesignedText {
  /** The text with `<b class="kind">...</b>` around the keywords. */
  text: string;
  flavor: string;
}

const DESIGNED: Readonly<Record<string, DesignedText>> = {
  "Buy One, Get Two": { text: 'Range 1 to 2. Deal <b class="dmg">2 damage</b> twice. <b class="dmg">+1 damage</b> each time at Range 1.', flavor: "Limit: your face." },
  "Handle With Care": { text: 'Range 1 to 2. Deal <b class="dmg">2 damage</b>. <b class="dmg">+1 damage</b> at Range 1.', flavor: "He did not." },
  "Time for Coffee": { text: 'Range 3. Deal <b class="dmg">1 damage</b>. Apply <b class="slow">Slow</b>.', flavor: "Fifteen-minute break. Mandatory." },
  "Express Delivery": { text: 'Gain <b class="shield">2 Shield</b>. Then move up to 5 tiles to an enemy Hero.', flavor: "Signature required." },
  "Hard Hat": { text: 'Gain <b class="shield">2 Shield</b>.', flavor: "Safety is no accident." },
  "Cargo Hook": { text: 'Range 7. Pull an enemy Hero next to you. Can target a <b class="ghost">Ghost</b>.', flavor: "Heavy load. Handle accordingly." },
  "Temporary Solution": { text: 'Range 5. Place <b class="cover">Half Cover</b> on an empty tile (at most 3 at once). <b class="scrap">Scrap:</b> Full Cover instead.', flavor: "Nothing lasts like a temporary fix." },
  "Site Survey": { text: 'Reveal a 3×3 area anywhere on the map for 3 Resolutions. <b class="scrap">Scrap:</b> 5×5.', flavor: "Results may vary." },
  "Urban Renewal": { text: 'Range 4. Deal <b class="dmg">2 damage</b> to every Hero in a 3×3 area and destroy all Cover in it.', flavor: "Out with the old. Along with the tenants." },
  "Heavy Metal": {
    text: 'Range 4. A 3×3 area until the end of the next Resolution: a Move that starts in it is <b class="slow">Slowed</b>, and each Move through it costs <b class="dmg">1 damage</b>. <b class="scrap">Scrap:</b> +1 Resolution.',
    flavor: "Mosh pit rules: don't move.",
  },
  "Price Tag": { text: 'Range 3. Deal <b class="dmg">1 damage</b>. <b class="marked">Marked:</b> hits on it deal +1 damage until the end of the next Resolution. <b class="scrap">Scrap:</b> +1 damage.', flavor: "Everything has one." },
  "Long Shot": { text: 'Range 3 to 7. Deal <b class="dmg">3 damage</b>.<br><b class="hid">Hidden</b> or <b class="marked">Marked</b>: up to Range 9. <b class="hid">Hidden</b>: <b class="dmg">+1 damage</b> beyond 7.', flavor: "Distance is a feature." },
  Vanish: { text: 'Become <b class="hid">Hidden</b> for 2 Resolutions, wherever you stand. Taking damage or shooting ends it.', flavor: "Last seen: never." },
  "Personal Space": { text: 'Range 1 to 2. Deal <b class="dmg">1 damage</b>. Push the target up to <b class="energy">3 tiles</b> away from you.', flavor: "Keep your distance. Or the rifle will keep it for you." },
  "Shield Breaker": { text: 'Range 2 to 4. Deal <b class="dmg">2 damage</b> through <b class="shield">Shield</b> and all Cover.', flavor: "Read the fine print. The bullet did." },
  // The standard uses of every card: Move, Pitch and Wait.
  "Walk It Off": { text: 'Move up to <b class="energy">3 tiles</b>. Any card can be used this way.', flavor: "Mind the gap." },
  Overtime: { text: 'Discard a card. Gain <b class="energy">1 Energy</b>. Any card can be used this way.', flavor: "Time and a half. In theory." },
  Cannibalize: { text: 'Discard a card. Gain <b class="energy">1 Energy</b>. Any card can be used this way.', flavor: "Parts is parts." },
  "Trade-In": { text: 'Discard a card. Gain <b class="energy">1 Energy</b>. Any card can be used this way.', flavor: "Cards, organs, no questions asked." },
  Stakeout: { text: "Do nothing for one Tick. Needs no card.", flavor: "Patience is a firearm." },

  "Smoke Break": { text: "Do nothing for one Tick. Needs no card.", flavor: "Union rules." },
  "Idle Hands": { text: "Do nothing for one Tick. Needs no card.", flavor: "The workshop is never closed." },
};

const KEYWORD = /<b class="(\w+)">(.*?)<\/b>/g;

/** The runs of a text with `<b class="kind">` markup. */
export function parseRuns(markup: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const match of markup.matchAll(KEYWORD)) {
    if (match.index > last) runs.push(markup.slice(last, match.index));
    runs.push({ keyword: match[1] as KeywordKind, text: match[2]! });
    last = match.index + match[0].length;
  }
  if (last < markup.length) runs.push(markup.slice(last));
  return runs;
}

/** The text box of a card: the designed text and flavour, or the text of its effects. */
export function cardTextOf(card: Pick<CardDefinition, "name" | "effects">): { runs: TextRun[]; flavor: string } {
  const designed = DESIGNED[card.name];
  if (designed) return { runs: parseRuns(designed.text), flavor: designed.flavor };
  return { runs: [describeEffects(card.effects) ?? ""], flavor: "" };
}
