import { describe, expect, it } from "vitest";
import { loadRules, readSource } from "./css-rules";
import { HERO_STYLE } from "./hero-style";

// Text the player reads is legible (issue 268, UI spec "Text"): at least 12 px, contrast at least 4.5:1 (3:1 for large and for
// disabled or dimmed text), colours from the tokens. The CSS is read with a small tolerant parser. Anything this test cannot
// decide fails loudly, so a new rule needs a decision; what stays below the minimum is listed, with a reason, in
// text-legibility.allowlist.json, and an entry that no longer matches a violation fails too.

const MIN_SIZE = 12;
const MIN_CONTRAST = 4.5;
const MIN_CONTRAST_LARGE_OR_DIMMED = 3;
const DIMMED_SELECTOR = /:disabled|aria-disabled|\.exhausted-hud|\.past|\.used|\.resolving/;

const read = readSource;
const rules = loadRules(["styles.css", "tutorial.css", "hero-select.css"]);
const tokens = new Map<string, string>();
for (const rule of rules) {
  if (!rule.selectors.includes(":root")) continue;
  for (const [name, value] of rule.decls) if (name.startsWith("--")) tokens.set(name, value);
}

// ---- colours and contrast (WCAG 2.x) ----

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((k) => parseInt(full.slice(k, k + 2), 16)) as Rgb;
}

/** A token name ("--muted"), var(--muted) or a hex literal to a colour; undefined for values this test does not model (inherit, color-mix). */
function resolveColor(value: string): Rgb | undefined {
  const variable = /^var\((--[\w-]+)/.exec(value);
  if (variable) return resolveColor(variable[1]!);
  if (value.startsWith("--")) {
    const token = tokens.get(value);
    if (token === undefined) throw new Error(`Unknown token ${value}`);
    return resolveColor(token);
  }
  return /^#[0-9a-f]{3,6}$/i.test(value) ? parseHex(value) : undefined;
}

function luminance(color: Rgb): number {
  const [r, g, b] = color.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour of text at `opacity` over a background. */
function mix(fg: Rgb, bg: Rgb, opacity: number): Rgb {
  return fg.map((c, k) => c * opacity + bg[k]! * (1 - opacity)) as Rgb;
}

describe("the contrast helper", () => {
  it("gives 21:1 for black on white and 1:1 for equal colours", () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([9, 9, 9], [9, 9, 9])).toBe(1);
  });
});

// ---- text facts of a rule ----

function textSize(decls: Map<string, string>): { size?: number; bold: boolean } {
  const shorthand = /^(?:(?:italic|normal)\s+)?(?:(\d{3}|bold|normal)\s+)?(\d+(?:\.\d+)?)px/.exec(decls.get("font") ?? "");
  const sizeValue = /^(\d+(?:\.\d+)?)px$/.exec(decls.get("font-size") ?? "");
  const weight = decls.get("font-weight") ?? shorthand?.[1] ?? "400";
  return {
    size: sizeValue ? Number(sizeValue[1]) : shorthand ? Number(shorthand[2]) : undefined,
    bold: weight === "bold" || Number(weight) >= 700,
  };
}

const isLarge = (size: number | undefined, bold: boolean) => size !== undefined && (size >= 24 || (bold && size >= 18.66));

// ---- the surface a text sits on, by selector (first match wins); a text rule without one fails ----

const SURFACES: [RegExp, string][] = [
  [/^\.end-screen button$|^\.commit$|^\.queue-number|^\.hand \.card-use$|^\.drop-chip\.active$|^\.pull-card\.card \.card-cost$|^\.hand \.card-cost$|^\.tutorial-controls button\.primary$|^\.tutorial-hero|^\.tutorial-counter$|^\.hs-start$/, "--teal"],
  // The Hero Select: the card list is a panel; the rest stands on the graphite screen.
  [/^\.hs-card|^\.hs-close$/, "--panel"],
  [/^\.hs-/, "--graphite"],
  [/^\.od-marker$/, "--overdrive"],
  [/^\.energy\.drop-lit\.active/, "--orange"],
  [/^\.commit\.resolving:disabled$|^\.commit:disabled$|^\.commentary-entry|^\.energy|^\.pitch-undo|^\.queue-|^\.deck-count$|^\.drop-chip|^\.tutorial-controls button|^\.tutorial-progress$/, "--panel"],
  [/^\.resolution-bar$|^\.prime-|^\.zone-dot|^\.zone-note|^\.timer-|^\.cover-chip|^\.floating-|^\.callout|^\.burn-minus$/, "--ink"],
  [/^body$|^\.end-screen|^\.rotate-notice|^\.pile-minor$|^\.piles\.resolving \.pile-minor$|^\.pull-|^\.face-|^\.use-reason$|^\.card|^\.hand|^\.mode-note$|^\.tutorial|^\.wait-card$|^\.deck-skull$/, "--graphite"],
];

