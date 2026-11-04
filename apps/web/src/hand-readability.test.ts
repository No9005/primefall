import { HeroClass } from "game-core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadRules } from "./css-rules";
import { MIN_STRIP } from "./hand-fan";
import { energyRect, handRect, pilesRect, waitCardRect } from "./hud-layout";
import { QueueColumn } from "./PlanningScreen";

// The Hand, its cost badges, the Energy pill, the locked cards and the Queue slots stay readable and tidy (issue 273).

const rules = loadRules(["styles.css"]);
const decls = (selector: string) => {
  const found = rules.filter((rule) => rule.selectors.includes(selector));
  if (found.length === 0) throw new Error(`No rule for ${selector}`);
  return new Map(found.flatMap((rule) => [...rule.decls]));
};
const px = (value: string | undefined) => Number(/^-?[\d.]+/.exec(value ?? "")?.[0]);

type Rgb = [number, number, number];
const tokens = new Map(rules.flatMap((rule) => [...rule.decls].filter(([name]) => name.startsWith("--"))));
const colour = (token: string): Rgb => {
  const hex = tokens.get(token.replace(/^var\((.*)\)$/, "$1"))!.replace("#", "");
  return [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16)) as Rgb;
};
const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((c) => ((c / 255) <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg: Rgb, bg: Rgb, opacity: number) => fg.map((c, k) => c * opacity + bg[k]! * (1 - opacity)) as Rgb;

describe("the cost badge of a Hand card", () => {
  const badge = decls(".hand .card-cost");

  it("sits inside the top left corner of the card, where the strip of every card shows it", () => {
    expect(px(badge.get("top"))).toBe(5);
    expect(px(badge.get("left"))).toBe(5);
    expect(badge.has("right")).toBe(false);
    expect(px(badge.get("width"))).toBe(22);
    expect(px(badge.get("height"))).toBe(22);
  });

  it("stays fully visible in the narrowest strip and inside the card, and the title does not run under it", () => {
    expect(px(badge.get("left")) + px(badge.get("width"))).toBeLessThanOrEqual(MIN_STRIP);
    expect(px(decls(".hand .card-name").get("padding-left"))).toBeGreaterThanOrEqual(30);
  });
});

describe("the type stripe of a Hand card", () => {
  it("is 3 px along the top edge in the type colour", () => {
    expect(px(decls(".hand .card::before").get("height"))).toBe(3);
    expect(decls(".hand .card.attack::before").get("background")).toBe("var(--orange)");
    expect(decls(".hand .card.utility::before").get("background")).toBe("var(--teal)");
  });
});

describe("contrast of the Hand, Energy and Queue texts", () => {
  const panel = colour("--panel");
  const graphite = colour("--graphite");

  it("is at least 4.5:1 for the Energy number and label on the pill", () => {
    expect(contrast(colour(decls(".energy-count").get("color")!), panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour(decls(".energy-label").get("color")!), panel)).toBeGreaterThanOrEqual(4.5);
  });

  it("is at least 4.5:1 for the card name and the type texts on the card", () => {
    expect(contrast(colour("--text"), graphite)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour("--orange"), graphite)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour("--teal"), graphite)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the name of a locked card at least 4.5:1 at its reduced opacity over every board colour", () => {
    const opacity = Number(decls(".card:disabled").get("opacity"));
    expect(opacity).toBeGreaterThanOrEqual(0.6);
    for (const board of ["--ink", "--graphite", "--panel", "--steel"]) {
      const behind = colour(board);
      expect(contrast(over(colour("--text"), behind, opacity), over(graphite, behind, opacity)), board).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("is at least 4.5:1 for the digit of an empty Queue slot on its fill", () => {
    const slot = decls(".queue-row.empty .queue-number");
    expect(contrast(colour(slot.get("color")!), colour(slot.get("background")!))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the Energy orbs", () => {
  it("differ by at least 1.5:1 in luminance between filled and empty", () => {
    const empty = colour(decls(".energy-dot").get("background")!);
    const full = colour(decls(".energy-dot.full").get("background")!);
    expect(contrast(full, empty)).toBeGreaterThanOrEqual(1.5);
  });
});

describe("the Wait card", () => {
  it("has the size, top edge and title of the centre Hand card", () => {
    const card = decls(".card");
    const wait = decls(".wait-card");
    expect(px(wait.get("width"))).toBe(px(card.get("width")?.replace(/^var\(--card-w, (\d+px)\)$/, "$1")));
    expect(px(card.get("height"))).toBe(134);
    expect(px(wait.get("margin-bottom"))).toBe(px(decls(".hand li").get("bottom")));
    expect(decls(".wait-card .card-name").get("font-size")).toBe(decls(".hand .card-name").get("font-size"));
  });

  for (const view of [{ width: 844, height: 390 }, { width: 667, height: 375 }, { width: 932, height: 430 }]) {
    it(`is level with the Hand at ${view.width} x ${view.height}`, () => {
      expect(waitCardRect(view).top).toBe(handRect(view).top);
    });

    it(`has the Energy pill clear of the Hand, the piles and the Wait card at ${view.width} x ${view.height}`, () => {
      const pill = energyRect(view);
      expect(pill.left).toBeGreaterThanOrEqual(pilesRect(view).right);
      expect(handRect(view).top - pill.bottom).toBeGreaterThanOrEqual(8);
      expect(pill.right).toBeLessThanOrEqual(waitCardRect(view).left);
    });
  }
});

describe("the Queue slots", () => {
  it("show the Tick numbers 1 to 4 when empty", () => {
    const html = renderToStaticMarkup(
      createElement(QueueColumn, {
        queue: [],
        heroClass: HeroClass.Bruiser,
        heroId: "ally-1",
        issues: [],
        disabled: false,
        resolutionTick: undefined,
        nameOf: (id: string) => id,
        missHints: [],
        onRemove: () => {},
      }),
    );
    const empties = [...html.matchAll(/class="queue-row empty"[^>]*><span class="queue-number"[^>]*>(\d)<\/span>/g)].map((match) => match[1]);
    expect(empties).toEqual(["1", "2", "3", "4"]);
  });

  it("are at least 32 px high", () => {
    expect(px(decls(".queue-row").get("min-height"))).toBeGreaterThanOrEqual(32);
  });
});
