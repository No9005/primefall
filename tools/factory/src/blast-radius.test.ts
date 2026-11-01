import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BlastRadius, classifyPullRequest, keepHighWhenAlreadyHigh, pathMatchesGlob, type BlastRadiusRules, type ChangedFile } from "./blast-radius.ts";

const rules = JSON.parse(readFileSync(new URL("../blast-radius-rules.json", import.meta.url), "utf8")) as BlastRadiusRules;
const file = (filename: string, additions = 5, deletions = 0): ChangedFile => ({ filename, additions, deletions });
const classify = (files: ChangedFile[], labels: string[] = []) => classifyPullRequest({ files, labels, rules });

describe("pathMatchesGlob", () => {
  it("handles **, * and exact names", () => {
    expect(pathMatchesGlob(".github/workflows/ci.yml", ".github/**")).toBe(true);
    expect(pathMatchesGlob("apps/web/package.json", "**/package.json")).toBe(true);
    expect(pathMatchesGlob("package.json", "**/package.json")).toBe(true);
    expect(pathMatchesGlob("tsconfig.base.json", "**/tsconfig*.json")).toBe(true);
    expect(pathMatchesGlob("apps/web/src/App.tsx", "**/package.json")).toBe(false);
    expect(pathMatchesGlob("docs/adr/0001.md", "docs/adr/*.md")).toBe(true);
    expect(pathMatchesGlob("docs/adr/x/0001.md", "docs/adr/*.md")).toBe(false);
  });
});

describe("classifyPullRequest", () => {
  it("is low for UI, rendering, tests and assets", () => {
    const result = classify([file("apps/web/src/Board.tsx"), file("apps/web/src/board-layout.test.ts"), file("apps/web/public/assets/tiles/floor_01.png")]);
    expect(result).toEqual({ level: BlastRadius.Low, reasons: [] });
  });

  it.each([
    ["card data", "packages/game-core/src/cards.ts"],
    ["map data", "packages/game-core/src/reactor-deck.ts"],
    ["the package exports", "packages/game-core/src/index.ts"],
    ["a test of the rules package", "packages/game-core/src/match.test.ts"],
    ["a mockup page", "docs/design/mockups.html"],
    ["a design asset", "docs/design/tools/generate_placeholders.py"],
  ])("is low when it only touches %s", (_name, filename) => {
    expect(classify([file(filename)]).level).toBe(BlastRadius.Low);
  });

  it("is not high just because it is large when no size limit is configured", () => {
    const manyLines = classify([file("apps/web/src/a.ts", 3000, 500), ...Array.from({ length: 40 }, (_, i) => file(`apps/web/src/f${i}.ts`, 1))]);
    expect(manyLines.level).toBe(BlastRadius.Low);
  });

  it.each([
    ["CLAUDE.md"],
    ["README.md"],
    ["GLOSSARY.md"],
    ["docs/adr/0021-new.md"],
    ["docs/specs/mvp-card-set.md"],
    ["docs/design/ui-spec.md"],
    ["docs/agents/issue-tracker.md"],
    [".claude/skills/to-tickets/SKILL.md"],
    [".claude/skills/pixijs/references/index.md"],
  ])("is high when it touches documentation or agent files: %s", (filename) => {
    expect(classify([file(filename)]).level).toBe(BlastRadius.High);
  });

  it.each([
    [".github/workflows/ci.yml"],
    [".github/CODEOWNERS"],
    ["tools/factory/blast-radius-rules.json"],
    ["tools/factory/src/cli.ts"],
    ["eslint.config.js"],
    ["packages/game-core/tsconfig.json"],
    ["tsconfig.base.json"],
    ["apps/web/package.json"],
    ["package-lock.json"],
  ])("is high when it touches the factory or tooling: %s", (filename) => {
    expect(classify([file(filename)]).level).toBe(BlastRadius.High);
  });

  it.each([
    ["packages/game-core/src/match.ts"],
    ["packages/game-core/src/server.ts"],
    ["packages/game-core/src/local-host.ts"],
    ["packages/game-core/src/resolve-round.ts"],
    ["packages/game-core/src/prng.ts"],
    ["packages/game-core/src/server/resolve.ts"],
  ])("is high when it touches the business logic of the rules package: %s", (filename) => {
    expect(classify([file(filename)]).level).toBe(BlastRadius.High);
  });

  it("is high when business logic changes together with card data", () => {
    const result = classify([file("packages/game-core/src/cards.ts"), file("packages/game-core/src/match.ts")]);
    expect(result.level).toBe(BlastRadius.High);
    expect(result.reasons).toHaveLength(1);
  });

  it("is high when labelled high-risk and reports every reason", () => {
    const result = classify([file("CLAUDE.md"), file(".github/workflows/ci.yml")], ["high-risk"]);
    expect(result.level).toBe(BlastRadius.High);
    expect(result.reasons).toHaveLength(3);
  });

  it("still supports optional size limits: 400 lines and 15 files are fine, one more is high", () => {
    const limited: BlastRadiusRules = { ...rules, maxChangedLines: 400, maxChangedFiles: 15 };
    const withLimits = (files: ChangedFile[]) => classifyPullRequest({ files, labels: [], rules: limited }).level;
    expect(withLimits([file("apps/web/src/a.ts", 400, 0)])).toBe(BlastRadius.Low);
    expect(withLimits([file("apps/web/src/a.ts", 300, 101)])).toBe(BlastRadius.High);
    const many = (n: number) => Array.from({ length: n }, (_, i) => file(`apps/web/src/f${i}.ts`, 1));
    expect(withLimits(many(15))).toBe(BlastRadius.Low);
    expect(withLimits(many(16))).toBe(BlastRadius.High);
  });
});

describe("keepHighWhenAlreadyHigh", () => {
  it("never lowers an existing high class", () => {
    const low = { level: BlastRadius.Low, reasons: [] };
    expect(keepHighWhenAlreadyHigh(low, true).level).toBe(BlastRadius.High);
    expect(keepHighWhenAlreadyHigh(low, false).level).toBe(BlastRadius.Low);
  });
});
