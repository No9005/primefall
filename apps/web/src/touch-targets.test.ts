import ts from "typescript";
import { describe, expect, it } from "vitest";
import { computeCamera, gridToWorld, pickTileAt, resolveTap, viewToWorld, zoomAt } from "./board-layout";
import { type DropLayout, type DropPlaces, type Point, probeDrop } from "./card-drag";
import { loadRules, readSource } from "./css-rules";
import { MIN_STRIP } from "./hand-fan";
import { commitButtonRect, energyPillRect, handRect, QUEUE_COLUMN_WIDTH, waitCardRect } from "./hud-layout";
import { CardUse } from "./planning-selection";

// Touch targets have a minimum size in screen pixels, whatever the board is fitted to (issue 148).

const allowed: Record<CardUse, string | undefined> = {
  [CardUse.Primary]: undefined,
  [CardUse.Pitch]: undefined,
  [CardUse.Move]: undefined,
  [CardUse.Block]: undefined,
};

describe("minimum touch size of Heroes", () => {
  const hero = { id: "ally", position: { col: 10, row: 8 } };
  const candidates = { heroes: [hero], targetableIds: ["ally"], highlights: [] };

  for (const view of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
    it(`picks a Hero 15 px away on screen but not one 40 px away at ${view.width} x ${view.height}, fitted, zoomed out and zoomed in`, () => {
      const fitted = computeCamera(view.width, view.height);
      // The zoom cannot go below the fitted scale, so asking for less gives the fitted camera again.
      const zoomedOut = zoomAt(fitted, fitted.scale * 0.5, view.width / 2, view.height / 2, view);
      const zoomedIn = zoomAt(fitted, fitted.scale * 2, view.width / 2, view.height / 2, view);
      for (const camera of [fitted, zoomedOut, zoomedIn]) {
        const centre = gridToWorld(hero.position);
        const screen = { x: centre.x * camera.scale + camera.x, y: centre.y * camera.scale + camera.y };
        const tapAt = (dx: number) => {
          const { x, y } = viewToWorld(screen.x + dx, screen.y, view.width, view.height, undefined, camera);
          return resolveTap(x, y, candidates, undefined, undefined, camera.scale);
        };
        expect(tapAt(15)).toEqual({ kind: "hero", id: "ally" });
        expect(tapAt(-15)).toEqual({ kind: "hero", id: "ally" });
        expect(tapAt(40).kind).toBe("none");
      }
    });
  }
});

describe("minimum touch size of tiles and card drops", () => {
  const tile = { col: 10, row: 8 };
  const view = { width: 844, height: 390 };
  const camera = computeCamera(view.width, view.height);
  const bottomCorner = gridToWorld({ col: tile.col + 0.5, row: tile.row + 0.5 });
  const below = (px: number): Point => ({ x: bottomCorner.x * camera.scale + camera.x, y: bottomCorner.y * camera.scale + camera.y + px });
  const highlights = [tile];

  it("picks a highlighted tile within 22 px of its floor and none farther away", () => {
    const tapBelow = (px: number) => {
      const { x, y } = viewToWorld(below(px).x, below(px).y, view.width, view.height, undefined, camera);
      return resolveTap(x, y, { heroes: [], targetableIds: [], highlights }, undefined, undefined, camera.scale);
    };
    expect(tapBelow(15)).toEqual({ kind: "tile", tile });
    expect(tapBelow(40)).toEqual({ kind: "none" });
  });

  const layout: DropLayout = {
    board: { left: 0, top: 0, right: view.width, bottom: view.height },
    blockChip: { left: -10, top: -10, right: -5, bottom: -5 },
    energyOrb: { left: -10, top: -10, right: -5, bottom: -5 },
    hud: [],
    pickBoard: (point) => {
      const { x, y } = viewToWorld(point.x, point.y, view.width, view.height, undefined, camera);
      return { target: resolveTap(x, y, { heroes: [], targetableIds: [], highlights }, undefined, undefined, camera.scale), ground: pickTileAt(x, y) };
    },
  };
  const places: DropPlaces = { selfId: "ally", heroIds: [], primaryTiles: [], moveTiles: [tile], here: undefined };

  it("plays Move to the tile when dropped 15 px beside it, and shows that tile; far from any tile it cancels", () => {
    const probe = probeDrop(below(15), layout, places, allowed, "USE");
    expect(probe.drop).toEqual({ use: CardUse.Move, tile });
    expect(probe.label).toBe("MOVE 2");
    expect(probeDrop(below(80), layout, places, allowed, "USE").drop).toBeUndefined();
  });
});

