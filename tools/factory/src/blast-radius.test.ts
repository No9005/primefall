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
  it("is low for ordinary UI, test and asset changes", () => {
    const result = classify([file("apps/web/src/Board.tsx"), file("apps/web/src/board-layout.test.ts"), file("apps/web/public/assets/tiles/floor_01.png")]);
    expect(result).toEqual({ level: BlastRadius.Low, reasons: [] });
  });

  it.each([
    [".github/workflows/ci.yml"],
    ["CLAUDE.md"],
    ["docs/agents/issue-tracker.md"],
    ["tools/factory/blast-radius-rules.json"],
    ["eslint.config.js"],
    ["packages/game-core/tsconfig.json"],
    ["apps/web/package.json"],
    ["package-lock.json"],
  ])("is high when it touches factory or tooling: %s", (filename) => {
    expect(classify([file(filename)]).level).toBe(BlastRadius.High);
  });

  it.each([["docs/adr/0021-new.md"], ["docs/specs/offline-mvp-prototype.md"], ["GLOSSARY.md"]])("is high when it touches decisions and contracts: %s", (filename) => {
    expect(classify([file(filename)]).level).toBe(BlastRadius.High);
  });

  it.each([["packages/game-core/src/server.ts"], ["packages/game-core/src/server/resolve-round.ts"], ["packages/game-core/src/prng.ts"], ["packages/game-core/src/resolve-round.ts"], ["packages/game-core/src/match-state.ts"]])(
    "is high when it touches the simulation core: %s",
    (filename) => {
      expect(classify([file(filename)]).level).toBe(BlastRadius.High);
    },
  );

  it("is low for other game-core files such as the map", () => {
    expect(classify([file("packages/game-core/src/reactor-deck.ts")]).level).toBe(BlastRadius.Low);
  });

  it("treats 400 changed lines as low and 401 as high", () => {
    expect(classify([file("apps/web/src/a.ts", 400, 0)]).level).toBe(BlastRadius.Low);
    expect(classify([file("apps/web/src/a.ts", 300, 101)]).level).toBe(BlastRadius.High);
  });

  it("treats 15 changed files as low and 16 as high", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => file(`apps/web/src/f${i}.ts`, 1));
    expect(classify(many(15)).level).toBe(BlastRadius.Low);
    expect(classify(many(16)).level).toBe(BlastRadius.High);
  });

  it("is high when labelled high-risk and reports every reason", () => {
    const result = classify([file("CLAUDE.md"), file("docs/adr/0001-x.md")], ["high-risk"]);
    expect(result.level).toBe(BlastRadius.High);
    expect(result.reasons).toHaveLength(3);
  });
});

describe("keepHighWhenAlreadyHigh", () => {
  it("never lowers an existing high class", () => {
    const low = { level: BlastRadius.Low, reasons: [] };
    expect(keepHighWhenAlreadyHigh(low, true).level).toBe(BlastRadius.High);
    expect(keepHighWhenAlreadyHigh(low, false).level).toBe(BlastRadius.Low);
  });
});