function surfaceFor(selector: string): string | undefined {
  return SURFACES.find(([pattern]) => pattern.test(selector))?.[1];
}

// ---- opacity: which text each dimmed surface carries (text colour token, surface token) ----

const CARD_TEXTS: [string, string][] = [["--text", "--graphite"], ["--text-soft", "--graphite"], ["--orange", "--graphite"]];

const DIMMED: Record<string, { texts: [string, string][] }> = {
  ".piles.resolving .pile-minor": { texts: [["--muted", "--graphite"]] },
  ".piles.resolving .deck-count": { texts: [["--text", "--panel"]] },
  ".exhausted-hud": { texts: [["--muted", "--graphite"], ["--text", "--panel"], ...CARD_TEXTS] },
  // Only committed (valid) rows become past, so no red reason text is dimmed here.
  ".queue-row.past": { texts: [["--text", "--panel"], ["--muted-light", "--panel"]] },
  '.pull-face[aria-disabled="true"]': { texts: [["--red-text", "--graphite"], ...CARD_TEXTS] },
  ".card.used": { texts: CARD_TEXTS },
  ".card.used:disabled": { texts: CARD_TEXTS },
  ".card:disabled": { texts: CARD_TEXTS },
  ".card.mode-face:disabled": { texts: CARD_TEXTS },
  ".queue-remove:disabled": { texts: [["--text", "--panel"]] },
  ".pitch-undo:disabled": { texts: [["--orange", "--panel"]] },
  ".drop-chip.off": { texts: [["--muted", "--panel"]] },
  ".tutorial-controls button:disabled": { texts: [["--text", "--panel"]] },
};

/** Opacity below 1 that is not about dimmed text: invisible on purpose, a decoration, or set per element. */
const OPACITY_EXEMPT: Record<string, string> = {
  ".callout-word, .callout-number": "animated from invisible, fades in",
  ".card.lifted": "the lifted card is shown big elsewhere; its place in the fan is empty",
  ".hand.collapsed li": "hidden while a target is picked",
  ".hand li": "per-card dimming while another card is in use (otherOpacity); that card is not the focus",
  ".card-back": "card back graphic without text",
  ".burn-card": "animation graphic without text",
  ".burn-flame": "animation graphic without text",
  ".burn-ember": "animation graphic without text",
  ".burn-minus": "animation, fades out",
  ".shuffle-card": "animation graphic without text",
  ".shuffle-flash": "animation graphic without text",
  ".hand.drawing .card:disabled": "full opacity while cards are drawn",
};

// ---- the allowlist ----

interface AllowEntry {
  selector: string;
  check: "size" | "contrast" | "hex";
  reason: string;
}
const allowlist = JSON.parse(read("text-legibility.allowlist.json")) as AllowEntry[];

// ---- collecting violations ----

interface Violation {
  selector: string;
  check: AllowEntry["check"];
  detail: string;
}

function checkPair(selector: string, fg: Rgb, bg: Rgb, opacity: number, large: boolean, dimmed: boolean): Violation | undefined {
  const needed = large || dimmed ? MIN_CONTRAST_LARGE_OR_DIMMED : MIN_CONTRAST;
  const value = contrast(mix(fg, bg, opacity), bg);
  return value < needed ? { selector, check: "contrast", detail: `${value.toFixed(2)}:1 < ${needed}:1` } : undefined;
}