// ---- Touch target tiers (issue 268, UI spec "Touch targets") ----
// Primary controls are at least 40 x 40 px; secondary, dense controls at least 32 x 32 px with 8 px between neighbours;
// nothing tappable is smaller than 24 x 24 px. Every interactive element of the screens is listed here with its tier; an
// interactive element that is not listed fails, so a new button needs a decision. Sizes come from the style sheet, or from
// hud-layout.ts where the layout fixes them. What is below its tier is in touch-targets.allowlist.json with a reason.

type Tier = "primary" | "secondary";
const TIER_MIN: Record<Tier, number> = { primary: 40, secondary: 32 };
const FLOOR = 24;
const SECONDARY_GAP = 8;

interface Size {
  width: number;
  height: number;
}

interface JsxMatch {
  file: string;
  includes: string;
}

interface Target {
  name: string;
  /** `{ none }`: not something the player taps by itself; the reason says why. */
  tier: Tier | { none: string };
  /** The rule in styles.css or tutorial.css that sizes the element. */
  selector?: string;
  /** Sizes the style sheet does not give (text-sized or set by the layout), per view. */
  size?: (view: { width: number; height: number }) => Partial<Size>;
  /** The rule whose `gap` separates neighbouring targets of this kind. */
  gapIn?: string;
  /** The JSX elements (file and a string in the opening tag) that are this target. */
  jsx?: JsxMatch[];
}

const wide = (rect: { left: number; right: number }) => rect.right - rect.left;
const high = (rect: { top: number; bottom: number }) => rect.bottom - rect.top;

const TARGETS: Target[] = [
  { name: "Commit", tier: "primary", selector: ".commit", size: (view) => ({ width: wide(commitButtonRect(view)) }), jsx: [{ file: "PlanningScreen.tsx", includes: "className={`commit" }] },
  { name: "Card face", tier: "primary", selector: ".pull-face", jsx: [{ file: "game-parts.tsx", includes: "pull-face" }] },
  { name: "Hand card", tier: "primary", size: (view) => ({ width: MIN_STRIP, height: high(handRect(view)) }), jsx: [{ file: "PlanningScreen.tsx", includes: "className={`card ${card.type}" }] },
  { name: "Wait card", tier: "primary", size: (view) => ({ width: wide(waitCardRect(view)), height: high(waitCardRect(view)) }), jsx: [{ file: "PlanningScreen.tsx", includes: "wait-card" }] },
  { name: "Queue remove button", tier: "primary", selector: ".queue-remove", jsx: [{ file: "PlanningScreen.tsx", includes: "queue-remove" }] },
  { name: "Energy pill", tier: "primary", selector: ".energy", size: (view) => ({ width: wide(energyPillRect(view)) }) },
  // "Undo Pitch" at 12 px is well over 60 px wide.
  { name: "Undo Pitch button", tier: "secondary", selector: ".pitch-undo", size: () => ({ width: 60 }), jsx: [{ file: "PlanningScreen.tsx", includes: "pitch-undo" }] },
  { name: "Queue row", tier: "secondary", selector: ".queue-row", size: () => ({ width: QUEUE_COLUMN_WIDTH }), gapIn: ".queue-rows" },
  { name: "Block drop chip", tier: "secondary", selector: ".drop-chip" },
  { name: "Floating card", tier: "primary", selector: ".floating-card", jsx: [{ file: "game-parts.tsx", includes: "floating-card" }] },
  { name: "Mode face card", tier: "primary", selector: ".card.mode-face", jsx: [{ file: "game-parts.tsx", includes: "mode-face" }] },
  // The padding of the end-screen buttons is 24 px on each side of the label.
  { name: "Start and end screen button", tier: "primary", selector: ".end-screen button", size: () => ({ width: 48 }), jsx: [{ file: "App.tsx", includes: "<button" }, { file: "EndScreen.tsx", includes: "<button" }] },
  { name: "Tutorial control", tier: "primary", selector: ".tutorial-controls button", jsx: ["tutorial-back", "tutorial-play", "tutorial-skip", "tutorial-exit"].map((includes) => ({ file: "TutorialScreen.tsx", includes })) },
  { name: "Tutorial demo card", tier: { none: "a moving picture of a card, tabIndex -1, no handler" }, jsx: [{ file: "TutorialScreen.tsx", includes: "tutorial-card" }] },
  { name: "Pull backdrop", tier: { none: "the whole view behind the pulled card; a tap anywhere outside the card closes it" }, jsx: [{ file: "game-parts.tsx", includes: "pull-backdrop" }] },
];

