import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const github = path.join(import.meta.dirname, "..", "..", "..", ".github");

function yamlFiles(): string[] {
  const workflows = readdirSync(path.join(github, "workflows")).map((name) => path.join(github, "workflows", name));
  const actions = readdirSync(path.join(github, "actions")).map((name) => path.join(github, "actions", name, "action.yml"));
  return [...workflows, ...actions];
}

describe("workflow files", () => {
  // In YAML a ` #` inside a one-line plain scalar starts a comment, so `run: node x "Review #7"` is cut off after
  // `"Review` and the step fails with a shell syntax error (this broke the factory once). Use a block scalar (`run: |`).
  it.each(yamlFiles())("has no one-line run command that contains ' #': %s", (file) => {
    const offenders = readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => /^\s*(- )?run: [^|>].* #/.test(line));
    expect(offenders).toEqual([]);
  });
});

describe("visual-check rule", () => {
  const read = (...parts: string[]) => readFileSync(path.join(github, "..", ...parts), "utf8");

  it("review prompt exempts a stated gap and keeps the three failing cases", () => {
    const prompt = read(".github", "actions", "factory-review", "action.yml");
    expect(prompt).toContain("Stated gap (not a fail by itself)");
    expect(prompt).toContain("(a) any deviation visible in the screenshots");
    expect(prompt).toContain("(b) no look at all although staging was possible");
    expect(prompt).toContain("(c) an unstated gap");
    expect(prompt).toContain("brief.ownerChecks");
  });

  it("rework prompt forbids an own Playwright harness", () => {
    const prompt = read(".github", "actions", "factory-rework", "action.yml");
    expect(prompt).toContain("never write your own Playwright harness");
  });

  it("CLAUDE.md step 5 has the stated-gap and screenshot-tool-only wording", () => {
    const rules = read("CLAUDE.md");
    expect(rules).toContain("Use only that tool; do not write your own Playwright script or harness");
    expect(rules).toContain("state in the pull request exactly which state was not looked at and why, and that the owner checks it in play");
  });
});