function cssViolations(): Violation[] {
  const found: Violation[] = [];
  const undecided: string[] = [];
  for (const rule of rules) {
    for (const selector of rule.selectors) {
      if (selector === ":root") continue;
      const { size, bold } = textSize(rule.decls);
      if (size !== undefined && size < MIN_SIZE) found.push({ selector, check: "size", detail: `${size}px < ${MIN_SIZE}px` });

      const colorValue = rule.decls.get("color");
      if (colorValue !== undefined && colorValue.startsWith("#")) found.push({ selector, check: "hex", detail: `hex colour ${colorValue}, use a token` });
      const fg = colorValue === undefined ? undefined : resolveColor(colorValue);
      if (fg) {
        const surface = surfaceFor(selector);
        if (surface === undefined) undecided.push(`${selector}: no surface in SURFACES`);
        const violation = surface === undefined ? undefined : checkPair(selector, fg, resolveColor(surface)!, 1, isLarge(size, bold), DIMMED_SELECTOR.test(selector));
        if (violation) found.push(violation);
      }

      const opacityValue = rule.decls.get("opacity");
      const opacity = Number(opacityValue);
      if (opacityValue !== undefined && !(opacity >= 1)) {
        const dimmed = DIMMED[selector];
        const exempt = OPACITY_EXEMPT[rule.selectors.join(", ")] ?? OPACITY_EXEMPT[selector];
        if (!dimmed && exempt === undefined) undecided.push(`${selector}: opacity ${opacityValue} not in DIMMED or OPACITY_EXEMPT`);
        for (const [text, surface] of dimmed?.texts ?? []) {
          const violation = checkPair(selector, resolveColor(text)!, resolveColor(surface)!, opacity, false, true);
          if (violation) found.push({ ...violation, detail: `${text} on ${surface} at opacity ${opacityValue}: ${violation.detail}` });
        }
      }
    }
  }
  if (undecided.length > 0) throw new Error(`Rules without a decision in text-legibility.test.ts:\n${undecided.join("\n")}`);
  return found;
}

/** Pixi texts: font sizes in the source files; a world-space size is multiplied by the figure scale F. */
function pixiViolations(): Violation[] {
  const found: Violation[] = [];
  for (const [name, size] of [["tickText", HERO_STYLE.marks.tickText.size], ["waitBadge", HERO_STYLE.marks.waitBadge.size]] as const) {
    if (size < MIN_SIZE) found.push({ selector: `pixi ${name}`, check: "size", detail: `${size}px` });
  }
  for (const file of ["Board.tsx", "effects-layer.ts"]) {
    for (const line of read(file).split("\n")) {
      const match = /fontSize: ([\d.]+)( \* F)?/.exec(line);
      if (!match) continue;
      const size = Number(match[1]) * (match[2] ? HERO_STYLE.figureScale : 1);
      const text = /text: "([^"]*)"/.exec(line)?.[1] || "(set later)";
      if (size < MIN_SIZE) found.push({ selector: `pixi ${file} "${text}"`, check: "size", detail: `${size.toFixed(1)}px before the camera scale` });
    }
  }
  return found;
}

const allViolations = [...cssViolations(), ...pixiViolations()];
const key = (v: { selector: string; check: string }) => `${v.check} ${v.selector}`;

describe("text legibility", () => {
  it("has no violation that is not on the allowlist", () => {
    const allowed = new Set(allowlist.map(key));
    const open = allViolations.filter((v) => !allowed.has(key(v)));
    expect(open.map((v) => `${key(v)}: ${v.detail}`)).toEqual([]);
  });

  it("has a reason for every allowlist entry, and no entry that matches nothing", () => {
    for (const entry of allowlist) expect(entry.reason.trim(), key(entry)).not.toBe("");
    const violated = new Set(allViolations.map(key));
    expect(allowlist.filter((entry) => !violated.has(key(entry))).map(key)).toEqual([]);
  });

  it("keeps the Pixi Tick and Wait texts at 12 px or more", () => {
    expect(HERO_STYLE.marks.tickText.size).toBeGreaterThanOrEqual(MIN_SIZE);
    expect(HERO_STYLE.marks.waitBadge.size).toBeGreaterThanOrEqual(MIN_SIZE);
  });
});