const styleRules = loadRules(["styles.css", "tutorial.css"]);

/** The declarations of the rules with exactly this selector, merged in source order. */
function declarationsOf(selector: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const rule of styleRules) if (rule.selectors.includes(selector)) for (const [name, value] of rule.decls) merged.set(name, value);
  if (merged.size === 0) throw new Error(`No rule "${selector}" in the style sheets`);
  return merged;
}

const px = (value: string | undefined) => {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value ?? "");
  return match ? Number(match[1]) : undefined;
};

interface TierViolation {
  target: string;
  check: "size" | "floor" | "gap";
  detail: string;
}

function tierViolations(): TierViolation[] {
  const found: TierViolation[] = [];
  for (const view of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
    for (const target of TARGETS) {
      if (typeof target.tier !== "string") continue;
      const decls = target.selector ? declarationsOf(target.selector) : new Map<string, string>();
      const given = target.size?.(view) ?? {};
      const width = given.width ?? px(decls.get("width")) ?? px(decls.get("min-width"));
      const height = given.height ?? px(decls.get("height")) ?? px(decls.get("min-height"));
      if (width === undefined || height === undefined) throw new Error(`The size of "${target.name}" is not known: give a width and a height in the style sheet or in its entry`);
      const at = `at ${view.width} x ${view.height}: ${width} x ${height} px`;
      const needed = TIER_MIN[target.tier];
      if (width < needed || height < needed) found.push({ target: target.name, check: "size", detail: `${at}, ${target.tier} needs ${needed} x ${needed}` });
      if (width < FLOOR || height < FLOOR) found.push({ target: target.name, check: "floor", detail: `${at}, the floor is ${FLOOR} x ${FLOOR}` });
      if (target.tier === "secondary" && target.gapIn) {
        const gap = px(declarationsOf(target.gapIn).get("gap"));
        if (gap === undefined) throw new Error(`No gap in "${target.gapIn}" for "${target.name}"`);
        if (gap < SECONDARY_GAP) found.push({ target: target.name, check: "gap", detail: `${gap} px between neighbours, secondary needs ${SECONDARY_GAP}` });
      }
    }
  }
  return found;
}

/** Every JSX element that takes input: a button, role="button", or one with a click or pointer-down handler. */
function interactiveElements(file: string): string[] {
  const tree = ts.createSourceFile(file, readSource(file), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const text = node.getText(tree);
      const attributes = node.attributes.properties.map((p) => (ts.isJsxAttribute(p) ? p.name.getText(tree) : ""));
      const isButton = node.tagName.getText(tree) === "button";
      if (isButton || text.includes('role="button"') || attributes.includes("onClick") || attributes.includes("onPointerDown")) found.push(text);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

const SCREEN_FILES = ["PlanningScreen.tsx", "TutorialScreen.tsx", "EndScreen.tsx", "App.tsx", "game-parts.tsx"];

describe("touch target tiers", () => {
  const allowlist = JSON.parse(readSource("touch-targets.allowlist.json")) as { target: string; check: string; reason: string }[];
  const key = (v: { target: string; check: string }) => `${v.check} ${v.target}`;
  const violations = tierViolations();

  it("has no target below its tier that is not on the allowlist", () => {
    const allowed = new Set(allowlist.map(key));
    expect(violations.filter((v) => !allowed.has(key(v))).map((v) => `${key(v)} ${v.detail}`)).toEqual([]);
  });

  it("has a reason for every allowlist entry, and no entry that matches nothing", () => {
    for (const entry of allowlist) expect(entry.reason.trim(), key(entry)).not.toBe("");
    const violated = new Set(violations.map(key));
    expect(allowlist.filter((entry) => !violated.has(key(entry))).map(key)).toEqual([]);
  });

  it("lists every interactive element of the screens with a tier", () => {
    const listed = TARGETS.flatMap((target) => target.jsx ?? []);
    const used = new Set<JsxMatch>();
    const unlisted: string[] = [];
    for (const file of SCREEN_FILES) {
      for (const element of interactiveElements(file)) {
        const entry = listed.find((jsx) => jsx.file === file && element.includes(jsx.includes));
        if (entry) used.add(entry);
        else unlisted.push(`${file}: ${element.replace(/\s+/g, " ").slice(0, 100)}`);
      }
    }
    expect(unlisted).toEqual([]);
    expect(listed.filter((jsx) => !used.has(jsx)).map((jsx) => `${jsx.file} ${jsx.includes}`)).toEqual([]);
  });
});
